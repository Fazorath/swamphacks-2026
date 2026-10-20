import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

import { BAND_PROTOCOL, parseHex, registerBandProtocol, type Rgb } from "./heightBands";
import type { NepalMap } from "./evacuationPlan";
import type { LatLon } from "./routeGrid";

// Past this zoom the district hairlines appear (D-02); below it the map is the national view.
export const NATIONAL_ZOOM = 6;
const DISTRICT_LINES_FROM_ZOOM = NATIONAL_ZOOM + 1;

const PACK_FILES = "/api/cache-pack/files/";

// MapLibre fetches in a worker, which cannot resolve a relative URL against the page. The origin
// is joined as text: `new URL` would percent-encode the `{z}/{x}/{y}` MapLibre fills in per tile.
function packUrl(path: string): string {
  return window.location.origin + PACK_FILES + path;
}

// The colours of the map, read from the theme's roles at run time (theme.css owns every value).
export type MapColors = Record<
  | "outside"
  | "land"
  | "river"
  | "border"
  | "district"
  | "shadow"
  | "heightLow"
  | "heightMid"
  | "heightHigh"
  | "floodProne"
  | "route"
  | "routeCasing"
  | "blocked"
  | "wave",
  string
>;

const ROLES: Record<keyof MapColors, string> = {
  outside: "--map-outside",
  land: "--map-land",
  river: "--map-river",
  border: "--map-border",
  district: "--map-district",
  shadow: "--map-shadow",
  heightLow: "--map-height-low",
  heightMid: "--map-height-mid",
  heightHigh: "--map-height-high",
  floodProne: "--flood-prone",
  route: "--accent",
  routeCasing: "--map-shadow",
  blocked: "--risk-high",
  wave: "--wave",
};

export function readMapColors(): MapColors {
  const style = getComputedStyle(document.documentElement);
  const colors = {} as MapColors;
  for (const [name, role] of Object.entries(ROLES) as [keyof MapColors, string][]) {
    colors[name] = style.getPropertyValue(role).trim();
  }
  return colors;
}

// The Flood-Prone Area is hatched with diagonal lines, so it reads as approximate ground, not as
// a solid zone. MapLibre asks for the pattern by name; `hatchImage` draws it without a canvas.
export const HATCH_IMAGE = "flood-hatch";
const HATCH_SIZE = 8;
const HATCH_THICKNESS = 2;
const FALLBACK_HATCH_RGB = [107, 134, 168];
const FALLBACK_BAND_RGB: Rgb = [51, 71, 107];
const FALLBACK_WAVE_RGB: Rgb = [232, 238, 248];

export function hatchImage(colour: string): { width: number; height: number; data: Uint8Array } {
  const [red, green, blue] = /^#[0-9a-f]{6}$/i.test(colour)
    ? [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16))
    : FALLBACK_HATCH_RGB;
  const data = new Uint8Array(HATCH_SIZE * HATCH_SIZE * 4);
  for (let y = 0; y < HATCH_SIZE; y++) {
    for (let x = 0; x < HATCH_SIZE; x++) {
      if ((x + y) % HATCH_SIZE >= HATCH_THICKNESS) continue;
      data.set([red, green, blue, 255], (y * HATCH_SIZE + x) * 4);
    }
  }
  return { width: HATCH_SIZE, height: HATCH_SIZE, data };
}

// The data drawn over the map; each is a GeoJSON source the app fills as its props change.
export type OverlayName =
  | "flood-prone"
  | "valley-river"
  | "route"
  | "out-of-reach-line"
  | "blocked-roads"
  | "wave-trail"
  | "wave-head"
  | "water-level"
  | "water-ticks";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// The map is on screen at once, as a plain ground; the Nepal layers join when the pack is known.
export function baseStyle(colors: MapColors): StyleSpecification {
  return {
    version: 8,
    sources: {
      "flood-prone": { type: "geojson", data: EMPTY },
      "valley-river": { type: "geojson", data: EMPTY },
      route: { type: "geojson", data: EMPTY },
      "out-of-reach-line": { type: "geojson", data: EMPTY },
      "blocked-roads": { type: "geojson", data: EMPTY },
      // The gradient along the trail needs the line's own length (lineMetrics).
      "wave-trail": { type: "geojson", data: EMPTY, lineMetrics: true },
      "wave-head": { type: "geojson", data: EMPTY },
      "water-level": { type: "geojson", data: EMPTY },
      "water-ticks": { type: "geojson", data: EMPTY },
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
        paint: { "fill-pattern": HATCH_IMAGE, "fill-opacity": 0.7 },
      },
      {
        id: "flood-prone-line",
        type: "line",
        source: "flood-prone",
        paint: { "line-color": colors.floodProne, "line-width": 2, "line-dasharray": [3, 2] },
      },
      {
        id: "route-casing",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colors.routeCasing, "line-width": 9 },
      },
      {
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": colors.route, "line-width": 5 },
      },
      {
        id: "out-of-reach-line",
        type: "line",
        source: "out-of-reach-line",
        paint: {
          "line-color": colors.route,
          "line-width": 3,
          "line-opacity": 0.7,
          "line-dasharray": [1, 2.5],
        },
      },
      {
        id: "blocked-roads",
        type: "line",
        source: "blocked-roads",
        paint: { "line-color": colors.blocked, "line-width": 6, "line-dasharray": [1.3, 1] },
      },
      // The water level on the valley walls (D-46): a dashed height line with a tick every metre.
      {
        id: "water-level",
        type: "line",
        source: "water-level",
        paint: {
          "line-color": colors.river,
          "line-width": 3,
          "line-opacity": 0.9,
          "line-dasharray": [3, 2],
        },
      },
      {
        id: "water-ticks",
        type: "line",
        source: "water-ticks",
        paint: { "line-color": colors.river, "line-width": 2, "line-opacity": 0.7 },
      },
      // The wave front (D-16, D-17, D-19): white only, fading from the head back to the tail.
      {
        id: "wave-trail",
        type: "line",
        source: "wave-trail",
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": colors.wave,
          "line-width": 5,
          "line-gradient": [
            "interpolate",
            ["linear"],
            ["line-progress"],
            0,
            ["rgba", ...(parseHex(colors.wave) ?? FALLBACK_WAVE_RGB), 0],
            1,
            colors.wave,
          ],
        },
      },
      {
        id: "wave-glow",
        type: "circle",
        source: "wave-head",
        paint: {
          "circle-color": colors.wave,
          "circle-radius": 16,
          "circle-opacity": 0.25,
          "circle-blur": 1,
        },
      },
      {
        id: "wave-head",
        type: "circle",
        source: "wave-head",
        paint: { "circle-color": colors.wave, "circle-radius": 5 },
      },
    ],
  };
}

export const RIVER_FLOW_LAYER = "river-flow";

// Dash and gap, in line widths. MapLibre cannot slide a dash pattern, so the drift is a short
// cycle of arrays, each one the pattern moved a little further along the line.
const FLOW_DASH = 2;
const FLOW_GAP = 5;
const FLOW_STEPS = 14;

export function flowDashes(step: number): number[] {
  const shift = ((step % FLOW_STEPS) / FLOW_STEPS) * (FLOW_DASH + FLOW_GAP);
  return shift <= FLOW_GAP
    ? [0, shift, FLOW_DASH, FLOW_GAP - shift]
    : [shift - FLOW_GAP, FLOW_GAP, FLOW_DASH - (shift - FLOW_GAP), 0];
}

// Under the first overlay, so a river never hides the Route.
export const FIRST_OVERLAY = "valley-river";

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
  registerBandProtocol(
    [colors.heightLow, colors.heightMid, colors.heightHigh].map(
      (colour) => parseHex(colour) ?? FALLBACK_BAND_RGB,
    ),
  );
  map.addSource("elevation-bands", {
    type: "raster",
    tiles: [`${BAND_PROTOCOL}://${packUrl("elevation/{z}/{x}/{y}.png")}`],
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
  map.addLayer({ id: "height-bands", type: "raster", source: "elevation-bands" }, FIRST_OVERLAY);
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
  // Slow dim dashes drifting down every river (D-20); `useRiverFlow` moves them.
  map.addLayer(
    {
      id: RIVER_FLOW_LAYER,
      type: "line",
      source: "rivers",
      paint: {
        "line-color": colors.wave,
        "line-opacity": 0.3,
        "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 10, 1.6],
        "line-dasharray": flowDashes(0),
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

export function pointCollection(points: LatLon[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: points.map((point) => ({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: lonLat(point) },
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
