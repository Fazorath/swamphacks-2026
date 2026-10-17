import { render, screen, waitFor, within } from "@testing-library/react";

import { App } from "./App";
import type { CommunityWarning } from "./communityWarnings";
import { fakeNodeSnapshot, fakeNodeState } from "./fakeNodeState";

const PROFILE_KEY = "storm-shield.household-profile";
const SURGE_T = 1_787_716_020;

// A straight river at lon 85, one vertex every 10 km (0.09 degrees of latitude): 190 km/h down to
// km 0, then 60 km/h. From km -10 the wave takes 189.5 s + 20 min to reach km 20: 1389.5 s.
const RIVER = {
  features: [
    {
      properties: { speed_kmh: 190, km: [-10, 0] },
      geometry: {
        coordinates: [
          [85, 28.09],
          [85, 28],
        ],
      },
    },
    {
      properties: { speed_kmh: 60, km: [0, 10, 20, 30] },
      geometry: {
        coordinates: [
          [85, 28],
          [85, 27.91],
          [85, 27.82],
          [85, 27.73],
        ],
      },
    },
  ],
};

const WARNING: CommunityWarning = {
  id: 7,
  t: SURGE_T + 3,
  nodes: ["s0"],
  reasons: ["water_surge"],
  origin: "s0",
  origin_km: -10,
  surge_t: SURGE_T,
};

const KM_20 = { lat: 27.82, lon: 85 };
const KM_MINUS_5 = { lat: 28.045, lon: 85 };

function saveProfile(home: { lat: number; lon: number }) {
  localStorage.setItem(
    PROFILE_KEY,
    JSON.stringify({
      version: 1,
      profile: {
        home,
        housing: "site-built",
        needsSpecialNeedsShelter: false,
        needsPetFriendlyShelter: false,
      },
    }),
  );
}

let requests: string[];

function stubNode({ eventT, river = RIVER }: { eventT: number; river?: object | null }) {
  const answers: Record<string, unknown> = {
    "/api/state": fakeNodeState({
      id: "porch",
      role: "sensor",
      community_warnings: [WARNING],
      nodes: [fakeNodeSnapshot("porch", { river_km: 20, position: [KM_20.lat, KM_20.lon] })],
    }),
    "/api/replay": { v: 1, kind: "replay", state: "paused", event_t: eventT, rate: 30 },
    "/api/cache-pack": { available: true, manifest: null },
    "/api/cache-pack/files/shelters.json": [],
    "/api/cache-pack/files/flood_prone.geojson": { type: "FeatureCollection", features: [] },
    "/api/cache-pack/files/river.geojson": river,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      requests.push(url);
      return answers[url] ? Response.json(answers[url]) : new Response(null, { status: 404 });
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
  requests = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

test("the plan and the warning card count down to the wave at the home in the profile", async () => {
  saveProfile(KM_20);
  stubNode({ eventT: SURGE_T + 60 });
  render(<App />);

  const plan = await screen.findByRole("region", { name: "Evacuation Plan" });
  expect(await within(plan).findByText("Wave expected at your home in about 23 min")).toBeVisible();
  const card = screen.getByRole("article", { name: "Community Warning" });
  expect(within(card).getByText("Wave expected at your home in about 23 min")).toBeVisible();
});

test("with no profile the connected Node's position is the home", async () => {
  stubNode({ eventT: SURGE_T + 60 });
  render(<App />);

  const plan = await screen.findByRole("region", { name: "Evacuation Plan" });
  expect(await within(plan).findByText("Wave expected at your home in about 23 min")).toBeVisible();
});

test("at or past the arrival time it says the wave is expected now", async () => {
  saveProfile(KM_20);
  stubNode({ eventT: SURGE_T + 3000 });
  render(<App />);

  const plan = await screen.findByRole("region", { name: "Evacuation Plan" });
  expect(await within(plan).findByText("Wave expected now")).toBeVisible();
});

test("a home upstream of the origin gets no ETA", async () => {
  saveProfile(KM_MINUS_5);
  stubNode({ eventT: SURGE_T + 60 });
  render(<App />);

  await screen.findByRole("article", { name: "Community Warning" });
  await waitFor(() => expect(requests).toContain("/api/cache-pack/files/river.geojson"));
  expect(screen.queryByText(/Wave expected/)).toBeNull();
});

test("a pack with no river line gives no ETA and no error", async () => {
  saveProfile(KM_20);
  stubNode({ eventT: SURGE_T + 60, river: null });
  render(<App />);

  await screen.findByRole("article", { name: "Community Warning" });
  await waitFor(() => expect(requests).toContain("/api/cache-pack/files/river.geojson"));
  expect(screen.queryByText(/Wave expected/)).toBeNull();
  expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain("river");
});

test("no request carries the home location", async () => {
  saveProfile(KM_20);
  stubNode({ eventT: SURGE_T + 60 });
  render(<App />);

  await screen.findByText("Wave expected at your home in about 23 min", {
    selector: "section[aria-label='Evacuation Plan'] p",
  });
  expect(requests.filter((url) => url.includes("27.82") || url.includes("85"))).toEqual([]);
});
