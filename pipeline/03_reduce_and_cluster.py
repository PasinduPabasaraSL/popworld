#!/usr/bin/env python3
"""
Stage 3: PCA + UMAP 2D Projection, High-D HDBSCAN Clustering, Auto-Labeling & 20-NN Graph.

Reads `pipeline/vectors.npy` and `pipeline/records_meta.json`, then:
1. Projects high-D vectors to 2D coordinates in [0, 1000] using PCA -> UMAP.
2. Runs HDBSCAN on the high-dimensional vectors to discover natural clusters.
3. Automatically names every cluster using top distinguishing genres & keywords.
4. Precomputes the 20 nearest neighbors (`similar` array) per item in high-D space.
5. Assigns HSL/RGB colors per cluster and blends nearest cluster colors for
   transitional (`cluster = -1`) items.
6. Exports `public/data/media_points.json` and `public/data/cluster_labels.json`.
"""

import colorsys
import json
import os
from collections import Counter, defaultdict
import numpy as np
from sklearn.decomposition import PCA
from sklearn.neighbors import NearestNeighbors
import umap
import hdbscan

BASE_DIR = os.path.dirname(__file__)
VECTORS_PATH = os.path.join(BASE_DIR, "vectors.npy")
META_PATH = os.path.join(BASE_DIR, "records_meta.json")
OUT_DIR = os.path.join(os.path.dirname(BASE_DIR), "public", "data")


def hsl_to_rgb_str(h: float, s: float, l: float) -> str:
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return f"rgb({int(r*255)},{int(g*255)},{int(b*255)})"


def main() -> None:
    X = np.load(VECTORS_PATH)
    with open(META_PATH, "r", encoding="utf-8") as f:
        records = json.load(f)

    n_items = len(records)
    print(f"Processing {n_items:,} items with {X.shape[1]} dimensions...")

    # 1. PCA -> UMAP 2D projection
    n_pca = min(64, X.shape[1], n_items - 1)
    X_pca = PCA(n_components=n_pca, random_state=42).fit_transform(X)

    reducer = umap.UMAP(n_neighbors=30, min_dist=0.12, metric="cosine", random_state=42)
    coords = reducer.fit_transform(X_pca)

    mins = coords.min(axis=0)
    maxs = coords.max(axis=0)
    coords_norm = (coords - mins) / (maxs - mins + 1e-8) * 960.0 + 20.0

    # 2. High-D HDBSCAN clustering
    clusterer = hdbscan.HDBSCAN(
        min_cluster_size=max(25, n_items // 350),
        min_samples=10,
        metric="euclidean",
    )
    labels = clusterer.fit_predict(X_pca)
    unique_clusters = sorted(c for c in set(labels) if c >= 0)
    print(f"Found {len(unique_clusters)} dense clusters.")

    # 3. 20 Nearest Neighbors in High-D Space
    nn = NearestNeighbors(n_neighbors=min(21, n_items), metric="cosine")
    nn.fit(X_pca)
    _, nn_indices = nn.kneighbors(X_pca)

    # 4. Cluster Colors & Auto-Naming
    cluster_rgb = {}
    for idx, cid in enumerate(unique_clusters):
        hue = (idx * 0.618033988749895) % 1.0  # Golden ratio hue distribution
        r, g, b = colorsys.hls_to_rgb(hue, 0.58, 0.72)
        cluster_rgb[cid] = (int(r * 255), int(g * 255), int(b * 255))

    cluster_members = defaultdict(list)
    for i, cid in enumerate(labels):
        if cid >= 0:
            cluster_members[cid].append(i)

    cluster_labels_out = []
    for cid in unique_clusters:
        idxs = cluster_members[cid]
        cx = float(np.median(coords_norm[idxs, 0]))
        cy = float(np.median(coords_norm[idxs, 1]))
        tag_counts = Counter()
        for i in idxs:
            for g in records[i]["genres"]:
                tag_counts[g] += 2
            for k in records[i]["keywords"][:5]:
                tag_counts[k.title()] += 1
        top_tags = [t for t, _ in tag_counts.most_common(2)]
        name = " / ".join(top_tags) if top_tags else f"Cluster {cid}"
        r, g, b = cluster_rgb[cid]
        cluster_labels_out.append(
            {
                "cluster": int(cid),
                "name": name,
                "x": round(cx, 1),
                "y": round(cy, 1),
                "size": len(idxs),
                "color": f"rgb({r},{g},{b})",
            }
        )

    cluster_labels_out.sort(key=lambda c: c["size"], reverse=True)

    # 5. Export media_points.json
    os.makedirs(OUT_DIR, exist_ok=True)
    points_out = []
    for i, rec in enumerate(records):
        cid = int(labels[i])
        sims = [int(nb) for nb in nn_indices[i][1:21]]
        if cid >= 0:
            r, g, b = cluster_rgb[cid]
        else:
            # Blend colors of nearest clustered neighbors
            clustered_nbs = [labels[nb] for nb in sims if labels[nb] >= 0]
            if clustered_nbs:
                rs = [cluster_rgb[c][0] for c in clustered_nbs[:5]]
                gs = [cluster_rgb[c][1] for c in clustered_nbs[:5]]
                bs = [cluster_rgb[c][2] for c in clustered_nbs[:5]]
                r, g, b = int(np.mean(rs)), int(np.mean(gs)), int(np.mean(bs))
            else:
                r, g, b = 120, 130, 155

        points_out.append(
            {
                "id": i,
                "tmdbId": rec["tmdb_id"],
                "mediaType": rec["mediaType"],
                "title": rec["title"],
                "year": rec["year"],
                "language": rec["language"],
                "genres": rec["genres"],
                "keywords": rec["keywords"],
                "cast": rec["cast"],
                "creator": rec["creator"],
                "rating": round(float(rec["rating"]), 2),
                "popularity": round(float(rec["popularity"]), 2),
                "runtime": rec["runtime"],
                "seasons": rec["seasons"],
                "poster": rec["poster"],
                "overview": rec["overview"],
                "x": round(float(coords_norm[i, 0]), 2),
                "y": round(float(coords_norm[i, 1]), 2),
                "cluster": cid,
                "color": f"rgb({r},{g},{b})",
                "similar": sims,
            }
        )

    with open(os.path.join(OUT_DIR, "media_points.json"), "w", encoding="utf-8") as f:
        json.dump(points_out, f)
    with open(os.path.join(OUT_DIR, "cluster_labels.json"), "w", encoding="utf-8") as f:
        json.dump(cluster_labels_out, f, indent=2)

    print(f"Exported {len(points_out):,} points and {len(cluster_labels_out)} clusters to {OUT_DIR}")


if __name__ == "__main__":
    main()
