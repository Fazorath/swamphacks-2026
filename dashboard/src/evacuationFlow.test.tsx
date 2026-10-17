import { render, screen, waitFor } from "@testing-library/react";

import { App } from "./App";
import { fakeNodeState } from "./fakeNodeState";

const PROFILE_KEY = "storm-shield.household-profile";

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

// A grid whose steps are whole hundredths, so the cell nearest the profile's home is easy to read.
const ROUTE_GRID = { south: 29, west: -83, lat_step: 0.01, lon_step: 0.01 };
const HOME_ROUTE_FILE = "/api/cache-pack/files/routes/68_65.json";
const ROUTE: [number, number][] = [
  [29.65, -82.32],
  [29.655, -82.32],
  [29.66, -82.32],
];

function stubNode({
  packAvailable,
  open,
  routeGrid = null,
  routeFile,
}: {
  packAvailable: boolean;
  open: string[];
  routeGrid?: typeof ROUTE_GRID | null;
  routeFile?: Record<string, [number, number][]>;
}) {
  const answers: Record<string, unknown> = {
    "/api/state": fakeNodeState(),
    "/api/cache-pack": {
      available: packAvailable,
      manifest: routeGrid && { route_grid: routeGrid },
    },
    ...(routeFile && { [HOME_ROUTE_FILE]: routeFile }),
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
    "/api/shelters": { open },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url in answers ? Response.json(answers[url]) : new Response(null, { status: 404 }),
    ),
  );
}

function fetchedUrls(): string[] {
  return vi.mocked(fetch).mock.calls.map(([url]) => String(url));
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

test("a resident with a profile sees the nearest open Shelter, marked on the map", async () => {
  saveProfile();
  stubNode({ packAvailable: true, open: ["test-gym"] });
  render(<App />);

  expect(await screen.findByText(/Nearest open Shelter: Test Gym, 1\.1 km away/)).toBeVisible();
  expect(screen.getByText("Evacuation decisions come from official sources.")).toBeVisible();
  // Leaflet can add the marker a moment after the plan text renders.
  await waitFor(() => expect(document.querySelectorAll(".shelter-marker")).toHaveLength(1));
});

test("the Shelter marker clears when no Shelter is open", async () => {
  saveProfile();
  stubNode({ packAvailable: true, open: [] });
  render(<App />);

  expect(await screen.findByText(/No open Shelter announced yet/)).toBeVisible();
  expect(document.querySelector(".shelter-marker")).toBeNull();
});

test("a Node with no Cache Pack yet says the information is still loading", async () => {
  saveProfile();
  stubNode({ packAvailable: false, open: [] });
  render(<App />);

  expect(await screen.findByText(/still loading on this Node/)).toBeVisible();
  expect(document.querySelector(".shelter-marker")).toBeNull();
});

test("the route from the Grid point nearest home is drawn and sets the distance", async () => {
  saveProfile();
  stubNode({
    packAvailable: true,
    open: ["test-gym"],
    routeGrid: ROUTE_GRID,
    routeFile: { "test-gym": ROUTE },
  });
  render(<App />);

  expect(await screen.findByText(/Nearest open Shelter: Test Gym, 1\.\d km by road/)).toBeVisible();
  expect(fetchedUrls()).toContain(HOME_ROUTE_FILE);
  expect(document.querySelectorAll(".evacuation-route")).toHaveLength(1);
});

test("the Route request names a Grid point, not the home", async () => {
  saveProfile();
  stubNode({ packAvailable: true, open: ["test-gym"], routeGrid: ROUTE_GRID });
  render(<App />);

  await screen.findByText(/Nearest open Shelter/);
  const routeRequests = fetchedUrls().filter((url) => url.includes("routes/"));
  expect(routeRequests).toEqual([HOME_ROUTE_FILE]);
});

test("a home with no Route file falls back to straight-line distance and draws no line", async () => {
  saveProfile();
  stubNode({ packAvailable: true, open: ["test-gym"], routeGrid: ROUTE_GRID });
  render(<App />);

  expect(
    await screen.findByText(/Test Gym, 1\.1 km away in a straight line, no road route available/),
  ).toBeVisible();
  expect(document.querySelector(".evacuation-route")).toBeNull();
});

test("a pack built without Routes asks for none", async () => {
  saveProfile();
  stubNode({ packAvailable: true, open: ["test-gym"] });
  render(<App />);

  await screen.findByText(/Nearest open Shelter/);
  expect(fetchedUrls().some((url) => url.includes("routes/"))).toBe(false);
});
