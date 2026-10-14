import React from "react";
import { HighlightChip, LANGUAGE_NAMES, MediaPoint } from "../types";
import {
  getFallbackPosterDataUri,
  getPosterUrl,
} from "../utils/posterUrl";

interface DetailDrawerProps {
  point: MediaPoint | null;
  clusterName: string;
  onClose: () => void;
  onAddHighlight: (chip: HighlightChip) => void;
  onSetPathStart: (id: number) => void;
  onSetPathEnd: (id: number) => void;
}

export const DetailDrawer: React.FC<DetailDrawerProps> = ({
  point,
  clusterName,
  onClose,
  onAddHighlight,
  onSetPathStart,
  onSetPathEnd,
}) => {
  if (!point) return null;

  const langLabel =
    LANGUAGE_NAMES[point.language] || point.language.toUpperCase();
  const posterSrc =
    getPosterUrl(point.poster, "md") || getFallbackPosterDataUri(point);

  return (
    <aside className="detail-drawer open">
      <button type="button" className="d-close" onClick={onClose}>
        ×
      </button>

      <div className="d-poster-wrap">
        <img
          key={point.id}
          className="d-poster"
          src={posterSrc}
          alt={point.title}
          loading="eager"
          onError={(e) => {
            const target = e.currentTarget;
            const fallback = getFallbackPosterDataUri(point);
            if (target.src !== fallback) {
              target.src = fallback;
            }
          }}
        />
      </div>

      <div className="d-body">
        <div className="d-badge-row">
          <span className={`res-tag tag-${point.mediaType}`}>
            {point.mediaType === "tv" ? "TV SERIES ◆" : "MOVIE ●"}
          </span>
          <span className="d-cluster-badge">{clusterName}</span>
        </div>

        <h2 className="d-title">{point.title}</h2>

        <div className="d-meta">
          <div>
            {point.year} · {langLabel}
            {point.mediaType === "movie" && point.runtime
              ? ` · ${point.runtime} min`
              : ""}
            {point.mediaType === "tv" && point.seasons
              ? ` · ${point.seasons} Season${point.seasons > 1 ? "s" : ""}`
              : ""}
          </div>
          {point.creator && (
            <div className="d-creator-row">
              {point.mediaType === "tv" ? "Network / Creator: " : "Directed by "}
              <button
                type="button"
                className="creator-link"
                onClick={() =>
                  onAddHighlight({ type: "creator", value: point.creator })
                }
              >
                {point.creator}
              </button>
            </div>
          )}
          <div className="d-rating-row">
            <span className="star-badge">★ {point.rating.toFixed(1)}</span>
            <span className="pop-badge">
              Popularity {point.popularity.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="d-path-actions">
          <button
            type="button"
            className="d-path-btn"
            onClick={() => onSetPathStart(point.id)}
          >
            ✦ Set as Path Start (A)
          </button>
          <button
            type="button"
            className="d-path-btn"
            onClick={() => onSetPathEnd(point.id)}
          >
            ✦ Set as Path Target (B)
          </button>
        </div>

        <div className="d-section">Genres (Click to highlight on map)</div>
        <div className="d-chips">
          {point.genres.map((g) => (
            <span
              key={g}
              className="chip genre-chip"
              onClick={() => onAddHighlight({ type: "genre", value: g })}
            >
              {g}
            </span>
          ))}
        </div>

        {point.keywords.length > 0 && (
          <>
            <div className="d-section">Themes & Tropes</div>
            <div className="d-chips">
              {point.keywords.map((k) => (
                <span
                  key={k}
                  className="chip kw-chip"
                  onClick={() => onAddHighlight({ type: "keyword", value: k })}
                >
                  {k}
                </span>
              ))}
            </div>
          </>
        )}

        {point.cast.length > 0 && (
          <>
            <div className="d-section">Key Cast</div>
            <div className="d-cast">{point.cast.join(" · ")}</div>
          </>
        )}

        <div className="d-section">Overview</div>
        <p className="d-overview">
          {point.overview || "No summary available."}
        </p>
      </div>
    </aside>
  );
};
