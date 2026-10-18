import { describe, expect, it } from "vitest";
import { WEATHER_VARIABLES, valueAt, type WeatherGrid, type WeatherVariable } from "./weatherGrid";

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

describe("a national grid", () => {
  // 9 x 17 at 0.5 degrees from 26.3 N, 80.0 E; each cell holds its own index so a wrong lookup shows.
  const rows = 9;
  const cols = 17;
  const national: WeatherGrid = {
    ...handMadeGrid(),
    grid: { south: 26.3, west: 80, rows, cols, step_deg: 0.5 },
    variables: {
      temperature_2m: [Array.from({ length: rows * cols }, (_, index) => index)],
      cloud_cover: [Array(rows * cols).fill(0)],
      precipitation: [Array(rows * cols).fill(0)],
    },
    times: ["2026-08-26T00:00:00Z"],
  };

  it("finds a point in row-major order, south to north then west to east", () => {
    expect(valueAt(national, "temperature_2m", 26.3 + 3 * 0.5, 80 + 5 * 0.5, HOUR_0)).toBeCloseTo(
      3 * cols + 5,
      9,
    );
  });

  it("blends the four points around the middle of a cell", () => {
    // Neighbours are 1 apart along a row and 17 apart along a column: (0 + 1 + 17 + 18) / 4.
    expect(valueAt(national, "temperature_2m", 26.55, 80.25, HOUR_0)).toBeCloseTo(9);
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
    expect(() => valueAt(grid, "temperature_2m", 28, 85, HOUR_0)).toThrow(
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
