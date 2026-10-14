#!/usr/bin/env python3
"""
Stage 2: Build High-Dimensional Cross-Media Feature Vectors for Movies & TV Series.

Reads `pipeline/tmdb_cache.sqlite` and constructs a ~640-dimensional weighted feature
matrix (`pipeline/vectors.npy`) where Movies and TV Series occupy a single shared
semantic space:
  - Block 1: Multi-hot canonical genres (19 dims, weight = 3.2)
  - Block 2: Multi-hot top 350 keywords (350 dims, weight = 2.6)
  - Block 3: Plot synopsis semantic SVD components (128 dims via TF-IDF + TruncatedSVD, weight = 2.4)
  - Block 4: Top 100 directors/showrunners & cast multi-hot (100 dims, weight = 1.1)
  - Block 5: Top 35 original languages one-hot (35 dims, weight = 1.2)
  - Block 6: Per-media-type standardized numeric features (year, rating, log(popularity), weight = 0.8)
    * Standardized separately within Movies and within TV Series so UMAP does not split
      Movies and TV Series into separate islands due to runtime or vote scale differences.
"""

import json
import os
import sqlite3
from collections import Counter
import numpy as np
from sklearn.decomposition import TruncatedSVD
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.preprocessing import MultiLabelBinarizer, StandardScaler

BASE_DIR = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE_DIR, "tmdb_cache.sqlite")
VECTORS_PATH = os.path.join(BASE_DIR, "vectors.npy")
META_PATH = os.path.join(BASE_DIR, "records_meta.json")


def main() -> None:
    if not os.path.exists(DB_PATH):
        raise SystemExit(f"Cache DB not found at {DB_PATH}. Run 01_fetch_tmdb.py first.")

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("SELECT * FROM media WHERE title IS NOT NULL").fetchall()
    conn.close()

    print(f"Loaded {len(rows):,} Movies & TV Series from SQLite.")
    records = []
    for r in rows:
        records.append(
            {
                "uid": r["uid"],
                "tmdb_id": r["tmdb_id"],
                "mediaType": r["media_type"],
                "title": r["title"],
                "year": r["year"] or 2015,
                "language": r["language"] or "en",
                "genres": json.loads(r["genres"] or "[]"),
                "keywords": json.loads(r["keywords"] or "[]"),
                "cast": json.loads(r["cast_names"] or "[]"),
                "creator": r["creator"] or "",
                "rating": float(r["rating"] or 6.0),
                "popularity": float(r["popularity"] or 1.0),
                "runtime": r["runtime"],
                "seasons": r["seasons"],
                "poster": r["poster"] or "",
                "overview": r["overview"] or "",
            }
        )

    # 1. Genres (19 canonical)
    mlb_genre = MultiLabelBinarizer()
    X_genre = mlb_genre.fit_transform([r["genres"] for r in records]).astype(np.float32) * 3.2

    # 2. Top 350 Keywords
    kw_counts = Counter(k for r in records for k in r["keywords"])
    top_kws = {k for k, _ in kw_counts.most_common(350)}
    mlb_kw = MultiLabelBinarizer(classes=sorted(top_kws))
    X_kw = mlb_kw.fit_transform([[k for k in r["keywords"] if k in top_kws] for r in records]).astype(np.float32) * 2.6

    # 3. Synopsis TF-IDF + SVD (128 dims) for deep cross-media plot similarity
    overviews = [
        f"{r['title']} {' '.join(r['genres'])} {' '.join(r['keywords'])} {r['overview']}"
        for r in records
    ]
    tfidf = TfidfVectorizer(max_features=12000, stop_words="english", ngram_range=(1, 2))
    X_tfidf = tfidf.fit_transform(overviews)
    n_svd = min(128, X_tfidf.shape[1] - 1)
    svd = TruncatedSVD(n_components=n_svd, random_state=42)
    X_plot = svd.fit_transform(X_tfidf).astype(np.float32) * 2.4

    # 4. Top 100 Creators + Cast
    person_counts = Counter()
    for r in records:
        if r["creator"]:
            person_counts[r["creator"]] += 2
        for c in r["cast"]:
            person_counts[c] += 1
    top_people = {p for p, _ in person_counts.most_common(100)}
    mlb_people = MultiLabelBinarizer(classes=sorted(top_people))
    X_people = mlb_people.fit_transform(
        [[p for p in ([r["creator"]] + r["cast"]) if p in top_people] for r in records]
    ).astype(np.float32) * 1.1

    # 5. Top 35 Languages
    lang_counts = Counter(r["language"] for r in records)
    top_langs = {l for l, _ in lang_counts.most_common(35)}
    mlb_lang = MultiLabelBinarizer(classes=sorted(top_langs))
    X_lang = mlb_lang.fit_transform(
        [[r["language"]] if r["language"] in top_langs else [] for r in records]
    ).astype(np.float32) * 1.2

    # 6. Numeric features standardized per mediaType
    X_num = np.zeros((len(records), 3), dtype=np.float32)
    for mtype in ("movie", "tv"):
        idxs = [i for i, r in enumerate(records) if r["mediaType"] == mtype]
        if not idxs:
            continue
        sub = np.array(
            [
                [
                    float(records[i]["year"]),
                    float(records[i]["rating"]),
                    np.log1p(float(records[i]["popularity"])),
                ]
                for i in idxs
            ],
            dtype=np.float32,
        )
        X_num[idxs] = StandardScaler().fit_transform(sub) * 0.8

    X = np.hstack([X_genre, X_kw, X_plot, X_people, X_lang, X_num]).astype(np.float32)
    print(f"Built feature matrix X of shape {X.shape}")

    np.save(VECTORS_PATH, X)
    with open(META_PATH, "w", encoding="utf-8") as f:
        json.dump(records, f)
    print(f"Saved {VECTORS_PATH} and {META_PATH}")


if __name__ == "__main__":
    main()
