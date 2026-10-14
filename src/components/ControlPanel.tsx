import React, { useMemo, useState } from "react";
import {
  HighlightChip,
  LANGUAGE_NAMES,
  MatchMode,
  MediaPoint,
} from "../types";
import {
  getFallbackPosterDataUri,
  getPosterUrl,
} from "../utils/posterUrl";

interface ControlPanelProps {
  points: MediaPoint[];
  shifted: boolean;
  highlights: HighlightChip[];
  onAddHighlight: (chip: HighlightChip) => void;
  onRemoveHighlight: (chip: HighlightChip) => void;
  onClearHighlights: () => void;
  matchMode: MatchMode;
  onChangeMatchMode: (mode: MatchMode) => void;
  activeLanguages: Set<string>;
  onToggleLanguage: (lang: string) => void;
  onSelectAllLanguages: () => void;
  onSelectNoLanguages: () => void;
  onSelectPoint: (id: number) => void;
  highlightedCount: number | null;
}

interface SearchSuggestion {
  kind: "point" | "genre" | "keyword" | "creator";
  label: string;
  subLabel?: string;
  pointId?: number;
  mediaType?: "movie" | "tv";
  year?: number;
  poster?: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  points,
  shifted,
  highlights,
  onAddHighlight,
  onRemoveHighlight,
  onClearHighlights,
  matchMode,
  onChangeMatchMode,
  activeLanguages,
  onToggleLanguage,
  onSelectAllLanguages,
  onSelectNoLanguages,
  onSelectPoint,
  highlightedCount,
}) => {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(-1);
  const [langCollapsed, setLangCollapsed] = useState(true);

  const { allGenres, allKeywords, allCreators, languageCounts } = useMemo(() => {
    const gSet = new Set<string>();
    const kSet = new Set<string>();
    const cSet = new Set<string>();
    const lCounts: Record<string, number> = {};

    for (const p of points) {
      for (const g of p.genres) gSet.add(g);
      for (const k of p.keywords) kSet.add(k);
      if (p.creator) cSet.add(p.creator);
      lCounts[p.language] = (lCounts[p.language] || 0) + 1;
    }

    return {
      allGenres: Array.from(gSet).sort(),
      allKeywords: Array.from(kSet).sort(),
      allCreators: Array.from(cSet).sort(),
      languageCounts: Object.entries(lCounts).sort((a, b) => b[1] - a[1]),
    };
  }, [points]);

  const suggestions = useMemo<SearchSuggestion[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const out: SearchSuggestion[] = [];

    for (const g of allGenres) {
      if (g.toLowerCase().includes(q)) {
        out.push({ kind: "genre", label: g });
      }
    }

    let kwAdded = 0;
    for (const k of allKeywords) {
      if (k.toLowerCase().includes(q)) {
        out.push({ kind: "keyword", label: k });
        if (++kwAdded >= 4) break;
      }
    }

    let creatorAdded = 0;
    for (const c of allCreators) {
      if (c.toLowerCase().includes(q)) {
        out.push({ kind: "creator", label: c });
        if (++creatorAdded >= 3) break;
      }
    }

    const matchedPoints: Array<{ point: MediaPoint; via?: string }> = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.title.toLowerCase().includes(q)) {
        matchedPoints.push({ point: p });
      } else if (p.creator && p.creator.toLowerCase().includes(q)) {
        matchedPoints.push({ point: p, via: `by ${p.creator}` });
      } else {
        const castHit = p.cast.find((actor) => actor.toLowerCase().includes(q));
        if (castHit) {
          matchedPoints.push({ point: p, via: castHit });
        }
      }
      if (matchedPoints.length >= 350) break;
    }

    matchedPoints.sort((a, b) => {
      const aPrefix = a.point.title.toLowerCase().startsWith(q) ? 0 : 1;
      const bPrefix = b.point.title.toLowerCase().startsWith(q) ? 0 : 1;
      if (aPrefix !== bPrefix) return aPrefix - bPrefix;
      return b.point.popularity - a.point.popularity;
    });

    for (const item of matchedPoints.slice(0, 10)) {
      out.push({
        kind: "point",
        label: item.point.title,
        subLabel: item.via,
        pointId: item.point.id,
        mediaType: item.point.mediaType,
        year: item.point.year,
        poster:
          getPosterUrl(item.point.poster, "sm") ||
          getFallbackPosterDataUri(item.point),
      });
    }

    return out.slice(0, 14);
  }, [query, allGenres, allKeywords, allCreators, points]);

  const handleChoose = (s: SearchSuggestion) => {
    if (s.kind === "point" && s.pointId !== undefined) {
      onSelectPoint(s.pointId);
      setQuery(s.label);
    } else if (s.kind === "genre" || s.kind === "keyword" || s.kind === "creator") {
      onAddHighlight({ type: s.kind, value: s.label });
      setQuery("");
    }
    setActiveIdx(-1);
  };

  return (
    <aside className={`controls-panel ${shifted ? "shifted" : ""}`}>
      <div className="search-wrap">
        <input
          type="text"
          className="search-input"
          placeholder="Search movies, TV shows, genres, tropes, creators…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIdx(-1);
          }}
          onKeyDown={(e) => {
            if (!suggestions.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIdx((prev) => Math.min(prev + 1, suggestions.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIdx((prev) => Math.max(prev - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              const chosen = suggestions[activeIdx >= 0 ? activeIdx : 0];
              if (chosen) handleChoose(chosen);
            } else if (e.key === "Escape") {
              setQuery("");
            }
          }}
        />
        {query && (
          <button
            type="button"
            className="search-clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            ×
          </button>
        )}

        {suggestions.length > 0 && (
          <div className="search-results">
            {suggestions.map((s, idx) => (
              <div
                key={`${s.kind}-${s.label}-${s.pointId ?? idx}`}
                className={`res-row ${idx === activeIdx ? "active" : ""}`}
                onClick={() => handleChoose(s)}
              >
                {s.kind === "point" && s.poster && (
                  <img
                    className="res-mini-poster"
                    src={s.poster}
                    alt={s.label}
                    loading="lazy"
                  />
                )}
                <span
                  className={`res-tag ${
                    s.kind === "point" ? `tag-${s.mediaType}` : `tag-${s.kind}`
                  }`}
                >
                  {s.kind === "point"
                    ? s.mediaType === "tv"
                      ? "TV"
                      : "MOVIE"
                    : s.kind}
                </span>
                <span className="res-label">{s.label}</span>
                {s.subLabel && <span className="res-via">{s.subLabel}</span>}
                {s.year && <span className="res-year">{s.year}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {highlights.length > 0 && (
        <div className="chips-container">
          <div className="chips-list">
            {highlights.map((h) => (
              <span key={`${h.type}-${h.value}`} className={`hl-chip ${h.type}`}>
                <span className="chip-prefix">{h.type}:</span>
                <span>{h.value}</span>
                <button
                  type="button"
                  className="chip-remove"
                  onClick={() => onRemoveHighlight(h)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="match-bar">
            <span>
              {highlightedCount !== null
                ? `${highlightedCount.toLocaleString()} highlighted`
                : "Match"}
            </span>
            <div className="seg-group">
              <button
                type="button"
                className={matchMode === "or" ? "active" : ""}
                onClick={() => onChangeMatchMode("or")}
              >
                Any (OR)
              </button>
              <button
                type="button"
                className={matchMode === "and" ? "active" : ""}
                onClick={() => onChangeMatchMode("and")}
              >
                All (AND)
              </button>
            </div>
            <button
              type="button"
              className="clear-chips-btn"
              onClick={onClearHighlights}
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className={`ctl-box ${langCollapsed ? "collapsed" : ""}`}>
        <div
          className="ctl-head"
          onClick={() => setLangCollapsed((prev) => !prev)}
        >
          <span>Languages ({activeLanguages.size} active)</span>
          <span className="caret">▾</span>
        </div>
        {!langCollapsed && (
          <div className="ctl-body">
            <div className="lang-actions">
              <button type="button" onClick={onSelectAllLanguages}>
                All
              </button>
              <button type="button" onClick={onSelectNoLanguages}>
                None
              </button>
            </div>
            <div className="lang-list">
              {languageCounts.map(([code, count]) => (
                <label key={code} className="lang-row">
                  <input
                    type="checkbox"
                    checked={activeLanguages.has(code)}
                    onChange={() => onToggleLanguage(code)}
                  />
                  <span>{LANGUAGE_NAMES[code] || code.toUpperCase()}</span>
                  <span className="l-count">{count.toLocaleString()}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
