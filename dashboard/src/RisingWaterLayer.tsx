import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect, useRef } from "react";

import { lineCollection, setOverlay } from "./basemap";
import type { WaterReach } from "./risingWater";

// Draws nothing itself: it fills the two water-level sources, which sit in the map's own layers.
// The reaches are rebuilt on every render, so the sources are refilled only when a level moves
// (redrawing them makes the map re-tile).
export function RisingWaterLayer({ map, reaches }: { map: MapLibreMap; reaches: WaterReach[] }) {
  const latest = useRef(reaches);
  useEffect(() => {
    latest.current = reaches;
  });
  const drawn = reaches.map((reach) => `${reach.riverKm}:${reach.levelM}`).join(",");
  useEffect(() => {
    const now = latest.current;
    setOverlay(map, "water-level", lineCollection(now.flatMap((reach) => reach.lines)));
    setOverlay(map, "water-ticks", lineCollection(now.flatMap((reach) => reach.ticks)));
  }, [map, drawn]);
  return null;
}
