import type { FleetEntry, NodeSnapshot, NodeState } from "./nodeState";

// What a Node answers at /api/state on a calm day with no Node heard yet; tests override the rest.
export function fakeNodeState(overrides: Partial<NodeState> = {}): NodeState {
  return {
    id: "porch",
    name: "porch",
    role: "hub",
    status: "online",
    registration: "registered",
    scenario: { step: "normal_day" },
    flood_risk: {
      level: null,
      reasons: [],
      storm_signal: { on: false, nodes: 0, pressure_hpa: null },
      nodes: {},
      surged: [],
    },
    nodes: [],
    fleet: [],
    official_alerts: [],
    community_warnings: [],
    ...overrides,
  };
}

export function fakeNodeSnapshot(id: string, overrides: Partial<NodeSnapshot> = {}): NodeSnapshot {
  return {
    id,
    position: [29.652, -82.324],
    river_km: null,
    simulated: true,
    age_s: 2,
    stale: false,
    counts: true,
    measurements: { air_pressure: { value: 1015, unit: "hPa" } },
    registered: true,
    name: id,
    ...overrides,
  };
}

export function fakeFleetEntry(id: string, overrides: Partial<FleetEntry> = {}): FleetEntry {
  return {
    id: `fleet-${id}`,
    name: id,
    river: "Karnali",
    site: "town",
    position: [28.644, 81.276],
    age_s: 2,
    stale: false,
    measurements: { water_level: { value: 0.8, unit: "m" } },
    ...overrides,
  };
}
