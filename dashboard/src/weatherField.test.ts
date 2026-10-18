import { describe, expect, it } from "vitest";

import { fieldCorners, paintWeatherField, type FieldImage } from "./weatherField";
import type { WeatherGrid, WeatherVariable } from "./weatherGrid";

const HOUR_0 = Date.parse("2026-08-26T00:00:00Z");
const HOUR_MS = 3_600_000;

const everywhere = (value: number) => [
  [value, value, value, value],
  [value, value, value, value],
];

// 2 x 2 points half a degree apart, 2 hours.
function handMadeWeather(
  overrides: Partial<Record<WeatherVariable, number[][]>> = {},
): WeatherGrid {
  return {
    source: "test",
    credit: "Weather data by Open-Meteo.com (CC BY 4.0)",
    grid: { south: 28, west: 85, rows: 2, cols: 2, step_deg: 0.5 },
    times: ["2026-08-26T00:00:00Z", "2026-08-26T01:00:00Z"],
    units: { temperature_2m: "°C", cloud_cover: "%", precipitation: "mm/h" },
    variables: {
      temperature_2m: everywhere(10),
      cloud_cover: everywhere(0),
      precipitation: everywhere(0),
      ...overrides,
    },
  };
}

const alphas = (image: FieldImage) => image.data.filter((_, at) => at % 4 === 3);
const opacity = (image: FieldImage) => alphas(image).reduce((sum, alpha) => sum + alpha, 0);

describe("paintWeatherField", () => {
  it("paints zero rain as a fully transparent pixel", () => {
    const image = paintWeatherField(handMadeWeather(), "rain", HOUR_0);

    expect(Math.max(...alphas(image))).toBe(0);
  });

  it("paints rain deeper blue and more opaque as it gets heavier", () => {
    const light = paintWeatherField(
      handMadeWeather({ precipitation: everywhere(0.5) }),
      "rain",
      HOUR_0,
    );
    const heavy = paintWeatherField(
      handMadeWeather({ precipitation: everywhere(10) }),
      "rain",
      HOUR_0,
    );

    expect(light.data[3]).toBeGreaterThan(0);
    expect(heavy.data[3]).toBeGreaterThan(light.data[3]);
    expect(heavy.data[2]).toBeGreaterThan(heavy.data[0]);
  });

  it("makes full cloud cover more opaque than 30%", () => {
    const wisps = paintWeatherField(
      handMadeWeather({ cloud_cover: everywhere(30) }),
      "cloud",
      HOUR_0,
    );
    const overcast = paintWeatherField(
      handMadeWeather({ cloud_cover: everywhere(100) }),
      "cloud",
      HOUR_0,
    );

    expect(opacity(overcast)).toBeGreaterThan(opacity(wisps));
    expect(opacity(wisps)).toBeGreaterThan(0);
    // 30% leaves gaps; 100% is cloud nearly everywhere.
    expect(Math.min(...alphas(wisps))).toBe(0);
    expect(alphas(overcast).filter((alpha) => alpha > 0).length).toBeGreaterThan(
      0.9 * alphas(overcast).length,
    );
  });

  it("keeps clouds where they are as the cover grows: no crawling", () => {
    const thin = paintWeatherField(
      handMadeWeather({ cloud_cover: everywhere(40) }),
      "cloud",
      HOUR_0,
    );
    const thick = paintWeatherField(
      handMadeWeather({ cloud_cover: everywhere(70) }),
      "cloud",
      HOUR_0,
    );

    const alphasThin = alphas(thin);
    const alphasThick = alphas(thick);
    expect(alphasThin.every((alpha, at) => alphasThick[at] >= alpha)).toBe(true);
  });

  it("changes when the Event clock moves an hour", () => {
    const weather = handMadeWeather({ temperature_2m: [everywhere(0)[0], everywhere(30)[0]] });

    const before = paintWeatherField(weather, "temperature", HOUR_0);
    const after = paintWeatherField(weather, "temperature", HOUR_0 + HOUR_MS);

    expect(after.data).not.toEqual(before.data);
  });

  it("uses a fixed temperature scale: cold is bluer than warm, whatever the data holds", () => {
    const cold = paintWeatherField(
      handMadeWeather({ temperature_2m: everywhere(-10) }),
      "temperature",
      HOUR_0,
    );
    const warm = paintWeatherField(
      handMadeWeather({ temperature_2m: everywhere(32) }),
      "temperature",
      HOUR_0,
    );

    expect(cold.data[2]).toBeGreaterThan(cold.data[0]);
    expect(warm.data[0]).toBeGreaterThan(warm.data[2]);
  });

  it("covers the Weather Grid's own box", () => {
    expect(fieldCorners(handMadeWeather().grid)).toEqual([
      [85, 28.5],
      [85.5, 28.5],
      [85.5, 28],
      [85, 28],
    ]);
  });

  it("paints rain blue, never a risk colour", () => {
    const image = paintWeatherField(
      handMadeWeather({ precipitation: everywhere(10) }),
      "rain",
      HOUR_0,
    );

    for (let at = 0; at < image.data.length; at += 4) {
      if (image.data[at + 3] > 0) expect(image.data[at + 2]).toBeGreaterThan(image.data[at]);
    }
  });
});
