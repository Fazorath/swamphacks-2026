import { useEffect, useState } from "react";

import { contactArc, risenNodeIds } from "./markerState";
import type { NodeOnMap } from "./nodesOnMap";
import type { NodeLevel } from "./nodeState";

const HEARD_AGAIN_SHOWN_MS = 4000;

type Seen = { levels: Record<string, NodeLevel | null>; rises: Record<string, number> };

// How many times each Node's Flood Risk has risen since the page opened. The map's ring and the
// Node card's flash both key on this count, so they start on the same frame (D-13).
export function useLevelRises(nodes: NodeOnMap[]): Record<string, number> {
  const [seen, setSeen] = useState<Seen>({ levels: {}, rises: {} });
  const levels = Object.fromEntries(nodes.map((node) => [node.id, node.level]));
  const ids = Object.keys(levels);
  const changed =
    ids.length !== Object.keys(seen.levels).length ||
    ids.some((id) => !(id in seen.levels) || seen.levels[id] !== levels[id]);
  if (changed) {
    const rises = { ...seen.rises };
    for (const id of risenNodeIds(seen.levels, nodes)) rises[id] = (rises[id] ?? 0) + 1;
    setSeen({ levels, rises });
  }
  return seen.rises;
}

// The status strip's notes about Nodes that went quiet or came back (D-52).
export function useContactNotes(nodes: NodeOnMap[]): { key: string; text: string }[] {
  const lost = nodes.filter((node) => contactArc(node) !== null);
  const lostIds = lost.map((node) => node.id);
  const [previouslyLost, setPreviouslyLost] = useState<string[]>([]);
  const [heardAgain, setHeardAgain] = useState<string[]>([]);

  if (previouslyLost.join() !== lostIds.join()) {
    setPreviouslyLost(lostIds);
    // A Node that went on to Stale was not heard again.
    const back = nodes.filter(
      (node) => previouslyLost.includes(node.id) && !lostIds.includes(node.id) && !node.stale,
    );
    if (back.length > 0) setHeardAgain((names) => [...names, ...back.map((node) => node.label)]);
  }

  useEffect(() => {
    if (heardAgain.length === 0) return;
    const timer = setTimeout(() => setHeardAgain([]), HEARD_AGAIN_SHOWN_MS);
    return () => clearTimeout(timer);
  }, [heardAgain]);

  return [
    ...lost.map((node) => ({
      key: node.id,
      text: `${node.label}: contact lost ${Math.floor(node.ageSeconds)} s`,
    })),
    ...heardAgain.map((label) => ({ key: `again-${label}`, text: `${label}: heard again` })),
  ];
}
