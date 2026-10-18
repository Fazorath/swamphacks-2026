import { evacuationPlan, type CachePackContents, type Shelter } from "./evacuationPlan";
import type { HouseholdProfile } from "./householdProfile";
import { blockedRoadLines, roadNear, type BlockedRoad, type RoadGraph } from "./rerouting";
import type { LatLon } from "./routeGrid";

// Home at node 0. The direct road 0-1 reaches Shelter A (node 1); the detour 0-2-3-1 goes round
// the east side. Shelter B sits at node 4, south of home.
//
//   3 ---- 1 (A)
//   |      |
//   2 ---- 0 (home) ---- 4 (B)   (4 is south of 0 in the real layout)
const NODES: LatLon[] = [
  [29.65, -82.32],
  [29.66, -82.32],
  [29.65, -82.31],
  [29.66, -82.31],
  [29.64, -82.32],
];
const GRAPH: RoadGraph = {
  nodes: NODES,
  edges: [
    [0, 1, 1113],
    [0, 2, 969],
    [2, 3, 1113],
    [3, 1, 969],
    [0, 4, 1113],
  ],
};
const DIRECT: BlockedRoad = { a: NODES[0], b: NODES[1] };
const EAST: BlockedRoad = { a: NODES[0], b: NODES[2] };
const SOUTH: BlockedRoad = { a: NODES[0], b: NODES[4] };

const SHELTER_A: Shelter = {
  id: "shelter-a",
  name: "Shelter A",
  pos: [29.66, -82.32],
  special_needs: false,
  pet_friendly: false,
  height_above_river_m: 80,
};
const SHELTER_B: Shelter = {
  ...SHELTER_A,
  id: "shelter-b",
  name: "Shelter B",
  pos: [29.64, -82.32],
};

const PROFILE: HouseholdProfile = {
  home: { lat: 29.65, lon: -82.32 },
  housing: "site-built",
  needsSpecialNeedsShelter: false,
  needsPetFriendlyShelter: false,
};

// A box around the middle of the direct road, and one around the middle of the detour too.
function box(south: number, west: number, north: number, east: number) {
  return {
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ] as [number, number][],
      ],
    },
  };
}
const ON_DIRECT_ROAD = box(29.654, -82.321, 29.656, -82.319);
const ON_DETOUR = box(29.654, -82.311, 29.656, -82.309);

const PRECOMPUTED: LatLon[] = [NODES[0], NODES[1]];

function planFor({
  blocked = [],
  floodProne = [] as ReturnType<typeof box>[],
  open = ["shelter-a"],
  graph = GRAPH,
}: {
  blocked?: BlockedRoad[];
  floodProne?: ReturnType<typeof box>[];
  open?: string[];
  graph?: RoadGraph;
} = {}) {
  const pack: CachePackContents = {
    shelters: [SHELTER_A, SHELTER_B],
    floodProne: { features: floodProne },
    routeGrid: null,
    built: null,
    nepal: null,
    bbox: null,
  };
  return evacuationPlan({
    profile: PROFILE,
    pack,
    openShelterIds: open,
    floodRisk: null,
    routes: { "shelter-a": PRECOMPUTED, "shelter-b": [NODES[0], NODES[4]] },
    rerouting: { graph, blocked },
    officialAlerts: [],
    wave: null,
  });
}

test("a Route that crosses no Blocked Road and no Flood-Prone Area is kept", () => {
  const result = planFor({ blocked: [EAST] });
  expect(result.route).toBe(PRECOMPUTED);
  expect(result.lines.join(" ")).not.toContain("Rerouted");
});

test("a Blocked Road on the Route gives a Route that avoids it", () => {
  const result = planFor({ blocked: [DIRECT] });
  expect(result.shelter).toBe(SHELTER_A);
  expect(result.route).toContainEqual(NODES[2]);
  expect(result.route).toContainEqual(NODES[3]);
  expect(result.lines.join(" ")).toContain("3.1 km by road");
  expect(result.lines).toContain("Rerouted around 1 blocked road.");
});

test("a Flood-Prone Area on the Route is avoided when another way exists", () => {
  const result = planFor({ floodProne: [ON_DIRECT_ROAD] });
  expect(result.route).toContainEqual(NODES[2]);
  expect(result.lines).toContain("The route avoids the mapped Flood-Prone Areas.");
});

test("the plan says so when every way still crosses a Flood-Prone Area", () => {
  const result = planFor({ floodProne: [ON_DIRECT_ROAD, ON_DETOUR] });
  expect(result.route).not.toBeNull();
  expect(result.lines).toContain("This route still crosses a Flood-Prone Area.");
});

test("blocks make another Shelter the quickest", () => {
  const result = planFor({ blocked: [DIRECT], open: ["shelter-a", "shelter-b"] });
  expect(result.shelter).toBe(SHELTER_B);
});

test("blocks that cut home off from every Shelter keep the straight-line plan and warn", () => {
  const result = planFor({ blocked: [DIRECT, EAST, SOUTH], open: ["shelter-a"] });
  expect(result.shelter).toBe(SHELTER_A);
  expect(result.route).toBeNull();
  expect(result.lines.join(" ")).toContain("km away in a straight line");
  expect(result.lines).toContain(
    "Roads you marked as blocked cut off every Shelter. Follow official sources.",
  );
});

test("a pack with no Road graph keeps the precomputed Route", () => {
  const result = evacuationPlan({
    profile: PROFILE,
    pack: {
      shelters: [SHELTER_A],
      floodProne: { features: [] },
      routeGrid: null,
      built: null,
      nepal: null,
      bbox: null,
    },
    openShelterIds: ["shelter-a"],
    floodRisk: null,
    routes: { "shelter-a": PRECOMPUTED },
    rerouting: null,
    officialAlerts: [],
    wave: null,
  });
  expect(result.route).toBe(PRECOMPUTED);
});

test("a home far from any road keeps the precomputed Route", () => {
  const result = evacuationPlan({
    profile: { ...PROFILE, home: { lat: 29.7, lon: -82.4 } },
    pack: {
      shelters: [SHELTER_A],
      floodProne: { features: [] },
      routeGrid: null,
      built: null,
      nepal: null,
      bbox: null,
    },
    openShelterIds: ["shelter-a"],
    floodRisk: null,
    routes: { "shelter-a": PRECOMPUTED },
    rerouting: { graph: GRAPH, blocked: [DIRECT] },
    officialAlerts: [],
    wave: null,
  });
  expect(result.route).toBe(PRECOMPUTED);
});

test("a tap picks the road segment under it, and nothing when no road is near", () => {
  expect(roadNear(GRAPH, { lat: 29.655, lon: -82.3201 })).toEqual(DIRECT);
  expect(roadNear(GRAPH, { lat: 29.655, lon: -82.3 })).toBeNull();
});

test("Blocked Roads are drawn from the graph, and ones it no longer has are skipped", () => {
  const gone: BlockedRoad = { a: [1, 1], b: [2, 2] };
  expect(blockedRoadLines(GRAPH, [DIRECT, gone])).toEqual([[NODES[0], NODES[1]]]);
});
