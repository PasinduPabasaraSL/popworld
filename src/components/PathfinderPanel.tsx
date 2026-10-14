import React, { useMemo, useState } from "react";
import { MediaPoint, PathResult } from "../types";
import {
  getFallbackPosterDataUri,
  getPosterUrl,
} from "../utils/posterUrl";

interface PathfinderPanelProps {
  points: MediaPoint[];
  startId: number | null;
  endId: number | null;
  pathResult: PathResult | null;
  onSetStart: (id: number | null) => void;
  onSetEnd: (id: number | null) => void;
  onFocusNode: (id: number) => void;
  onClose: () => void;
}

const PRESET_BRIDGES: Array<{ startTitle: string; endTitle: string; label: string }> = [
  {
    startTitle: "Inception",
    endTitle: "Severance",
    label: "Inception (Movie) → Severance (TV)",
  },
  {
    startTitle: "The Godfather",
    endTitle: "Succession",
    label: "The Godfather (Movie) → Succession (TV)",
  },
  {
    startTitle: "Se7en",
    endTitle: "Mindhunter",
    label: "Se7en (Movie) → Mindhunter (TV)",
  },
  {
    startTitle: "Spirited Away",
    endTitle: "Stranger Things",
    label: "Spirited Away (Movie) → Stranger Things (TV)",
  },
  {
    startTitle: "Interstellar",
    endTitle: "Breaking Bad",
    label: "Interstellar (Movie) → Breaking Bad (TV)",
  },
];

export const PathfinderPanel: React.FC<PathfinderPanelProps> = ({
  points,
  startId,
  endId,
  pathResult,
  onSetStart,
  onSetEnd,
  onFocusNode,
  onClose,
}) => {
  const [startSearch, setStartSearch] = useState("");
  const [endSearch, setEndSearch] = useState("");

  const startPoint = startId !== null ? points[startId] : null;
  const endPoint = endId !== null ? points[endId] : null;

  const startMatches = useMemo(() => {
    const q = startSearch.trim().toLowerCase();
    if (!q) return [];
    const hits: MediaPoint[] = [];
    for (let i = 0; i < points.length; i++) {
      if (points[i].title.toLowerCase().includes(q)) {
        hits.push(points[i]);
        if (hits.length >= 250) break;
      }
    }
    return hits
      .sort((a, b) => {
        const ap = a.title.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.title.toLowerCase().startsWith(q) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return b.popularity - a.popularity;
      })
      .slice(0, 6);
  }, [startSearch, points]);

  const endMatches = useMemo(() => {
    const q = endSearch.trim().toLowerCase();
    if (!q) return [];
    const hits: MediaPoint[] = [];
    for (let i = 0; i < points.length; i++) {
      if (points[i].title.toLowerCase().includes(q)) {
        hits.push(points[i]);
        if (hits.length >= 250) break;
      }
    }
    return hits
      .sort((a, b) => {
        const ap = a.title.toLowerCase().startsWith(q) ? 0 : 1;
        const bp = b.title.toLowerCase().startsWith(q) ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return b.popularity - a.popularity;
      })
      .slice(0, 6);
  }, [endSearch, points]);

  const applyPreset = (startTitle: string, endTitle: string) => {
    const s = points.find(
      (p) => p.title.toLowerCase() === startTitle.toLowerCase()
    );
    const e = points.find(
      (p) => p.title.toLowerCase() === endTitle.toLowerCase()
    );
    if (s && e) {
      onSetStart(s.id);
      onSetEnd(e.id);
      onFocusNode(s.id);
    }
  };

  return (
    <div className="pathfinder-panel">
      <div className="pf-header">
        <div>
          <div className="pf-title">✦ Pathfinder Constellation Bridge</div>
          <div className="pf-subtitle">
            Connect any Movie to any TV Series across the 20-NN similarity graph
          </div>
        </div>
        <button type="button" className="pf-close" onClick={onClose}>
          ×
        </button>
      </div>

      <div className="pf-presets">
        <span className="pf-preset-label">Try a bridge:</span>
        {PRESET_BRIDGES.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="pf-preset-chip"
            onClick={() => applyPreset(preset.startTitle, preset.endTitle)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="pf-inputs">
        <div className="pf-Endpoint">
          <span className="pf-badge start">START (A)</span>
          {startPoint ? (
            <div className="pf-selected-pill">
              <img
                className="pf-mini-poster"
                src={
                  getPosterUrl(startPoint.poster, "sm") ||
                  getFallbackPosterDataUri(startPoint)
                }
                alt={startPoint.title}
              />
              <span className={`res-tag tag-${startPoint.mediaType}`}>
                {startPoint.mediaType === "tv" ? "TV" : "MOVIE"}
              </span>
              <span
                className="pf-sel-title"
                onClick={() => onFocusNode(startPoint.id)}
              >
                {startPoint.title} ({startPoint.year})
              </span>
              <button
                type="button"
                className="pf-clear-btn"
                onClick={() => onSetStart(null)}
              >
                ×
              </button>
            </div>
          ) : (
            <div className="pf-search-box">
              <input
                type="text"
                placeholder="Type a starting Movie or TV Series…"
                value={startSearch}
                onChange={(e) => setStartSearch(e.target.value)}
              />
              {startMatches.length > 0 && (
                <div className="pf-dropdown">
                  {startMatches.map((p) => (
                    <div
                      key={p.id}
                      className="res-row"
                      onClick={() => {
                        onSetStart(p.id);
                        setStartSearch("");
                      }}
                    >
                      <img
                        className="res-mini-poster"
                        src={
                          getPosterUrl(p.poster, "sm") ||
                          getFallbackPosterDataUri(p)
                        }
                        alt={p.title}
                        loading="lazy"
                      />
                      <span className={`res-tag tag-${p.mediaType}`}>
                        {p.mediaType === "tv" ? "TV" : "MOVIE"}
                      </span>
                      <span>{p.title}</span>
                      <span className="res-year">{p.year}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="pf-Endpoint">
          <span className="pf-badge end">TARGET (B)</span>
          {endPoint ? (
            <div className="pf-selected-pill">
              <img
                className="pf-mini-poster"
                src={
                  getPosterUrl(endPoint.poster, "sm") ||
                  getFallbackPosterDataUri(endPoint)
                }
                alt={endPoint.title}
              />
              <span className={`res-tag tag-${endPoint.mediaType}`}>
                {endPoint.mediaType === "tv" ? "TV" : "MOVIE"}
              </span>
              <span
                className="pf-sel-title"
                onClick={() => onFocusNode(endPoint.id)}
              >
                {endPoint.title} ({endPoint.year})
              </span>
              <button
                type="button"
                className="pf-clear-btn"
                onClick={() => onSetEnd(null)}
              >
                ×
              </button>
            </div>
          ) : (
            <div className="pf-search-box">
              <input
                type="text"
                placeholder="Type a target Movie or TV Series…"
                value={endSearch}
                onChange={(e) => setEndSearch(e.target.value)}
              />
              {endMatches.length > 0 && (
                <div className="pf-dropdown">
                  {endMatches.map((p) => (
                    <div
                      key={p.id}
                      className="res-row"
                      onClick={() => {
                        onSetEnd(p.id);
                        setEndSearch("");
                      }}
                    >
                      <img
                        className="res-mini-poster"
                        src={
                          getPosterUrl(p.poster, "sm") ||
                          getFallbackPosterDataUri(p)
                        }
                        alt={p.title}
                        loading="lazy"
                      />
                      <span className={`res-tag tag-${p.mediaType}`}>
                        {p.mediaType === "tv" ? "TV" : "MOVIE"}
                      </span>
                      <span>{p.title}</span>
                      <span className="res-year">{p.year}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {pathResult && pathResult.nodeIds.length > 0 && (
        <div className="pf-chain">
          <div className="pf-chain-summary">
            Connected in <strong>{pathResult.nodeIds.length - 1} hops</strong> across
            the cross-media similarity graph:
          </div>
          <div className="pf-steps-scroll">
            {pathResult.nodeIds.map((nodeId, idx) => {
              const node = points[nodeId];
              const nextStep = pathResult.steps[idx];
              const posterUrl =
                getPosterUrl(node.poster, "sm") || getFallbackPosterDataUri(node);
              return (
                <React.Fragment key={nodeId}>
                  <div
                    className="pf-node-card"
                    onClick={() => onFocusNode(nodeId)}
                  >
                    <div className="pf-step-num">{idx + 1}</div>
                    <img
                      className="pf-card-poster"
                      src={posterUrl}
                      alt={node.title}
                      loading="lazy"
                      onError={(e) => {
                        const fallback = getFallbackPosterDataUri(node);
                        if (e.currentTarget.src !== fallback) {
                          e.currentTarget.src = fallback;
                        }
                      }}
                    />
                    <div className="pf-node-info">
                      <div className="pf-node-top">
                        <span className={`res-tag tag-${node.mediaType}`}>
                          {node.mediaType === "tv" ? "TV ◆" : "MOVIE ●"}
                        </span>
                        <span className="pf-node-year">{node.year}</span>
                        <span className="pf-node-rating">
                          ★ {node.rating.toFixed(1)}
                        </span>
                      </div>
                      <div className="pf-node-name">{node.title}</div>
                      <div className="pf-node-creator">{node.creator}</div>
                    </div>
                  </div>
                  {nextStep && (
                    <div className="pf-connector">
                      <div className="pf-arrow">→</div>
                      <div className="pf-shared-tags">
                        {[...nextStep.sharedGenres, ...nextStep.sharedKeywords]
                          .slice(0, 2)
                          .map((t) => (
                            <span key={t} className="pf-shared-pill">
                              {t}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
