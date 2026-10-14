import { ColorLens, MediaPoint } from "../types";

export interface LensMetadata {
  id: ColorLens;
  label: string;
  shortDesc: string;
  legend: Array<{ color: string; label: string }>;
}

export const COLOR_LENSES: LensMetadata[] = [
  {
    id: "cluster",
    label: "Cluster Map",
    shortDesc: "Colored by HDBSCAN high-dimensional semantic cluster",
    legend: [
      { color: "#38bdf8", label: "Sci-Fi & Cyberpunk" },
      { color: "#f43f5e", label: "Crime & Thriller" },
      { color: "#f59e0b", label: "Fantasy & Action" },
      { color: "#34d399", label: "Comedy & Drama" },
      { color: "#a3e635", label: "Documentaries" },
    ],
  },
  {
    id: "mediaType",
    label: "Movies vs. TV",
    shortDesc: "Distinguishes Feature Films (circles) from TV Series (diamonds)",
    legend: [
      { color: "#38bdf8", label: "Movie (Circle ●)" },
      { color: "#f472b6", label: "TV Series (Diamond ◆)" },
    ],
  },
  {
    id: "rating",
    label: "Rating Heatmap",
    shortDesc: "Critical acclaim gradient from 5.0 (cool indigo) to 9.0+ (gold)",
    legend: [
      { color: "#4338ca", label: "< 6.5" },
      { color: "#0ea5e9", label: "6.5 – 7.4" },
      { color: "#10b981", label: "7.5 – 8.2" },
      { color: "#f59e0b", label: "8.3 – 8.8" },
      { color: "#fde047", label: "8.9+ Masterpiece" },
    ],
  },
  {
    id: "hiddenGems",
    label: "Hidden Gems",
    shortDesc: "Highlights high-rated titles with lower mainstream popularity",
    legend: [
      { color: "#334155", label: "Mainstream / Low Gem Score" },
      { color: "#06b6d4", label: "Notable Deep Cut" },
      { color: "#a855f7", label: "Cult Favorite" },
      { color: "#f43f5e", label: "Top Hidden Gem (High ★ / Low Pop)" },
    ],
  },
  {
    id: "era",
    label: "Release Era",
    shortDesc: "Chronological gradient from Classic Cinema (<1985) to Modern (2020s)",
    legend: [
      { color: "#f97316", label: "Pre-1990 Classic" },
      { color: "#eab308", label: "1990s" },
      { color: "#22c55e", label: "2000s" },
      { color: "#06b6d4", label: "2010s" },
      { color: "#a855f7", label: "2020s Modern" },
    ],
  },
];

function lerpColor(
  c1: [number, number, number],
  c2: [number, number, number],
  t: number
): string {
  const clamped = Math.max(0, Math.min(1, t));
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * clamped);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * clamped);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * clamped);
  return `rgb(${r},${g},${b})`;
}

export function computePointColor(point: MediaPoint, lens: ColorLens): string {
  switch (lens) {
    case "cluster":
      return point.color || "#6b7280";

    case "mediaType":
      return point.mediaType === "movie" ? "rgb(56,189,248)" : "rgb(244,114,182)";

    case "rating": {
      const r = point.rating || 6.5;
      if (r < 6.5) {
        return lerpColor([55, 48, 163], [14, 165, 233], (r - 5.0) / 1.5);
      }
      if (r < 7.6) {
        return lerpColor([14, 165, 233], [16, 185, 129], (r - 6.5) / 1.1);
      }
      if (r < 8.5) {
        return lerpColor([16, 185, 129], [245, 158, 11], (r - 7.6) / 0.9);
      }
      return lerpColor([245, 158, 11], [253, 224, 71], (r - 8.5) / 0.9);
    }

    case "hiddenGems": {
      // Hidden Gem score rewards high rating (>7.2) with lower popularity
      const ratingBoost = Math.max(0, (point.rating || 6.0) - 6.2);
      const popPenalty = Math.log1p(Math.max(1, point.popularity || 10));
      const gemScore = (ratingBoost * ratingBoost) / popPenalty;
      // Typical gemScore range is ~0.0 to ~2.8
      const norm = Math.max(0, Math.min(1, gemScore / 2.2));
      if (norm < 0.35) {
        return lerpColor([51, 65, 85], [6, 182, 212], norm / 0.35);
      }
      if (norm < 0.7) {
        return lerpColor([6, 182, 212], [168, 85, 247], (norm - 0.35) / 0.35);
      }
      return lerpColor([168, 85, 247], [244, 63, 94], (norm - 0.7) / 0.3);
    }

    case "era": {
      const y = point.year || 2010;
      if (y < 1990) return "rgb(249,115,22)";
      if (y < 2000) return lerpColor([249, 115, 22], [234, 179, 8], (y - 1990) / 10);
      if (y < 2010) return lerpColor([234, 179, 8], [34, 197, 94], (y - 2000) / 10);
      if (y < 2020) return lerpColor([34, 197, 94], [6, 182, 212], (y - 2010) / 10);
      return lerpColor([6, 182, 212], [168, 85, 247], (y - 2020) / 6);
    }
  }
}
