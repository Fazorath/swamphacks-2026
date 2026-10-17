import type { LatLon } from "./routeGrid";
import type { BlockedRoad } from "./rerouting";

const STORAGE_KEY = "storm-shield.blocked-roads";
const STORED_VERSION = 1;

function isLatLon(value: unknown): value is LatLon {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((part) => typeof part === "number" && Number.isFinite(part))
  );
}

// An unusable stored value counts as no Blocked Roads; the next save replaces it.
export function loadBlockedRoads(storage: Storage): BlockedRoad[] {
  const stored = storage.getItem(STORAGE_KEY);
  if (stored === null) return [];
  try {
    const parsed = JSON.parse(stored);
    if (parsed?.version !== STORED_VERSION || !Array.isArray(parsed.roads)) return [];
    return parsed.roads.filter(
      (road: { a?: unknown; b?: unknown }) => isLatLon(road?.a) && isLatLon(road?.b),
    );
  } catch {
    return [];
  }
}

export function saveBlockedRoads(storage: Storage, roads: BlockedRoad[]): void {
  storage.setItem(STORAGE_KEY, JSON.stringify({ version: STORED_VERSION, roads }));
}
