import type { ImageSource, Map as MapLibreMap } from "maplibre-gl";

import { FIRST_OVERLAY } from "./basemap";
import type { Corners } from "./weatherField";

const WEATHER = "weather";

// The field is one image draped on the terrain: a MapLibre `image` source keeps it aligned when
// the map moves, and a Weather layer changing or the hour moving only swaps the picture. It sits
// under the first overlay so the river, Flood-Prone Areas and Route stay readable on top of it.
export function showWeatherField(
  map: MapLibreMap,
  field: { url: string; corners: Corners } | null,
): void {
  if (field === null) {
    if (map.getLayer(WEATHER)) map.removeLayer(WEATHER);
    if (map.getSource(WEATHER)) map.removeSource(WEATHER);
    return;
  }
  const source = map.getSource<ImageSource>(WEATHER);
  if (source) {
    source.updateImage({ url: field.url, coordinates: field.corners });
    return;
  }
  map.addSource(WEATHER, { type: "image", url: field.url, coordinates: field.corners });
  map.addLayer(
    { id: WEATHER, type: "raster", source: WEATHER, paint: { "raster-fade-duration": 0 } },
    FIRST_OVERLAY,
  );
}
