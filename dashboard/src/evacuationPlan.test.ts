import {
  evacuationPlan,
  OFFICIAL_LINE,
  type CachePackContents,
  type Shelter,
} from "./evacuationPlan";
import type { HouseholdProfile } from "./householdProfile";
import type { FloodRisk } from "./useFloodRisk";

const HOME = { lat: 29.65, lon: -82.32 };

const NEAR_PLAIN: Shelter = {
  id: "near-plain",
  name: "Near Plain",
  pos: [29.66, -82.32],
  special_needs: false,
  pet_friendly: false,
};
const FAR_BOTH: Shelter = {
  id: "far-both",
  name: "Far Both",
  pos: [29.7, -82.32],
  special_needs: true,
  pet_friendly: true,
};
const NEAREST_FLAGGED: Shelter = {
  id: "nearest-flagged",
  name: "Nearest Flagged",
  pos: [29.651, -82.32],
  special_needs: true,
  pet_friendly: false,
};

// A square from lat 29.64 to 29.66 and lon -82.33 to -82.31, with a hole around the Home.
const SQUARE: [number, number][] = [
  [-82.33, 29.64],
  [-82.31, 29.64],
  [-82.31, 29.66],
  [-82.33, 29.66],
  [-82.33, 29.64],
];
const HOLE: [number, number][] = [
  [-82.322, 29.648],
  [-82.318, 29.648],
  [-82.318, 29.652],
  [-82.322, 29.652],
  [-82.322, 29.648],
];

function pack(overrides: Partial<CachePackContents> = {}): CachePackContents {
  return {
    shelters: [NEAR_PLAIN, FAR_BOTH, NEAREST_FLAGGED],
    floodProne: { features: [] },
    ...overrides,
  };
}

function profile(overrides: Partial<HouseholdProfile> = {}): HouseholdProfile {
  return {
    home: HOME,
    housing: "site-built",
    needsSpecialNeedsShelter: false,
    needsPetFriendlyShelter: false,
    ...overrides,
  };
}

function floodRisk(level: FloodRisk["level"]): FloodRisk {
  return {
    level,
    reasons: level ? [{ code: "water_high", nodes: 2, value: 55 }] : [],
    storm_signal: { on: false, nodes: 0, pressure_hpa: null },
    nodes: {},
  };
}

function plan(overrides: Partial<Parameters<typeof evacuationPlan>[0]> = {}) {
  return evacuationPlan({
    profile: profile(),
    pack: pack(),
    openShelterIds: ["near-plain", "far-both", "nearest-flagged"],
    floodRisk: null,
    ...overrides,
  });
}

test("closed Shelters are skipped", () => {
  const result = plan({ openShelterIds: ["near-plain", "far-both"] });
  expect(result.shelter).toBe(NEAR_PLAIN);
  expect(result.lines.join(" ")).toContain("Near Plain, 1.1 km away");
});

test("a household with no needs can get a Shelter flagged special-needs, and sees the flag", () => {
  const result = plan();
  expect(result.shelter).toBe(NEAREST_FLAGGED);
  expect(result.lines.join(" ")).toContain("(special-needs)");
});

test("special-needs and pet-friendly needs are required together", () => {
  expect(plan({ profile: profile({ needsSpecialNeedsShelter: true }) }).shelter).toBe(
    NEAREST_FLAGGED,
  );
  expect(plan({ profile: profile({ needsPetFriendlyShelter: true }) }).shelter).toBe(FAR_BOTH);
  const both = profile({ needsSpecialNeedsShelter: true, needsPetFriendlyShelter: true });
  expect(plan({ profile: both }).shelter).toBe(FAR_BOTH);
});

test("no Shelter listed open says so and marks nothing", () => {
  const result = plan({ openShelterIds: [] });
  expect(result.shelter).toBeNull();
  expect(result.lines).toContain("No open Shelter announced yet. Follow official sources.");
});

test("open Shelters that do not fit are never offered as partial matches", () => {
  const result = plan({
    profile: profile({ needsPetFriendlyShelter: true }),
    openShelterIds: ["near-plain", "nearest-flagged"],
  });
  expect(result.shelter).toBeNull();
  expect(result.lines).toContain(
    "No open Shelter matches this household. Follow official sources.",
  );
});

test("a home inside a Flood-Prone Area is flagged and one outside is not", () => {
  const floodProne = {
    features: [{ geometry: { type: "Polygon" as const, coordinates: [SQUARE] } }],
  };
  expect(plan({ pack: pack({ floodProne }) }).lines).toContain(
    "Your home is inside a mapped Flood-Prone Area.",
  );
  const elsewhere = profile({ home: { lat: 29.7, lon: -82.2 } });
  expect(plan({ pack: pack({ floodProne }), profile: elsewhere }).lines[0]).toMatch(
    /^Your home is outside the mapped Flood-Prone Areas/,
  );
});

test("a hole in a polygon and a MultiPolygon are respected", () => {
  const holed = {
    features: [{ geometry: { type: "Polygon" as const, coordinates: [SQUARE, HOLE] } }],
  };
  expect(plan({ pack: pack({ floodProne: holed }) }).lines[0]).toMatch(/^Your home is outside/);
  const multi = {
    features: [{ geometry: { type: "MultiPolygon" as const, coordinates: [[SQUARE]] } }],
  };
  expect(plan({ pack: pack({ floodProne: multi }) }).lines[0]).toMatch(/^Your home is inside/);
});

test("a null Flood Risk level leaves the risk section out", () => {
  expect(plan({ floodRisk: floodRisk(null) }).risk).toBeNull();
  expect(plan({ floodRisk: null }).risk).toBeNull();
  expect(plan({ floodRisk: floodRisk("elevated") }).risk).toEqual({
    level: "elevated",
    reasons: ["water level 55 cm at 2 Nodes"],
  });
});

test("no saved profile shows the headline and a prompt, with no area or Shelter lines", () => {
  const result = plan({ profile: null, floodRisk: floodRisk("high") });
  expect(result.risk?.level).toBe("high");
  expect(result.lines).toEqual([
    "Fill in your household profile to see your Flood-Prone Area and nearest Shelter.",
  ]);
  expect(result.shelter).toBeNull();
});

test("no valid Cache Pack yet says the information is loading", () => {
  const result = plan({ pack: null, floodRisk: floodRisk("low") });
  expect(result.risk?.level).toBe("low");
  expect(result.lines).toEqual([
    "Shelter and flood-area information is still loading on this Node. Follow official sources.",
  ]);
  expect(result.shelter).toBeNull();
});

test("the plan gives no evacuation instruction of its own", () => {
  const floodProne = {
    features: [{ geometry: { type: "Polygon" as const, coordinates: [SQUARE] } }],
  };
  const everyCase = [
    plan({ floodRisk: floodRisk("high"), pack: pack({ floodProne }) }),
    plan({ openShelterIds: [] }),
    plan({ profile: profile({ needsPetFriendlyShelter: true }), openShelterIds: ["near-plain"] }),
    plan({ profile: null }),
    plan({ pack: null }),
  ];
  const instructionVerbs =
    /\b(evacuate|leave|go|drive|head|move|travel|take|stay|shelter in place)\b/i;
  for (const result of everyCase) {
    expect(result.officialLine).toBe(OFFICIAL_LINE);
    const sentences = [...(result.risk?.reasons ?? []), ...result.lines];
    for (const sentence of sentences) expect(sentence).not.toMatch(instructionVerbs);
  }
});
