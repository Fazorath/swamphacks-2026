import type { NodeIdentity } from "./useNodeIdentity";
import type { Reading } from "./useReadings";

const STALE_AFTER_SECONDS = 15;

export type NodeOnMap = {
  id: string;
  label: string;
  position: [number, number];
  waterLevelCm: number | null;
  simulated: boolean;
  stale: boolean;
  ageSeconds: number;
  readings: Reading[];
};

export function formatAge(seconds: number): string {
  return seconds < 60 ? `${Math.round(seconds)} s` : `${Math.floor(seconds / 60)} min`;
}

// A Node's own name is known only to itself; everyone else is shown by id until the registry (0012).
export function nodesOnMap(readings: Reading[], own: NodeIdentity | null): NodeOnMap[] {
  const byNode = new Map<string, Reading[]>();
  for (const reading of readings) {
    byNode.set(reading.node, [...(byNode.get(reading.node) ?? []), reading]);
  }
  return [...byNode].map(([id, nodeReadings]) => {
    const ageSeconds = Math.max(...nodeReadings.map((reading) => reading.age_s));
    return {
      id,
      label: own?.id === id ? own.name : id,
      position: nodeReadings[0].position,
      waterLevelCm: nodeReadings.find((reading) => reading.kind === "water_level")?.value ?? null,
      simulated: nodeReadings.some((reading) => reading.simulated),
      stale: ageSeconds > STALE_AFTER_SECONDS,
      ageSeconds,
      readings: nodeReadings,
    };
  });
}
