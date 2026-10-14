import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ClusterLabel,
  ColorLens,
  LANGUAGE_NAMES,
  MediaPoint,
  PathResult,
} from "../types";
import { computePointColor } from "../utils/colorLenses";
import {
  getFallbackPosterDataUri,
  getPosterUrl,
} from "../utils/posterUrl";

interface VectorCanvasProps {
  points: MediaPoint[];
  clusterLabels: ClusterLabel[];
  visibleMask: boolean[];
  highlightedSet: Set<number> | null;
  activeLens: ColorLens;
  showLabels: boolean;
  showMapPosters: boolean;
  selectedId: number | null;
  hoveredSimId: number | null;
  pathResult: PathResult | null;
  focusTrigger: { id: number; seq: number } | null;
  onSelectPoint: (id: number | null) => void;
}

const BASE_DOT = 1.15;
const HOVER_RADIUS_PX = 9;

export const VectorCanvas: React.FC<VectorCanvasProps> = ({
  points,
  clusterLabels,
  visibleMask,
  highlightedSet,
  activeLens,
  showLabels,
  showMapPosters,
  selectedId,
  hoveredSimId,
  pathResult,
  focusTrigger,
  onSelectPoint,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef({ x: 0, y: 0, scale: 1 });
  const fittedCountRef = useRef<number>(0);
  const rafIdRef = useRef<number>(0);
  const lastHoverCheckRef = useRef<number>(0);
  const lastHoveredIdRef = useRef<number>(-1);

  const dragRef = useRef({
    dragging: false,
    moved: false,
    lastX: 0,
    lastY: 0,
  });
  const posterImageCacheRef = useRef<
    Map<number, { img: HTMLImageElement; loaded: boolean; failed: boolean }>
  >(new Map());

  const [hoveredPoint, setHoveredPoint] = useState<MediaPoint | null>(null);

  const sizeMultipliers = useMemo(() => {
    let maxPop = 1;
    for (let i = 0; i < points.length; i++) {
      if (points[i].popularity > maxPop) maxPop = points[i].popularity;
    }
    const denom = Math.log1p(maxPop) || 1;
    const out = new Float32Array(points.length);
    for (let i = 0; i < points.length; i++) {
      out[i] = 0.72 + (Math.log1p(points[i].popularity || 1) / denom) * 1.45;
    }
    return out;
  }, [points]);

  const pointColors = useMemo(() => {
    return points.map((p) => computePointColor(p, activeLens));
  }, [points, activeLens]);

  const topLandmarkIds = useMemo(() => {
    return points
      .map((p) => p.id)
      .sort((a, b) => points[b].popularity - points[a].popularity)
      .slice(0, 240);
  }, [points]);

  const wx = (x: number) => x * viewRef.current.scale + viewRef.current.x;
  const wy = (y: number) => y * viewRef.current.scale + viewRef.current.y;
  const sx = (px: number) => (px - viewRef.current.x) / viewRef.current.scale;
  const sy = (py: number) => (py - viewRef.current.y) / viewRef.current.scale;

  const ensurePosterImage = useCallback(
    (pointId: number, onLoadCallback: () => void): HTMLImageElement | null => {
      const cache = posterImageCacheRef.current;
      const existing = cache.get(pointId);
      if (existing) {
        return existing.loaded && !existing.failed ? existing.img : null;
      }
      const pt = points[pointId];
      if (!pt || !pt.poster) return null;
      const url = getPosterUrl(pt.poster, "sm");
      if (!url) return null;

      const img = new Image();
      const entry = { img, loaded: false, failed: false };
      cache.set(pointId, entry);
      img.onload = () => {
        entry.loaded = true;
        onLoadCallback();
      };
      img.onerror = () => {
        entry.failed = true;
      };
      img.src = url;
      return null;
    },
    [points]
  );

  const fitToScreen = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv || points.length === 0) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    const padX = 90;
    const padTop = 120;
    const padBottom = 60;
    const availW = Math.max(200, W - padX * 2);
    const availH = Math.max(200, H - padTop - padBottom);
    const scale = Math.min(availW / (maxX - minX || 1), availH / (maxY - minY || 1));
    viewRef.current.scale = scale;
    viewRef.current.x = padX - minX * scale + (availW - (maxX - minX) * scale) / 2;
    viewRef.current.y = padTop - minY * scale + (availH - (maxY - minY) * scale) / 2;
  }, [points]);

  const drawNow = useCallback(() => {
    rafIdRef.current = 0;
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    ctx.fillStyle = "#08090d";
    ctx.fillRect(0, 0, W, H);

    const scale = viewRef.current.scale;
    const vx = viewRef.current.x;
    const vy = viewRef.current.y;
    const rBase = Math.max(1.05, BASE_DOT * Math.sqrt(scale));
    const hasSelection = selectedId !== null;
    const hasHighlights = highlightedSet !== null;
    const hasPath = Boolean(pathResult && pathResult.nodeIds.length > 1);
    const pathNodeSet = hasPath ? new Set(pathResult!.nodeIds) : null;

    const baseAlpha =
      hasHighlights || hasPath ? 0.14 : hasSelection ? 0.2 : 0.78;
    const skip = scale < 0.75 ? 4 : scale < 1.45 ? 2 : 1;

    // 1. Draw regular points first with single globalAlpha & minimal state changes
    ctx.globalAlpha = baseAlpha;
    let lastFill = "";
    const n = points.length;

    for (let i = 0; i < n; i++) {
      if (!visibleMask[i]) continue;
      if (hasHighlights && highlightedSet!.has(i)) continue;
      if (pathNodeSet && pathNodeSet.has(i)) continue;
      if (skip > 1 && i % skip !== 0) continue;

      const p = points[i];
      const px = p.x * scale + vx;
      if (px < -8 || px > W + 8) continue;
      const py = p.y * scale + vy;
      if (py < -8 || py > H + 8) continue;

      const r = rBase * sizeMultipliers[i];
      const col = pointColors[i];
      if (col !== lastFill) {
        ctx.fillStyle = col;
        lastFill = col;
      }

      if (r < 2.8) {
        const d = r * 2;
        ctx.fillRect(px - r, py - r, d, d);
      } else if (p.mediaType === "tv") {
        ctx.beginPath();
        ctx.moveTo(px, py - r * 1.2);
        ctx.lineTo(px + r * 1.2, py);
        ctx.lineTo(px, py + r * 1.2);
        ctx.lineTo(px - r * 1.2, py);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 1b. Draw highlighted points on top at full opacity
    if (hasHighlights && highlightedSet) {
      ctx.globalAlpha = 0.96;
      lastFill = "";
      for (const i of highlightedSet) {
        if (!visibleMask[i]) continue;
        const p = points[i];
        const px = p.x * scale + vx;
        if (px < -10 || px > W + 10) continue;
        const py = p.y * scale + vy;
        if (py < -10 || py > H + 10) continue;

        const r = rBase * sizeMultipliers[i] * 1.4;
        const col = pointColors[i];
        if (col !== lastFill) {
          ctx.fillStyle = col;
          lastFill = col;
        }
        if (r < 2.4) {
          const d = r * 2;
          ctx.fillRect(px - r, py - r, d, d);
        } else {
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.globalAlpha = 1;

    const scheduleRedraw = () => {
      if (!rafIdRef.current) {
        rafIdRef.current = requestAnimationFrame(drawNow);
      }
    };

    const drawPosterBadge = (
      ptId: number,
      w: number,
      h: number,
      borderColor: string,
      badgeNum?: number
    ) => {
      const pt = points[ptId];
      if (!pt) return;
      const px = wx(pt.x);
      const py = wy(pt.y);
      if (px < -60 || px > W + 60 || py < -60 || py > H + 60) return;

      const img = ensurePosterImage(ptId, scheduleRedraw);
      if (img) {
        ctx.save();
        ctx.fillStyle = "#08090d";
        ctx.fillRect(px - w / 2 - 2, py - h / 2 - 2, w + 4, h + 4);
        ctx.drawImage(img, px - w / 2, py - h / 2, w, h);
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 2;
        ctx.strokeRect(px - w / 2 - 1, py - h / 2 - 1, w + 2, h + 2);
        ctx.restore();
      }

      if (badgeNum !== undefined) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(px - w / 2, py - h / 2, 9, 0, Math.PI * 2);
        ctx.fillStyle = borderColor;
        ctx.fill();
        ctx.font = "700 10px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#08090d";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(badgeNum), px - w / 2, py - h / 2);
        ctx.restore();
      }
    };

    // 2. Landmark posters when zoomed in
    if (showMapPosters && scale >= 1.9 && !hasPath) {
      const placedBoxes: Array<{ x: number; y: number }> = [];
      const cardW = Math.min(44, Math.max(26, scale * 11));
      const cardH = cardW * 1.5;
      const minSpacing = cardH + 14;

      for (const id of topLandmarkIds) {
        if (!visibleMask[id]) continue;
        if (hasHighlights && !highlightedSet!.has(id)) continue;
        const pt = points[id];
        const px = wx(pt.x);
        const py = wy(pt.y);
        if (px < 40 || px > W - 40 || py < 80 || py > H - 40) continue;

        let overlaps = false;
        for (const box of placedBoxes) {
          if (
            Math.abs(box.x - px) < cardW + 12 &&
            Math.abs(box.y - py) < minSpacing
          ) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) continue;
        placedBoxes.push({ x: px, y: py });
        drawPosterBadge(id, cardW, cardH, pointColors[id]);
        if (placedBoxes.length >= 24) break;
      }
    }

    // 3. Draw 20-NN constellation lines & neighbor posters for selected point
    if (selectedId !== null && points[selectedId]) {
      const src = points[selectedId];
      const sxp = wx(src.x);
      const syp = wy(src.y);

      for (const ni of src.similar) {
        const nb = points[ni];
        if (!nb || !visibleMask[ni]) continue;
        const nxp = wx(nb.x);
        const nyp = wy(nb.y);
        const isHot = ni === hoveredSimId;
        ctx.beginPath();
        ctx.moveTo(sxp, syp);
        ctx.lineTo(nxp, nyp);
        ctx.strokeStyle = isHot ? "#ffffff" : "rgba(96, 165, 250, 0.45)";
        ctx.lineWidth = isHot ? 2.6 : 1.1;
        ctx.stroke();
      }

      for (let k = 0; k < src.similar.length; k++) {
        const ni = src.similar[k];
        const nb = points[ni];
        if (!nb || !visibleMask[ni]) continue;
        const nxp = wx(nb.x);
        const nyp = wy(nb.y);
        const isHot = ni === hoveredSimId;

        if (showMapPosters && (isHot || k < 6)) {
          drawPosterBadge(
            ni,
            isHot ? 44 : 32,
            isHot ? 66 : 48,
            isHot ? "#ffffff" : pointColors[ni]
          );
        } else {
          const rr = rBase * sizeMultipliers[ni] + (isHot ? 4 : 2);
          ctx.fillStyle = pointColors[ni];
          ctx.beginPath();
          ctx.arc(nxp, nyp, rr, 0, Math.PI * 2);
          ctx.fill();
          ctx.lineWidth = isHot ? 2.5 : 1.5;
          ctx.strokeStyle = isHot ? "#ffffff" : "rgba(255,255,255,0.75)";
          ctx.stroke();
        }
      }

      if (showMapPosters) {
        drawPosterBadge(selectedId, 48, 72, "#ffffff");
      } else {
        const rs = rBase * sizeMultipliers[selectedId] + 5;
        ctx.beginPath();
        ctx.arc(sxp, syp, rs, 0, Math.PI * 2);
        ctx.fillStyle = pointColors[selectedId];
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      }
    }

    // 4. Draw Pathfinder Constellation Bridge if active
    if (hasPath && pathResult) {
      const ids = pathResult.nodeIds;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < ids.length; i++) {
        const pt = points[ids[i]];
        const px = wx(pt.x);
        const py = wy(pt.y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "rgba(250, 204, 21, 0.92)";
      ctx.lineWidth = 3.2;
      ctx.stroke();

      for (let i = 0; i < ids.length; i++) {
        const pt = points[ids[i]];
        const px = wx(pt.x);
        const py = wy(pt.y);
        const borderCol =
          i === 0
            ? "#22c55e"
            : i === ids.length - 1
            ? "#f43f5e"
            : "#eab308";

        if (showMapPosters) {
          drawPosterBadge(ids[i], 40, 60, borderCol, i + 1);
        } else {
          ctx.beginPath();
          ctx.arc(px, py, 10, 0, Math.PI * 2);
          ctx.fillStyle = borderCol;
          ctx.fill();
          ctx.lineWidth = 2;
          ctx.strokeStyle = "#08090d";
          ctx.stroke();

          ctx.font = "700 11px -apple-system, BlinkMacSystemFont, sans-serif";
          ctx.fillStyle = "#08090d";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(String(i + 1), px, py);
        }

        ctx.font = "600 12px -apple-system, BlinkMacSystemFont, sans-serif";
        ctx.fillStyle = "#fef08a";
        ctx.strokeStyle = "rgba(8, 9, 13, 0.92)";
        ctx.lineWidth = 3;
        const labelOffsetY = showMapPosters ? 38 : 16;
        ctx.strokeText(pt.title, px, py - labelOffsetY);
        ctx.fillText(pt.title, px, py - labelOffsetY);
      }
      ctx.restore();
    }

    // 5. Draw Cluster Labels
    if (showLabels && clusterLabels.length > 0) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const cl of clusterLabels) {
        if (!cl.name) continue;
        const px = wx(cl.x);
        const py = wy(cl.y);
        if (px < -80 || px > W + 80 || py < -40 || py > H + 40) continue;
        const fontSize = Math.min(18, Math.max(10.5, 9.5 + cl.size / 220));
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = "rgba(8, 9, 13, 0.88)";
        ctx.fillStyle = "rgba(241, 245, 249, 0.92)";
        ctx.strokeText(cl.name, px, py);
        ctx.fillText(cl.name, px, py);
      }
    }
  }, [
    points,
    clusterLabels,
    visibleMask,
    highlightedSet,
    pointColors,
    sizeMultipliers,
    topLandmarkIds,
    showLabels,
    showMapPosters,
    selectedId,
    hoveredSimId,
    pathResult,
    ensurePosterImage,
  ]);

  const drawFnRef = useRef<() => void>(() => {});
  drawFnRef.current = drawNow;

  const scheduleDraw = useCallback(() => {
    if (rafIdRef.current) return;
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = 0;
      drawFnRef.current();
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = 0;
      }
    };
  }, []);

  // Size canvas buffer only on mount and actual window resize
  useEffect(() => {
    const handleResize = () => {
      const cv = canvasRef.current;
      if (!cv) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = window.innerWidth;
      const H = window.innerHeight;
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
      const ctx = cv.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawFnRef.current();
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fit to screen once when points dataset loads
  useEffect(() => {
    if (points.length > 0 && fittedCountRef.current !== points.length) {
      fittedCountRef.current = points.length;
      fitToScreen();
      drawFnRef.current();
    }
  }, [points, fitToScreen]);

  useEffect(() => {
    scheduleDraw();
  }, [drawNow, scheduleDraw]);

  useEffect(() => {
    if (!focusTrigger) return;
    const pt = points[focusTrigger.id];
    if (!pt) return;
    const W = window.innerWidth;
    const H = window.innerHeight;
    viewRef.current.scale = Math.max(viewRef.current.scale, 3.2);
    viewRef.current.x = W / 2 - pt.x * viewRef.current.scale;
    viewRef.current.y = H / 2 - pt.y * viewRef.current.scale;
    scheduleDraw();
  }, [focusTrigger, points, scheduleDraw]);

  const pickPoint = (clientX: number, clientY: number): number => {
    const worldX = sx(clientX);
    const worldY = sy(clientY);
    const tol = HOVER_RADIUS_PX / viewRef.current.scale;
    const maxBound = tol * 2.6;
    let bestIdx = -1;
    let bestScore = Infinity;

    const n = points.length;
    for (let i = 0; i < n; i++) {
      if (!visibleMask[i]) continue;
      const dx = points[i].x - worldX;
      if (dx > maxBound || dx < -maxBound) continue;
      const dy = points[i].y - worldY;
      if (dy > maxBound || dy < -maxBound) continue;

      const d2 = dx * dx + dy * dy;
      const mul = sizeMultipliers[i];
      const maxR = tol * mul + tol * 0.5;
      if (d2 < maxR * maxR) {
        const eff = d2 / (mul * mul);
        if (eff < bestScore) {
          bestScore = eff;
          bestIdx = i;
        }
      }
    }
    return bestIdx;
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className="vector-canvas"
        onMouseDown={(e) => {
          dragRef.current = {
            dragging: true,
            moved: false,
            lastX: e.clientX,
            lastY: e.clientY,
          };
        }}
        onMouseMove={(e) => {
          const tx = Math.min(window.innerWidth - 290, e.clientX + 16);
          const ty = Math.min(window.innerHeight - 130, e.clientY + 16);
          if (tooltipRef.current) {
            tooltipRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
          }

          if (dragRef.current.dragging) {
            const dx = e.clientX - dragRef.current.lastX;
            const dy = e.clientY - dragRef.current.lastY;
            if (Math.abs(dx) + Math.abs(dy) > 3) dragRef.current.moved = true;
            viewRef.current.x += dx;
            viewRef.current.y += dy;
            dragRef.current.lastX = e.clientX;
            dragRef.current.lastY = e.clientY;
            if (lastHoveredIdRef.current !== -1) {
              lastHoveredIdRef.current = -1;
              setHoveredPoint(null);
            }
            scheduleDraw();
            return;
          }

          const now = performance.now();
          if (now - lastHoverCheckRef.current < 20) return;
          lastHoverCheckRef.current = now;

          const idx = pickPoint(e.clientX, e.clientY);
          if (idx !== lastHoveredIdRef.current) {
            lastHoveredIdRef.current = idx;
            setHoveredPoint(idx >= 0 ? points[idx] : null);
          }
        }}
        onMouseUp={(e) => {
          if (dragRef.current.dragging && !dragRef.current.moved) {
            const idx = pickPoint(e.clientX, e.clientY);
            if (idx >= 0) onSelectPoint(idx);
            else onSelectPoint(null);
          }
          dragRef.current.dragging = false;
        }}
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.16 : 1 / 1.16;
          const mx = e.clientX;
          const my = e.clientY;
          const bx = sx(mx);
          const by = sy(my);
          const nextScale = Math.max(
            0.2,
            Math.min(viewRef.current.scale * factor, 80)
          );
          viewRef.current.scale = nextScale;
          viewRef.current.x = mx - bx * nextScale;
          viewRef.current.y = my - by * nextScale;
          scheduleDraw();
        }}
      />

      <div
        ref={tooltipRef}
        className="map-tooltip"
        style={{
          left: 0,
          top: 0,
          display: hoveredPoint ? "flex" : "none",
        }}
      >
        {hoveredPoint && (
          <>
            <img
              className="tt-poster"
              src={
                getPosterUrl(hoveredPoint.poster, "sm") ||
                getFallbackPosterDataUri(hoveredPoint)
              }
              alt={hoveredPoint.title}
            />
            <div className="tt-body">
              <div className="tt-header">
                <span className={`res-tag tag-${hoveredPoint.mediaType}`}>
                  {hoveredPoint.mediaType === "tv" ? "TV ◆" : "MOVIE ●"}
                </span>
                <span className="tt-rating">
                  ★ {hoveredPoint.rating.toFixed(1)}
                </span>
              </div>
              <div className="tt-title">{hoveredPoint.title}</div>
              <div className="tt-sub">
                {hoveredPoint.year} ·{" "}
                {LANGUAGE_NAMES[hoveredPoint.language] ||
                  hoveredPoint.language.toUpperCase()}{" "}
                · {hoveredPoint.genres.join(", ")}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="map-hint">
        Scroll to zoom (posters appear as you zoom in) · Drag to pan · Click any
        ● Movie or ◆ TV Series · Press <strong>P</strong> for Map Posters,{" "}
        <strong>L</strong> for Labels, or <strong>G</strong> for 3D Earth
      </div>
    </>
  );
};
