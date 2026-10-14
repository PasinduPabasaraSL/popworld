#!/usr/bin/env python3
"""
Stage 1: Fetch Top Movies & TV Series from TMDB API into a Resumable SQLite Cache.

Usage:
  export TMDB_API_KEY="your_tmdb_v3_api_key"
  python3 pipeline/01_fetch_tmdb.py --movies 25000 --tv 15000

Features:
- Downloads TMDB daily ID exports for both `movie_ids` and `tv_series_ids`.
- Selects the top N movies and top M TV series by popularity.
- Fetches full details + keywords + credits in a single call per item using
  `append_to_response=keywords,credits`.
- Normalizes TV compound genres (e.g. "Action & Adventure" -> ["Action", "Adventure"],
  "Sci-Fi & Fantasy" -> ["Science Fiction", "Fantasy"]) so Movies and TV Series share
  a unified genre taxonomy.
- Stores everything in `pipeline/tmdb_cache.sqlite` with rate-limiting and
  automatic resume on interruption.
"""

import argparse
import datetime
import gzip
import io
import json
import os
import sqlite3
import time
from typing import Dict, List, Tuple
import requests

DB_PATH = os.path.join(os.path.dirname(__file__), "tmdb_cache.sqlite")

TV_GENRE_SPLIT_MAP: Dict[str, List[str]] = {
    "Action & Adventure": ["Action", "Adventure"],
    "Sci-Fi & Fantasy": ["Science Fiction", "Fantasy"],
    "War & Politics": ["War", "History"],
    "Soap": ["Drama", "Romance"],
    "Kids": ["Family", "Animation"],
    "News": ["Documentary"],
    "Reality": ["Documentary"],
    "Talk": ["Comedy"],
}


def init_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS media (
            uid TEXT PRIMARY KEY,
            tmdb_id INTEGER NOT NULL,
            media_type TEXT NOT NULL,
            title TEXT NOT NULL,
            year INTEGER,
            language TEXT,
            genres TEXT,
            keywords TEXT,
            cast_names TEXT,
            creator TEXT,
            rating REAL,
            popularity REAL,
            runtime INTEGER,
            seasons INTEGER,
            poster TEXT,
            overview TEXT,
            fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    conn.commit()


def download_daily_export(export_prefix: str, target_count: int) -> List[int]:
    """Download TMDB's daily gzipped JSONL export and return top IDs by popularity."""
    for days_back in range(1, 5):
        dt = datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=days_back)
        date_str = dt.strftime("%m_%d_%Y")
        url = f"http://files.tmdb.org/p/exports/{export_prefix}_{date_str}.json.gz"
        print(f"Checking daily export: {url}")
        resp = requests.get(url, timeout=60)
        if resp.status_code == 200:
            items: List[Tuple[float, int]] = []
            with gzip.GzipFile(fileobj=io.BytesIO(resp.content)) as gz:
                for raw_line in gz:
                    try:
                        obj = json.loads(raw_line.decode("utf-8"))
                        if obj.get("adult"):
                            continue
                        items.append((float(obj.get("popularity") or 0.0), int(obj["id"])))
                    except Exception:
                        continue
            items.sort(reverse=True)
            return [tmdb_id for _, tmdb_id in items[:target_count]]
    raise RuntimeError(f"Could not download TMDB daily export for {export_prefix}")


def normalize_genres(raw_genres: List[Dict], media_type: str) -> List[str]:
    out: List[str] = []
    for g in raw_genres:
        name = g.get("name", "").strip()
        if not name:
            continue
        if media_type == "tv" and name in TV_GENRE_SPLIT_MAP:
            for mapped in TV_GENRE_SPLIT_MAP[name]:
                if mapped not in out:
                    out.append(mapped)
        elif name not in out:
            out.append(name)
    return out


def fetch_item(session: requests.Session, api_key: str, media_type: str, tmdb_id: int) -> Dict | None:
    url = f"https://api.themoviedb.org/3/{media_type}/{tmdb_id}"
    params = {"api_key": api_key, "append_to_response": "keywords,credits", "language": "en-US"}
    resp = session.get(url, params=params, timeout=20)
    if resp.status_code == 429:
        retry_after = float(resp.headers.get("Retry-After", "2"))
        time.sleep(retry_after + 0.5)
        resp = session.get(url, params=params, timeout=20)
    if resp.status_code != 200:
        return None

    data = resp.json()
    title = data.get("title") if media_type == "movie" else data.get("name")
    if not title:
        return None

    date_field = data.get("release_date") if media_type == "movie" else data.get("first_air_date")
    year = int(date_field[:4]) if date_field and len(date_field) >= 4 and date_field[:4].isdigit() else None

    genres = normalize_genres(data.get("genres") or [], media_type)

    kw_block = data.get("keywords") or {}
    kw_list = kw_block.get("keywords") if media_type == "movie" else kw_block.get("results")
    keywords = [k["name"].lower().strip() for k in (kw_list or []) if k.get("name")]

    credits = data.get("credits") or {}
    cast = [c["name"] for c in (credits.get("cast") or [])[:5] if c.get("name")]

    creator = ""
    if media_type == "movie":
        for crew_member in credits.get("crew") or []:
            if crew_member.get("job") == "Director" and crew_member.get("name"):
                creator = crew_member["name"]
                break
    else:
        created_by = data.get("created_by") or []
        if created_by and created_by[0].get("name"):
            creator = created_by[0]["name"]
        else:
            for crew_member in credits.get("crew") or []:
                if crew_member.get("job") in ("Executive Producer", "Series Director") and crew_member.get("name"):
                    creator = crew_member["name"]
                    break

    runtime = data.get("runtime") if media_type == "movie" else (
        (data.get("episode_run_time") or [None])[0]
    )
    seasons = data.get("number_of_seasons") if media_type == "tv" else None

    return {
        "uid": f"{media_type}_{tmdb_id}",
        "tmdb_id": tmdb_id,
        "media_type": media_type,
        "title": title,
        "year": year,
        "language": data.get("original_language") or "en",
        "genres": json.dumps(genres),
        "keywords": json.dumps(keywords[:20]),
        "cast_names": json.dumps(cast),
        "creator": creator,
        "rating": float(data.get("vote_average") or 0.0),
        "popularity": float(data.get("popularity") or 0.0),
        "runtime": int(runtime) if runtime else None,
        "seasons": int(seasons) if seasons else None,
        "poster": data.get("poster_path") or "",
        "overview": (data.get("overview") or "").strip(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch TMDB Movies & TV Series into SQLite.")
    parser.add_argument("--movies", type=int, default=25000, help="Number of top movies to fetch")
    parser.add_argument("--tv", type=int, default=15000, help="Number of top TV series to fetch")
    args = parser.parse_args()

    api_key = os.environ.get("TMDB_API_KEY", "").strip()
    if not api_key:
        raise SystemExit("Error: Set TMDB_API_KEY environment variable before running 01_fetch_tmdb.py")

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    existing = {row[0] for row in conn.execute("SELECT uid FROM media")}
    print(f"SQLite cache currently has {len(existing):,} items.")

    movie_ids = download_daily_export("movie_ids", args.movies)
    tv_ids = download_daily_export("tv_series_ids", args.tv)

    queue: List[Tuple[str, int]] = (
        [("movie", mid) for mid in movie_ids if f"movie_{mid}" not in existing]
        + [("tv", tid) for tid in tv_ids if f"tv_{tid}" not in existing]
    )
    print(f"Remaining items to fetch: {len(queue):,}")

    session = requests.Session()
    for idx, (mtype, tid) in enumerate(queue, 1):
        rec = fetch_item(session, api_key, mtype, tid)
        if rec:
            conn.execute(
                """
                INSERT OR REPLACE INTO media
                (uid, tmdb_id, media_type, title, year, language, genres, keywords,
                 cast_names, creator, rating, popularity, runtime, seasons, poster, overview)
                VALUES (:uid, :tmdb_id, :media_type, :title, :year, :language, :genres, :keywords,
                        :cast_names, :creator, :rating, :popularity, :runtime, :seasons, :poster, :overview)
                """,
                rec,
            )
            if idx % 50 == 0:
                conn.commit()
                print(f"[{idx:,}/{len(queue):,}] Cached {rec['uid']} ({rec['title']})")
        time.sleep(0.03)  # ~33 req/sec, well under TMDB's ~40-50 req/sec limit

    conn.commit()
    conn.close()
    print("Done fetching TMDB Movies + TV Series cache.")


if __name__ == "__main__":
    main()
