import { MediaPoint } from "../types";

const TMDB_IMG_SM = "https://image.tmdb.org/t/p/w185";
const TMDB_IMG_MD = "https://image.tmdb.org/t/p/w342";

/**
 * Resolves either a TMDB relative poster path (`/abc.jpg`) or a full HTTPS
 * poster URL (`https://static.tvmaze.com/...`) to a ready-to-render URL.
 */
export function getPosterUrl(
  poster: string | undefined | null,
  size: "sm" | "md" = "md"
): string {
  if (!poster) return "";
  const trimmed = poster.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed.replace(/^http:\/\//i, "https://");
  }
  const base = size === "sm" ? TMDB_IMG_SM : TMDB_IMG_MD;
  return `${base}${trimmed.startsWith("/") ? trimmed : `/${trimmed}`}`;
}

/**
 * Generates an inline SVG data-URI fallback poster if an external image fails to load.
 */
export function getFallbackPosterDataUri(
  point: Pick<MediaPoint, "title" | "year" | "mediaType" | "color">
): string {
  const safeTitle = point.title
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 28);
  const badge = point.mediaType === "tv" ? "TV SERIES" : "MOVIE";
  const accent = point.color || "#38bdf8";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360" viewBox="0 0 240 360">
    <rect width="240" height="360" fill="#121622"/>
    <rect x="0" y="0" width="240" height="6" fill="${accent}"/>
    <rect x="16" y="16" width="208" height="328" rx="6" fill="none" stroke="#252c3d" stroke-width="1.5"/>
    <text x="28" y="46" fill="${accent}" font-family="sans-serif" font-size="11" font-weight="700" letter-spacing="1.5">${badge}</text>
    <text x="28" y="180" fill="#eef2f8" font-family="sans-serif" font-size="16" font-weight="700">${safeTitle}</text>
    <text x="28" y="206" fill="#8e96aa" font-family="sans-serif" font-size="13">${point.year || ""}</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
