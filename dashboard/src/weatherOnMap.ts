import type { ImageSource, Map as MapLibreMap } from "maplibre-gl";

import { FIRST_OVERLAY } from "./basemap";

const WEATHER = "weather";

type Corners = ImageSource["coordinates"];

// The field is one image draped on the terrain: a MapLibre `image` source keeps it aligned when
// the map moves, and a Weather layer changing or the hour moving only swaps the picture.
export function showWeatherField(
  map: MapLibreMap,
  field: { url: string; corners: [number, number][] } | null,
): void {
  if (field === null) {
    if (map.getLayer(WEATHER)) map.removeLayer(WEATHER);
    if (map.getSource(WEATHER)) map.removeSource(WEATHER);
    return;
  }
  const source = map.getSource(WEATHER) as ImageSource | undefined;
  if (source) {
    source.updateImage({ url: field.url, coordinates: field.corners as Corners });
    return;
  }
  map.addSource(WEATHER, { type: "image", url: field.url, coordinates: field.corners as Corners });
  map.addLayer(
    { id: WEATHER, type: "raster", source: WEATHER, paint: { "raster-fade-duration": 0 } },
    FIRST_OVERLAY,
  );
}
