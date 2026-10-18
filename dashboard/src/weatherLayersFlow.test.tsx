import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { App } from "./App";
import { lastMap } from "./fakeMaplibre";
import { fakeNodeState } from "./fakeNodeState";

const NEPAL_MANIFEST = {
  built: "2026-10-18T12:00:00+00:00",
  bbox: [27.86, 85.08, 28.46, 85.47],
  nepal: {
    bbox: [26.3, 80.0, 30.5, 88.3],
    elevation: {
      encoding: "terrarium",
      approximate: true,
      national_zooms: [5, 8],
      detail_zooms: [9, 12],
      detail_areas: [],
    },
    boundaries_note: "Boundaries are indicative",
    sources: [],
  },
};

const everywhere = (value: number) => [value, value, value, value];
const HOUR_0_T = Date.parse("2026-08-26T00:00:00Z") / 1000;

// 2 x 2 points, 2 hours: 0 °C then 30 °C.
const WEATHER = {
  source: "test",
  credit: "Weather data by Open-Meteo.com (CC BY 4.0)",
  grid: { south: 28, west: 85, rows: 2, cols: 2, step_deg: 0.5 },
  times: ["2026-08-26T00:00:00Z", "2026-08-26T01:00:00Z"],
  units: { temperature_2m: "°C", cloud_cover: "%", precipitation: "mm/h" },
  variables: {
    temperature_2m: [everywhere(0), everywhere(30)],
    cloud_cover: [everywhere(60), everywhere(60)],
    precipitation: [everywhere(0), everywhere(2)],
  },
};

let eventT: number | null;
let weather: unknown;

function stubNode() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const answers: Record<string, unknown> = {
        "/api/state": fakeNodeState({}),
        "/api/cache-pack": { available: true, manifest: NEPAL_MANIFEST },
        "/api/cache-pack/files/shelters.json": [],
        "/api/cache-pack/files/flood_prone.geojson": { type: "FeatureCollection", features: [] },
        "/api/cache-pack/files/nepal/places.geojson": { type: "FeatureCollection", features: [] },
        "/api/shelters": { open: [] },
        "/api/replay":
          eventT === null ? { state: "stopped" } : { state: "paused", event_t: eventT, rate: 30 },
        ...(weather === null ? {} : { "/api/weather/replay": weather }),
      };
      return url in answers ? Response.json(answers[url]) : new Response(null, { status: 404 });
    }),
  );
}

const weatherUrl = () => lastMap().sources.get("weather")?.url;
const legend = () => screen.getByRole("complementary", { name: "Weather legend" });

async function pick(choice: string) {
  fireEvent.click(screen.getByRole("button", { name: "Weather" }));
  fireEvent.click(screen.getByRole("radio", { name: choice }));
}

async function openMap() {
  render(<App />);
  await waitFor(() => expect(lastMap().layerIds).toContain("height-bands"));
}

beforeEach(() => {
  eventT = HOUR_0_T;
  weather = WEATHER;
  stubNode();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("Weather layers on the map", () => {
  it("drapes the picture on the map under the overlays, and removes it with Off", async () => {
    await openMap();
    await pick("Temperature");

    await waitFor(() => expect(weatherUrl()).toBeDefined());
    const layers = lastMap().layerIds;
    expect(layers.indexOf("weather")).toBeLessThan(layers.indexOf("valley-river"));
    expect(layers.indexOf("weather")).toBeLessThan(layers.indexOf("route"));

    await pick("Off");
    await waitFor(() => expect(lastMap().layerIds).not.toContain("weather"));
    expect(weatherUrl()).toBeUndefined();
  });

  it("repaints when the Event clock moves an hour", async () => {
    await openMap();
    await pick("Temperature");
    await waitFor(() => expect(weatherUrl()).toBeDefined());
    const atHourZero = weatherUrl();

    eventT = HOUR_0_T + 3600;

    await waitFor(() => expect(weatherUrl()).not.toBe(atHourZero), { timeout: 4000 });
  });

  it("shows the file's first hour when no Replay is running", async () => {
    eventT = null;
    await openMap();
    await pick("Temperature");
    await waitFor(() => expect(weatherUrl()).toBeDefined());
    const noClock = weatherUrl();

    eventT = HOUR_0_T;

    // The clock at hour 0 paints the same picture as no clock: the first hour.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(weatherUrl()).toBe(noClock);
  });

  it.each([
    ["Temperature", "°C"],
    ["Cloud cover", "cloud cover, %"],
    ["Rain", "mm/h"],
  ])(
    "labels %s with its units, the recorded tag, the coarse note and the credit",
    async (choice, unit) => {
      await openMap();
      await pick(choice);

      await waitFor(() =>
        expect(within(legend()).getByText(/RECORDED WEATHER/)).toBeInTheDocument(),
      );
      const text = legend().textContent ?? "";
      expect(text).toContain(choice);
      expect(text).toContain(unit);
      expect(text).toContain("RECORDED WEATHER · 26 Aug 2026");
      expect(text).toContain("Coarse grid");
      expect(text).toContain("Weather data by Open-Meteo.com (CC BY 4.0)");
      expect(text).not.toMatch(/avalanche|flood/i);
    },
  );

  it("says the weather is not downloaded when the pack has no replay file", async () => {
    weather = null;
    await openMap();
    await pick("Rain");

    await waitFor(() =>
      expect(within(legend()).getByText(/Weather not downloaded/)).toBeInTheDocument(),
    );
    expect(lastMap().layerIds).not.toContain("weather");
  });
});
