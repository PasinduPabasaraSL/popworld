import React, { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { ColorLens, MediaFilter, MediaPoint } from "../types";
import { computePointColor } from "../utils/colorLenses";
import {
  buildCountryBuckets,
  COUNTRIES_BY_CODE,
  CountryBucket,
  distributePointsInsideCountries,
  GeoFeature,
  isPointInsideFeature,
} from "../utils/countryData";
import {
  getFallbackPosterDataUri,
  getPosterUrl,
} from "../utils/posterUrl";

interface EarthGlobeViewProps {
  points: MediaPoint[];
  activeLens: ColorLens;
  mediaFilter: MediaFilter;
  onChangeMediaFilter: (filter: MediaFilter) => void;
  selectedId: number | null;
  onSelectPoint: (id: number) => void;
  onLocateOn2DMap: (id: number) => void;
}

type SortBy = "popular" | "rating" | "newest";
type EarthTextureMode = "day_night" | "night";
type PanelLayout = "grid" | "list";

const GLOBE_RADIUS = 100;
const MATH_GLOBE_SPHERE = new THREE.Sphere(
  new THREE.Vector3(0, 0, 0),
  GLOBE_RADIUS
);

function latLngToXYZ(
  lat: number,
  lng: number,
  radius: number
): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  const sinPhi = Math.sin(phi);
  return [
    -(radius * sinPhi * Math.cos(theta)),
    radius * Math.cos(phi),
    radius * sinPhi * Math.sin(theta),
  ];
}

function fastParseRgb(colorStr: string): [number, number, number] {
  if (colorStr.startsWith("rgb(")) {
    const inner = colorStr.slice(4, -1);
    const c1 = inner.indexOf(",");
    const c2 = inner.indexOf(",", c1 + 1);
    if (c1 > 0 && c2 > c1) {
      const r = Number(inner.slice(0, c1)) / 255;
      const g = Number(inner.slice(c1 + 1, c2)) / 255;
      const b = Number(inner.slice(c2 + 1)) / 255;
      return [r, g, b];
    }
  }
  if (colorStr.startsWith("#") && colorStr.length === 7) {
    const hex = parseInt(colorStr.slice(1), 16);
    return [
      ((hex >> 16) & 255) / 255,
      ((hex >> 8) & 255) / 255,
      (hex & 255) / 255,
    ];
  }
  return [0.22, 0.74, 0.97];
}

function createCircleDotTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 64;
  cv.height = 64;
  const ctx = cv.getContext("2d")!;
  ctx.clearRect(0, 0, 64, 64);

  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();

  ctx.lineWidth = 4;
  ctx.strokeStyle = "rgba(8, 10, 16, 0.65)";
  ctx.stroke();

  const tex = new THREE.CanvasTexture(cv);
  tex.needsUpdate = true;
  return tex;
}

export const EarthGlobeView: React.FC<EarthGlobeViewProps> = ({
  points,
  activeLens,
  mediaFilter,
  onChangeMediaFilter,
  selectedId,
  onSelectPoint,
  onLocateOn2DMap,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const dotTooltipRef = useRef<HTMLDivElement | null>(null);
  const countryTooltipRef = useRef<HTMLDivElement | null>(null);

  const [geoFeatures, setGeoFeatures] = useState<GeoFeature[]>([]);
  const [selectedCountryCode, setSelectedCountryCode] = useState<string>("US");
  const [onlySelectedCountryDots, setOnlySelectedCountryDots] =
    useState<boolean>(false);

  const [hoveredDot, setHoveredDot] = useState<{
    point: MediaPoint;
    countryCode: string;
  } | null>(null);

  const [hoveredCountryBucket, setHoveredCountryBucket] =
    useState<CountryBucket | null>(null);

  const [countrySearch, setCountrySearch] = useState("");
  const [titleSearch, setTitleSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("popular");
  const [genreFilter, setGenreFilter] = useState<string>("all");
  const [panelLayout, setPanelLayout] = useState<PanelLayout>("grid");
  const [visibleLimit, setVisibleLimit] = useState<number>(60);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [textureMode, setTextureMode] = useState<EarthTextureMode>("day_night");

  const rotRef = useRef({
    rotY: -1.45,
    rotX: 0.45,
    targetRotY: null as number | null,
    targetRotX: null as number | null,
    zoomDist: 235,
    targetZoomDist: 235,
  });

  // Persistent Three.js object refs so state updates never recreate the WebGL context
  const threeRefs = useRef<{
    earthMat?: THREE.MeshPhongMaterial;
    dayTex?: THREE.Texture;
    nightTex?: THREE.Texture;
    dotsGeo?: THREE.BufferGeometry;
    regBorderGeo?: THREE.BufferGeometry;
    selBorderGeo?: THREE.BufferGeometry;
  }>({});

  // Live state ref read by WebGL event handlers without re-binding listeners
  const liveRef = useRef({
    points,
    lats: new Float32Array(0) as Float32Array,
    lngs: new Float32Array(0) as Float32Array,
    pointCountryCodes: [] as string[],
    bucketsByCode: new Map<string, CountryBucket>(),
    geoFeatures: [] as GeoFeature[],
    mediaFilter,
    selectedCountryCode,
    onlySelectedCountryDots,
    autoRotate,
    onSelectPoint,
    hoveredDotId: -1,
    hoveredCountryIso: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetch("/data/world_countries.json")
      .then((r) => r.json())
      .then((geo) => {
        if (!cancelled && geo && Array.isArray(geo.features)) {
          setGeoFeatures(geo.features);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const { bucketsByCode, sortedBuckets, pointCountryCodes } = useMemo(
    () => buildCountryBuckets(points),
    [points]
  );

  const { lats, lngs } = useMemo(
    () => distributePointsInsideCountries(points, bucketsByCode, geoFeatures),
    [points, bucketsByCode, geoFeatures]
  );

  // Keep liveRef synchronized
  liveRef.current.points = points;
  liveRef.current.lats = lats;
  liveRef.current.lngs = lngs;
  liveRef.current.pointCountryCodes = pointCountryCodes;
  liveRef.current.bucketsByCode = bucketsByCode;
  liveRef.current.geoFeatures = geoFeatures;
  liveRef.current.mediaFilter = mediaFilter;
  liveRef.current.selectedCountryCode = selectedCountryCode;
  liveRef.current.onlySelectedCountryDots = onlySelectedCountryDots;
  liveRef.current.autoRotate = autoRotate;
  liveRef.current.onSelectPoint = onSelectPoint;

  const selectedBucket =
    bucketsByCode.get(selectedCountryCode) || sortedBuckets[0] || null;

  const filteredCountries = useMemo(() => {
    const q = countrySearch.trim().toLowerCase();
    if (!q) return sortedBuckets;
    return sortedBuckets.filter(
      (b) =>
        b.meta.name.toLowerCase().includes(q) ||
        b.meta.code.toLowerCase().includes(q) ||
        b.meta.continent.toLowerCase().includes(q)
    );
  }, [sortedBuckets, countrySearch]);

  const countryItems = useMemo(() => {
    if (!selectedBucket) return [];
    const q = titleSearch.trim().toLowerCase();
    return selectedBucket.points
      .filter((p) => {
        if (mediaFilter !== "all" && p.mediaType !== mediaFilter) return false;
        if (genreFilter !== "all" && !p.genres.includes(genreFilter))
          return false;
        if (
          q &&
          !p.title.toLowerCase().includes(q) &&
          !(p.creator && p.creator.toLowerCase().includes(q))
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "rating") {
          if (b.rating !== a.rating) return b.rating - a.rating;
          return b.popularity - a.popularity;
        }
        if (sortBy === "newest") {
          if (b.year !== a.year) return b.year - a.year;
          return b.popularity - a.popularity;
        }
        return b.popularity - a.popularity;
      });
  }, [selectedBucket, mediaFilter, genreFilter, titleSearch, sortBy]);

  const availableGenresInCountry = useMemo(() => {
    if (!selectedBucket) return [];
    const counts = new Map<string, number>();
    for (const p of selectedBucket.points) {
      if (mediaFilter !== "all" && p.mediaType !== mediaFilter) continue;
      for (const g of p.genres) {
        counts.set(g, (counts.get(g) || 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([g]) => g);
  }, [selectedBucket, mediaFilter]);

  const focusCountryOnGlobe = (code: string) => {
    setSelectedCountryCode(code);
    setGenreFilter("all");
    setVisibleLimit(60);
    const bucket = bucketsByCode.get(code);
    if (!bucket) return;
    setAutoRotate(false);
    const theta = ((bucket.meta.lng + 180) * Math.PI) / 180;
    const targetY = theta - Math.PI / 2;
    const targetX = (bucket.meta.lat * Math.PI) / 180;
    rotRef.current.targetRotY = targetY;
    rotRef.current.targetRotX = Math.max(-1.15, Math.min(1.15, targetX));
    rotRef.current.targetZoomDist = Math.min(rotRef.current.zoomDist, 195);
  };

  // Initialize Three.js WebGL Scene ONCE on mount
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 1, 1500);
    camera.position.set(0, 0, rotRef.current.zoomDist);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.setClearColor(0x05070c, 1);
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 1. Starfield
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1400;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 450 + Math.random() * 450;
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = r * Math.sin(v) * Math.cos(u);
      starPositions[i * 3 + 1] = r * Math.sin(v) * Math.sin(u);
      starPositions[i * 3 + 2] = r * Math.cos(v);
    }
    starGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(starPositions, 3)
    );
    const starMat = new THREE.PointsMaterial({
      color: 0xcbd5e1,
      size: 1.15,
      transparent: true,
      opacity: 0.6,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // 2. Lighting
    scene.add(new THREE.AmbientLight(0xdbeafe, 1.4));
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(180, 110, 220);
    scene.add(sunLight);

    const globeGroup = new THREE.Group();
    scene.add(globeGroup);

    // 3. Earth Sphere & Textures (loaded once)
    const texLoader = new THREE.TextureLoader();
    const dayTex = texLoader.load("/data/earth_day.jpg");
    const nightTex = texLoader.load("/data/earth_night.jpg");
    const bumpTex = texLoader.load("/data/earth_topology.png");

    const earthGeo = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: dayTex,
      emissiveMap: nightTex,
      emissive: new THREE.Color(0x1e293b),
      emissiveIntensity: 0.22,
      bumpMap: bumpTex,
      bumpScale: 1.2,
      specular: new THREE.Color(0x0f172a),
      shininess: 12,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    globeGroup.add(earthMesh);

    // Atmosphere Glow
    const atmosGeo = new THREE.SphereGeometry(GLOBE_RADIUS * 1.028, 48, 48);
    const atmosMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Mesh(atmosGeo, atmosMat));

    // 4. Country Border Geometries
    const regBorderGeo = new THREE.BufferGeometry();
    const regBorderMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.36,
    });
    globeGroup.add(new THREE.LineSegments(regBorderGeo, regBorderMat));

    const selBorderGeo = new THREE.BufferGeometry();
    const selBorderMat = new THREE.LineBasicMaterial({
      color: 0xfacc15,
      transparent: true,
      opacity: 0.95,
    });
    globeGroup.add(new THREE.LineSegments(selBorderGeo, selBorderMat));

    // 5. Dots PointCloud Geometry
    const dotsGeo = new THREE.BufferGeometry();
    const dotTexture = createCircleDotTexture();
    const dotsMat = new THREE.PointsMaterial({
      size: 2.2,
      map: dotTexture,
      vertexColors: true,
      transparent: true,
      alphaTest: 0.15,
      opacity: 0.94,
      sizeAttenuation: true,
    });
    const dotsCloud = new THREE.Points(dotsGeo, dotsMat);
    globeGroup.add(dotsCloud);

    // Hover ring on 3D surface
    const hoverRingGeo = new THREE.RingGeometry(0.65, 1.35, 20);
    const hoverRingMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
    });
    const hoverRingMesh = new THREE.Mesh(hoverRingGeo, hoverRingMat);
    hoverRingMesh.visible = false;
    globeGroup.add(hoverRingMesh);

    threeRefs.current = {
      earthMat,
      dayTex,
      nightTex,
      dotsGeo,
      regBorderGeo,
      selBorderGeo,
    };

    // 6. Fast O(1) Analytical Sphere Raycasting + Country-Scoped Dot Picking
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    const worldHitVec = new THREE.Vector3();
    let isDragging = false;
    let dragMoved = false;
    let prevX = 0;
    let prevY = 0;
    let lastHoverCheckTime = 0;

    const resolveGlobeHit = (
      e: MouseEvent
    ): {
      lat: number;
      lng: number;
      nearestPointId: number | null;
      countryCode: string | null;
    } | null => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // O(1) mathematical ray-sphere intersection instead of testing 10,000 mesh triangles!
      const hit = raycaster.ray.intersectSphere(MATH_GLOBE_SPHERE, worldHitVec);
      if (!hit) return null;

      const localPt = globeGroup.worldToLocal(worldHitVec.clone());
      const r = localPt.length();
      const lat = 90 - (Math.acos(localPt.y / r) * 180) / Math.PI;
      const rawLng =
        (Math.atan2(localPt.z, -localPt.x) * 180) / Math.PI - 180;
      const lng = rawLng < -180 ? rawLng + 360 : rawLng;

      const st = liveRef.current;

      // First identify which country polygon contains (lng, lat) using bounding-box accelerated lookup
      let hoveredIso: string | null = null;
      for (let i = 0; i < st.geoFeatures.length; i++) {
        const f = st.geoFeatures[i];
        const iso = f.properties.iso2;
        if (iso && st.bucketsByCode.has(iso) && isPointInsideFeature(lng, lat, f)) {
          hoveredIso = iso;
          break;
        }
      }

      if (
        st.onlySelectedCountryDots &&
        hoveredIso &&
        hoveredIso !== st.selectedCountryCode
      ) {
        return { lat, lng, nearestPointId: null, countryCode: hoveredIso };
      }

      const zoomFactor = (rotRef.current.zoomDist - 120) / 140;
      const maxDegTol = Math.max(0.45, Math.min(2.1, 0.55 + zoomFactor * 1.05));
      const maxDegTol2 = maxDegTol * maxDegTol;
      const cosLat = Math.max(0.2, Math.cos((lat * Math.PI) / 180));

      let bestId: number | null = null;
      let bestD2 = maxDegTol2;

      // Only scan dots in the hovered country bucket (e.g. ~500 points instead of 80,000!)
      const candidatePoints = hoveredIso
        ? st.bucketsByCode.get(hoveredIso)?.points || []
        : [];

      for (let i = 0; i < candidatePoints.length; i++) {
        const pt = candidatePoints[i];
        if (st.mediaFilter !== "all" && pt.mediaType !== st.mediaFilter) {
          continue;
        }
        const idx = pt.id;
        const dLat = st.lats[idx] - lat;
        if (Math.abs(dLat) > maxDegTol) continue;
        const dLng = (st.lngs[idx] - lng) * cosLat;
        const d2 = dLat * dLat + dLng * dLng;
        if (d2 < bestD2) {
          bestD2 = d2;
          bestId = idx;
        }
      }

      return {
        lat,
        lng,
        nearestPointId: bestId,
        countryCode: bestId !== null ? st.pointCountryCodes[bestId] : hoveredIso,
      };
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      dragMoved = false;
      prevX = e.clientX;
      prevY = e.clientY;
      rotRef.current.targetRotX = null;
      rotRef.current.targetRotY = null;
    };

    const onMouseMove = (e: MouseEvent) => {
      const tx = Math.min(window.innerWidth - 300, e.clientX + 16);
      const ty = Math.min(window.innerHeight - 130, e.clientY + 16);
      if (dotTooltipRef.current) {
        dotTooltipRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      }
      if (countryTooltipRef.current) {
        countryTooltipRef.current.style.transform = `translate3d(${tx}px, ${ty}px, 0)`;
      }

      if (isDragging) {
        const dx = e.clientX - prevX;
        const dy = e.clientY - prevY;
        if (Math.abs(dx) + Math.abs(dy) > 3) {
          dragMoved = true;
          if (liveRef.current.autoRotate) {
            setAutoRotate(false);
          }
        }
        const speed = (rotRef.current.zoomDist / 250) * 0.005;
        rotRef.current.rotY += dx * speed;
        rotRef.current.rotX = Math.max(
          -1.25,
          Math.min(1.25, rotRef.current.rotX + dy * speed)
        );
        prevX = e.clientX;
        prevY = e.clientY;
        hoverRingMesh.visible = false;
        if (liveRef.current.hoveredDotId !== -1) {
          liveRef.current.hoveredDotId = -1;
          setHoveredDot(null);
        }
        if (liveRef.current.hoveredCountryIso !== "") {
          liveRef.current.hoveredCountryIso = "";
          setHoveredCountryBucket(null);
        }
        return;
      }

      // Throttle hover raycasting to at most once every 24ms (~40Hz)
      const now = performance.now();
      if (now - lastHoverCheckTime < 24) return;
      lastHoverCheckTime = now;

      const hit = resolveGlobeHit(e);
      const st = liveRef.current;

      if (hit && hit.nearestPointId !== null) {
        const ptId = hit.nearestPointId;
        const [hx, hy, hz] = latLngToXYZ(
          st.lats[ptId],
          st.lngs[ptId],
          GLOBE_RADIUS + 0.62
        );
        hoverRingMesh.position.set(hx, hy, hz);
        hoverRingMesh.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 0, 1),
          hoverRingMesh.position.clone().normalize()
        );
        hoverRingMesh.visible = true;
        renderer.domElement.style.cursor = "pointer";

        if (st.hoveredCountryIso !== "") {
          st.hoveredCountryIso = "";
          setHoveredCountryBucket(null);
        }
        if (st.hoveredDotId !== ptId) {
          st.hoveredDotId = ptId;
          setHoveredDot({
            point: st.points[ptId],
            countryCode: hit.countryCode || "US",
          });
        }
      } else if (
        hit &&
        hit.countryCode &&
        st.bucketsByCode.has(hit.countryCode)
      ) {
        hoverRingMesh.visible = false;
        renderer.domElement.style.cursor = "pointer";
        if (st.hoveredDotId !== -1) {
          st.hoveredDotId = -1;
          setHoveredDot(null);
        }
        if (st.hoveredCountryIso !== hit.countryCode) {
          st.hoveredCountryIso = hit.countryCode;
          setHoveredCountryBucket(st.bucketsByCode.get(hit.countryCode)!);
        }
      } else {
        hoverRingMesh.visible = false;
        renderer.domElement.style.cursor = "grab";
        if (st.hoveredDotId !== -1) {
          st.hoveredDotId = -1;
          setHoveredDot(null);
        }
        if (st.hoveredCountryIso !== "") {
          st.hoveredCountryIso = "";
          setHoveredCountryBucket(null);
        }
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      if (isDragging && !dragMoved) {
        const hit = resolveGlobeHit(e);
        if (hit && hit.nearestPointId !== null) {
          if (hit.countryCode) {
            setSelectedCountryCode(hit.countryCode);
          }
          liveRef.current.onSelectPoint(hit.nearestPointId);
        } else if (hit && hit.countryCode) {
          focusCountryOnGlobe(hit.countryCode);
        }
      }
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 12 : -12;
      rotRef.current.targetZoomDist = Math.max(
        125,
        Math.min(390, rotRef.current.targetZoomDist + delta)
      );
    };

    const domEl = renderer.domElement;
    domEl.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseup", onMouseUp);
    domEl.addEventListener("wheel", onWheel, { passive: false });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", onResize);

    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      if (
        rotRef.current.targetRotY !== null &&
        rotRef.current.targetRotX !== null
      ) {
        const dy = rotRef.current.targetRotY - rotRef.current.rotY;
        const dx = rotRef.current.targetRotX - rotRef.current.rotX;
        rotRef.current.rotY += dy * 0.08;
        rotRef.current.rotX += dx * 0.08;
        if (Math.abs(dy) < 0.002 && Math.abs(dx) < 0.002) {
          rotRef.current.targetRotY = null;
          rotRef.current.targetRotX = null;
        }
      } else if (liveRef.current.autoRotate && !isDragging) {
        rotRef.current.rotY += 0.0015;
      }

      rotRef.current.zoomDist +=
        (rotRef.current.targetZoomDist - rotRef.current.zoomDist) * 0.14;
      camera.position.z = rotRef.current.zoomDist;

      const zoomNorm = (rotRef.current.zoomDist - 125) / 265;
      dotsMat.size = Math.max(1.25, 1.4 + zoomNorm * 1.1);

      globeGroup.rotation.y = rotRef.current.rotY;
      globeGroup.rotation.x = rotRef.current.rotX;

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      domEl.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      domEl.removeEventListener("wheel", onWheel);
      window.removeEventListener("resize", onResize);
      dotTexture.dispose();
      dotsGeo.dispose();
      dotsMat.dispose();
      regBorderGeo.dispose();
      selBorderGeo.dispose();
      dayTex.dispose();
      nightTex.dispose();
      bumpTex.dispose();
      renderer.dispose();
    };
  }, []);

  // Lightweight update: switch Day/Night texture mode in-place without recreating WebGL
  useEffect(() => {
    const { earthMat, dayTex, nightTex } = threeRefs.current;
    if (!earthMat || !dayTex || !nightTex) return;
    earthMat.map = textureMode === "night" ? nightTex : dayTex;
    earthMat.emissive.setHex(textureMode === "night" ? 0xffd166 : 0x1e293b);
    earthMat.emissiveIntensity = textureMode === "night" ? 0.85 : 0.22;
    earthMat.needsUpdate = true;
  }, [textureMode]);

  // Lightweight update: rebuild country border buffers only when GeoJSON or selectedCountryCode changes
  useEffect(() => {
    const { regBorderGeo, selBorderGeo } = threeRefs.current;
    if (!regBorderGeo || !selBorderGeo || geoFeatures.length === 0) return;

    const regularBorderPos: number[] = [];
    const selectedBorderPos: number[] = [];

    const addRing = (ring: number[][], targetArr: number[], rad: number) => {
      for (let i = 0; i < ring.length - 1; i++) {
        const [x1, y1, z1] = latLngToXYZ(ring[i][1], ring[i][0], rad);
        const [x2, y2, z2] = latLngToXYZ(ring[i + 1][1], ring[i + 1][0], rad);
        targetArr.push(x1, y1, z1, x2, y2, z2);
      }
    };

    for (const f of geoFeatures) {
      const isSel = f.properties.iso2 === selectedCountryCode;
      const arr = isSel ? selectedBorderPos : regularBorderPos;
      const rad = isSel ? GLOBE_RADIUS + 0.55 : GLOBE_RADIUS + 0.22;
      if (f.geometry.type === "Polygon") {
        for (const ring of f.geometry.coordinates as number[][][]) {
          addRing(ring, arr, rad);
        }
      } else if (f.geometry.type === "MultiPolygon") {
        for (const poly of f.geometry.coordinates as number[][][][]) {
          for (const ring of poly) addRing(ring, arr, rad);
        }
      }
    }

    regBorderGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(regularBorderPos, 3)
    );
    selBorderGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(selectedBorderPos, 3)
    );
  }, [geoFeatures, selectedCountryCode]);

  // Lightweight update: update 3D dot positions & colors in-place when data, lens, or filter changes
  useEffect(() => {
    const { dotsGeo } = threeRefs.current;
    if (!dotsGeo || points.length === 0 || lats.length === 0) return;

    const visibleIndices: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (mediaFilter !== "all" && p.mediaType !== mediaFilter) continue;
      if (
        onlySelectedCountryDots &&
        pointCountryCodes[i] !== selectedCountryCode
      ) {
        continue;
      }
      visibleIndices.push(i);
    }

    const numDots = visibleIndices.length;
    const dotPositions = new Float32Array(numDots * 3);
    const dotColors = new Float32Array(numDots * 3);

    for (let k = 0; k < numDots; k++) {
      const ptIdx = visibleIndices[k];
      const pt = points[ptIdx];
      const isSelectedCountry =
        pointCountryCodes[ptIdx] === selectedCountryCode;
      const r = isSelectedCountry ? GLOBE_RADIUS + 0.52 : GLOBE_RADIUS + 0.36;
      const [vx, vy, vz] = latLngToXYZ(lats[ptIdx], lngs[ptIdx], r);
      dotPositions[k * 3] = vx;
      dotPositions[k * 3 + 1] = vy;
      dotPositions[k * 3 + 2] = vz;

      const rgbStr = computePointColor(pt, activeLens);
      const [cr, cg, cb] = fastParseRgb(rgbStr);
      const dim =
        !onlySelectedCountryDots && !isSelectedCountry ? 0.68 : 1.0;
      dotColors[k * 3] = cr * dim;
      dotColors[k * 3 + 1] = cg * dim;
      dotColors[k * 3 + 2] = cb * dim;
    }

    dotsGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(dotPositions, 3)
    );
    dotsGeo.setAttribute("color", new THREE.BufferAttribute(dotColors, 3));
    dotsGeo.computeBoundingSphere();
  }, [
    points,
    lats,
    lngs,
    pointCountryCodes,
    activeLens,
    mediaFilter,
    selectedCountryCode,
    onlySelectedCountryDots,
  ]);

  return (
    <div className="earth-globe-shell">
      <div ref={mountRef} className="earth-webgl-stage" />

      {/* Left Sidebar: Global Cinema Countries Leaderboard & Globe Controls */}
      <aside
        className={`earth-left-panel ${selectedId !== null ? "shifted" : ""}`}
      >
        <div className="earth-panel-head">
          <div className="earth-panel-title">🌍 3D Country Dot Atlas</div>
          <div className="earth-panel-sub">
            {sortedBuckets.length} Countries · {points.length.toLocaleString()} Dots
            Mapped by Country
          </div>
        </div>

        <div className="earth-globe-controls">
          <button
            type="button"
            className={`globe-ctl-btn ${onlySelectedCountryDots ? "active" : ""}`}
            onClick={() => setOnlySelectedCountryDots((prev) => !prev)}
            title="Show dots for all countries or isolate only the selected country"
          >
            {onlySelectedCountryDots
              ? `Isolate ${selectedCountryCode} Dots`
              : "Showing All Countries"}
          </button>
          <button
            type="button"
            className="globe-ctl-btn"
            onClick={() =>
              setTextureMode((prev) =>
                prev === "day_night" ? "night" : "day_night"
              )
            }
          >
            {textureMode === "day_night"
              ? "🛰️ Satellite Earth"
              : "🌃 Night Lights"}
          </button>
        </div>

        <div className="earth-country-search">
          <input
            type="text"
            placeholder="Search country or continent…"
            value={countrySearch}
            onChange={(e) => setCountrySearch(e.target.value)}
          />
        </div>

        <div className="earth-country-list">
          {filteredCountries.map((b, idx) => {
            const isSel = b.meta.code === selectedCountryCode;
            return (
              <div
                key={b.meta.code}
                className={`earth-country-row ${isSel ? "active" : ""}`}
                onClick={() => focusCountryOnGlobe(b.meta.code)}
              >
                <span className="ec-rank">{idx + 1}</span>
                <span className="ec-flag">{b.meta.flag}</span>
                <div className="ec-info">
                  <div className="ec-name">{b.meta.name}</div>
                  <div className="ec-sub">
                    ● {b.movieCount.toLocaleString()} Movies · ◆{" "}
                    {b.tvCount.toLocaleString()} TV
                  </div>
                </div>
                <div className="ec-total">{b.points.length.toLocaleString()}</div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Right Sidebar: Selected Country Movies & TV Series Explorer */}
      {selectedBucket && (
        <aside className="earth-right-panel">
          <div className="er-header">
            <div className="er-title-row">
              <span className="er-flag">{selectedBucket.meta.flag}</span>
              <div className="er-title-text">
                <h2 className="er-country-name">{selectedBucket.meta.name}</h2>
                <div className="er-country-meta">
                  {selectedBucket.meta.continent} · ★{" "}
                  {selectedBucket.avgRating.toFixed(1)} avg ·{" "}
                  {countryItems.length.toLocaleString()} matching titles
                </div>
              </div>
              <div className="seg-group er-layout-toggle">
                <button
                  type="button"
                  className={panelLayout === "grid" ? "active" : ""}
                  onClick={() => setPanelLayout("grid")}
                  title="Poster Grid View"
                >
                  Grid
                </button>
                <button
                  type="button"
                  className={panelLayout === "list" ? "active" : ""}
                  onClick={() => setPanelLayout("list")}
                  title="Compact List View"
                >
                  List
                </button>
              </div>
            </div>

            <div className="er-stat-pills">
              <button
                type="button"
                className={`er-stat-btn ${mediaFilter === "all" ? "active" : ""}`}
                onClick={() => onChangeMediaFilter("all")}
              >
                All ({selectedBucket.points.length.toLocaleString()})
              </button>
              <button
                type="button"
                className={`er-stat-btn movie ${
                  mediaFilter === "movie" ? "active" : ""
                }`}
                onClick={() => onChangeMediaFilter("movie")}
              >
                ● Movies ({selectedBucket.movieCount.toLocaleString()})
              </button>
              <button
                type="button"
                className={`er-stat-btn tv ${mediaFilter === "tv" ? "active" : ""}`}
                onClick={() => onChangeMediaFilter("tv")}
              >
                ◆ TV Series ({selectedBucket.tvCount.toLocaleString()})
              </button>
            </div>

            <div className="er-filters-row">
              <input
                type="text"
                className="er-search-input"
                placeholder={`Search in ${selectedBucket.meta.name}…`}
                value={titleSearch}
                onChange={(e) => {
                  setTitleSearch(e.target.value);
                  setVisibleLimit(60);
                }}
              />
              <select
                className="er-select"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortBy)}
              >
                <option value="popular">Most Popular</option>
                <option value="rating">Highest Rated (★)</option>
                <option value="newest">Newest Year</option>
              </select>
            </div>

            <div className="er-genre-bar">
              <button
                type="button"
                className={`er-genre-chip ${genreFilter === "all" ? "active" : ""}`}
                onClick={() => setGenreFilter("all")}
              >
                All Genres
              </button>
              {availableGenresInCountry.slice(0, 12).map((g) => (
                <button
                  key={g}
                  type="button"
                  className={`er-genre-chip ${genreFilter === g ? "active" : ""}`}
                  onClick={() => setGenreFilter(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="er-scroll-container">
            {countryItems.length === 0 ? (
              <div className="er-empty">
                No titles match the current filter in {selectedBucket.meta.name}.
              </div>
            ) : panelLayout === "grid" ? (
              <div className="er-poster-grid">
                {countryItems.slice(0, visibleLimit).map((item) => {
                  const posterUrl =
                    getPosterUrl(item.poster, "sm") ||
                    getFallbackPosterDataUri(item);
                  const isSel = item.id === selectedId;
                  return (
                    <div
                      key={item.id}
                      className={`er-card ${isSel ? "selected" : ""}`}
                      onClick={() => onSelectPoint(item.id)}
                    >
                      <div className="er-poster-box">
                        <img
                          src={posterUrl}
                          alt={item.title}
                          loading="lazy"
                          onError={(e) => {
                            const fallback = getFallbackPosterDataUri(item);
                            if (e.currentTarget.src !== fallback) {
                              e.currentTarget.src = fallback;
                            }
                          }}
                        />
                        <span className={`er-badge ${item.mediaType}`}>
                          {item.mediaType === "tv" ? "TV ◆" : "MOVIE ●"}
                        </span>
                        <span className="er-rating">
                          ★ {item.rating.toFixed(1)}
                        </span>
                      </div>
                      <div className="er-card-body">
                        <div className="er-card-title" title={item.title}>
                          {item.title}
                        </div>
                        <div className="er-card-sub">
                          {item.year} · {item.genres.slice(0, 2).join(", ")}
                        </div>
                        <button
                          type="button"
                          className="er-locate-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLocateOn2DMap(item.id);
                          }}
                        >
                          Locate on 2D Map →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="er-list-view">
                {countryItems.slice(0, visibleLimit).map((item) => {
                  const posterUrl =
                    getPosterUrl(item.poster, "sm") ||
                    getFallbackPosterDataUri(item);
                  const isSel = item.id === selectedId;
                  return (
                    <div
                      key={item.id}
                      className={`er-list-row ${isSel ? "selected" : ""}`}
                      onClick={() => onSelectPoint(item.id)}
                    >
                      <img
                        className="er-list-thumb"
                        src={posterUrl}
                        alt={item.title}
                        loading="lazy"
                        onError={(e) => {
                          const fallback = getFallbackPosterDataUri(item);
                          if (e.currentTarget.src !== fallback) {
                            e.currentTarget.src = fallback;
                          }
                        }}
                      />
                      <div className="er-list-info">
                        <div className="er-list-top">
                          <span className={`res-tag tag-${item.mediaType}`}>
                            {item.mediaType === "tv" ? "TV ◆" : "MOVIE ●"}
                          </span>
                          <span className="er-list-year">{item.year}</span>
                          <span className="er-list-star">
                            ★ {item.rating.toFixed(1)}
                          </span>
                        </div>
                        <div className="er-list-title">{item.title}</div>
                        <div className="er-list-genres">
                          {item.genres.slice(0, 3).join(", ")}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="er-locate-mini"
                        onClick={(e) => {
                          e.stopPropagation();
                          onLocateOn2DMap(item.id);
                        }}
                        title="Locate on 2D Vector Map"
                      >
                        2D →
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {countryItems.length > visibleLimit && (
              <div className="er-load-more-wrap">
                <button
                  type="button"
                  className="er-load-more-btn"
                  onClick={() => setVisibleLimit((prev) => prev + 60)}
                >
                  Show More ({visibleLimit.toLocaleString()} of{" "}
                  {countryItems.length.toLocaleString()})
                </button>
              </div>
            )}
          </div>
        </aside>
      )}

      {/* Hover Tooltip for a specific Movie/TV Dot on the 3D Earth (positioned via GPU transform3d) */}
      <div
        ref={dotTooltipRef}
        className="map-tooltip"
        style={{
          left: 0,
          top: 0,
          display: hoveredDot ? "flex" : "none",
        }}
      >
        {hoveredDot && (
          <>
            <img
              className="tt-poster"
              src={
                getPosterUrl(hoveredDot.point.poster, "sm") ||
                getFallbackPosterDataUri(hoveredDot.point)
              }
              alt={hoveredDot.point.title}
            />
            <div className="tt-body">
              <div className="tt-header">
                <span className={`res-tag tag-${hoveredDot.point.mediaType}`}>
                  {hoveredDot.point.mediaType === "tv" ? "TV ◆" : "MOVIE ●"}
                </span>
                <span className="tt-rating">
                  ★ {hoveredDot.point.rating.toFixed(1)}
                </span>
              </div>
              <div className="tt-title">{hoveredDot.point.title}</div>
              <div className="tt-sub">
                {COUNTRIES_BY_CODE[hoveredDot.countryCode]?.flag || "🌍"}{" "}
                {COUNTRIES_BY_CODE[hoveredDot.countryCode]?.name ||
                  hoveredDot.countryCode}{" "}
                · {hoveredDot.point.year}
                <br />
                {hoveredDot.point.genres.slice(0, 3).join(", ")}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Hover Tooltip when over a Country's land with no specific dot under cursor */}
      <div
        ref={countryTooltipRef}
        className="earth-tooltip"
        style={{
          left: 0,
          top: 0,
          display: !hoveredDot && hoveredCountryBucket ? "block" : "none",
        }}
      >
        {!hoveredDot && hoveredCountryBucket && (
          <>
            <div className="et-head">
              <span className="et-flag">
                {hoveredCountryBucket.meta.flag}
              </span>
              <span className="et-name">
                {hoveredCountryBucket.meta.name}
              </span>
            </div>
            <div className="et-counts">
              ● {hoveredCountryBucket.movieCount.toLocaleString()} Movies · ◆{" "}
              {hoveredCountryBucket.tvCount.toLocaleString()} TV Series
            </div>
            <div className="et-sub">
              ★ {hoveredCountryBucket.avgRating.toFixed(1)} avg · Top:{" "}
              {hoveredCountryBucket.topGenres.join(", ")}
            </div>
          </>
        )}
      </div>

      <div className="map-hint">
        Drag to rotate 3D Earth · Scroll to zoom · Hover or click any{" "}
        <strong>Movie/TV dot</strong> inside a country · Press <strong>G</strong>{" "}
        to switch between 3D Earth and 2D Vector Map
      </div>
    </div>
  );
};
