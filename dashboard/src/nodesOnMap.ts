import type { Measurement, NodeLevel, NodeState, ReadingKind } from "./nodeState";

export type NodeOnMap = {
  id: string;
  label: string;
  position: [number, number];
  waterLevelCm: number | null;
  simulated: boolean;
  stale: boolean;
  level: NodeLevel | null;
  ageSeconds: number;
  measurements: ({ kind: ReadingKind } & Measurement)[];
};

// A Node's own name is known only to itself; everyone else is shown by id until the registry (0012).
export function nodesOnMap(state: NodeState | null): NodeOnMap[] {
  if (!state) return [];
  return state.nodes.map((node) => ({
    id: node.id,
    label: node.id === state.id ? state.name : node.id,
    position: node.position,
    waterLevelCm: node.measurements.water_level?.value ?? null,
    simulated: node.simulated,
    stale: node.stale,
    level: state.flood_risk.nodes[node.id] ?? null,
    ageSeconds: node.age_s,
    measurements: (Object.entries(node.measurements) as [ReadingKind, Measurement][]).map(
      ([kind, measurement]) => ({ kind, ...measurement }),
    ),
  }));
}
