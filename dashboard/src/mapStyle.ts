import type { ExpressionSpecification, LayerSpecification } from "maplibre-gl";

import { parseHex, type Rgb } from "./heightBands";

// The one place for how the map looks: every fill, line width and opacity, and the theme roles the
// colours come from. A new look is a change here and in theme.css and touches no map logic.
export type MapColors = Record<
  | "land"
  | "water"
  | "waterway"
  | "coast"
  | "road"
  | "river"
  | "shadow"
  | "heightLow"
  | "heightMid"
  | "heightHigh"
  | "floodProne"
  | "route"
  | "routeCasing"
  | "blocked"
  | "wave"
  | "radioRange"
  | "radioLink",
  string
>;

const ROLES: Record<keyof MapColors, string> = {
  land: "--map-land",
  water: "--map-water",
  waterway: "--map-river",
  coast: "--map-coast",
  road: "--map-road",
  river: "--map-river",
  shadow: "--map-shadow",
  heightLow: "--map-height-low",
  heightMid: "--map-height-mid",
  heightHigh: "--map-height-high",
  floodProne: "--flood-prone",
  route: "--accent",
  routeCasing: "--map-shadow",
  blocked: "--risk-high",
  wave: "--wave",
  radioRange: "--radio-range",
  radioLink: "--radio-link",
};

export function readMapColors(): MapColors {
  const style = getComputedStyle(document.documentElement);
  const colors = {} as MapColors;
  for (const [name, role] of Object.entries(ROLES) as [keyof MapColors, string][]) {
    colors[name] = style.getPropertyValue(role).trim();
  }
  return colors;
}

export const FALLBACK_BAND_RGB: Rgb = [51, 71, 107];
const FALLBACK_WAVE_RGB: Rgb = [232, 238, 248];
const FALLBACK_HATCH_RGB = [107, 134, 168];

// The Flood-Prone Area is hatched with diagonal lines, so it reads as approximate ground, not as
// a solid zone. MapLibre asks for the pattern by name; `hatchImage` draws it without a canvas.
export const HATCH_IMAGE = "flood-hatch";
const HATCH_SIZE = 8;
const HATCH_THICKNESS = 2;

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

export const RIVER_FLOW_LAYER = "river-flow";

// A line width that grows with the zoom, between two (zoom, width) stops.
function zoomRamp(
  fromZoom: number,
  fromWidth: number,
  toZoom: number,
  toWidth: number,
): ExpressionSpecification {
  return ["interpolate", ["linear"], ["zoom"], fromZoom, fromWidth, toZoom, toWidth];
}

// Hillshade strength: about 10% (D-05), so the valley walls read as a soft band, not as a relief map.
const HILLSHADE_EXAGGERATION = 0.1;
const WATER_FILL_OPACITY = 0.9;
const WATERWAY_WIDTHS = zoomRamp(5, 0.6, 10, 2.2);
const RIVER_FLOW_OPACITY = 0.3;
const RIVER_FLOW_WIDTHS = zoomRamp(5, 0.8, 10, 1.6);
const COAST_LINE_WIDTH = 1.2;
const ROAD_WIDTHS = zoomRamp(8, 0.4, 14, 2);
const ROAD_OPACITY = 0.8;

// The Region's ground from the pack's basemap: land is the map's background, water is filled,
// and the coast, waterways and roads are lines. Added once the pack is known, under the overlays.
export function groundLayers(colors: MapColors): LayerSpecification[] {
  return [
    { id: "height-bands", type: "raster", source: "elevation-bands" },
    {
      id: "hillshade",
      type: "hillshade",
      source: "elevation",
      paint: {
        "hillshade-exaggeration": HILLSHADE_EXAGGERATION,
        "hillshade-shadow-color": colors.shadow,
      },
    },
    {
      id: "water",
      type: "fill",
      source: "water",
      paint: { "fill-color": colors.water, "fill-opacity": WATER_FILL_OPACITY },
    },
    {
      id: "roads",
      type: "line",
      source: "roads",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": colors.road,
        "line-width": ROAD_WIDTHS,
        "line-opacity": ROAD_OPACITY,
      },
    },
    {
      id: "waterways",
      type: "line",
      source: "waterways",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": colors.waterway, "line-width": WATERWAY_WIDTHS },
    },
    // Slow dim dashes drifting down every waterway (D-20); `useRiverFlow` moves them.
    {
      id: RIVER_FLOW_LAYER,
      type: "line",
      source: "waterways",
      paint: {
        "line-color": colors.wave,
        "line-opacity": RIVER_FLOW_OPACITY,
        "line-width": RIVER_FLOW_WIDTHS,
        "line-dasharray": flowDashes(0),
      },
    },
    {
      id: "coastline",
      type: "line",
      source: "coastline",
      paint: { "line-color": colors.coast, "line-width": COAST_LINE_WIDTH },
    },
  ];
}

const FLOOD_PRONE_FILL_OPACITY = 0.7;
const FLOOD_PRONE_LINE_WIDTH = 2;
const FLOOD_PRONE_DASHES = [3, 2];
const VALLEY_RIVER_WIDTH = 2;
const RADIO_RANGE_FILL_OPACITY = 0.08;
const RADIO_RANGE_LINE_WIDTH = 1;
const RADIO_RANGE_LINE_OPACITY = 0.5;
const RADIO_LINK_WIDTH = 2;
const RADIO_LINK_OPACITY = 0.7;
const ROUTE_CASING_WIDTH = 9;
const ROUTE_WIDTH = 5;
const OUT_OF_REACH_WIDTH = 3;
const OUT_OF_REACH_OPACITY = 0.7;
const OUT_OF_REACH_DASHES = [1, 2.5];
const BLOCKED_ROAD_WIDTH = 6;
const BLOCKED_ROAD_DASHES = [1.3, 1];
const WATER_LEVEL_WIDTH = 3;
const WATER_LEVEL_OPACITY = 0.9;
const WATER_LEVEL_DASHES = [3, 2];
const WATER_TICK_WIDTH = 2;
const WATER_TICK_OPACITY = 0.7;
const WAVE_TRAIL_WIDTH = 5;
const WAVE_GLOW_RADIUS = 16;
const WAVE_GLOW_OPACITY = 0.25;
const WAVE_GLOW_BLUR = 1;
const WAVE_HEAD_RADIUS = 5;

// The first overlay: the Region's ground layers go under it, so a river never hides the Route.
export const FIRST_OVERLAY = "valley-river";

// What is drawn over the ground, bottom to top. The ground itself is the background, so the map is
// on screen at once, before the pack's basemap arrives.
export function baseLayers(colors: MapColors): LayerSpecification[] {
  return [
    { id: "land", type: "background", paint: { "background-color": colors.land } },
    {
      id: FIRST_OVERLAY,
      type: "line",
      source: "valley-river",
      paint: { "line-color": colors.river, "line-width": VALLEY_RIVER_WIDTH },
    },
    {
      id: "flood-prone-fill",
      type: "fill",
      source: "flood-prone",
      paint: { "fill-pattern": HATCH_IMAGE, "fill-opacity": FLOOD_PRONE_FILL_OPACITY },
    },
    {
      id: "flood-prone-line",
      type: "line",
      source: "flood-prone",
      paint: {
        "line-color": colors.floodProne,
        "line-width": FLOOD_PRONE_LINE_WIDTH,
        "line-dasharray": FLOOD_PRONE_DASHES,
      },
    },
    {
      id: "radio-range-fill",
      type: "fill",
      source: "radio-range",
      paint: { "fill-color": colors.radioRange, "fill-opacity": RADIO_RANGE_FILL_OPACITY },
    },
    {
      id: "radio-range-line",
      type: "line",
      source: "radio-range",
      paint: {
        "line-color": colors.radioRange,
        "line-width": RADIO_RANGE_LINE_WIDTH,
        "line-opacity": RADIO_RANGE_LINE_OPACITY,
      },
    },
    {
      id: "radio-links",
      type: "line",
      source: "radio-links",
      layout: { "line-cap": "round" },
      paint: {
        "line-color": colors.radioLink,
        "line-width": RADIO_LINK_WIDTH,
        "line-opacity": RADIO_LINK_OPACITY,
      },
    },
    {
      id: "route-casing",
      type: "line",
      source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": colors.routeCasing, "line-width": ROUTE_CASING_WIDTH },
    },
    {
      id: "route",
      type: "line",
      source: "route",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: { "line-color": colors.route, "line-width": ROUTE_WIDTH },
    },
    {
      id: "out-of-reach-line",
      type: "line",
      source: "out-of-reach-line",
      paint: {
        "line-color": colors.route,
        "line-width": OUT_OF_REACH_WIDTH,
        "line-opacity": OUT_OF_REACH_OPACITY,
        "line-dasharray": OUT_OF_REACH_DASHES,
      },
    },
    {
      id: "blocked-roads",
      type: "line",
      source: "blocked-roads",
      paint: {
        "line-color": colors.blocked,
        "line-width": BLOCKED_ROAD_WIDTH,
        "line-dasharray": BLOCKED_ROAD_DASHES,
      },
    },
    // The water level on the valley walls (D-46): a dashed height line with a tick every metre.
    {
      id: "water-level",
      type: "line",
      source: "water-level",
      paint: {
        "line-color": colors.river,
        "line-width": WATER_LEVEL_WIDTH,
        "line-opacity": WATER_LEVEL_OPACITY,
        "line-dasharray": WATER_LEVEL_DASHES,
      },
    },
    {
      id: "water-ticks",
      type: "line",
      source: "water-ticks",
      paint: {
        "line-color": colors.river,
        "line-width": WATER_TICK_WIDTH,
        "line-opacity": WATER_TICK_OPACITY,
      },
    },
    // The wave front (D-16, D-17, D-19): white only, fading from the head back to the tail.
    {
      id: "wave-trail",
      type: "line",
      source: "wave-trail",
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": colors.wave,
        "line-width": WAVE_TRAIL_WIDTH,
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
        "circle-radius": WAVE_GLOW_RADIUS,
        "circle-opacity": WAVE_GLOW_OPACITY,
        "circle-blur": WAVE_GLOW_BLUR,
      },
    },
    {
      id: "wave-head",
      type: "circle",
      source: "wave-head",
      paint: { "circle-color": colors.wave, "circle-radius": WAVE_HEAD_RADIUS },
    },
  ];
}
