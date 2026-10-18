import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

import type { NepalMap } from "./evacuationPlan";
import type { LatLon } from "./routeGrid";

// Past this zoom the district hairlines appear (D-02); below it the map is the national view.
export const NATIONAL_ZOOM = 6;
export const VALLEY_ZOOM = 11;
const DISTRICT_LINES_FROM_ZOOM = NATIONAL_ZOOM + 1;

const PACK_FILES = "/api/cache-pack/files/";

// MapLibre fetches in a worker, which cannot resolve a relative URL against the page.
function packUrl(path: string): string {
  return new URL(PACK_FILES + path, window.location.origin).href;
}

// The colours of the map, read from the theme's roles at run time (theme.css owns every value).
export type MapColors = Record<
  | "outside"
  | "land"
  | "river"
  | "border"
  | "district"
  | "shadow"
  | "floodProne"
  | "route"
  | "blocked",
  string
>;

const ROLES: Record<keyof MapColors, string> = {
  outside: "--map-outside",
  land: "--map-land",
  river: "--map-river",
  border: "--map-border",
  district: "--map-district",
  shadow: "--map-shadow",
  floodProne: "--accent",
  route: "--risk-low",
  blocked: "--risk-high",
};

export function readMapColors(): MapColors {
  const style = getComputedStyle(document.documentElement);
  const colors = {} as MapColors;
  for (const [name, role] of Object.entries(ROLES) as [keyof MapColors, string][]) {
    colors[name] = style.getPropertyValue(role).trim();
  }
  return colors;
}

// The data drawn over the map; each is a GeoJSON source the app fills as its props change.
export type OverlayName = "flood-prone" | "valley-river" | "route" | "blocked-roads";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// The map is on screen at once, as a plain ground; the Nepal layers join when the pack is known.
export function baseStyle(colors: MapColors): StyleSpecification {
  return {
    version: 8,
    sources: {
      "flood-prone": { type: "geojson", data: EMPTY },
      "valley-river": { type: "geojson", data: EMPTY },
      route: { type: "geojson", data: EMPTY },
      "blocked-roads": { type: "geojson", data: EMPTY },
    },
    layers: [
      { id: "outside", type: "background", paint: { "background-color": colors.outside } },
      {
        id: "valley-river",
        type: "line",
        source: "valley-river",
        paint: { "line-color": colors.river, "line-width": 2 },
      },
      {
        id: "flood-prone-fill",
        type: "fill",
        source: "flood-prone",
        paint: { "fill-color": colors.floodProne, "fill-opacity": 0.12 },
      },
      {
        id: "flood-prone-line",
        type: "line",
        source: "flood-prone",
        paint: { "line-color": colors.floodProne, "line-width": 2, "line-dasharray": [3, 2] },
      },
      {
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colors.route, "line-width": 5, "line-opacity": 0.85 },
      },
      {
        id: "blocked-roads",
        type: "line",
        source: "blocked-roads",
        paint: { "line-color": colors.blocked, "line-width": 6, "line-dasharray": [1.3, 1] },
      },
    ],
  };
}

// Under the first overlay, so a river never hides the Route.
const FIRST_OVERLAY = "valley-river";

// The Osiris-style basemap, lifted one step (D-07), from the vector files the pack holds. Nothing
// here has a label layer: MapLibre would need a glyph server for text, so place names are DOM
// markers (placeLabels.ts) and the map asks no host but this Node.
export function addNepalBasemap(map: MapLibreMap, nepal: NepalMap, colors: MapColors): void {
  const { nationalZooms, detailZooms } = nepal.elevation;
  map.addSource("elevation", {
    type: "raster-dem",
    tiles: [packUrl("elevation/{z}/{x}/{y}.png")],
    encoding: "terrarium",
    tileSize: 256,
    minzoom: nationalZooms[0],
    maxzoom: detailZooms[1],
  });
  for (const name of ["border", "districts", "rivers"]) {
    map.addSource(name, { type: "geojson", data: packUrl(`nepal/${name}.geojson`) });
  }
  map.addLayer(
    { id: "land", type: "fill", source: "border", paint: { "fill-color": colors.land } },
    FIRST_OVERLAY,
  );
  map.addLayer(
    {
      id: "hillshade",
      type: "hillshade",
      source: "elevation",
      // About 10% (D-05): the valley walls read as a soft band, not as a relief map.
      paint: { "hillshade-exaggeration": 0.1, "hillshade-shadow-color": colors.shadow },
    },
    FIRST_OVERLAY,
  );
  map.addLayer(
    {
      id: "districts",
      type: "line",
      source: "districts",
      minzoom: DISTRICT_LINES_FROM_ZOOM,
      paint: { "line-color": colors.district, "line-width": 0.6 },
    },
    FIRST_OVERLAY,
  );
  map.addLayer(
    {
      id: "rivers",
      type: "line",
      source: "rivers",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": colors.river,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 10, 2.2],
      },
    },
    FIRST_OVERLAY,
  );
  map.addLayer(
    {
      id: "border",
      type: "line",
      source: "border",
      paint: { "line-color": colors.border, "line-width": 1.2 },
    },
    FIRST_OVERLAY,
  );
}

function lonLat([lat, lon]: LatLon): [number, number] {
  return [lon, lat];
}

export function lineCollection(lines: LatLon[][]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: lines.map((line) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: line.map(lonLat) },
    })),
  };
}

export function setOverlay(
  map: MapLibreMap,
  name: OverlayName,
  data: GeoJSON.FeatureCollection,
): void {
  (map.getSource(name) as GeoJSONSource).setData(data);
}
