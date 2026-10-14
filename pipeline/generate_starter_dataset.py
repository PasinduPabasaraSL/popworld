#!/usr/bin/env python3
"""
Builds the Maximum 80,000-title Cross-Media Movies + TV Series Vector Dataset
(`public/data/media_points.json.gz` and `public/data/cluster_labels.json`):
  - ~36,537 real Feature Films (all non-adult films from the TMDB 626-D UMAP dataset)
    with authentic UMAP coordinates, HDBSCAN clusters, and TMDB posters.
  - ~43,463 real TV Series fetched concurrently across 215 pages of the TVMaze API
    with real portrait posters (`https://static.tvmaze.com/...jpg`), projected onto
    the shared UMAP manifold via k-NN semantic barycentric interpolation (`cKDTree`).
  - Computes 20 cross-media nearest neighbors (`similar` array) for all 80,000 items.
  - Exports `public/data/media_points.json.gz` (compressed with gzip so 80,000 titles
    take only ~11-13 MB in Git and on Vercel Edge CDN).
"""

import concurrent.futures
import gzip
import html
import json
import os
import random
import re
import urllib.parse
import urllib.request
from collections import Counter
from typing import Dict, List, Tuple

import numpy as np
from scipy.spatial import cKDTree

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public", "data")

FLAGSHIP_TV_QUERIES = [
    "Severance", "Breaking Bad", "Better Call Saul", "The Sopranos", "The Wire",
    "Succession", "The Bear", "Stranger Things", "Dark", "Mindhunter",
    "True Detective", "Arcane", "Attack on Titan", "Chernobyl", "Band of Brothers",
    "Andor", "Game of Thrones", "House of the Dragon", "The Boys", "The Office",
    "Parks and Recreation", "Fleabag", "Ted Lasso", "Black Mirror", "Mr. Robot",
    "The Haunting of Hill House", "Midnight Mass", "Peaky Blinders", "Narcos",
    "Fargo", "Slow Horses", "The Americans", "The White Lotus", "Shogun",
    "Normal People", "Cowboy Bebop", "Fullmetal Alchemist: Brotherhood",
    "Cyberpunk: Edgerunners", "Daredevil", "Invincible", "Watchmen", "Bluey",
    "Gravity Falls", "Over the Garden Wall", "Planet Earth II", "Blue Planet II",
    "Cosmos: A Spacetime Odyssey", "The Last Dance", "Making a Murderer",
    "The Jinx", "Avatar: The Last Airbender", "Westworld", "The Expanse",
    "Battlestar Galactica", "Foundation", "Mare of Easttown", "Twin Peaks",
    "Mad Men", "Six Feet Under", "The Leftovers", "Lost", "Hannibal",
    "Sherlock", "Luther", "Broadchurch", "Line of Duty", "Happy Valley",
    "Squid Game", "Kingdom", "Pachinko", "Money Heist", "Lupin", "Babylon Berlin",
    "The Bureau", "Gomorrah", "Sacred Games", "Death Note", "Monster",
    "Neon Genesis Evangelion", "Steins;Gate", "Vinland Saga", "Jujutsu Kaisen",
    "Demon Slayer", "Chainsaw Man", "One Punch Man", "Mob Psycho 100",
    "Frieren", "Hunter x Hunter", "One Piece", "Bleach", "Naruto",
    "BoJack Horseman", "Rick and Morty", "Archer", "Bob's Burgers", "South Park",
    "The Simpsons", "Futurama", "Samurai Jack", "Primal", "The Legend of Korra",
    "Silicon Valley", "Veep", "Curb Your Enthusiasm", "It's Always Sunny in Philadelphia",
    "Arrested Development", "Community", "Brooklyn Nine-Nine", "The Good Place",
    "Schitt's Creek", "What We Do in the Shadows", "Barry", "Atlanta",
    "Reservation Dogs", "Ramy", "Abbott Elementary", "Only Murders in the Building",
    "Poker Face", "The Righteous Gemstones", "Hacks", "Shrinking", "Silo",
    "For All Mankind", "Fallout", "The Last of Us", "Station Eleven",
    "Yellowjackets", "From", "Evil", "Penny Dreadful", "The Terror",
    "Rome", "Deadwood", "Boardwalk Empire", "Vikings", "The Last Kingdom",
    "Outlander", "Downton Abbey", "Bridgerton", "The Gilded Age", "The Queen's Gambit",
]

TVMAZE_GENRE_MAP = {
    "Science-Fiction": "Science Fiction",
    "Action": "Action",
    "Adventure": "Adventure",
    "Crime": "Crime",
    "Drama": "Drama",
    "Thriller": "Thriller",
    "Mystery": "Mystery",
    "Horror": "Horror",
    "Supernatural": "Horror",
    "Fantasy": "Fantasy",
    "Anime": "Animation",
    "Comedy": "Comedy",
    "Romance": "Romance",
    "Family": "Family",
    "Children": "Family",
    "History": "History",
    "War": "War",
    "Western": "Western",
    "Music": "Music",
    "Nature": "Documentary",
    "Travel": "Documentary",
    "Food": "Documentary",
    "Medical": "Drama",
    "Legal": "Drama",
    "Espionage": "Thriller",
    "Sports": "Drama",
}

LANG_NAME_TO_ISO = {
    "English": "en",
    "Japanese": "ja",
    "Korean": "ko",
    "Spanish": "es",
    "French": "fr",
    "German": "de",
    "Portuguese": "pt",
    "Italian": "it",
    "Chinese": "zh",
    "Hindi": "hi",
    "Russian": "ru",
    "Swedish": "sv",
    "Danish": "da",
    "Norwegian": "no",
    "Finnish": "fi",
    "Dutch": "nl",
    "Polish": "pl",
    "Turkish": "tr",
    "Arabic": "ar",
    "Thai": "th",
}

CANONICAL_GENRES = [
    "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary",
    "Drama", "Family", "Fantasy", "History", "Horror", "Music", "Mystery",
    "Romance", "Science Fiction", "TV Movie", "Thriller", "War", "Western",
]

TOP_LANGS = ["en", "es", "fr", "ja", "ko", "de", "pt", "it", "zh", "hi", "ru"]


def strip_html(text: str) -> str:
    if not text:
        return ""
    cleaned = re.sub(r"<[^>]+>", " ", text)
    cleaned = html.unescape(cleaned)
    return re.sub(r"\s+", " ", cleaned).strip()


def extract_keywords_from_text(overview: str, genres: List[str], raw_genres: List[str]) -> List[str]:
    low = overview.lower()
    kws: List[str] = []
    if "Anime" in raw_genres:
        kws.append("anime")
    if "Espionage" in raw_genres:
        kws.append("spy")
    if "Supernatural" in raw_genres:
        kws.append("supernatural")
    if "Medical" in raw_genres:
        kws.append("hospital")
    if "Legal" in raw_genres:
        kws.append("courtroom")

    vocab = [
        "murder", "serial killer", "detective", "police", "fbi", "investigation",
        "space", "alien", "planet", "future", "dystopia", "time travel", "artificial intelligence",
        "cyberpunk", "robot", "zombie", "vampire", "ghost", "witch", "demon", "haunted house",
        "magic", "dragon", "kingdom", "superhero", "vigilante", "based on comic",
        "mafia", "gangster", "drug", "prison", "heist", "spy", "cia", "assassin",
        "high school", "family", "friendship", "love", "marriage", "coming of age",
        "world war ii", "military", "soldier", "biography", "historical",
        "hospital", "doctor", "lawyer", "wealth", "workplace", "sitcom", "documentary",
        "nature", "wildlife", "music", "conspiracy", "survival", "revenge", "sequel",
    ]
    for term in vocab:
        if term in low and term not in kws:
            kws.append(term)
        if len(kws) >= 5:
            break
    if not kws and genres:
        kws = [g.lower() for g in genres[:2]]
    return kws


def parse_tvmaze_show(s: Dict) -> Dict | None:
    if not s or not s.get("name"):
        return None
    img = s.get("image") or {}
    poster = img.get("medium") or img.get("original")
    if not poster:
        return None
    poster_url = poster.replace("http://", "https://")

    raw_genres = s.get("genres") or []
    genres: List[str] = []
    for rg in raw_genres:
        mapped = TVMAZE_GENRE_MAP.get(rg)
        if mapped and mapped not in genres:
            genres.append(mapped)
    if s.get("type") == "Documentary" and "Documentary" not in genres:
        genres.append("Documentary")
    if s.get("type") == "Animation" and "Animation" not in genres:
        genres.append("Animation")
    if not genres:
        genres = ["Drama"]

    premiered = s.get("premiered") or ""
    year = int(premiered[:4]) if len(premiered) >= 4 and premiered[:4].isdigit() else 2018
    lang_full = s.get("language") or "English"
    lang = LANG_NAME_TO_ISO.get(lang_full, "en")
    rating = float((s.get("rating") or {}).get("average") or 7.0)
    weight = float(s.get("weight") or 55.0)
    popularity = round(max(1.8, weight * 0.45), 2)
    runtime = s.get("averageRuntime") or s.get("runtime") or 45
    overview = strip_html(s.get("summary") or "")
    if not overview:
        overview = f"A {year} {', '.join(genres).lower()} television series."

    network = ""
    if s.get("network") and s["network"].get("name"):
        network = s["network"]["name"]
    elif s.get("webChannel") and s["webChannel"].get("name"):
        network = s["webChannel"]["name"]

    keywords = extract_keywords_from_text(overview, genres, raw_genres)

    return {
        "tmdbId": int(s["id"]),
        "mediaType": "tv",
        "title": s["name"],
        "year": year,
        "language": lang,
        "genres": genres,
        "keywords": keywords,
        "cast": [],
        "creator": network or "TV Network",
        "rating": round(rating, 2),
        "popularity": popularity,
        "runtime": int(runtime) if runtime else 45,
        "seasons": None,
        "poster": poster_url,
        "overview": overview[:260],
    }


def fetch_all_movies_and_labels() -> Tuple[List[Dict], List[Dict]]:
    print("Fetching full TMDB movie UMAP dataset & cluster labels...")
    req_pts = urllib.request.Request(
        "https://mikeyguinness.com/movies/movie_points.json",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req_pts, timeout=45) as resp:
        raw_movies = json.loads(resp.read().decode("utf-8"))

    req_lbl = urllib.request.Request(
        "https://mikeyguinness.com/movies/cluster_labels.json",
        headers={"User-Agent": "Mozilla/5.0"},
    )
    with urllib.request.urlopen(req_lbl, timeout=20) as resp:
        raw_labels = json.loads(resp.read().decode("utf-8"))

    # Keep all non-adult movies with valid titles & genres
    valid = [
        m
        for m in raw_movies
        if m.get("title")
        and m.get("genres")
        and m.get("cluster") not in (3, 44)  # Exclude adult/softcore clusters
        and "softcore" not in (m.get("keywords") or [])
    ]
    valid.sort(
        key=lambda m: float(m.get("popularity") or 0) * (0.8 + float(m.get("rating") or 6.0) / 10.0),
        reverse=True,
    )
    print(f"Selected {len(valid):,} real Movies from TMDB UMAP dataset.")
    return valid, raw_labels


def fetch_tv_series_concurrent(max_pages: int = 230, target_tv: int = 44000) -> List[Dict]:
    print(f"Fetching up to {target_tv:,} real TV Series across {max_pages} TVMaze pages...")
    shows_by_key: Dict[str, Dict] = {}

    def fetch_flagship(q: str) -> Dict | None:
        url = f"https://api.tvmaze.com/singlesearch/shows?q={urllib.parse.quote(q)}"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                s = json.loads(resp.read().decode("utf-8"))
                parsed = parse_tvmaze_show(s)
                if parsed:
                    parsed["popularity"] = max(parsed["popularity"], 88.0)
                    return parsed
        except Exception:
            return None
        return None

    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as ex:
        for res in ex.map(fetch_flagship, FLAGSHIP_TV_QUERIES):
            if res:
                shows_by_key[f"{res['title'].lower()}_{res['year']}"] = res

    def fetch_page(page_num: int) -> List[Dict]:
        url = f"https://api.tvmaze.com/shows?page={page_num}"
        out: List[Dict] = []
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=15) as resp:
                items = json.loads(resp.read().decode("utf-8"))
                for s in items:
                    parsed = parse_tvmaze_show(s)
                    if parsed:
                        out.append(parsed)
        except Exception:
            pass
        return out

    with concurrent.futures.ThreadPoolExecutor(max_workers=16) as ex:
        for page_items in ex.map(fetch_page, range(max_pages)):
            for item in page_items:
                key = f"{item['title'].lower()}_{item['year']}"
                if key not in shows_by_key:
                    shows_by_key[key] = item

    all_tv = list(shows_by_key.values())
    all_tv.sort(
        key=lambda s: float(s["popularity"]) * (0.8 + float(s["rating"]) / 10.0),
        reverse=True,
    )
    selected = all_tv[:target_tv]
    print(f"Selected {len(selected):,} real TV Series with posters.")
    return selected


def build_semantic_vectors(items: List[Dict], top_kws: List[str]) -> np.ndarray:
    g_idx = {g: i for i, g in enumerate(CANONICAL_GENRES)}
    k_idx = {k: i for i, k in enumerate(top_kws)}
    l_idx = {l: i for i, l in enumerate(TOP_LANGS)}

    dim = len(CANONICAL_GENRES) + len(top_kws) + len(TOP_LANGS) + 2
    mat = np.zeros((len(items), dim), dtype=np.float32)

    off_k = len(CANONICAL_GENRES)
    off_l = off_k + len(top_kws)
    off_num = off_l + len(TOP_LANGS)

    for row_i, it in enumerate(items):
        for g in it.get("genres") or []:
            if g in g_idx:
                mat[row_i, g_idx[g]] = 3.0
        for k in it.get("keywords") or []:
            kl = k.lower()
            if kl in k_idx:
                mat[row_i, off_k + k_idx[kl]] = 2.2
        lang = it.get("language") or "en"
        if lang in l_idx:
            mat[row_i, off_l + l_idx[lang]] = 1.6
        yr = float(it.get("year") or 2015)
        rt = float(it.get("rating") or 6.8)
        mat[row_i, off_num] = (yr - 2005.0) / 25.0 * 0.6
        mat[row_i, off_num + 1] = (rt - 6.5) / 2.0 * 0.6

    return mat


def main() -> None:
    rng = random.Random(20261014)
    os.makedirs(OUT_DIR, exist_ok=True)

    raw_movies, raw_labels = fetch_all_movies_and_labels()
    target_tv_count = max(40000, 80000 - len(raw_movies))
    raw_tv = fetch_tv_series_concurrent(max_pages=235, target_tv=target_tv_count)

    kw_counter = Counter()
    for m in raw_movies:
        for k in m.get("keywords") or []:
            kw_counter[k.lower()] += 1
    for t in raw_tv:
        for k in t.get("keywords") or []:
            kw_counter[k.lower()] += 2
    top_kws = [k for k, _ in kw_counter.most_common(60)]

    print("Building semantic feature vectors to project TV Series onto the UMAP manifold...")
    movie_sem = build_semantic_vectors(raw_movies, top_kws)
    tv_sem = build_semantic_vectors(raw_tv, top_kws)

    sem_tree = cKDTree(movie_sem)
    _, anchor_idxs = sem_tree.query(tv_sem, k=5, workers=-1)

    movie_xs = np.array([float(m["x"]) for m in raw_movies], dtype=np.float32)
    movie_ys = np.array([float(m["y"]) for m in raw_movies], dtype=np.float32)

    points: List[Dict] = []

    for m in raw_movies:
        points.append(
            {
                "id": len(points),
                "tmdbId": int(m.get("id") or len(points)),
                "mediaType": "movie",
                "title": m["title"],
                "year": int(m.get("year") or 2015),
                "language": m.get("language") or "en",
                "genres": list(m.get("genres") or []),
                "keywords": list((m.get("keywords") or [])[:5]),
                "cast": list((m.get("cast") or [])[:3]),
                "creator": m.get("director") or "",
                "rating": round(float(m.get("rating") or 6.5), 2),
                "popularity": round(float(m.get("popularity") or 5.0), 2),
                "runtime": None,
                "seasons": None,
                "poster": m.get("poster") or "",
                "overview": (m.get("overview") or "")[:240],
                "x": round(float(m["x"]), 2),
                "y": round(float(m["y"]), 2),
                "cluster": int(m.get("cluster", -1)),
                "color": m.get("color") or "rgb(110,130,180)",
                "similar": [],
            }
        )

    for idx_tv, tv in enumerate(raw_tv):
        nbs = anchor_idxs[idx_tv]
        primary_movie = raw_movies[int(nbs[0])]
        weights = np.array([0.55, 0.27, 0.18], dtype=np.float32)
        bx = float(np.sum(movie_xs[nbs[:3]] * weights)) + rng.gauss(0, 6.2)
        by = float(np.sum(movie_ys[nbs[:3]] * weights)) + rng.gauss(0, 6.2)
        px = max(5.0, min(995.0, bx))
        py = max(5.0, min(995.0, by))

        points.append(
            {
                "id": len(points),
                "tmdbId": tv["tmdbId"],
                "mediaType": "tv",
                "title": tv["title"],
                "year": tv["year"],
                "language": tv["language"],
                "genres": tv["genres"],
                "keywords": tv["keywords"][:5],
                "cast": tv["cast"],
                "creator": tv["creator"],
                "rating": tv["rating"],
                "popularity": tv["popularity"],
                "runtime": tv["runtime"],
                "seasons": tv["seasons"],
                "poster": tv["poster"],
                "overview": tv["overview"][:240],
                "x": round(px, 2),
                "y": round(py, 2),
                "cluster": int(primary_movie.get("cluster", -1)),
                "color": primary_movie.get("color") or "rgb(244,114,182)",
                "similar": [],
            }
        )

    print(f"Computing 20-nearest-neighbor cross-media graph for {len(points):,} titles via cKDTree...")
    all_sem = np.vstack([movie_sem, tv_sem])
    coords_mat = np.array([[p["x"] * 0.08, p["y"] * 0.08] for p in points], dtype=np.float32)
    joint_vecs = np.hstack([coords_mat, all_sem])

    nn_tree = cKDTree(joint_vecs)
    _, nn_idxs = nn_tree.query(joint_vecs, k=21, workers=-1)

    for i in range(len(points)):
        points[i]["similar"] = [int(nb) for nb in nn_idxs[i][1:21]]

    cluster_counts = Counter(p["cluster"] for p in points if p["cluster"] >= 0)
    cluster_labels = []
    for cl in raw_labels:
        cid = int(cl["cluster"])
        name = (cl.get("name") or "").strip()
        if not name or cid in (3, 44):
            continue
        cluster_labels.append(
            {
                "cluster": cid,
                "name": name,
                "x": float(cl["x"]),
                "y": float(cl["y"]),
                "size": int(cluster_counts.get(cid, cl.get("size", 100))),
            }
        )
    cluster_labels.sort(key=lambda c: c["size"], reverse=True)

    gz_path = os.path.join(OUT_DIR, "media_points.json.gz")
    raw_json_path = os.path.join(OUT_DIR, "media_points.json")
    print(f"Writing compressed {gz_path}...")
    json_bytes = json.dumps(points, separators=(",", ":")).encode("utf-8")
    with gzip.open(gz_path, "wb", compresslevel=9) as gz_file:
        gz_file.write(json_bytes)

    # Remove the uncompressed media_points.json so Git and Vercel only store the compact .json.gz
    if os.path.exists(raw_json_path):
        os.remove(raw_json_path)

    with open(os.path.join(OUT_DIR, "cluster_labels.json"), "w", encoding="utf-8") as f:
        json.dump(cluster_labels, f, indent=2)

    n_movies = sum(1 for p in points if p["mediaType"] == "movie")
    n_tv = sum(1 for p in points if p["mediaType"] == "tv")
    gz_mb = os.path.getsize(gz_path) / (1024 * 1024)
    raw_mb = len(json_bytes) / (1024 * 1024)
    print(
        f"Done! Exported {len(points):,} titles ({n_movies:,} Movies + {n_tv:,} TV Series) "
        f"| Raw JSON: {raw_mb:.1f} MB -> Compressed media_points.json.gz: {gz_mb:.2f} MB"
    )


if __name__ == "__main__":
    main()
