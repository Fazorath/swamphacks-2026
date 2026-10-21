import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";

import type { Basemap } from "./evacuationPlan";
import { BAND_PROTOCOL, parseHex, registerBandProtocol } from "./heightBands";
import {
  FALLBACK_BAND_RGB,
  FIRST_OVERLAY,
  baseLayers,
  groundLayers,
  type MapColors,
} from "./mapStyle";
import type { LatLon } from "./routeGrid";

const PACK_FILES = "/api/cache-pack/files/";

// MapLibre fetches in a worker, which cannot resolve a relative URL against the page. The origin
// is joined as text: `new URL` would percent-encode the `{z}/{x}/{y}` MapLibre fills in per tile.
function packUrl(path: string): string {
  return window.location.origin + PACK_FILES + path;
}

// The data drawn over the map; each is a GeoJSON source the app fills as its props change.
export type OverlayName =
  | "flood-prone"
  | "valley-river"
  | "route"
  | "out-of-reach-line"
  | "blocked-roads"
  | "radio-range"
  | "radio-links"
  | "wave-trail"
  | "wave-head"
  | "water-level"
  | "water-ticks";

const EMPTY: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

// The map is on screen at once, as a plain ground; the Region's basemap joins when the pack is known.
export function baseStyle(colors: MapColors): StyleSpecification {
  return {
    version: 8,
    sources: {
      "flood-prone": { type: "geojson", data: EMPTY },
      "valley-river": { type: "geojson", data: EMPTY },
      route: { type: "geojson", data: EMPTY },
      "out-of-reach-line": { type: "geojson", data: EMPTY },
      "blocked-roads": { type: "geojson", data: EMPTY },
      "radio-range": { type: "geojson", data: EMPTY },
      "radio-links": { type: "geojson", data: EMPTY },
      // The gradient along the trail needs the line's own length (lineMetrics).
      "wave-trail": { type: "geojson", data: EMPTY, lineMetrics: true },
      "wave-head": { type: "geojson", data: EMPTY },
      "water-level": { type: "geojson", data: EMPTY },
      "water-ticks": { type: "geojson", data: EMPTY },
    },
    layers: baseLayers(colors),
  };
}

// The Region's basemap from the vector files the pack holds, with its terrain. Nothing here has a
// label layer: MapLibre would need a glyph server for text, so place names are DOM markers
// (placeLabels.ts) and the map asks no host but this Node.
export function addBasemap(map: MapLibreMap, basemap: Basemap, colors: MapColors): void {
  const [lowestZoom, highestZoom] = basemap.terrain.zooms;
  map.addSource("elevation", {
    type: "raster-dem",
    tiles: [packUrl("elevation/{z}/{x}/{y}.png")],
    encoding: "terrarium",
    tileSize: 256,
    minzoom: lowestZoom,
    maxzoom: highestZoom,
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
    minzoom: lowestZoom,
    maxzoom: highestZoom,
  });
  for (const name of ["water", "waterways", "coastline", "roads"]) {
    map.addSource(name, { type: "geojson", data: packUrl(`basemap/${name}.geojson`) });
  }
  for (const layer of groundLayers(colors)) map.addLayer(layer, FIRST_OVERLAY);
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
