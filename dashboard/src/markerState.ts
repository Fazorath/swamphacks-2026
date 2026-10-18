import type { NodeOnMap } from "./nodesOnMap";
import type { NodeLevel } from "./nodeState";

// Contact lost is a display cue only: a Node silent this long loses its glow, and the arc around
// its dot drains over the seconds left until the Node decides it is Stale.
export const CONTACT_LOST_FROM_SECONDS = 5;
export const STALE_AFTER_SECONDS = 15;

const GLOW_PX: Record<NodeLevel, number> = { elevated: 16, high: 22 };

export type MarkerState = {
  // How the dot reads: a Stale or Unverified Node shows that before any Flood Risk level.
  appearance: "stale" | "unverified" | "high" | "elevated" | "calm";
  // Zero for a calm dot (D-06), a silent one and a Stale one.
  glowPx: number;
  // From 1 (full) to 0 (empty) while contact is lost; null while the Node is heard or Stale.
  contactArc: number | null;
};

export function contactArc(node: Pick<NodeOnMap, "ageSeconds" | "stale">): number | null {
  if (node.stale || node.ageSeconds < CONTACT_LOST_FROM_SECONDS) return null;
  const drained =
    (node.ageSeconds - CONTACT_LOST_FROM_SECONDS) /
    (STALE_AFTER_SECONDS - CONTACT_LOST_FROM_SECONDS);
  return Math.min(1, Math.max(0, 1 - drained));
}

export function markerState(node: NodeOnMap): MarkerState {
  const arc = contactArc(node);
  const appearance = node.stale
    ? "stale"
    : !node.registered
      ? "unverified"
      : (node.level ?? "calm");
  const glows = appearance === "high" || appearance === "elevated";
  return {
    appearance,
    glowPx: glows && arc === null ? GLOW_PX[appearance] : 0,
    contactArc: arc,
  };
}

const RANK: Record<NodeLevel | "none", number> = { none: 0, elevated: 1, high: 2 };

export function levelRose(before: NodeLevel | null, after: NodeLevel | null): boolean {
  return RANK[after ?? "none"] > RANK[before ?? "none"];
}

// Which of these Nodes rose a step since `before`. A Node not in `before` is new, not risen.
export function risenNodeIds(
  before: Record<string, NodeLevel | null>,
  nodes: Pick<NodeOnMap, "id" | "level">[],
): string[] {
  return nodes
    .filter((node) => node.id in before && levelRose(before[node.id], node.level))
    .map((node) => node.id);
}
