import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { App } from "./App";
import { lastMap, layerShown, sourceData } from "./fakeMaplibre";
import { fakeNodeSnapshot, fakeNodeState } from "./fakeNodeState";
import { defaultPanels, withPanelToggled } from "./openPanels";

const SHELTERS = [
  { id: "gym", name: "Test Gym", pos: [29.66, -82.32], special_needs: false, pet_friendly: false },
  {
    id: "hall",
    name: "Town Hall",
    pos: [29.67, -82.33],
    special_needs: false,
    pet_friendly: false,
  },
  {
    id: "school",
    name: "Old School",
    pos: [29.68, -82.34],
    special_needs: false,
    pet_friendly: false,
  },
];

const CAMERAS = [
  { id: 1, label: "I-75 at 39th", state: "live", taken_at: "t1", age_s: 3 },
  { id: 2, label: "I-75 at 8th", state: "live", taken_at: "t2", age_s: 3 },
  { id: 3, label: "US-441", state: "offline", taken_at: null, age_s: null },
];

function stubNode(state = fakeNodeState({ nodes: [fakeNodeSnapshot("porch")] })) {
  const answers: Record<string, unknown> = {
    "/api/state": state,
    "/api/cache-pack": { available: true, manifest: null },
    "/api/cache-pack/files/shelters.json": SHELTERS,
    "/api/cache-pack/files/flood_prone.geojson": {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-82.4, 29.6],
                [-82.4, 29.7],
                [-82.3, 29.7],
                [-82.4, 29.6],
              ],
            ],
          },
        },
      ],
    },
    "/api/shelters": { open: ["gym", "hall"] },
    "/api/cameras": CAMERAS,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url in answers ? Response.json(answers[url]) : new Response(null, { status: 404 }),
    ),
  );
}

const rail = () => within(screen.getByRole("navigation", { name: "Layers" }));
const isOpen = (panel: string) => screen.queryByRole("button", { name: `Collapse ${panel}` });

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

describe("the rail's counts", () => {
  it("count Registered Nodes, open Shelters and live cameras", async () => {
    stubNode(
      fakeNodeState({
        nodes: [
          fakeNodeSnapshot("porch"),
          fakeNodeSnapshot("garage"),
          fakeNodeSnapshot("stranger", { registered: false }),
        ],
      }),
    );
    render(<App />);

    expect(await rail().findByRole("button", { name: "Nodes, 2" })).toBeVisible();
    expect(await rail().findByRole("button", { name: "Shelters, 2" })).toBeVisible();
    expect(await rail().findByRole("button", { name: "Cameras, 2" })).toBeVisible();
  });
});

describe("the rail's layer buttons", () => {
  it("hide and show the Shelters on the map", async () => {
    stubNode();
    render(<App />);
    await waitFor(() => expect(document.querySelectorAll(".shelter-pin")).toHaveLength(3));

    const shelters = rail().getByRole("button", { name: "Shelters, 2" });
    expect(shelters).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(shelters);
    expect(shelters).toHaveAttribute("aria-pressed", "false");
    expect(document.querySelectorAll(".shelter-pin")).toHaveLength(0);

    fireEvent.click(shelters);
    expect(document.querySelectorAll(".shelter-pin")).toHaveLength(3);
  });

  it("hide and show the Flood-Prone Areas", async () => {
    stubNode();
    render(<App />);
    await waitFor(() => expect(sourceData("flood-prone").features).toHaveLength(1));
    expect(layerShown("flood-prone-fill")).toBe(true);

    fireEvent.click(rail().getByRole("button", { name: "Flood-Prone Areas" }));
    await waitFor(() => expect(layerShown("flood-prone-fill")).toBe(false));

    fireEvent.click(rail().getByRole("button", { name: "Flood-Prone Areas" }));
    await waitFor(() => expect(layerShown("flood-prone-fill")).toBe(true));
  });

  it("hide the Node markers", async () => {
    stubNode();
    render(<App />);
    await waitFor(() => expect(document.querySelectorAll(".node-marker")).toHaveLength(1));

    fireEvent.click(rail().getByRole("button", { name: /^Nodes/ }));
    expect(document.querySelectorAll(".node-marker")).toHaveLength(0);
  });
});

describe("the rail's Panel buttons", () => {
  it("open and collapse a Panel", async () => {
    stubNode();
    render(<App />);
    expect(isOpen("Readings")).not.toBeNull();

    fireEvent.click(rail().getByRole("button", { name: "Readings" }));
    expect(isOpen("Readings")).toBeNull();
    expect(rail().getByRole("button", { name: "Readings" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(rail().getByRole("button", { name: "Readings" }));
    expect(isOpen("Readings")).not.toBeNull();
  });

  it("collapse the oldest Panel on a side when a third opens", async () => {
    stubNode();
    render(<App />);

    fireEvent.click(rail().getByRole("button", { name: "Alerts" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand Evacuation Plan" }));
    expect(isOpen("Alerts")).not.toBeNull();
    expect(isOpen("Evacuation Plan")).not.toBeNull();

    fireEvent.click(rail().getByRole("button", { name: /^Cameras/ }));
    expect(isOpen("Alerts")).toBeNull();
    expect(isOpen("Evacuation Plan")).not.toBeNull();
    expect(isOpen("Cameras")).not.toBeNull();
    // The left side is its own count.
    expect(isOpen("Readings")).not.toBeNull();
  });

  it("re-centre the map on the selected Node so the Panel does not hide it", async () => {
    stubNode();
    render(<App />);
    await waitFor(() => expect(document.querySelectorAll(".node-marker")).toHaveLength(1));
    fireEvent.click(document.querySelector(".node-marker")!);
    await waitFor(() => expect(lastMap().eased.length).toBeGreaterThan(0));
    const before = lastMap().eased.length;

    fireEvent.click(rail().getByRole("button", { name: "Alerts" }));

    await waitFor(() => expect(lastMap().eased.length).toBeGreaterThan(before));
    expect(lastMap().eased.at(-1)).toMatchObject({
      center: [-82.324, 29.652],
      padding: { right: 360 },
    });
  });
});

describe("remembered Panels", () => {
  it("are restored on the next visit", async () => {
    stubNode();
    const first = render(<App />);
    fireEvent.click(rail().getByRole("button", { name: "Readings" }));
    fireEvent.click(rail().getByRole("button", { name: /^Cameras/ }));
    first.unmount();

    render(<App />);
    expect(isOpen("Readings")).toBeNull();
    expect(isOpen("Cameras")).not.toBeNull();
  });

  it("fall back to the defaults when the saved value is unreadable", () => {
    localStorage.setItem("storm-shield.open-panels", "{not json");
    stubNode();
    render(<App />);

    expect(isOpen("Readings")).not.toBeNull();
    expect(isOpen("Cameras")).toBeNull();
  });

  it("fall back to the defaults when the browser will not read storage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    stubNode();
    render(<App />);

    expect(isOpen("Readings")).not.toBeNull();
  });
});

describe("the starting Panels", () => {
  it("are the Readings on a calm day", () => {
    expect(defaultPanels(null, false)).toEqual(["readings"]);
    expect(defaultPanels("low", false)).toEqual(["readings"]);
  });

  it("are the Evacuation Plan from Elevated, with the Alerts once there are any", () => {
    expect(defaultPanels("elevated", false)).toEqual(["readings", "plan"]);
    expect(defaultPanels("high", false)).toEqual(["readings", "plan"]);
    expect(defaultPanels("elevated", true)).toEqual(["readings", "alerts", "plan"]);
  });

  it("show the Evacuation Plan when the Node reports High", async () => {
    const state = fakeNodeState();
    state.flood_risk.level = "high";
    stubNode(state);
    render(<App />);

    await waitFor(() => expect(isOpen("Evacuation Plan")).not.toBeNull());
    expect(isOpen("Readings")).not.toBeNull();
  });
});

describe("withPanelToggled", () => {
  it("drops the oldest Panel of the same side only", () => {
    expect(withPanelToggled(["readings", "alerts", "plan"], "cameras")).toEqual([
      "readings",
      "plan",
      "cameras",
    ]);
  });
});
