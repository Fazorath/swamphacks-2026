export const WEATHER_VARIABLES = ["temperature_2m", "cloud_cover", "precipitation"] as const;

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

// Checking a grid and parsing its times is the same work on every call, and a layer asks for
// every cell of the map, so each grid is checked once.
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

/** The value at a place and time (epoch ms); outside the grid or its hours, the nearest edge value. */
export function valueAt(
  weather: WeatherGrid,
  variable: WeatherVariable,
  lat: number,
  lon: number,
  timeMs: number,
): number {
  const times = checkedHourTimes(weather);
  const { south, west, rows, cols, step_deg } = weather.grid;
  const [row0, row1, rowFraction] = clampedPosition((lat - south) / step_deg, rows);
  const [col0, col1, colFraction] = clampedPosition((lon - west) / step_deg, cols);
  const inHour = (hour: number): number => {
    const at = (row: number, col: number): number =>
      weather.variables[variable][hour][row * cols + col];
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
