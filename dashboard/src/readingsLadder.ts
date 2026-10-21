import type { NodeOnMap } from "./nodesOnMap";

export type ReadingsLadder = {
  // The Pi: shown first, whatever the river is doing.
  pinned: NodeOnMap | null;
  // The Nodes on the river, top of the river first.
  rungs: NodeOnMap[];
  // The Nodes off the river, in the order `nodesOnMap` gave them.
  offRiver: NodeOnMap[];
};

// The Pi is the one real Node that is neither on the river nor the Hub; any other real Node off
// the river is an Audience Node and stays in the list under the ladder. `hubId` is null when the
// connected Node is not the Hub, which is the only Node that can say who the Hub is.
export function readingsLadder(nodes: NodeOnMap[], hubId: string | null): ReadingsLadder {
  const pinned = nodes.find(
    (node) => !node.simulated && node.riverKm === null && node.id !== hubId,
  );
  return {
    pinned: pinned ?? null,
    rungs: nodes
      .filter((node) => node.riverKm !== null)
      .sort((a, b) => (a.riverKm as number) - (b.riverKm as number)),
    offRiver: nodes.filter((node) => node.riverKm === null && node !== pinned),
  };
}

// Index of the rung the wave front has just passed, or null while it is above the first rung or
// below the last: the marker sits on the line between that rung and the next.
export function rungBeforeWave(rungs: NodeOnMap[], waveKm: number | null): number | null {
  if (waveKm === null) return null;
  for (let at = 0; at < rungs.length - 1; at++) {
    if ((rungs[at].riverKm as number) <= waveKm && waveKm < (rungs[at + 1].riverKm as number)) {
      return at;
    }
  }
  return null;
}
