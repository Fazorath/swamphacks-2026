import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect } from "react";

import { RIVER_FLOW_LAYER, flowDashes } from "./mapStyle";

const FLOW_STEP_MS = 160;

// The slow dim dashes drifting down the pack's rivers (D-20): decorative, so `drifting` is false
// with reduced motion, and the layer is hidden then. `layerExists` is true once the pack's map has
// been added to the style, which is when the layer joins it.
export function useRiverFlow(map: MapLibreMap | null, layerExists: boolean, drifting: boolean) {
  useEffect(() => {
    if (!map || !layerExists || !map.getLayer(RIVER_FLOW_LAYER)) return;
    map.setLayoutProperty(RIVER_FLOW_LAYER, "visibility", drifting ? "visible" : "none");
    if (!drifting) return;
    let step = 0;
    const timer = setInterval(
      () => map.setPaintProperty(RIVER_FLOW_LAYER, "line-dasharray", flowDashes(++step)),
      FLOW_STEP_MS,
    );
    return () => clearInterval(timer);
  }, [map, layerExists, drifting]);
}
