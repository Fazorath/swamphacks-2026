import type { Measurement, NodeLevel, NodeState, ReadingKind } from "./nodeState";

export type NodeOnMap = {
  id: string;
  label: string;
  position: [number, number];
  waterLevelCm: number | null;
  simulated: boolean;
  stale: boolean;
  // False for an Unverified Node: shown, but not counted toward Flood Risk.
  registered: boolean;
  level: NodeLevel | null;
  ageSeconds: number;
  measurements: ({ kind: ReadingKind } & Measurement)[];
};

// A Node knows its own name; everyone else is shown by the name in the registry, or by id when
// the Hub has no name for them. Ordered for the cards: this Node, the other Registered Nodes by
// label, then the Unverified ones by id.
export function nodesOnMap(state: NodeState | null): NodeOnMap[] {
  if (!state) return [];
  const nodes = state.nodes.map((node) => ({
    id: node.id,
    label: node.id === state.id ? state.name : (node.name ?? node.id),
    position: node.position,
    waterLevelCm: node.measurements.water_level?.value ?? null,
    simulated: node.simulated,
    stale: node.stale,
    registered: node.registered,
    level: state.flood_risk.nodes[node.id] ?? null,
    ageSeconds: node.age_s,
    measurements: (Object.entries(node.measurements) as [ReadingKind, Measurement][]).map(
      ([kind, measurement]) => ({ kind, ...measurement }),
    ),
  }));
  const rank = (node: NodeOnMap) => (node.id === state.id ? 0 : node.registered ? 1 : 2);
  return nodes.sort((a, b) => rank(a) - rank(b) || a.label.localeCompare(b.label));
}
