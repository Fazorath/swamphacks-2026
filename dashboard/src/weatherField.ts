import { valueAt, type WeatherGrid, type WeatherVariable } from "./weatherGrid";

export type FieldLayer = "temperature" | "cloud" | "rain";

/** Straight RGBA pixels, row 0 at the north edge, like a canvas's `ImageData`. */
export type FieldImage = { width: number; height: number; data: Uint8ClampedArray<ArrayBuffer> };

export const FIELD_WIDTH = 320;
export const FIELD_HEIGHT = 180;

type Stop = [value: number, r: number, g: number, b: number, a: number];

// The scales are fixed, not stretched to the data: a calm hour must look calm.
export const TEMPERATURE_STOPS: Stop[] = [
  [-20, 40, 70, 200, 0.62],
  [0, 110, 170, 235, 0.62],
  [12, 235, 240, 245, 0.62],
  [24, 245, 170, 80, 0.62],
  [38, 215, 60, 50, 0.62],
];

// Zero is fully transparent, so dry country shows the map.
export const RAIN_STOPS: Stop[] = [
  [0, 150, 200, 255, 0],
  [0.5, 120, 175, 250, 0.45],
  [3, 60, 110, 230, 0.7],
  [10, 20, 40, 170, 0.88],
];

export const LEGEND_RANGE: Record<"temperature" | "rain", { low: number; high: number }> = {
  temperature: { low: -20, high: 38 },
  rain: { low: 0, high: 10 },
};

export const VARIABLE_OF: Record<FieldLayer, WeatherVariable> = {
  temperature: "temperature_2m",
  cloud: "cloud_cover",
  rain: "precipitation",
};

function colourAt(stops: Stop[], value: number): [number, number, number, number] {
  if (value <= stops[0][0]) return [stops[0][1], stops[0][2], stops[0][3], stops[0][4]];
  for (let i = 1; i < stops.length; i++) {
    if (value <= stops[i][0]) {
      const [v0, r0, g0, b0, a0] = stops[i - 1];
      const [v1, r1, g1, b1, a1] = stops[i];
      const t = (value - v0) / (v1 - v0);
      return [r0 + (r1 - r0) * t, g0 + (g1 - g0) * t, b0 + (b1 - b0) * t, a0 + (a1 - a0) * t];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3], last[4]];
}

/** A CSS gradient of a ramp across a legend strip, `low` at the left end. */
export function rampGradient(layer: "temperature" | "rain"): string {
  const stops = layer === "temperature" ? TEMPERATURE_STOPS : RAIN_STOPS;
  const { low, high } = LEGEND_RANGE[layer];
  const parts = stops.map(([value, r, g, b, a]) => {
    const alpha = layer === "rain" ? a : 1;
    // `color(srgb …)` because the ramps are data, not theme colours, and the theme test bans
    // the usual functional spellings outside theme.css.
    const colour = `color(srgb ${r / 255} ${g / 255} ${b / 255} / ${alpha})`;
    return `${colour} ${(((value - low) / (high - low)) * 100).toFixed(1)}%`;
  });
  return `linear-gradient(to right, ${parts.join(", ")})`;
}

// Value noise from a hash of the lattice corner: the same place always gets the same number,
// which is what keeps the clouds from crawling when the hour changes.
function lattice(ix: number, iy: number): number {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = smooth(x - ix);
  const fy = smooth(y - iy);
  const bottom = lattice(ix, iy) * (1 - fx) + lattice(ix + 1, iy) * fx;
  const top = lattice(ix, iy + 1) * (1 - fx) + lattice(ix + 1, iy + 1) * fx;
  return bottom * (1 - fy) + top * fy;
}

// Four octaves, normalised to 0 to 1, over latitude and longitude in degrees.
function cloudNoise(lat: number, lon: number): number {
  let sum = 0;
  let weight = 0.5;
  let scale = 3;
  let total = 0;
  for (let octave = 0; octave < 4; octave++) {
    sum += weight * valueNoise(lon * scale, lat * scale);
    total += weight;
    weight /= 2;
    scale *= 2;
  }
  return sum / total;
}

const CLOUD_SOFTNESS = 0.3;
const CLOUD_ALPHA = 0.85;

// Cover decides how much of the fixed texture shows: all of it at 100%, wisps at 30%.
function cloudAlpha(coverPct: number, noise: number): number {
  const cover = Math.min(Math.max(coverPct / 100, 0), 1);
  const threshold = 1.3 * (1 - cover) - 0.3;
  return Math.min(Math.max((noise - threshold) / CLOUD_SOFTNESS, 0), 1) * CLOUD_ALPHA;
}

/** The corners of the painted image, as MapLibre wants them: top-left, top-right, bottom-right, bottom-left (lon, lat). */
export function fieldCorners(grid: WeatherGrid["grid"]): [number, number][] {
  const south = grid.south;
  const north = grid.south + (grid.rows - 1) * grid.step_deg;
  const west = grid.west;
  const east = grid.west + (grid.cols - 1) * grid.step_deg;
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latOfMercatorY = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);

/**
 * One layer at one moment (epoch ms), painted over the Weather Grid's box. MapLibre stretches an
 * image evenly in map (Mercator) space, so rows are spaced that way to keep each place where the
 * data puts it.
 */
export function paintWeatherField(
  weather: WeatherGrid,
  layer: FieldLayer,
  timeMs: number,
): FieldImage {
  const [[west, north], [east, south]] = [
    fieldCorners(weather.grid)[0],
    fieldCorners(weather.grid)[2],
  ];
  const northY = mercatorY(north);
  const southY = mercatorY(south);
  const data = new Uint8ClampedArray(FIELD_WIDTH * FIELD_HEIGHT * 4);
  const variable = VARIABLE_OF[layer];
  for (let row = 0; row < FIELD_HEIGHT; row++) {
    const lat = latOfMercatorY(northY + ((southY - northY) * (row + 0.5)) / FIELD_HEIGHT);
    for (let col = 0; col < FIELD_WIDTH; col++) {
      const lon = west + ((east - west) * (col + 0.5)) / FIELD_WIDTH;
      const value = valueAt(weather, variable, lat, lon, timeMs);
      const at = (row * FIELD_WIDTH + col) * 4;
      if (layer === "cloud") {
        data[at] = data[at + 1] = data[at + 2] = 255;
        data[at + 3] = Math.round(cloudAlpha(value, cloudNoise(lat, lon)) * 255);
      } else {
        const [r, g, b, a] = colourAt(layer === "rain" ? RAIN_STOPS : TEMPERATURE_STOPS, value);
        data[at] = r;
        data[at + 1] = g;
        data[at + 2] = b;
        data[at + 3] = Math.round(a * 255);
      }
    }
  }
  return { width: FIELD_WIDTH, height: FIELD_HEIGHT, data };
}
