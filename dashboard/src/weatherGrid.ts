export const WEATHER_VARIABLES = [
  "temperature_2m",
  "cloud_cover",
  "precipitation",
  "wind_speed_10m",
  "wind_direction_10m",
] as const;

export type WeatherVariable = (typeof WEATHER_VARIABLES)[number];

/** The file layout from `docs/specs/wire-formats.md`: values are row-major, south to north then west to east. */
export interface WeatherGrid {
  source: string;
  credit: string;
  grid: { south: number; west: number; rows: number; cols: number; step_deg: number };
  times: string[];
  units: Record<WeatherVariable, string>;
  variables: Record<WeatherVariable, number[][]>;
}

export interface WindVector {
  /** Metres per second towards the east. */
  u: number;
  /** Metres per second towards the north. */
  v: number;
}

// Upper edge in m/s of each Beaufort force 0 to 11; anything faster is force 12.
const BEAUFORT_BANDS: [number, string][] = [
  [0.5, "Calm"],
  [1.6, "Light air"],
  [3.4, "Light breeze"],
  [5.5, "Gentle breeze"],
  [8, "Moderate breeze"],
  [10.8, "Fresh breeze"],
  [13.9, "Strong breeze"],
  [17.2, "Near gale"],
  [20.8, "Gale"],
  [24.5, "Strong gale"],
  [28.5, "Storm"],
  [32.7, "Violent storm"],
];

export function speedBand(ms: number): string {
  return BEAUFORT_BANDS.find(([upperEdge]) => ms < upperEdge)?.[1] ?? "Hurricane force";
}

// Checking a grid and parsing its times is the same work on every call, and a wind layer
// asks thousands of times a frame, so each grid is checked once.
const hourTimes = new WeakMap<WeatherGrid, number[]>();

function checkedHourTimes(weather: WeatherGrid): number[] {
  const known = hourTimes.get(weather);
  if (known) return known;
  const { rows, cols } = weather.grid;
  if (weather.times.length === 0) throw new Error("Weather Grid has no hours");
  const times = weather.times.map((text) => {
    const ms = Date.parse(text);
    if (Number.isNaN(ms)) throw new Error(`Weather Grid has an unreadable hour: ${text}`);
    return ms;
  });
  for (const name of WEATHER_VARIABLES) {
    const hours = weather.variables[name] as number[][] | undefined;
    if (!hours) throw new Error(`Weather Grid is missing ${name}`);
    if (hours.length !== times.length) {
      throw new Error(`Weather Grid ${name} has ${hours.length} hours, expected ${times.length}`);
    }
    hours.forEach((values, hour) => {
      if (values.length !== rows * cols) {
        throw new Error(
          `Weather Grid ${name} hour ${hour} has ${values.length} values, expected ${rows * cols}`,
        );
      }
    });
  }
  hourTimes.set(weather, times);
  return times;
}

function clampedPosition(value: number, count: number): [number, number, number] {
  const position = Math.min(Math.max(value, 0), count - 1);
  const low = Math.min(Math.floor(position), Math.max(count - 2, 0));
  return [low, Math.min(low + 1, count - 1), position - low];
}

function interpolate(
  weather: WeatherGrid,
  valueIn: (hour: number, index: number) => number,
  lat: number,
  lon: number,
  timeMs: number,
): number {
  const times = checkedHourTimes(weather);
  const { south, west, rows, cols, step_deg } = weather.grid;
  const [row0, row1, rowFraction] = clampedPosition((lat - south) / step_deg, rows);
  const [col0, col1, colFraction] = clampedPosition((lon - west) / step_deg, cols);
  const inHour = (hour: number): number => {
    const at = (row: number, col: number): number => valueIn(hour, row * cols + col);
    const southEdge = at(row0, col0) * (1 - colFraction) + at(row0, col1) * colFraction;
    const northEdge = at(row1, col0) * (1 - colFraction) + at(row1, col1) * colFraction;
    return southEdge * (1 - rowFraction) + northEdge * rowFraction;
  };
  const last = times.length - 1;
  if (timeMs <= times[0]) return inHour(0);
  if (timeMs >= times[last]) return inHour(last);
  const after = times.findIndex((hourMs) => hourMs >= timeMs);
  const before = after - 1;
  const fraction = (timeMs - times[before]) / (times[after] - times[before]);
  return inHour(before) * (1 - fraction) + inHour(after) * fraction;
}

/** The value at a place and time (epoch ms); outside the grid or its hours, the nearest edge value. */
export function valueAt(
  weather: WeatherGrid,
  variable: WeatherVariable,
  lat: number,
  lon: number,
  timeMs: number,
): number {
  return interpolate(
    weather,
    (hour, index) => weather.variables[variable][hour][index],
    lat,
    lon,
    timeMs,
  );
}

/** Wind as u and v. Direction is where the wind comes from, so a wind from 0° blows south. */
export function windAt(weather: WeatherGrid, lat: number, lon: number, timeMs: number): WindVector {
  const component = (toward: (speed: number, radians: number) => number) =>
    interpolate(
      weather,
      (hour, index) =>
        toward(
          weather.variables.wind_speed_10m[hour][index],
          (weather.variables.wind_direction_10m[hour][index] * Math.PI) / 180,
        ),
      lat,
      lon,
      timeMs,
    );
  return {
    u: component((speed, radians) => -speed * Math.sin(radians)),
    v: component((speed, radians) => -speed * Math.cos(radians)),
  };
}
