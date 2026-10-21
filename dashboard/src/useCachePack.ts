import { useEffect, useState } from "react";

import type { CachePackContents, HighGroundPoint, NepalMap } from "./evacuationPlan";
import type { RouteGrid } from "./routeGrid";

const RETRY_EVERY_MS = 5000;

// The `nepal` entry of the manifest of a pack built before the Regions (`scripts/pack_nepal.py`, since deleted).
type ManifestNepal = {
  bbox: NepalMap["bbox"];
  elevation: {
    approximate: boolean;
    national_zooms: [number, number];
    detail_zooms: [number, number];
  };
  boundaries_note: string;
  sources: NepalMap["sources"];
};

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Node API returned ${response.status} for ${url}`);
  return response.json();
}

function nepalMap(manifest: ManifestNepal | undefined): NepalMap | null {
  if (!manifest) return null;
  return {
    bbox: manifest.bbox,
    elevation: {
      approximate: manifest.elevation.approximate,
      nationalZooms: manifest.elevation.national_zooms,
      detailZooms: manifest.elevation.detail_zooms,
    },
    boundariesNote: manifest.boundaries_note,
    sources: manifest.sources,
  };
}

async function fetchCachePack(): Promise<CachePackContents | null> {
  const status = (await getJson("/api/cache-pack")) as {
    available?: boolean;
    manifest?: {
      built?: string;
      route_grid?: RouteGrid;
      bbox?: CachePackContents["bbox"];
      nepal?: ManifestNepal;
      files?: Record<string, string>;
    } | null;
  };
  if (status.available !== true) return null;
  const [shelters, floodProne] = await Promise.all([
    getJson("/api/cache-pack/files/shelters.json"),
    getJson("/api/cache-pack/files/flood_prone.geojson"),
  ]);
  // A pack built before High-ground points lacks the file; asking for it would only log a 404.
  const highGround: HighGroundPoint[] = status.manifest?.files?.["high_ground.json"]
    ? ((await getJson("/api/cache-pack/files/high_ground.json")) as HighGroundPoint[])
    : [];
  // A pack built without Routes has no grid.
  const routeGrid = status.manifest?.route_grid ?? null;
  const bbox = status.manifest?.bbox ?? null;
  const built = status.manifest?.built ?? null;
  const nepal = nepalMap(status.manifest?.nepal);
  return { shelters, highGround, floodProne, routeGrid, bbox, built, nepal } as CachePackContents;
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
