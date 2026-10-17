import { describe, expect, it } from "vitest";
import {
  WEATHER_VARIABLES,
  speedBand,
  valueAt,
  windAt,
  type WeatherGrid,
  type WeatherVariable,
} from "./weatherGrid";

const HOUR_0 = Date.parse("2026-08-26T00:00:00Z");
const HOUR_MS = 3_600_000;

const everywhere = (value: number) => [
  [value, value, value, value],
  [value, value, value, value],
];

// 2 rows x 2 columns, 2 hours. Temperature is 10, 20 (south row) and 30, 40 (north row), plus 100 in hour 1.
function handMadeGrid(overrides: Partial<Record<WeatherVariable, number[][]>> = {}): WeatherGrid {
  return {
    source: "test",
    credit: "test",
    grid: { south: 28, west: 85, rows: 2, cols: 2, step_deg: 0.1 },
    times: ["2026-08-26T00:00:00Z", "2026-08-26T01:00:00Z"],
    units: Object.fromEntries(WEATHER_VARIABLES.map((name) => [name, ""])) as WeatherGrid["units"],
    variables: {
      temperature_2m: [
        [10, 20, 30, 40],
        [110, 120, 130, 140],
      ],
      cloud_cover: everywhere(0),
      precipitation: everywhere(0),
      wind_speed_10m: everywhere(0),
      wind_direction_10m: everywhere(0),
      ...overrides,
    },
  };
}

describe("valueAt", () => {
  const grid = handMadeGrid();

  it("is exact at grid points and hours", () => {
    // Degrees like 85.1 are not exact in floating point, so compare to many decimals, not bit for bit.
    expect(valueAt(grid, "temperature_2m", 28, 85, HOUR_0)).toBeCloseTo(10, 9);
    expect(valueAt(grid, "temperature_2m", 28, 85.1, HOUR_0)).toBeCloseTo(20, 9);
    expect(valueAt(grid, "temperature_2m", 28.1, 85, HOUR_0)).toBeCloseTo(30, 9);
    expect(valueAt(grid, "temperature_2m", 28.1, 85.1, HOUR_0 + HOUR_MS)).toBeCloseTo(140, 9);
  });

  it("is the mean of the four corners at the middle of a cell", () => {
    expect(valueAt(grid, "temperature_2m", 28.05, 85.05, HOUR_0)).toBeCloseTo(25);
  });

  it("is halfway between two hours", () => {
    expect(valueAt(grid, "temperature_2m", 28, 85, HOUR_0 + HOUR_MS / 2)).toBeCloseTo(60);
  });

  it("clamps outside the grid and outside the hours", () => {
    expect(valueAt(grid, "temperature_2m", 20, 70, HOUR_0 - HOUR_MS)).toBe(10);
    expect(valueAt(grid, "temperature_2m", 40, 100, HOUR_0 + 9 * HOUR_MS)).toBe(140);
    expect(valueAt(grid, "temperature_2m", 28, 99, HOUR_0)).toBe(20);
  });
});

describe("windAt", () => {
  const blowing = (speed: number, direction: number) =>
    handMadeGrid({
      wind_speed_10m: everywhere(speed),
      wind_direction_10m: everywhere(direction),
    });

  it.each([
    ["north", 0, 0, -5],
    ["east", 90, -5, 0],
    ["south", 180, 0, 5],
    ["west", 270, 5, 0],
  ])("a wind from the %s blows the other way", (_name, direction, u, v) => {
    const wind = windAt(blowing(5, direction), 28.05, 85.05, HOUR_0);
    expect(wind.u).toBeCloseTo(u);
    expect(wind.v).toBeCloseTo(v);
  });
});

describe("speedBand", () => {
  it.each([
    [0, "Calm"],
    [0.49, "Calm"],
    [0.5, "Light air"],
    [3.4, "Gentle breeze"],
    [10.79, "Fresh breeze"],
    [32.6, "Violent storm"],
    [32.7, "Hurricane force"],
  ])("%s m/s is %s", (ms, band) => {
    expect(speedBand(ms)).toBe(band);
  });
});

describe("a malformed grid", () => {
  it("names a missing variable", () => {
    const grid = handMadeGrid();
    delete (grid.variables as Partial<WeatherGrid["variables"]>).cloud_cover;
    expect(() => valueAt(grid, "temperature_2m", 28, 85, HOUR_0)).toThrow(/missing cloud_cover/);
  });

  it("names an array of the wrong length", () => {
    const grid = handMadeGrid({
      precipitation: [
        [0, 0, 0],
        [0, 0, 0],
      ],
    });
    expect(() => windAt(grid, 28, 85, HOUR_0)).toThrow(
      /precipitation hour 0 has 3 values, expected 4/,
    );
  });

  it("names a wrong number of hours", () => {
    const grid = handMadeGrid({ cloud_cover: [[0, 0, 0, 0]] });
    expect(() => valueAt(grid, "cloud_cover", 28, 85, HOUR_0)).toThrow(
      /cloud_cover has 1 hours, expected 2/,
    );
  });
});
