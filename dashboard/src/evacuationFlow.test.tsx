import { render, screen } from "@testing-library/react";

import { App } from "./App";

const PROFILE_KEY = "storm-shield.household-profile";

class SilentEventSource {
  onmessage = null;
  close() {}
}

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

function stubNode({ packAvailable, open }: { packAvailable: boolean; open: string[] }) {
  const answers: Record<string, unknown> = {
    "/api/node": { id: "porch", name: "porch", role: "hub" },
    "/api/cache-pack": { available: packAvailable, manifest: null },
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

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal("EventSource", SilentEventSource);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

test("a resident with a profile sees the nearest open Shelter, marked on the map", async () => {
  saveProfile();
  stubNode({ packAvailable: true, open: ["test-gym"] });
  render(<App />);

  expect(await screen.findByText(/Nearest open Shelter: Test Gym, 1\.1 km away/)).toBeVisible();
  expect(screen.getByText("Evacuation decisions come from official sources.")).toBeVisible();
  expect(document.querySelectorAll(".shelter-marker")).toHaveLength(1);
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
