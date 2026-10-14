import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ClusterLabel,
  ColorLens,
  HighlightChip,
  MatchMode,
  MediaFilter,
  MediaPoint,
} from "./types";
import { findSemanticPath } from "./utils/pathfinder";
import { TopBar } from "./components/TopBar";
import { ControlPanel } from "./components/ControlPanel";
import { PathfinderPanel } from "./components/PathfinderPanel";
import { DetailDrawer } from "./components/DetailDrawer";
import { SimilarPanel } from "./components/SimilarPanel";
import { VectorCanvas } from "./components/VectorCanvas";
import { EarthGlobeView } from "./components/EarthGlobeView";

export const App: React.FC = () => {
  const [points, setPoints] = useState<MediaPoint[]>([]);
  const [clusterLabels, setClusterLabels] = useState<ClusterLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<"2d" | "3d_earth">("2d");
  const [activeLens, setActiveLens] = useState<ColorLens>("cluster");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [showLabels, setShowLabels] = useState(true);
  const [showMapPosters, setShowMapPosters] = useState(true);
  const [activeLanguages, setActiveLanguages] = useState<Set<string>>(
    new Set()
  );

  const [highlights, setHighlights] = useState<HighlightChip[]>([]);
  const [matchMode, setMatchMode] = useState<MatchMode>("or");

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hoveredSimId, setHoveredSimId] = useState<number | null>(null);
  const [focusTrigger, setFocusTrigger] = useState<{
    id: number;
    seq: number;
  } | null>(null);

  const [pathfinderOpen, setPathfinderOpen] = useState(false);
  const [pathStartId, setPathStartId] = useState<number | null>(null);
  const [pathEndId, setPathEndId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const [ptsResp, lblResp] = await Promise.all([
          fetch("/data/media_points.json.gz"),
          fetch("/data/cluster_labels.json"),
        ]);
        if (!ptsResp.ok) {
          throw new Error(`HTTP ${ptsResp.status} loading media_points.json.gz`);
        }

        const buf = await ptsResp.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let ptsData: MediaPoint[];
        if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) {
          const ds = new DecompressionStream("gzip");
          const decompressedStream = new Blob([buf]).stream().pipeThrough(ds);
          ptsData = await new Response(decompressedStream).json();
        } else {
          const text = new TextDecoder("utf-8").decode(bytes);
          ptsData = JSON.parse(text);
        }

        const lblData: ClusterLabel[] = lblResp.ok ? await lblResp.json() : [];
        if (cancelled) return;

        setPoints(ptsData);
        setClusterLabels(lblData);
        const langs = new Set<string>();
        for (const p of ptsData) langs.add(p.language);
        setActiveLanguages(langs);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (e.key === "l" || e.key === "L") {
        setShowLabels((prev) => !prev);
      } else if (e.key === "p" || e.key === "P") {
        setShowMapPosters((prev) => !prev);
      } else if (e.key === "g" || e.key === "G") {
        setViewMode((prev) => (prev === "2d" ? "3d_earth" : "2d"));
      } else if (e.key === "Escape") {
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleMask = useMemo(() => {
    return points.map((p) => {
      if (!activeLanguages.has(p.language)) return false;
      if (mediaFilter !== "all" && p.mediaType !== mediaFilter) return false;
      return true;
    });
  }, [points, activeLanguages, mediaFilter]);

  const visibleCount = useMemo(() => {
    let c = 0;
    for (const v of visibleMask) if (v) c++;
    return c;
  }, [visibleMask]);

  const highlightedSet = useMemo<Set<number> | null>(() => {
    if (highlights.length === 0) return null;
    const set = new Set<number>();
    for (let i = 0; i < points.length; i++) {
      if (!visibleMask[i]) continue;
      const p = points[i];
      const checks = highlights.map((h) => {
        if (h.type === "genre") return p.genres.includes(h.value);
        if (h.type === "keyword") return p.keywords.includes(h.value);
        if (h.type === "creator") return p.creator === h.value;
        return false;
      });
      const matched =
        matchMode === "and" ? checks.every(Boolean) : checks.some(Boolean);
      if (matched) set.add(i);
    }
    return set;
  }, [points, visibleMask, highlights, matchMode]);

  const pathResult = useMemo(() => {
    if (pathStartId === null || pathEndId === null) return null;
    return findSemanticPath(points, pathStartId, pathEndId);
  }, [points, pathStartId, pathEndId]);

  const clusterNameMap = useMemo(() => {
    const m = new Map<number, string>();
    for (const cl of clusterLabels) m.set(cl.cluster, cl.name);
    return m;
  }, [clusterLabels]);

  const handleSelectAndFocus = useCallback(
    (id: number) => {
      const pt = points[id];
      if (!pt) return;
      if (!activeLanguages.has(pt.language)) {
        setActiveLanguages((prev) => new Set(prev).add(pt.language));
      }
      if (mediaFilter !== "all" && pt.mediaType !== mediaFilter) {
        setMediaFilter("all");
      }
      setSelectedId(id);
      setFocusTrigger((prev) => ({ id, seq: (prev?.seq || 0) + 1 }));
    },
    [points, activeLanguages, mediaFilter]
  );

  const handleLocateFromGlobeTo2D = useCallback(
    (id: number) => {
      setViewMode("2d");
      handleSelectAndFocus(id);
    },
    [handleSelectAndFocus]
  );

  const handleAddHighlight = useCallback((chip: HighlightChip) => {
    setHighlights((prev) => {
      if (prev.some((h) => h.type === chip.type && h.value === chip.value)) {
        return prev;
      }
      return [...prev, chip];
    });
  }, []);

  const handleRemoveHighlight = useCallback((chip: HighlightChip) => {
    setHighlights((prev) =>
      prev.filter((h) => !(h.type === chip.type && h.value === chip.value))
    );
  }, []);

  const selectedPoint = selectedId !== null ? points[selectedId] || null : null;
  const selectedClusterName = selectedPoint
    ? clusterNameMap.get(selectedPoint.cluster) || "Transitional Hybrid"
    : "";

  return (
    <div className="app-shell">
      {loading && (
        <div className="loading-overlay">
          <div className="loading-title">Loading PopWorld…</div>
          <div className="loading-bar">
            <div />
          </div>
        </div>
      )}

      {error && (
        <div className="loading-overlay">
          <div className="loading-title">Failed to load dataset</div>
          <div className="loading-sub">{error}</div>
        </div>
      )}

      <TopBar
        viewMode={viewMode}
        onToggleViewMode={() =>
          setViewMode((prev) => (prev === "2d" ? "3d_earth" : "2d"))
        }
        activeLens={activeLens}
        onChangeLens={setActiveLens}
        mediaFilter={mediaFilter}
        onChangeMediaFilter={setMediaFilter}
        showLabels={showLabels}
        onToggleLabels={() => setShowLabels((prev) => !prev)}
        showMapPosters={showMapPosters}
        onToggleMapPosters={() => setShowMapPosters((prev) => !prev)}
        pathfinderOpen={pathfinderOpen}
        onTogglePathfinder={() => setPathfinderOpen((prev) => !prev)}
        visibleCount={visibleCount}
        totalCount={points.length}
      />

      {viewMode === "2d" ? (
        <>
          <ControlPanel
            points={points}
            shifted={selectedPoint !== null}
            highlights={highlights}
            onAddHighlight={handleAddHighlight}
            onRemoveHighlight={handleRemoveHighlight}
            onClearHighlights={() => setHighlights([])}
            matchMode={matchMode}
            onChangeMatchMode={setMatchMode}
            activeLanguages={activeLanguages}
            onToggleLanguage={(lang) => {
              setActiveLanguages((prev) => {
                const next = new Set(prev);
                if (next.has(lang)) next.delete(lang);
                else next.add(lang);
                return next;
              });
            }}
            onSelectAllLanguages={() => {
              const all = new Set<string>();
              for (const p of points) all.add(p.language);
              setActiveLanguages(all);
            }}
            onSelectNoLanguages={() => setActiveLanguages(new Set())}
            onSelectPoint={handleSelectAndFocus}
            highlightedCount={highlightedSet ? highlightedSet.size : null}
          />

          {pathfinderOpen && (
            <PathfinderPanel
              points={points}
              startId={pathStartId}
              endId={pathEndId}
              pathResult={pathResult}
              onSetStart={setPathStartId}
              onSetEnd={setPathEndId}
              onFocusNode={handleSelectAndFocus}
              onClose={() => setPathfinderOpen(false)}
            />
          )}

          <SimilarPanel
            selectedPoint={selectedPoint}
            points={points}
            activeLens={activeLens}
            onHoverSimilar={setHoveredSimId}
            onSelectPoint={handleSelectAndFocus}
          />

          <VectorCanvas
            points={points}
            clusterLabels={clusterLabels}
            visibleMask={visibleMask}
            highlightedSet={highlightedSet}
            activeLens={activeLens}
            showLabels={showLabels}
            showMapPosters={showMapPosters}
            selectedId={selectedId}
            hoveredSimId={hoveredSimId}
            pathResult={pathfinderOpen ? pathResult : null}
            focusTrigger={focusTrigger}
            onSelectPoint={setSelectedId}
          />
        </>
      ) : (
        <EarthGlobeView
          points={points}
          activeLens={activeLens}
          mediaFilter={mediaFilter}
          onChangeMediaFilter={setMediaFilter}
          selectedId={selectedId}
          onSelectPoint={setSelectedId}
          onLocateOn2DMap={handleLocateFromGlobeTo2D}
        />
      )}

      <DetailDrawer
        point={selectedPoint}
        clusterName={selectedClusterName}
        onClose={() => setSelectedId(null)}
        onAddHighlight={(chip) => {
          setViewMode("2d");
          handleAddHighlight(chip);
        }}
        onSetPathStart={(id) => {
          setViewMode("2d");
          setPathStartId(id);
          setPathfinderOpen(true);
        }}
        onSetPathEnd={(id) => {
          setViewMode("2d");
          setPathEndId(id);
          setPathfinderOpen(true);
        }}
      />
    </div>
  );
};
