import { MediaPoint, PathResult, PathStep } from "../types";

const adjCache = new WeakMap<MediaPoint[], number[][]>();

function getAdjacencyList(points: MediaPoint[]): number[][] {
  const cached = adjCache.get(points);
  if (cached) return cached;

  const n = points.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    const sims = points[i].similar || [];
    for (let k = 0; k < sims.length; k++) {
      const nb = sims[k];
      if (nb >= 0 && nb < n) {
        adj[i].push(nb);
        adj[nb].push(i);
      }
    }
  }
  adjCache.set(points, adj);
  return adj;
}

/**
 * Finds the shortest semantic bridge between `startId` and `endId` across the
 * 20-nearest-neighbor graph (`point.similar`), using Breadth-First Search (BFS)
 * on the cached symmetrized k-NN graph so any Movie can bridge to any TV Series.
 */
export function findSemanticPath(
  points: MediaPoint[],
  startId: number,
  endId: number
): PathResult | null {
  if (
    startId < 0 ||
    endId < 0 ||
    startId >= points.length ||
    endId >= points.length
  ) {
    return null;
  }

  if (startId === endId) {
    return { nodeIds: [startId], steps: [] };
  }

  const n = points.length;
  const adj = getAdjacencyList(points);

  const visited = new Uint8Array(n);
  const parent = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let head = 0;
  let tail = 0;

  visited[startId] = 1;
  queue[tail++] = startId;

  let found = false;
  while (head < tail) {
    const curr = queue[head++];
    if (curr === endId) {
      found = true;
      break;
    }
    const neighbors = adj[curr];
    for (let i = 0; i < neighbors.length; i++) {
      const next = neighbors[i];
      if (!visited[next]) {
        visited[next] = 1;
        parent[next] = curr;
        queue[tail++] = next;
      }
    }
  }

  if (!found) {
    return null;
  }

  const nodeIds: number[] = [];
  let trace = endId;
  while (trace !== -1) {
    nodeIds.push(trace);
    trace = parent[trace];
  }
  nodeIds.reverse();

  const steps: PathStep[] = [];
  for (let i = 0; i < nodeIds.length - 1; i++) {
    const a = points[nodeIds[i]];
    const b = points[nodeIds[i + 1]];
    const gSet = new Set(a.genres || []);
    const kSet = new Set(a.keywords || []);
    const sharedGenres = (b.genres || []).filter((g) => gSet.has(g));
    const sharedKeywords = (b.keywords || []).filter((k) => kSet.has(k));
    steps.push({
      fromId: a.id,
      toId: b.id,
      sharedGenres,
      sharedKeywords,
    });
  }

  return { nodeIds, steps };
}
