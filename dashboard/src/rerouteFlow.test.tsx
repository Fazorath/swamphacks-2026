import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { App } from "./App";
import { fakeNodeState } from "./fakeNodeState";

const PROFILE_KEY = "storm-shield.household-profile";
const BLOCKED_KEY = "storm-shield.blocked-roads";

// Home at node 0; the direct road 0-1 reaches the Shelter, the detour 0-2-3-1 goes round it.
const ROAD_GRAPH = {
  nodes: [
    [29.65, -82.32],
    [29.66, -82.32],
    [29.65, -82.31],
    [29.66, -82.31],
  ],
  edges: [
    [0, 1, 1113],
    [0, 2, 969],
    [2, 3, 1113],
    [3, 1, 969],
  ],
};
const ROUTE_GRID = { south: 29, west: -83, lat_step: 0.01, lon_step: 0.01 };
const DIRECT_ROUTE = [
  [29.65, -82.32],
  [29.66, -82.32],
];

function saveProfile() {
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      version: 1,
      profile: {
        home: { lat: 29.65, lon: -82.32 },
        housing: "site-built",
        needsSpecialNeedsShelter: false,
        needsPetFriendlyShelter: false,
      },
    }),
  );
}

function blockDirectRoad() {
  localStorage.setItem(
    BLOCKED_KEY,
    JSON.stringify({ version: 1, roads: [{ a: [29.65, -82.32], b: [29.66, -82.32] }] }),
  );
}

function stubNode({ roads }: { roads: boolean }) {
  const answers: Record<string, unknown> = {
    "/api/state": fakeNodeState(),
    "/api/cache-pack": { available: true, manifest: { route_grid: ROUTE_GRID } },
    "/api/cache-pack/files/routes/68_65.json": { "test-gym": DIRECT_ROUTE },
    ...(roads && { "/api/cache-pack/files/roads.json": ROAD_GRAPH }),
    "/api/cache-pack/files/shelters.json": [
      {
        id: "test-gym",
        name: "Test Gym",
        pos: [29.66, -82.32],
        special_needs: false,
        pet_friendly: false,
      },
    ],
    "/api/cache-pack/files/flood_prone.geojson": { type: "FeatureCollection", features: [] },
    "/api/shelters": { open: ["test-gym"] },
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

test("a Blocked Road on the Route reroutes the plan and is drawn on the map", async () => {
  saveProfile();
  blockDirectRoad();
  stubNode({ roads: true });
  render(<App />);

  expect(await screen.findByText("Rerouted around 1 blocked road.")).toBeVisible();
  expect(screen.getByText(/Test Gym, 3\.1 km by road/)).toBeVisible();
  await waitFor(() => expect(document.querySelectorAll(".blocked-road")).toHaveLength(1));
});

test("rerouting sends nothing about the Blocked Roads or the home", async () => {
  saveProfile();
  blockDirectRoad();
  stubNode({ roads: true });
  render(<App />);
  await screen.findByText("Rerouted around 1 blocked road.");

  const requests = vi.mocked(fetch).mock.calls;
  expect(requests.every(([, init]) => init?.body === undefined)).toBe(true);
  const urls = requests.map(([url]) => String(url));
  expect(urls.filter((url) => url.includes("blocked") || url.includes("29.65"))).toEqual([]);
});

test("without a Road graph the Route stays and there is no way to block a road", async () => {
  saveProfile();
  blockDirectRoad();
  stubNode({ roads: false });
  render(<App />);

  expect(await screen.findByText(/Test Gym, 1\.\d km by road/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Block a road" })).toBeNull();
  expect(screen.queryByText(/Rerouted/)).toBeNull();
});

test("the resident can switch road-blocking mode on and off", async () => {
  saveProfile();
  stubNode({ roads: true });
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Block a road" }));
  expect(screen.getByText(/Tap a road to block it/)).toBeVisible();
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(screen.queryByText(/Tap a road to block it/)).toBeNull();
});
