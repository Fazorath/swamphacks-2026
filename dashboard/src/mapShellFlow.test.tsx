import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { Profiler } from "react";

import { App } from "./App";
import type { CommunityWarning } from "./communityWarnings";
import { addressesTheMapWouldFetch, lastMap } from "./fakeMaplibre";
import { fakeNodeSnapshot, fakeNodeState } from "./fakeNodeState";
import type { NodeState } from "./nodeState";

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
    sources: [
      {
        layer: "borders",
        name: "geoBoundaries",
        licence: "CC BY 4.0",
        url: "https://example.org",
        checked: "2026-10-18",
      },
    ],
  },
};

const PLACES = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Kathmandu", kind: "capital", key: true },
      geometry: { type: "Point", coordinates: [85.3, 27.7] },
    },
    {
      type: "Feature",
      properties: { name: "Pokhara", kind: "city" },
      geometry: { type: "Point", coordinates: [83.98, 28.2] },
    },
  ],
};

const WARNING: CommunityWarning = {
  id: 7,
  t: 1000,
  nodes: ["s0"],
  reasons: ["water_surge"],
  origin: "s0",
  origin_km: -12.2,
  surge_t: 1000,
};

function stubNode(state: Partial<NodeState> = {}, manifest: unknown = null) {
  const answers: Record<string, unknown> = {
    "/api/state": fakeNodeState(state),
    "/api/cache-pack": { available: manifest !== null, manifest },
    "/api/cache-pack/files/shelters.json": [],
    "/api/cache-pack/files/flood_prone.geojson": { type: "FeatureCollection", features: [] },
    "/api/cache-pack/files/nepal/places.geojson": PLACES,
    "/api/shelters": { open: [] },
    "/api/replay": { state: "paused", event_t: 1_787_700_000, rate: 30 },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url in answers ? Response.json(answers[url]) : new Response(null, { status: 404 }),
    ),
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("the map", () => {
  it("draws the Nepal basemap from the Node's own files and asks no other host", async () => {
    stubNode({}, NEPAL_MANIFEST);
    render(<App />);

    await waitFor(() => expect(lastMap().layerIds).toContain("land"));
    expect(lastMap().layerIds).toEqual([
      "outside",
      "land",
      "height-bands",
      "hillshade",
      "districts",
      "rivers",
      "river-flow",
      "border",
      "valley-river",
      "flood-prone-fill",
      "flood-prone-line",
      "radio-range-fill",
      "radio-range-line",
      "radio-links",
      "route-casing",
      "route",
      "out-of-reach-line",
      "blocked-roads",
      "water-level",
      "water-ticks",
      "wave-trail",
      "wave-glow",
      "wave-head",
    ]);
    const addresses = addressesTheMapWouldFetch();
    expect(addresses.length).toBeGreaterThan(0);
    for (const address of addresses) {
      expect(address.startsWith(window.location.origin + "/api/cache-pack/files/")).toBe(true);
    }
    // MapLibre fills `{z}/{x}/{y}` per tile; an encoded template (%7Bz%7D) is asked for as is.
    expect(addresses.some((address) => address.endsWith("elevation/{z}/{x}/{y}.png"))).toBe(true);
  });

  it("makes no request to any host but its own Node, from the page or the map", async () => {
    stubNode({}, NEPAL_MANIFEST);
    render(<App />);
    await screen.findByText("Kathmandu");

    const requested = vi.mocked(fetch).mock.calls.map(([url]) => String(url));
    expect(requested.length).toBeGreaterThan(0);
    for (const url of [...requested, ...addressesTheMapWouldFetch()]) {
      expect(new URL(url, window.location.origin).origin).toBe(window.location.origin);
    }
  });

  it("needs no glyph or sprite server because place names are not map text", () => {
    stubNode();
    render(<App />);

    expect(lastMap().glyphs).toBeUndefined();
    expect(lastMap().sprite).toBeUndefined();
  });

  it("falls back to the valley's own layers when the pack has no Nepal map", async () => {
    stubNode({}, { built: "2026-10-17T12:00:00+00:00", bbox: [27.86, 85.08, 28.46, 85.47] });
    render(<App />);

    await screen.findByText(/Cache Pack built 2026-10-17/);
    expect(lastMap().layerIds).toEqual([
      "outside",
      "valley-river",
      "flood-prone-fill",
      "flood-prone-line",
      "radio-range-fill",
      "radio-range-line",
      "radio-links",
      "route-casing",
      "route",
      "out-of-reach-line",
      "blocked-roads",
      "water-level",
      "water-ticks",
      "wave-trail",
      "wave-glow",
      "wave-head",
    ]);
  });

  it("labels the capital and the valley towns at the national zoom, not every city", async () => {
    stubNode({}, NEPAL_MANIFEST);
    render(<App />);

    expect(await screen.findByText("Kathmandu")).toBeInTheDocument();
    expect(screen.queryByText("Pokhara")).toBeNull();
  });
});

describe("the top bar and status strip", () => {
  it("has the Hub button on a Hub and not on a Sensor Node", async () => {
    stubNode({ role: "hub" });
    const { unmount } = render(<App />);
    expect(await screen.findByRole("button", { name: "Hub" })).toBeInTheDocument();
    unmount();

    stubNode({ role: "sensor" });
    render(<App />);
    await screen.findByText(/porch · Sensor Node/);
    expect(screen.queryByRole("button", { name: "Hub" })).toBeNull();
  });

  it("puts the Node name and role in the status strip, not the top bar", async () => {
    stubNode({ name: "porch", role: "sensor" });
    render(<App />);

    const strip = await screen.findByRole("contentinfo", { name: "Status" });
    expect(within(strip).getByText("porch · Sensor Node")).toBeInTheDocument();
    expect(within(screen.getByRole("banner")).queryByText(/porch/)).toBeNull();
  });

  it("shows the credit with the boundaries note, the simulated count and Mesh-only", async () => {
    stubNode(
      {
        status: "mesh_only",
        nodes: [
          fakeNodeSnapshot("s0", { simulated: true }),
          fakeNodeSnapshot("porch", { simulated: false }),
        ],
      },
      NEPAL_MANIFEST,
    );
    render(<App />);

    const strip = await screen.findByRole("contentinfo", { name: "Status" });
    expect(await within(strip).findByText(/geoBoundaries \(CC BY 4\.0\)/)).toBeInTheDocument();
    expect(within(strip).getByText(/elevation is approximate/)).toBeInTheDocument();
    expect(within(strip).getByText("Boundaries are indicative")).toBeInTheDocument();
    expect(within(strip).getByText("1 simulated · 1 real")).toBeInTheDocument();
    expect(within(strip).getByText(/Mesh-only/)).toBeInTheDocument();
    expect(within(strip).getByText(/Readings \d+ s ago/)).toBeInTheDocument();
  });
});

describe("the Panels", () => {
  it("opens only the Readings on a calm day", async () => {
    stubNode();
    render(<App />);
    await screen.findByRole("region", { name: "Map" });

    expect(screen.getByRole("button", { name: "Collapse Readings" })).toBeInTheDocument();
    for (const name of ["Alerts", "Evacuation Plan"]) {
      expect(screen.getByRole("button", { name: `Expand ${name}` })).toBeInTheDocument();
    }
  });

  it("opens the Alerts and the Evacuation Plan when a warning arrives", async () => {
    stubNode({ community_warnings: [WARNING] });
    render(<App />);

    expect(await screen.findByRole("button", { name: "Collapse Alerts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Collapse Evacuation Plan" })).toBeInTheDocument();
  });

  it("hides a Panel's content when it is collapsed and brings it back when expanded", async () => {
    stubNode({ nodes: [fakeNodeSnapshot("porch")] });
    render(<App />);
    expect(await screen.findByText(/Pressure: 1015 hPa/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse Readings" }));
    expect(screen.queryByText(/Pressure: 1015 hPa/)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand Readings" }));
    expect(screen.getByText(/Pressure: 1015 hPa/)).toBeInTheDocument();
  });

  it("keeps a Panel the resident collapsed closed when the next warning arrives", async () => {
    stubNode({ community_warnings: [WARNING] });
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Collapse Alerts" }));

    expect(screen.getByRole("button", { name: "Expand Alerts" })).toBeInTheDocument();
  });
});

describe("polling", () => {
  it("re-renders nothing when a poll brings the same answer", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      stubNode({ nodes: [fakeNodeSnapshot("porch")] });
      let commits = 0;
      render(
        <Profiler id="app" onRender={() => commits++}>
          <App />
        </Profiler>,
      );
      await screen.findByText(/Pressure: 1015 hPa/);
      // Let the first round of polls and effects settle, then watch several more polls go by.
      await act(() => vi.advanceTimersByTimeAsync(7000));
      const settled = commits;
      await act(() => vi.advanceTimersByTimeAsync(7000));

      expect(commits).toBe(settled);
    } finally {
      vi.useRealTimers();
    }
  });
});
