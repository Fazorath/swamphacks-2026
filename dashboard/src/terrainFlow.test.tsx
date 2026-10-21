import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BASEMAP_MANIFEST_PARTS } from "./fakeBasemap";

import { App } from "./App";
import { lastMap } from "./fakeMaplibre";
import { fakeNodeState } from "./fakeNodeState";
import { TERRAIN_EXAGGERATION, TERRAIN_PITCH } from "./terrain";

const NEPAL_MANIFEST = {
  built: "2026-10-18T12:00:00+00:00",
  bbox: [27.86, 85.08, 28.46, 85.47],
  ...BASEMAP_MANIFEST_PARTS,
};

function stubNode(manifest: unknown) {
  const answers: Record<string, unknown> = {
    "/api/state": fakeNodeState({}),
    "/api/cache-pack": { available: manifest !== null, manifest },
    "/api/cache-pack/files/shelters.json": [],
    "/api/cache-pack/files/flood_prone.geojson": { type: "FeatureCollection", features: [] },
    "/api/cache-pack/files/basemap/places.geojson": { type: "FeatureCollection", features: [] },
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

function legend() {
  return within(screen.getByRole("complementary", { name: "Legend" }));
}

async function openOnNepal() {
  stubNode(NEPAL_MANIFEST);
  render(<App />);
  await waitFor(() => expect(lastMap().layerIds).toContain("height-bands"));
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

describe("terrain", () => {
  it("stays flat on the national view and tilts only when the camera flies to the valley", async () => {
    await openOnNepal();
    expect(lastMap().terrain).toBeNull();
    expect(lastMap().pitch).toBe(0);

    fireEvent.click(legend().getByRole("button", { name: "Valley" }));

    await waitFor(() =>
      expect(lastMap().terrain).toEqual({
        source: "elevation",
        exaggeration: TERRAIN_EXAGGERATION,
      }),
    );
    expect(lastMap().flights.at(-1)?.pitch).toBe(TERRAIN_PITCH);
  });

  it("does not tilt when the resident zooms in by hand", async () => {
    await openOnNepal();
    act(() => {
      lastMap().zoom = 10;
      lastMap().emit("zoomend", {});
    });

    expect(lastMap().terrain).not.toBeNull();
    expect(lastMap().pitch).toBe(0);
  });

  it("releases terrain and flattens when the view zooms back out to the country", async () => {
    await openOnNepal();
    fireEvent.click(legend().getByRole("button", { name: "Valley" }));
    await waitFor(() => expect(lastMap().terrain).not.toBeNull());

    act(() => {
      lastMap().zoom = 6;
      lastMap().emit("zoomend", {});
    });

    expect(lastMap().terrain).toBeNull();
    expect(lastMap().pitch).toBe(0);
  });

  it("turns terrain off by hand and remembers the choice on this device", async () => {
    await openOnNepal();
    fireEvent.click(legend().getByRole("button", { name: "Valley" }));
    await waitFor(() => expect(lastMap().terrain).not.toBeNull());

    fireEvent.click(legend().getByRole("button", { name: "2D" }));

    expect(lastMap().terrain).toBeNull();
    expect(lastMap().pitch).toBe(0);
    expect(legend().getByRole("button", { name: "2D" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("storm-shield.terrain")).toBe("2d");
  });

  it("starts flat when the resident chose 2D on an earlier visit", async () => {
    localStorage.setItem("storm-shield.terrain", "2d");
    await openOnNepal();
    fireEvent.click(legend().getByRole("button", { name: "Valley" }));

    await waitFor(() => expect(lastMap().flights).toHaveLength(1));
    expect(lastMap().flights[0].pitch).toBe(0);
    expect(lastMap().terrain).toBeNull();
  });

  it("drops to 2D on its own when panning is slow, with one line in the status strip", async () => {
    await openOnNepal();
    fireEvent.click(legend().getByRole("button", { name: "Valley" }));
    await waitFor(() => expect(lastMap().terrain).not.toBeNull());

    let clock = 0;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    act(() => {
      lastMap().emit("movestart", {});
      for (let frame = 0; frame < 40; frame++) {
        clock += 100;
        lastMap().emit("render", {});
      }
    });

    await waitFor(() => expect(lastMap().terrain).toBeNull());
    const strip = within(screen.getByRole("contentinfo", { name: "Status" }));
    expect(strip.getByText("Terrain off · frame rate")).toBeInTheDocument();
    expect(legend().getByRole("button", { name: "2D" })).toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem("storm-shield.terrain")).toBeNull();
  });

  it("is disabled with its reason on a pack without elevation tiles", async () => {
    stubNode(null);
    render(<App />);
    await waitFor(() => expect(screen.getByRole("button", { name: "3D" })).toBeDisabled());

    expect(screen.getByRole("button", { name: "2D" })).toBeDisabled();
    expect(screen.getByText(/3D needs a Cache Pack with elevation tiles/)).toBeInTheDocument();
    expect(lastMap().terrain).toBeNull();
  });
});
