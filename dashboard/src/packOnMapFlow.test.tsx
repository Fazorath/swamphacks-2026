import { render, screen, waitFor } from "@testing-library/react";

import { App } from "./App";
import { fakeNodeState } from "./fakeNodeState";

const SHELTERS = [
  { id: "gym", name: "Test Gym", pos: [29.66, -82.32], special_needs: true, pet_friendly: false },
  { id: "hall", name: "Town Hall", pos: [29.67, -82.33], special_needs: false, pet_friendly: true },
  {
    id: "school",
    name: "Old School",
    pos: [29.68, -82.34],
    special_needs: false,
    pet_friendly: false,
  },
];

const CORRIDOR = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { source: "APPROXIMATE river corridor" },
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
};

function stubNode({ packAvailable, open }: { packAvailable: boolean; open: string[] }) {
  const answers: Record<string, unknown> = {
    "/api/state": fakeNodeState(),
    "/api/cache-pack": { available: packAvailable, manifest: null },
    "/api/cache-pack/files/shelters.json": SHELTERS,
    "/api/cache-pack/files/flood_prone.geojson": CORRIDOR,
    "/api/shelters": { open },
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

test("every Shelter in the Cache Pack is marked with its name and the flags it has", async () => {
  stubNode({ packAvailable: true, open: ["gym", "hall", "school"] });
  render(<App />);

  expect(await screen.findByText("Test Gym · special needs")).toBeVisible();
  expect(await screen.findByText("Town Hall · pets")).toBeVisible();
  expect(await screen.findByText("Old School")).toBeVisible();
  expect(document.querySelectorAll(".shelter-pin")).toHaveLength(3);
});

test("a Shelter the Hub has not announced as open says Closed", async () => {
  stubNode({ packAvailable: true, open: ["hall"] });
  render(<App />);

  expect(await screen.findByText("Test Gym · special needs · Closed")).toBeVisible();
  expect(await screen.findByText("Town Hall · pets")).toBeVisible();
  expect(document.querySelectorAll(".shelter-pin.closed")).toHaveLength(2);
});

test("the corridor is drawn and captioned as approximate", async () => {
  stubNode({ packAvailable: true, open: [] });
  render(<App />);

  expect(await screen.findByText("Flood-Prone Area: hand-drawn, approximate")).toBeVisible();
  await waitFor(() => expect(document.querySelector("path.flood-prone-area")).not.toBeNull());
});

test("the Shelter the plan chose is marked once, apart from the others", async () => {
  localStorage.setItem(
    "storm-shield.household-profile",
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
  stubNode({ packAvailable: true, open: ["gym", "hall", "school"] });
  render(<App />);

  await screen.findByText(/Nearest open Shelter: Test Gym/);
  await waitFor(() => expect(document.querySelectorAll(".shelter-marker")).toHaveLength(1));
  expect(document.querySelectorAll(".shelter-pin")).toHaveLength(2);
});

test("a Node without a Cache Pack shows no Shelters and no corridor", async () => {
  stubNode({ packAvailable: false, open: [] });
  render(<App />);

  await screen.findByRole("region", { name: "Map" });
  expect(document.querySelector(".shelter-pin")).toBeNull();
  expect(document.querySelector(".flood-prone-area")).toBeNull();
  expect(screen.queryByText("Flood-Prone Area: hand-drawn, approximate")).toBeNull();
});
