import type { Measurement, NodeLevel, NodeState, ReadingKind } from "./nodeState";

export type NodeOnMap = {
  id: string;
  // This Node's own entry; it stays above the "Not counted" divider even when Unverified.
  isThisNode: boolean;
  label: string;
  position: [number, number];
  // Where the Node sits along the river; null off the river.
  riverKm: number | null;
  waterLevelCm: number | null;
  simulated: boolean;
  stale: boolean;
  // False for an Unverified Node: shown, but not counted toward Flood Risk.
  registered: boolean;
  level: NodeLevel | null;
  ageSeconds: number;
  measurements: ({ kind: ReadingKind } & Measurement)[];
};

// The Node sends water level in metres; the dashboard shows it in centimetres. A pack built
// before the wire format changed still says centimetres, and is shown as it is.
function displayed(kind: ReadingKind, measurement: Measurement): Measurement {
  if (kind === "water_level" && measurement.unit === "m") {
    return { value: Math.round(measurement.value * 1000) / 10, unit: "cm" };
  }
  return measurement;
}

function displayedMeasurements(
  measurements: Partial<Record<ReadingKind, Measurement>>,
): NodeOnMap["measurements"] {
  return (Object.entries(measurements) as [ReadingKind, Measurement][]).map(
    ([kind, measurement]) => ({
      kind,
      ...displayed(kind, measurement),
    }),
  );
}

function waterLevelCm(measurements: Partial<Record<ReadingKind, Measurement>>): number | null {
  const water = measurements.water_level;
  return water ? displayed("water_level", water).value : null;
}

// A Node knows its own name; everyone else is shown by the name in the registry, or by id when
// the Hub has no name for them. Ordered for the cards: this Node, the other Registered Nodes by
// label, then the Unverified ones by id.
export function nodesOnMap(state: NodeState | null): NodeOnMap[] {
  if (!state) return [];
  const nodes = state.nodes.map((node) => ({
    id: node.id,
    isThisNode: node.id === state.id,
    label: node.id === state.id ? state.name : (node.name ?? node.id),
    position: node.position,
    riverKm: node.river_km,
    waterLevelCm: waterLevelCm(node.measurements),
    simulated: node.simulated,
    stale: node.stale,
    registered: node.registered,
    level: state.flood_risk.nodes[node.id] ?? null,
    ageSeconds: node.age_s,
    measurements: displayedMeasurements(node.measurements),
  }));
  const rank = (node: NodeOnMap) => (node.isThisNode ? 0 : node.registered ? 1 : 2);
  return nodes.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}
