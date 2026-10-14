import React from "react";
import { ColorLens, MediaFilter } from "../types";
import { COLOR_LENSES } from "../utils/colorLenses";

interface TopBarProps {
  viewMode: "2d" | "3d_earth";
  onToggleViewMode: () => void;
  activeLens: ColorLens;
  onChangeLens: (lens: ColorLens) => void;
  mediaFilter: MediaFilter;
  onChangeMediaFilter: (filter: MediaFilter) => void;
  showLabels: boolean;
  onToggleLabels: () => void;
  showMapPosters: boolean;
  onToggleMapPosters: () => void;
  pathfinderOpen: boolean;
  onTogglePathfinder: () => void;
  visibleCount: number;
  totalCount: number;
}

export const TopBar: React.FC<TopBarProps> = ({
  viewMode,
  onToggleViewMode,
  activeLens,
  onChangeLens,
  mediaFilter,
  onChangeMediaFilter,
  showLabels,
  onToggleLabels,
  showMapPosters,
  onToggleMapPosters,
  pathfinderOpen,
  onTogglePathfinder,
  visibleCount,
  totalCount,
}) => {
  const currentLensMeta =
    COLOR_LENSES.find((l) => l.id === activeLens) || COLOR_LENSES[0];

  return (
    <header className="topbar">
      <div className="topbar-row">
        <div className="brand-group">
          <div className="brand-title">
            <span className="brand-dot" />
            PopWorld
          </div>
          <span className="brand-count">
            {visibleCount.toLocaleString()} / {totalCount.toLocaleString()} titles
          </span>
        </div>

        <div className="topbar-section">
          <span className="topbar-label">Format</span>
          <div className="seg-group">
            <button
              type="button"
              className={mediaFilter === "all" ? "active" : ""}
              onClick={() => onChangeMediaFilter("all")}
            >
              All
            </button>
            <button
              type="button"
              className={mediaFilter === "movie" ? "active" : ""}
              onClick={() => onChangeMediaFilter("movie")}
            >
              ● Movies
            </button>
            <button
              type="button"
              className={mediaFilter === "tv" ? "active" : ""}
              onClick={() => onChangeMediaFilter("tv")}
            >
              ◆ TV Series
            </button>
          </div>
        </div>

        <div className="topbar-section">
          <span className="topbar-label">Color Lens</span>
          <div className="seg-group">
            {COLOR_LENSES.map((lens) => (
              <button
                key={lens.id}
                type="button"
                className={activeLens === lens.id ? "active" : ""}
                onClick={() => onChangeLens(lens.id)}
                title={lens.shortDesc}
              >
                {lens.label}
              </button>
            ))}
          </div>
        </div>

        <div className="topbar-actions">
          <button
            type="button"
            className={`action-btn earth-btn ${
              viewMode === "3d_earth" ? "active" : ""
            }`}
            onClick={onToggleViewMode}
            title="Toggle 3D Earth Globe by Country (Shortcut: G)"
          >
            🌍 3D Earth
          </button>

          {viewMode === "2d" && (
            <>
              <button
                type="button"
                className={`action-btn pathfinder-btn ${
                  pathfinderOpen ? "active" : ""
                }`}
                onClick={onTogglePathfinder}
              >
                ✦ Pathfinder Bridge
              </button>
              <button
                type="button"
                className={`action-btn ${showMapPosters ? "active" : ""}`}
                onClick={onToggleMapPosters}
                title="Show Movie & TV Posters on the Map (Shortcut: P)"
              >
                Map Posters (P)
              </button>
              <button
                type="button"
                className={`action-btn ${showLabels ? "active" : ""}`}
                onClick={onToggleLabels}
                title="Toggle Cluster Labels (Shortcut: L)"
              >
                Labels (L)
              </button>
            </>
          )}
        </div>
      </div>

      <div className="lens-legend-bar">
        <span className="lens-desc">
          {viewMode === "3d_earth"
            ? `🌍 3D Country Dot Map (${currentLensMeta.label}) — ${currentLensMeta.shortDesc}:`
            : `${currentLensMeta.shortDesc}:`}
        </span>
        <div className="lens-swatches">
          {currentLensMeta.legend.map((item) => (
            <span key={item.label} className="legend-item">
              <span
                className="legend-swatch"
                style={{ backgroundColor: item.color }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>
    </header>
  );
};
