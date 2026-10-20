import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { App } from "./App";
import { fakeFleetEntry, fakeNodeSnapshot, fakeNodeState } from "./fakeNodeState";
import type { NodeState } from "./nodeState";
import { STATE_POLL_MS } from "./useNodeState";

const MANIFEST = {
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

let current: NodeState;

function stubNode(state: Partial<NodeState>, manifest: unknown = null) {
  current = fakeNodeState(state);
  const answers: Record<string, () => unknown> = {
    "/api/state": () => current,
    "/api/cache-pack": () => ({ available: manifest !== null, manifest }),
    "/api/cache-pack/files/shelters.json": () => [],
    "/api/cache-pack/files/flood_prone.geojson": () => ({
      type: "FeatureCollection",
      features: [],
    }),
    "/api/cache-pack/files/nepal/places.geojson": () => ({
      type: "FeatureCollection",
      features: [],
    }),
    "/api/shelters": () => ({ open: [] }),
    "/api/replay": () => ({ state: "paused", event_t: 1_787_700_000, rate: 30 }),
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url in answers ? Response.json(answers[url]()) : new Response(null, { status: 404 }),
    ),
  );
}

const markers = () => [...document.querySelectorAll<HTMLElement>(".node-marker")];
const markerOf = (name: string) => markers().find((each) => within(each).queryByText(name));

async function nextPoll() {
  await act(() => vi.advanceTimersByTimeAsync(STATE_POLL_MS));
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the Simulated Fleet", () => {
  it("draws a small marker for each fleet entry, and a Fleet button with the count hides them", async () => {
    stubNode({
      fleet: [fakeFleetEntry("Chisapani"), fakeFleetEntry("Dhangadhi", { position: [28.7, 80.5] })],
    });
    render(<App />);
    await waitFor(() => expect(document.querySelectorAll(".node-marker.fleet")).toHaveLength(2));

    const fleetButton = screen.getByRole("button", { name: "Fleet, 2" });
    fireEvent.click(fleetButton);

    expect(document.querySelectorAll(".node-marker.fleet")).toHaveLength(0);
    expect(fleetButton).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(fleetButton);
    expect(document.querySelectorAll(".node-marker.fleet")).toHaveLength(2);
  });

  it("gives the fleet no card in the Readings and no select action", async () => {
    stubNode({ fleet: [fakeFleetEntry("Chisapani")] });
    render(<App />);
    await waitFor(() => expect(document.querySelectorAll(".node-marker.fleet")).toHaveLength(1));

    expect(screen.queryByRole("region", { name: "Node Chisapani" })).toBeNull();
  });

  it("reads '40 simulated Nodes · 6 real' with live counts, and lists the sources in its tooltip", async () => {
    stubNode(
      {
        nodes: [
          fakeNodeSnapshot("porch", { simulated: false }),
          fakeNodeSnapshot("s0"),
          fakeNodeSnapshot("s1"),
        ],
        fleet: [fakeFleetEntry("Chisapani"), fakeFleetEntry("Dhangadhi")],
      },
      MANIFEST,
    );
    render(<App />);

    const strip = await screen.findByRole("contentinfo", { name: "Status" });
    const badge = await within(strip).findByText("2 simulated Nodes · 3 real");
    expect(badge).toHaveAttribute("title", expect.stringContaining("geoBoundaries (CC BY 4.0)"));
    expect(badge).toHaveAttribute("title", expect.stringContaining("checked 2026-10-18"));
    expect(badge).toHaveAttribute("title", expect.stringContaining("Open-Meteo"));
    expect(strip.firstElementChild).toBe(badge);
    const legend = screen.getByRole("complementary", { name: "Legend" });
    expect(within(legend).getByText("2 simulated Nodes · 3 real")).toBeInTheDocument();
  });
});

describe("a Node's marker", () => {
  it("rings and tags a real Node REAL, and no simulated one", async () => {
    stubNode({
      nodes: [fakeNodeSnapshot("porch", { simulated: false }), fakeNodeSnapshot("s0")],
    });
    render(<App />);
    await waitFor(() => expect(markers()).toHaveLength(2));

    expect(within(markerOf("porch")!).getByText("REAL")).toBeInTheDocument();
    expect(markerOf("porch")).toHaveClass("real");
    expect(within(markerOf("s0")!).queryByText("REAL")).toBeNull();
  });

  it("shows a Stale Node grey with its last water level struck through", async () => {
    stubNode({
      nodes: [
        fakeNodeSnapshot("s0", {
          stale: true,
          age_s: 20,
          measurements: { water_level: { value: 4.2, unit: "m" } },
        }),
      ],
    });
    render(<App />);
    await waitFor(() => expect(markers()).toHaveLength(1));

    const marker = markers()[0];
    expect(marker).toHaveClass("stale");
    expect(within(marker).getByText(/420 cm/)).toHaveClass("struck");
    expect(within(marker).getByText("STALE · 20 s")).toBeInTheDocument();
  });

  it("shows an Unverified Node hollow, tagged NOT COUNTED", async () => {
    stubNode({ nodes: [fakeNodeSnapshot("stranger", { registered: false, name: null })] });
    render(<App />);
    await waitFor(() => expect(markers()).toHaveLength(1));

    expect(markers()[0]).toHaveClass("unverified");
    expect(within(markers()[0]).getByText("NOT COUNTED")).toBeInTheDocument();
  });

  it("shows contact lost with an arc, CONTACT LOST and a strip note, then 'heard again'", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubNode({ nodes: [fakeNodeSnapshot("laptop-pokhara", { age_s: 6 })] });
    render(<App />);
    const strip = await screen.findByRole("contentinfo", { name: "Status" });

    await within(strip).findByText("laptop-pokhara: contact lost 6 s");
    const marker = markers()[0];
    expect(marker).toHaveClass("contact-lost");
    expect(within(marker).getByText("CONTACT LOST")).toBeInTheDocument();
    expect(marker.querySelector(".contact-arc")).not.toBeNull();

    current = fakeNodeState({ nodes: [fakeNodeSnapshot("laptop-pokhara", { age_s: 1 })] });
    await nextPoll();

    expect(within(strip).getByText("laptop-pokhara: heard again")).toBeInTheDocument();
    expect(within(strip).queryByText(/contact lost/)).toBeNull();
    expect(markers()[0]).not.toHaveClass("contact-lost");
  });

  it("says nothing of 'heard again' for a Node that went on to Stale", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubNode({ nodes: [fakeNodeSnapshot("s0", { age_s: 8 })] });
    render(<App />);
    const strip = await screen.findByRole("contentinfo", { name: "Status" });
    await within(strip).findByText(/s0: contact lost/);

    current = fakeNodeState({ nodes: [fakeNodeSnapshot("s0", { age_s: 16, stale: true })] });
    await nextPoll();

    expect(within(strip).queryByText(/heard again/)).toBeNull();
    expect(within(strip).queryByText(/contact lost/)).toBeNull();
  });

  it("updates in place on a poll: the same element, a new level, and a ring with a card flash once", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubNode({ nodes: [fakeNodeSnapshot("s0")] });
    render(<App />);
    await waitFor(() => expect(markers()).toHaveLength(1));
    const marker = markers()[0];
    expect(marker.querySelector(".rise-ring")).toBeNull();

    const risk = (level: "elevated" | "high" | null) => ({
      ...fakeNodeState().flood_risk,
      level,
      nodes: { s0: level },
    });
    current = fakeNodeState({ nodes: [fakeNodeSnapshot("s0")], flood_risk: risk("elevated") });
    await nextPoll();

    expect(markers()[0]).toBe(marker);
    expect(marker).toHaveClass("elevated");
    expect(marker.querySelectorAll(".rise-ring")).toHaveLength(1);
    expect(document.querySelectorAll(".card-flash")).toHaveLength(1);
    const ring = marker.querySelector(".rise-ring");

    // The same level on the next poll neither rebuilds the marker nor replays the ring.
    await nextPoll();
    expect(markers()[0]).toBe(marker);
    expect(marker.querySelector(".rise-ring")).toBe(ring);
  });

  it("leaves every marker object untouched when a poll brings no change", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stubNode({
      nodes: [fakeNodeSnapshot("s0"), fakeNodeSnapshot("s1")],
      fleet: [fakeFleetEntry("a")],
    });
    render(<App />);
    await waitFor(() => expect(markers()).toHaveLength(3));
    const before = markers();

    await nextPoll();
    await nextPoll();

    expect(markers()).toEqual(before);
    markers().forEach((marker, at) => expect(marker).toBe(before[at]));
  });

  it("highlights the card of the selected marker, and the marker of the selected card", async () => {
    stubNode({ nodes: [fakeNodeSnapshot("s0"), fakeNodeSnapshot("s1")] });
    render(<App />);
    await waitFor(() => expect(markers()).toHaveLength(2));

    fireEvent.click(markerOf("s1")!);
    expect(screen.getByRole("region", { name: "Node s1" })).toHaveAttribute("aria-current", "true");
    expect(markerOf("s1")).toHaveClass("selected");

    fireEvent.click(screen.getByRole("region", { name: "Node s0" }));
    expect(markerOf("s0")).toHaveClass("selected");
    expect(markerOf("s1")).not.toHaveClass("selected");
  });
});

describe("the layer buttons", () => {
  it("hide and show the Nodes", async () => {
    stubNode({ nodes: [fakeNodeSnapshot("s0")] });
    render(<App />);
    await waitFor(() => expect(markers()).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: /^Nodes, / }));
    expect(markers()).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: /^Nodes, / }));
    expect(markers()).toHaveLength(1);
  });

  it("darken the map's edges while the Storm Signal is on, until the button hides it", async () => {
    stubNode({
      flood_risk: {
        ...fakeNodeState().flood_risk,
        storm_signal: { on: true, nodes: 2, pressure_hpa: 990 },
      },
    });
    render(<App />);
    await waitFor(() => expect(document.querySelector(".storm-vignette")).not.toBeNull());

    fireEvent.click(screen.getByRole("button", { name: /Storm Signal/ }));
    expect(document.querySelector(".storm-vignette")).toBeNull();
  });

  it("show no vignette on a calm day", async () => {
    stubNode({});
    render(<App />);
    await screen.findByRole("region", { name: "Map" });

    expect(document.querySelector(".storm-vignette")).toBeNull();
  });
});
