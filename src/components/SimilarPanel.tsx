import React, { useState } from "react";
import { ColorLens, MediaFilter, MediaPoint } from "../types";
import { computePointColor } from "../utils/colorLenses";
import {
  getFallbackPosterDataUri,
  getPosterUrl,
} from "../utils/posterUrl";

interface SimilarPanelProps {
  selectedPoint: MediaPoint | null;
  points: MediaPoint[];
  activeLens: ColorLens;
  onHoverSimilar: (id: number | null) => void;
  onSelectPoint: (id: number) => void;
}

export const SimilarPanel: React.FC<SimilarPanelProps> = ({
  selectedPoint,
  points,
  activeLens,
  onHoverSimilar,
  onSelectPoint,
}) => {
  const [simFilter, setSimFilter] = useState<MediaFilter>("all");

  if (!selectedPoint) return null;

  const neighbors = selectedPoint.similar
    .map((id) => points[id])
    .filter((p): p is MediaPoint => Boolean(p))
    .filter((p) => simFilter === "all" || p.mediaType === simFilter);

  return (
    <aside className="similar-panel open">
      <div className="p-header">
        <div className="p-list-title">20 Nearest Cross-Media Neighbors</div>
        <div className="seg-group sim-filter">
          <button
            type="button"
            className={simFilter === "all" ? "active" : ""}
            onClick={() => setSimFilter("all")}
          >
            All
          </button>
          <button
            type="button"
            className={simFilter === "movie" ? "active" : ""}
            onClick={() => setSimFilter("movie")}
          >
            ● Movies
          </button>
          <button
            type="button"
            className={simFilter === "tv" ? "active" : ""}
            onClick={() => setSimFilter("tv")}
          >
            ◆ TV Shows
          </button>
        </div>
      </div>

      <div className="p-list">
        {neighbors.map((nb) => {
          const dotColor = computePointColor(nb, activeLens);
          const thumbSrc =
            getPosterUrl(nb.poster, "sm") || getFallbackPosterDataUri(nb);
          return (
            <div
              key={nb.id}
              className="sim-row"
              onMouseEnter={() => onHoverSimilar(nb.id)}
              onMouseLeave={() => onHoverSimilar(null)}
              onClick={() => onSelectPoint(nb.id)}
            >
              <img
                className="sim-thumb"
                src={thumbSrc}
                alt={nb.title}
                loading="lazy"
                onError={(e) => {
                  const fallback = getFallbackPosterDataUri(nb);
                  if (e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback;
                  }
                }}
              />
              <div className="s-main">
                <div className="s-title-row">
                  <span
                    className={`s-dot ${nb.mediaType === "tv" ? "diamond" : ""}`}
                    style={{ backgroundColor: dotColor }}
                  />
                  <span className="s-title">{nb.title}</span>
                </div>
                <div className="s-sub">
                  {nb.mediaType === "tv" ? "TV Series" : "Movie"} ·{" "}
                  {nb.genres.slice(0, 2).join(", ")}
                </div>
              </div>
              <div className="s-right">
                <span className="s-rating">★ {nb.rating.toFixed(1)}</span>
                <span className="s-year">{nb.year}</span>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
};
