import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BASEMAP_MANIFEST_PARTS } from "./fakeBasemap";

import { App } from "./App";
import { lastMap } from "./fakeMaplibre";
import { fakeNodeState } from "./fakeNodeState";

const NEPAL_MANIFEST = {
  built: "2026-10-18T12:00:00+00:00",
  bbox: [27.86, 85.08, 28.46, 85.47],
  ...BASEMAP_MANIFEST_PARTS,
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

const HOUR = 3_600_000;

// A forecast that starts now and runs two hours: 0 °C, then 30 °C.
function forecastFetched(hoursAgo: number) {
  const now = Date.now();
  return {
    ...WEATHER,
    variables: { ...WEATHER.variables, cloud_cover: [everywhere(10), everywhere(90)] },
    fetched_at: new Date(now - hoursAgo * HOUR).toISOString(),
    times: [new Date(now).toISOString(), new Date(now + 168 * HOUR).toISOString()],
  };
}

let eventT: number | null;
let weather: unknown;
let forecast: unknown;

function stubNode() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const answers: Record<string, unknown> = {
        "/api/state": fakeNodeState({}),
        "/api/cache-pack": { available: true, manifest: NEPAL_MANIFEST },
        "/api/cache-pack/files/shelters.json": [],
        "/api/cache-pack/files/flood_prone.geojson": { type: "FeatureCollection", features: [] },
        "/api/cache-pack/files/basemap/places.geojson": { type: "FeatureCollection", features: [] },
        "/api/shelters": { open: [] },
        "/api/replay":
          eventT === null ? { state: "stopped" } : { state: "paused", event_t: eventT, rate: 30 },
        ...(weather === null ? {} : { "/api/weather/replay": weather }),
        ...(forecast === null ? {} : { "/api/weather/forecast": forecast }),
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
  forecast = forecastFetched(1);
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

  describe("with no Replay running", () => {
    const requested = () =>
      vi
        .mocked(fetch)
        .mock.calls.map(([url]) => String(url))
        .filter((url) => /weather/.test(url));

    beforeEach(() => {
      eventT = null;
    });

    it("reads the forecast, not the replay file", async () => {
      await openMap();
      await pick("Temperature");

      await waitFor(() => expect(within(legend()).getByText(/^FORECAST/)).toBeInTheDocument());
      expect(requested()).toEqual(["/api/weather/forecast"]);
      expect(legend().textContent).not.toContain("RECORDED");
    });

    it("switches to the replay file when a Replay starts and back when it ends", async () => {
      await openMap();
      await pick("Temperature");
      await waitFor(() => expect(within(legend()).getByText(/^FORECAST/)).toBeInTheDocument());

      eventT = HOUR_0_T;
      await waitFor(() => expect(within(legend()).getByText(/RECORDED/)).toBeInTheDocument(), {
        timeout: 4000,
      });

      eventT = null;
      await waitFor(() => expect(within(legend()).getByText(/^FORECAST/)).toBeInTheDocument(), {
        timeout: 4000,
      });
    });

    it("moves every layer with the slider", async () => {
      await openMap();
      for (const choice of ["Temperature", "Cloud cover", "Rain"]) {
        await pick(choice);
        await waitFor(() => expect(weatherUrl()).toBeDefined());
        const now = weatherUrl();

        fireEvent.change(screen.getByRole("slider"), { target: { value: "168" } });
        await waitFor(() => expect(weatherUrl()).not.toBe(now));
        fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } });
      }
    });

    it("has a slider from now to seven days", async () => {
      await openMap();
      await pick("Rain");

      const slider = await screen.findByRole("slider");
      expect(slider).toHaveAttribute("min", "0");
      expect(slider).toHaveAttribute("max", "168");
      fireEvent.change(slider, { target: { value: "24" } });
      expect(legend().textContent).toContain("now + 24 h");
    });

    it.each([
      [1, "FORECAST · updated 1 h ago"],
      [5, "OFFLINE · last forecast 5 h old"],
    ])("tags a forecast fetched %s h ago", async (hoursAgo, tag) => {
      forecast = forecastFetched(hoursAgo);
      await openMap();
      await pick("Rain");

      await waitFor(() => expect(within(legend()).getByText(tag)).toBeInTheDocument());
    });

    it("says the forecast is not available when the Node has none, and draws nothing", async () => {
      forecast = null;
      await openMap();
      await pick("Rain");

      await waitFor(() =>
        expect(
          within(legend()).getByText(/Forecast not available on this Node/),
        ).toBeInTheDocument(),
      );
      expect(lastMap().layerIds).not.toContain("weather");
    });
  });

  it("keeps the replay layers working when the Node has no forecast", async () => {
    forecast = null;
    await openMap();
    await pick("Temperature");

    await waitFor(() => expect(within(legend()).getByText(/RECORDED/)).toBeInTheDocument());
    await waitFor(() => expect(weatherUrl()).toBeDefined());
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
