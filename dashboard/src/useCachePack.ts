import { useEffect, useState } from "react";

import type { CachePackContents } from "./evacuationPlan";
import type { RouteGrid } from "./routeGrid";

const RETRY_EVERY_MS = 5000;

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Node API returned ${response.status} for ${url}`);
  return response.json();
}

async function fetchCachePack(): Promise<CachePackContents | null> {
  const status = (await getJson("/api/cache-pack")) as {
    available?: boolean;
    manifest?: { route_grid?: RouteGrid; files?: Record<string, string> } | null;
  };
  if (status.available !== true) return null;
  const [shelters, floodProne] = await Promise.all([
    getJson("/api/cache-pack/files/shelters.json"),
    getJson("/api/cache-pack/files/flood_prone.geojson"),
  ]);
  // A pack built without Routes has no grid.
  const routeGrid = status.manifest?.route_grid ?? null;
  const tileZooms = Object.keys(status.manifest?.files ?? {})
    .filter((path) => path.startsWith("tiles/"))
    .map((path) => Number(path.split("/")[1]));
  const tileMaxZoom = tileZooms.length > 0 ? Math.max(...tileZooms) : null;
  return { shelters, floodProne, routeGrid, tileMaxZoom } as CachePackContents;
}

// The pack never changes once a Node holds a valid one, so it is read once and then kept.
export function useCachePack(): CachePackContents | null {
  const [pack, setPack] = useState<CachePackContents | null>(null);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const retryLater = () => {
      if (!cancelled) timer = setTimeout(load, RETRY_EVERY_MS);
    };
    const load = () =>
      fetchCachePack()
        .then((loaded) => {
          if (cancelled) return;
          if (loaded) setPack(loaded);
          else retryLater();
        })
        .catch((error) => {
          console.error(error);
          retryLater();
        });
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);
  return pack;
}
