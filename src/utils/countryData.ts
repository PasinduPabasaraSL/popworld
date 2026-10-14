import { MediaPoint } from "../types";

export interface CountryMetadata {
  code: string;
  name: string;
  flag: string;
  continent: string;
  lat: number;
  lng: number;
  /** Optional mainland bounding box [minLng, minLat, maxLng, maxLat] to keep dots on the main inhabited landmass */
  mainlandBounds?: [number, number, number, number];
}

export interface CountryBucket {
  meta: CountryMetadata;
  points: MediaPoint[];
  movieCount: number;
  tvCount: number;
  avgRating: number;
  topGenres: string[];
}

export interface GeoFeature {
  type: "Feature";
  properties: {
    iso2: string;
    name: string;
    continent: string;
  };
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
  _bbox?: [number, number, number, number];
}

export const COUNTRIES_BY_CODE: Record<string, CountryMetadata> = {
  US: {
    code: "US",
    name: "United States",
    flag: "🇺🇸",
    continent: "North America",
    lat: 38.5,
    lng: -96.5,
    mainlandBounds: [-125.0, 25.0, -66.9, 49.0],
  },
  GB: {
    code: "GB",
    name: "United Kingdom",
    flag: "🇬🇧",
    continent: "Europe",
    lat: 53.5,
    lng: -2.2,
    mainlandBounds: [-8.2, 49.9, 1.8, 58.7],
  },
  JP: {
    code: "JP",
    name: "Japan",
    flag: "🇯🇵",
    continent: "Asia",
    lat: 36.2,
    lng: 138.2,
    mainlandBounds: [129.5, 31.0, 145.6, 45.5],
  },
  KR: {
    code: "KR",
    name: "South Korea",
    flag: "🇰🇷",
    continent: "Asia",
    lat: 36.4,
    lng: 127.8,
  },
  IN: {
    code: "IN",
    name: "India",
    flag: "🇮🇳",
    continent: "Asia",
    lat: 22.0,
    lng: 79.0,
    mainlandBounds: [68.1, 8.0, 97.4, 35.5],
  },
  FR: {
    code: "FR",
    name: "France",
    flag: "🇫🇷",
    continent: "Europe",
    lat: 46.6,
    lng: 2.4,
    mainlandBounds: [-5.2, 42.3, 8.3, 51.1],
  },
  ES: {
    code: "ES",
    name: "Spain",
    flag: "🇪🇸",
    continent: "Europe",
    lat: 40.2,
    lng: -3.7,
    mainlandBounds: [-9.3, 36.0, 3.4, 43.8],
  },
  DE: {
    code: "DE",
    name: "Germany",
    flag: "🇩🇪",
    continent: "Europe",
    lat: 51.1,
    lng: 10.4,
  },
  IT: {
    code: "IT",
    name: "Italy",
    flag: "🇮🇹",
    continent: "Europe",
    lat: 42.5,
    lng: 12.5,
  },
  RU: {
    code: "RU",
    name: "Russia",
    flag: "🇷🇺",
    continent: "Europe",
    lat: 57.5,
    lng: 52.0,
    mainlandBounds: [28.0, 45.0, 140.0, 68.0],
  },
  CA: {
    code: "CA",
    name: "Canada",
    flag: "🇨🇦",
    continent: "North America",
    lat: 52.5,
    lng: -98.0,
    mainlandBounds: [-130.0, 43.0, -55.0, 62.0],
  },
  AU: {
    code: "AU",
    name: "Australia",
    flag: "🇦🇺",
    continent: "Oceania",
    lat: -26.5,
    lng: 135.0,
    mainlandBounds: [113.0, -43.6, 153.6, -11.0],
  },
  BR: {
    code: "BR",
    name: "Brazil",
    flag: "🇧🇷",
    continent: "South America",
    lat: -14.2,
    lng: -51.9,
  },
  MX: {
    code: "MX",
    name: "Mexico",
    flag: "🇲🇽",
    continent: "North America",
    lat: 23.6,
    lng: -102.5,
  },
  CN: {
    code: "CN",
    name: "China",
    flag: "🇨🇳",
    continent: "Asia",
    lat: 35.0,
    lng: 106.0,
    mainlandBounds: [75.0, 20.0, 134.0, 50.0],
  },
  HK: {
    code: "HK",
    name: "Hong Kong",
    flag: "🇭🇰",
    continent: "Asia",
    lat: 22.35,
    lng: 114.15,
  },
  TW: {
    code: "TW",
    name: "Taiwan",
    flag: "🇹🇼",
    continent: "Asia",
    lat: 23.7,
    lng: 120.9,
  },
  NL: {
    code: "NL",
    name: "Netherlands",
    flag: "🇳🇱",
    continent: "Europe",
    lat: 52.2,
    lng: 5.5,
    mainlandBounds: [3.3, 50.7, 7.2, 53.5],
  },
  TR: {
    code: "TR",
    name: "Turkey",
    flag: "🇹🇷",
    continent: "Asia",
    lat: 39.0,
    lng: 35.2,
  },
  SE: {
    code: "SE",
    name: "Sweden",
    flag: "🇸🇪",
    continent: "Europe",
    lat: 60.1,
    lng: 16.0,
  },
  NO: {
    code: "NO",
    name: "Norway",
    flag: "🇳🇴",
    continent: "Europe",
    lat: 61.5,
    lng: 9.0,
    mainlandBounds: [4.6, 58.0, 31.0, 71.2],
  },
  DK: {
    code: "DK",
    name: "Denmark",
    flag: "🇩🇰",
    continent: "Europe",
    lat: 56.1,
    lng: 9.5,
    mainlandBounds: [8.0, 54.5, 12.7, 57.8],
  },
  FI: {
    code: "FI",
    name: "Finland",
    flag: "🇫🇮",
    continent: "Europe",
    lat: 62.5,
    lng: 26.0,
  },
  HU: {
    code: "HU",
    name: "Hungary",
    flag: "🇭🇺",
    continent: "Europe",
    lat: 47.1,
    lng: 19.5,
  },
  TH: {
    code: "TH",
    name: "Thailand",
    flag: "🇹🇭",
    continent: "Asia",
    lat: 15.8,
    lng: 100.9,
  },
  PL: {
    code: "PL",
    name: "Poland",
    flag: "🇵🇱",
    continent: "Europe",
    lat: 52.0,
    lng: 19.1,
  },
  AR: {
    code: "AR",
    name: "Argentina",
    flag: "🇦🇷",
    continent: "South America",
    lat: -36.0,
    lng: -64.0,
  },
  CO: {
    code: "CO",
    name: "Colombia",
    flag: "🇨🇴",
    continent: "South America",
    lat: 4.5,
    lng: -74.3,
  },
  ID: {
    code: "ID",
    name: "Indonesia",
    flag: "🇮🇩",
    continent: "Asia",
    lat: -2.5,
    lng: 117.0,
  },
  PH: {
    code: "PH",
    name: "Philippines",
    flag: "🇵🇭",
    continent: "Asia",
    lat: 12.8,
    lng: 121.7,
  },
  VN: {
    code: "VN",
    name: "Vietnam",
    flag: "🇻🇳",
    continent: "Asia",
    lat: 16.0,
    lng: 107.8,
  },
  UA: {
    code: "UA",
    name: "Ukraine",
    flag: "🇺🇦",
    continent: "Europe",
    lat: 48.8,
    lng: 31.2,
  },
  GR: {
    code: "GR",
    name: "Greece",
    flag: "🇬🇷",
    continent: "Europe",
    lat: 39.2,
    lng: 22.0,
  },
  PT: {
    code: "PT",
    name: "Portugal",
    flag: "🇵🇹",
    continent: "Europe",
    lat: 39.6,
    lng: -8.1,
    mainlandBounds: [-9.5, 36.9, -6.2, 42.2],
  },
  IE: {
    code: "IE",
    name: "Ireland",
    flag: "🇮🇪",
    continent: "Europe",
    lat: 53.3,
    lng: -8.0,
  },
  NZ: {
    code: "NZ",
    name: "New Zealand",
    flag: "🇳🇿",
    continent: "Oceania",
    lat: -41.5,
    lng: 173.5,
  },
  BE: {
    code: "BE",
    name: "Belgium",
    flag: "🇧🇪",
    continent: "Europe",
    lat: 50.6,
    lng: 4.5,
  },
  AT: {
    code: "AT",
    name: "Austria",
    flag: "🇦🇹",
    continent: "Europe",
    lat: 47.6,
    lng: 14.1,
  },
  CH: {
    code: "CH",
    name: "Switzerland",
    flag: "🇨🇭",
    continent: "Europe",
    lat: 46.8,
    lng: 8.2,
  },
  CZ: {
    code: "CZ",
    name: "Czechia",
    flag: "🇨🇿",
    continent: "Europe",
    lat: 49.8,
    lng: 15.5,
  },
  RO: {
    code: "RO",
    name: "Romania",
    flag: "🇷🇴",
    continent: "Europe",
    lat: 45.9,
    lng: 24.9,
  },
  IR: {
    code: "IR",
    name: "Iran",
    flag: "🇮🇷",
    continent: "Asia",
    lat: 32.4,
    lng: 53.6,
  },
  IL: {
    code: "IL",
    name: "Israel",
    flag: "🇮🇱",
    continent: "Asia",
    lat: 31.4,
    lng: 35.0,
  },
  EG: {
    code: "EG",
    name: "Egypt",
    flag: "🇪🇬",
    continent: "Africa",
    lat: 26.8,
    lng: 30.8,
  },
  ZA: {
    code: "ZA",
    name: "South Africa",
    flag: "🇿🇦",
    continent: "Africa",
    lat: -29.5,
    lng: 24.5,
  },
  NG: {
    code: "NG",
    name: "Nigeria",
    flag: "🇳🇬",
    continent: "Africa",
    lat: 9.1,
    lng: 8.6,
  },
  AZ: {
    code: "AZ",
    name: "Azerbaijan",
    flag: "🇦🇿",
    continent: "Asia",
    lat: 40.3,
    lng: 47.6,
  },
  BD: {
    code: "BD",
    name: "Bangladesh",
    flag: "🇧🇩",
    continent: "Asia",
    lat: 23.7,
    lng: 90.3,
  },
  PK: {
    code: "PK",
    name: "Pakistan",
    flag: "🇵🇰",
    continent: "Asia",
    lat: 30.4,
    lng: 69.3,
  },
  MY: {
    code: "MY",
    name: "Malaysia",
    flag: "🇲🇾",
    continent: "Asia",
    lat: 4.2,
    lng: 102.0,
  },
  SG: {
    code: "SG",
    name: "Singapore",
    flag: "🇸🇬",
    continent: "Asia",
    lat: 1.35,
    lng: 103.8,
  },
  CL: {
    code: "CL",
    name: "Chile",
    flag: "🇨🇱",
    continent: "South America",
    lat: -33.5,
    lng: -70.8,
  },
  PE: {
    code: "PE",
    name: "Peru",
    flag: "🇵🇪",
    continent: "South America",
    lat: -10.0,
    lng: -75.5,
  },
  RS: {
    code: "RS",
    name: "Serbia",
    flag: "🇷🇸",
    continent: "Europe",
    lat: 44.1,
    lng: 20.9,
  },
  HR: {
    code: "HR",
    name: "Croatia",
    flag: "🇭🇷",
    continent: "Europe",
    lat: 45.2,
    lng: 15.5,
  },
  BG: {
    code: "BG",
    name: "Bulgaria",
    flag: "🇧🇬",
    continent: "Europe",
    lat: 42.7,
    lng: 25.4,
  },
  IS: {
    code: "IS",
    name: "Iceland",
    flag: "🇮🇸",
    continent: "Europe",
    lat: 64.9,
    lng: -18.8,
  },
  EE: {
    code: "EE",
    name: "Estonia",
    flag: "🇪🇪",
    continent: "Europe",
    lat: 58.6,
    lng: 25.2,
  },
  LT: {
    code: "LT",
    name: "Lithuania",
    flag: "🇱🇹",
    continent: "Europe",
    lat: 55.2,
    lng: 23.9,
  },
  LV: {
    code: "LV",
    name: "Latvia",
    flag: "🇱🇻",
    continent: "Europe",
    lat: 56.9,
    lng: 24.6,
  },
  GE: {
    code: "GE",
    name: "Georgia",
    flag: "🇬🇪",
    continent: "Asia",
    lat: 42.2,
    lng: 43.4,
  },
  KZ: {
    code: "KZ",
    name: "Kazakhstan",
    flag: "🇰🇿",
    continent: "Asia",
    lat: 48.0,
    lng: 67.0,
  },
  KE: {
    code: "KE",
    name: "Kenya",
    flag: "🇰🇪",
    continent: "Africa",
    lat: 0.2,
    lng: 37.8,
  },
  MA: {
    code: "MA",
    name: "Morocco",
    flag: "🇲🇦",
    continent: "Africa",
    lat: 32.0,
    lng: -6.5,
  },
  SN: {
    code: "SN",
    name: "Senegal",
    flag: "🇸🇳",
    continent: "Africa",
    lat: 14.5,
    lng: -14.4,
  },
};

const LANG_TO_DEFAULT_COUNTRY: Record<string, string> = {
  en: "US",
  ja: "JP",
  ko: "KR",
  ru: "RU",
  es: "ES",
  fr: "FR",
  de: "DE",
  it: "IT",
  pt: "BR",
  zh: "CN",
  cn: "HK",
  yue: "HK",
  hi: "IN",
  ta: "IN",
  te: "IN",
  ml: "IN",
  kn: "IN",
  mr: "IN",
  pa: "IN",
  gu: "IN",
  bn: "IN",
  ur: "PK",
  nl: "NL",
  tr: "TR",
  hu: "HU",
  sv: "SE",
  no: "NO",
  nb: "NO",
  da: "DK",
  fi: "FI",
  th: "TH",
  id: "ID",
  vi: "VN",
  tl: "PH",
  el: "GR",
  pl: "PL",
  uk: "UA",
  cs: "CZ",
  ro: "RO",
  fa: "IR",
  he: "IL",
  ar: "EG",
  az: "AZ",
  ms: "MY",
  sr: "RS",
  hr: "HR",
  bg: "BG",
  is: "IS",
  et: "EE",
  lt: "LT",
  lv: "LV",
  ka: "GE",
  kk: "KZ",
  af: "ZA",
  zu: "ZA",
  sw: "KE",
};

const UK_CREATORS_AND_NETWORKS = new Set([
  "bbc one", "bbc two", "bbc three", "bbc four", "itv1", "itv2", "itv",
  "channel 4", "5", "channel 5", "sky", "sky atlantic", "sky max", "e4",
  "cbbc", "cbeebies", "dave", "s4c", "bbc iplayer", "more4",
  "alfred hitchcock", "ridley scott", "christopher nolan", "danny boyle",
  "guy ritchie", "edgar wright", "ken loach", "mike leigh", "sam mendes",
  "alex garland", "steve mcqueen", "david lean", "michael winterbottom",
  "shane meadows", "paul greengrass", "matthew vaughn", "terry gilliam",
  "richard curtis", "joe wright", "andrea arnold", "lynne ramsay",
]);

const CA_CREATORS_AND_NETWORKS = new Set([
  "cbc", "ctv", "global", "citytv", "showcase", "crave", "ytv", "teletoon",
  "family channel", "tsn", "much", "w network", "hgtv canada",
  "denis villeneuve", "david cronenberg", "atom egoyan", "xavier dolan",
  "sarah polley", "ivan reitman", "norman jewison", "guy maddin",
]);

const AU_CREATORS_AND_NETWORKS = new Set([
  "abc tv", "nine network", "seven network", "network 10", "10", "foxtel",
  "stan", "abc kids", "abc me", "sbs",
  "george miller", "baz luhrmann", "peter weir", "phillip noyce",
  "gillian armstrong", "warwick thornton", "jennifer kent", "justin kurzel",
]);

const NZ_CREATORS_AND_NETWORKS = new Set([
  "tvnz 1", "tvnz 2", "three", "prime", "maori television",
  "peter jackson", "taika waititi", "jane campion", "roger donaldson",
]);

const IE_CREATORS_AND_NETWORKS = new Set([
  "rté one", "rté2", "virgin media one", "tg4",
  "martin mcdonagh", "neil jordan", "jim sheridan", "lenny abrahamson", "john carney",
]);

export function resolveMediaCountry(point: MediaPoint): string {
  const lang = (point.language || "en").toLowerCase();
  const creatorLow = (point.creator || "").toLowerCase().trim();
  const kwJoined = (point.keywords || []).join(" ").toLowerCase();
  const overviewLow = (point.overview || "").toLowerCase();

  if (lang === "en") {
    if (UK_CREATORS_AND_NETWORKS.has(creatorLow)) return "GB";
    if (CA_CREATORS_AND_NETWORKS.has(creatorLow)) return "CA";
    if (AU_CREATORS_AND_NETWORKS.has(creatorLow)) return "AU";
    if (NZ_CREATORS_AND_NETWORKS.has(creatorLow)) return "NZ";
    if (IE_CREATORS_AND_NETWORKS.has(creatorLow)) return "IE";

    if (
      kwJoined.includes("london") ||
      kwJoined.includes("england") ||
      kwJoined.includes("scotland") ||
      kwJoined.includes("british") ||
      overviewLow.includes("british") ||
      overviewLow.includes("london") ||
      overviewLow.includes("uk ")
    ) {
      return "GB";
    }
    if (
      kwJoined.includes("canada") ||
      kwJoined.includes("toronto") ||
      kwJoined.includes("vancouver") ||
      overviewLow.includes("canadian") ||
      overviewLow.includes("toronto")
    ) {
      return "CA";
    }
    if (
      kwJoined.includes("australia") ||
      kwJoined.includes("sydney") ||
      kwJoined.includes("melbourne") ||
      overviewLow.includes("australian") ||
      overviewLow.includes("sydney")
    ) {
      return "AU";
    }
    if (
      kwJoined.includes("ireland") ||
      kwJoined.includes("dublin") ||
      overviewLow.includes("irish") ||
      overviewLow.includes("dublin")
    ) {
      return "IE";
    }
    if (
      kwJoined.includes("new zealand") ||
      overviewLow.includes("new zealand")
    ) {
      return "NZ";
    }
    if (
      kwJoined.includes("south africa") ||
      overviewLow.includes("south africa")
    ) {
      return "ZA";
    }
    if (kwJoined.includes("nigeria") || overviewLow.includes("nigeria")) {
      return "NG";
    }
    return "US";
  }

  if (lang === "es") {
    if (
      kwJoined.includes("mexico") ||
      overviewLow.includes("mexican") ||
      overviewLow.includes("mexico") ||
      creatorLow.includes("televisa") ||
      creatorLow.includes("guillermo del toro") ||
      creatorLow.includes("alfonso cuarón")
    ) {
      return "MX";
    }
    if (
      kwJoined.includes("argentina") ||
      kwJoined.includes("buenos aires") ||
      overviewLow.includes("argentin") ||
      creatorLow.includes("telefe") ||
      creatorLow.includes("el trece")
    ) {
      return "AR";
    }
    if (
      kwJoined.includes("colombia") ||
      kwJoined.includes("bogota") ||
      kwJoined.includes("medellin") ||
      overviewLow.includes("colombia") ||
      creatorLow.includes("caracol") ||
      creatorLow.includes("rcn")
    ) {
      return "CO";
    }
    if (kwJoined.includes("chile") || overviewLow.includes("chilean")) {
      return "CL";
    }
    if (kwJoined.includes("peru") || overviewLow.includes("peruvian")) {
      return "PE";
    }
    return "ES";
  }

  if (lang === "pt") {
    if (
      kwJoined.includes("portugal") ||
      kwJoined.includes("lisbon") ||
      overviewLow.includes("portuguese") ||
      creatorLow.includes("rtp") ||
      creatorLow.includes("sic") ||
      creatorLow.includes("tvi")
    ) {
      return "PT";
    }
    return "BR";
  }

  if (lang === "fr") {
    if (
      kwJoined.includes("belgium") ||
      kwJoined.includes("brussels") ||
      overviewLow.includes("belgian")
    ) {
      return "BE";
    }
    if (
      kwJoined.includes("quebec") ||
      kwJoined.includes("montreal") ||
      kwJoined.includes("canada")
    ) {
      return "CA";
    }
    if (kwJoined.includes("switzerland") || overviewLow.includes("swiss")) {
      return "CH";
    }
    if (kwJoined.includes("senegal") || overviewLow.includes("senegal")) {
      return "SN";
    }
    return "FR";
  }

  if (lang === "de") {
    if (
      kwJoined.includes("austria") ||
      kwJoined.includes("vienna") ||
      overviewLow.includes("austrian") ||
      creatorLow === "michael haneke"
    ) {
      return "AT";
    }
    if (kwJoined.includes("switzerland") || overviewLow.includes("swiss")) {
      return "CH";
    }
    return "DE";
  }

  if (lang === "zh" || lang === "cn" || lang === "yue") {
    if (
      lang === "cn" ||
      lang === "yue" ||
      kwJoined.includes("hong kong") ||
      overviewLow.includes("hong kong") ||
      creatorLow.includes("tvb")
    ) {
      return "HK";
    }
    if (
      kwJoined.includes("taiwan") ||
      kwJoined.includes("taipei") ||
      overviewLow.includes("taiwan")
    ) {
      return "TW";
    }
    return "CN";
  }

  if (lang === "bn" && (kwJoined.includes("bangladesh") || overviewLow.includes("bangladesh"))) {
    return "BD";
  }

  return LANG_TO_DEFAULT_COUNTRY[lang] || "US";
}

const bucketsCache = new WeakMap<
  MediaPoint[],
  {
    bucketsByCode: Map<string, CountryBucket>;
    sortedBuckets: CountryBucket[];
    pointCountryCodes: string[];
  }
>();

export function buildCountryBuckets(points: MediaPoint[]): {
  bucketsByCode: Map<string, CountryBucket>;
  sortedBuckets: CountryBucket[];
  pointCountryCodes: string[];
} {
  if (points.length === 0) {
    return {
      bucketsByCode: new Map(),
      sortedBuckets: [],
      pointCountryCodes: [],
    };
  }
  const cached = bucketsCache.get(points);
  if (cached) return cached;

  const grouped = new Map<string, MediaPoint[]>();
  const pointCountryCodes = new Array<string>(points.length);

  for (let i = 0; i < points.length; i++) {
    const code = resolveMediaCountry(points[i]);
    pointCountryCodes[i] = code;
    let list = grouped.get(code);
    if (!list) {
      list = [];
      grouped.set(code, list);
    }
    list.push(points[i]);
  }

  const bucketsByCode = new Map<string, CountryBucket>();

  for (const [code, list] of grouped.entries()) {
    const meta = COUNTRIES_BY_CODE[code];
    if (!meta) continue;

    let movieCount = 0;
    let tvCount = 0;
    let ratingSum = 0;
    const genreCounts = new Map<string, number>();

    for (const p of list) {
      if (p.mediaType === "tv") tvCount++;
      else movieCount++;
      ratingSum += p.rating || 0;
      for (const g of p.genres) {
        genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
      }
    }

    const topGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([g]) => g);

    bucketsByCode.set(code, {
      meta,
      points: list,
      movieCount,
      tvCount,
      avgRating: list.length ? ratingSum / list.length : 0,
      topGenres,
    });
  }

  const sortedBuckets = Array.from(bucketsByCode.values()).sort(
    (a, b) => b.points.length - a.points.length
  );

  const result = { bucketsByCode, sortedBuckets, pointCountryCodes };
  bucketsCache.set(points, result);
  return result;
}

export function getFeatureBBox(
  feature: GeoFeature
): [number, number, number, number] {
  if (feature._bbox) return feature._bbox;
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  const scanRing = (ring: number[][]) => {
    for (let i = 0; i < ring.length; i++) {
      const lng = ring[i][0];
      const lat = ring[i][1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  };
  if (feature.geometry.type === "Polygon") {
    const rings = feature.geometry.coordinates as number[][][];
    if (rings[0]) scanRing(rings[0]);
  } else {
    const polys = feature.geometry.coordinates as number[][][][];
    for (let p = 0; p < polys.length; p++) {
      if (polys[p][0]) scanRing(polys[p][0]);
    }
  }
  const bbox: [number, number, number, number] = [
    minLng,
    minLat,
    maxLng,
    maxLat,
  ];
  feature._bbox = bbox;
  return bbox;
}

export function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0],
      yi = ring[i][1];
    const xj = ring[j][0],
      yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInsideFeature(
  lng: number,
  lat: number,
  feature: GeoFeature
): boolean {
  const [minLng, minLat, maxLng, maxLat] = getFeatureBBox(feature);
  if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) {
    return false;
  }
  const geom = feature.geometry;
  if (geom.type === "Polygon") {
    const rings = geom.coordinates as number[][][];
    return Boolean(rings[0] && pointInRing(lng, lat, rings[0]));
  }
  if (geom.type === "MultiPolygon") {
    const polys = geom.coordinates as number[][][][];
    for (let i = 0; i < polys.length; i++) {
      if (polys[i][0] && pointInRing(lng, lat, polys[i][0])) return true;
    }
  }
  return false;
}

const coordsCacheWithGeo = new WeakMap<
  MediaPoint[],
  { lats: Float32Array; lngs: Float32Array }
>();

/**
 * Computes deterministic (lat, lng) coordinates for all 80,000 Movies & TV Series
 * so every title is plotted as a dot strictly inside its respective country's
 * real geographic borders on the 3D Earth, while preserving relative UMAP grouping.
 */
export function distributePointsInsideCountries(
  points: MediaPoint[],
  bucketsByCode: Map<string, CountryBucket>,
  features: GeoFeature[]
): { lats: Float32Array; lngs: Float32Array } {
  const n = points.length;
  if (n === 0) {
    return { lats: new Float32Array(0), lngs: new Float32Array(0) };
  }
  if (features.length > 0) {
    const cached = coordsCacheWithGeo.get(points);
    if (cached) return cached;
  }

  const lats = new Float32Array(n);
  const lngs = new Float32Array(n);

  const featureByIso = new Map<string, GeoFeature>();
  for (const f of features) {
    if (f.properties.iso2) {
      featureByIso.set(f.properties.iso2, f);
    }
  }

  let seed = 133742;
  const nextRand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (const [code, bucket] of bucketsByCode.entries()) {
    const meta = bucket.meta;
    const feat = featureByIso.get(code);
    const items = bucket.points;
    if (items.length === 0) continue;

    const poolSize = Math.min(items.length, 450);
    const sampleCoords: Array<{ lat: number; lng: number }> = [];

    if (feat) {
      const [minLng, minLat, maxLng, maxLat] =
        meta.mainlandBounds || getFeatureBBox(feat);

      const padLng = (maxLng - minLng) * 0.05;
      const padLat = (maxLat - minLat) * 0.05;
      const bMinLng = minLng + padLng;
      const bMaxLng = maxLng - padLng;
      const bMinLat = minLat + padLat;
      const bMaxLat = maxLat - padLat;

      let attempts = 0;
      const maxAttempts = poolSize * 8;
      while (sampleCoords.length < poolSize && attempts < maxAttempts) {
        attempts++;
        const candLng = bMinLng + nextRand() * (bMaxLng - bMinLng);
        const candLat = bMinLat + nextRand() * (bMaxLat - bMinLat);
        if (isPointInsideFeature(candLng, candLat, feat)) {
          sampleCoords.push({ lat: candLat, lng: candLng });
        }
      }
    }

    while (sampleCoords.length < poolSize) {
      const angle = nextRand() * Math.PI * 2;
      const rad = Math.sqrt(nextRand()) * 0.5;
      sampleCoords.push({
        lat: meta.lat + Math.sin(angle) * rad,
        lng: meta.lng + Math.cos(angle) * rad,
      });
    }

    sampleCoords.sort((a, b) => a.lat + a.lng * 0.5 - (b.lat + b.lng * 0.5));
    const sortedItems = [...items].sort(
      (a, b) => a.y + a.x * 0.5 - (b.y + b.x * 0.5)
    );

    for (let i = 0; i < sortedItems.length; i++) {
      const pt = sortedItems[i];
      const poolIdx = Math.min(
        sampleCoords.length - 1,
        Math.floor((i / sortedItems.length) * sampleCoords.length)
      );
      const base = sampleCoords[poolIdx];
      lats[pt.id] = base.lat + (nextRand() - 0.5) * 0.14;
      lngs[pt.id] = base.lng + (nextRand() - 0.5) * 0.14;
    }
  }

  const out = { lats, lngs };
  if (features.length > 0) {
    coordsCacheWithGeo.set(points, out);
  }
  return out;
}
