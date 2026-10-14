export type MediaType = "movie" | "tv";

export type ColorLens = "cluster" | "mediaType" | "rating" | "hiddenGems" | "era";

export type MediaFilter = "all" | "movie" | "tv";

export type MatchMode = "or" | "and";

export interface MediaPoint {
  id: number;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  year: number;
  language: string;
  genres: string[];
  keywords: string[];
  cast: string[];
  creator: string;
  rating: number;
  popularity: number;
  runtime: number | null;
  seasons: number | null;
  poster: string;
  overview: string;
  x: number;
  y: number;
  cluster: number;
  color: string;
  similar: number[];
}

export interface ClusterLabel {
  cluster: number;
  name: string;
  x: number;
  y: number;
  size: number;
  color?: string;
}

export interface HighlightChip {
  type: "genre" | "keyword" | "creator";
  value: string;
}

export interface PathStep {
  fromId: number;
  toId: number;
  sharedGenres: string[];
  sharedKeywords: string[];
}

export interface PathResult {
  nodeIds: number[];
  steps: PathStep[];
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  ja: "Japanese",
  ko: "Korean",
  de: "German",
  pt: "Portuguese",
  it: "Italian",
  zh: "Chinese",
  hi: "Hindi",
  ru: "Russian",
  sv: "Swedish",
  da: "Danish",
  id: "Indonesian",
  ta: "Tamil",
  tr: "Turkish",
};
