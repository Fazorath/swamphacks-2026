export type Side = "right" | "left" | "above" | "below";

// `x` and `y` are the screen point the label belongs to. `rank` decides who wins a collision
// (lower wins); a `must` label is drawn even when no side is free.
export type MapLabel = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rank: number;
  must?: boolean;
};

export type Placement = Map<string, Side | null>;

const SIDES: Side[] = ["right", "left", "above", "below"];
// Clear of the dot or pin the label belongs to.
const GAP = 10;

type Rect = { left: number; top: number; right: number; bottom: number };

function rectOn(label: MapLabel, side: Side): Rect {
  const { x, y, width, height } = label;
  switch (side) {
    case "right":
      return { left: x + GAP, top: y - height / 2, right: x + GAP + width, bottom: y + height / 2 };
    case "left":
      return { left: x - GAP - width, top: y - height / 2, right: x - GAP, bottom: y + height / 2 };
    case "above":
      return { left: x - width / 2, top: y - GAP - height, right: x + width / 2, bottom: y - GAP };
    case "below":
      return { left: x - width / 2, top: y + GAP, right: x + width / 2, bottom: y + GAP + height };
  }
}

function overlap(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

// Decides, for each label, which side of its point it sits on, or null when it is left out.
// Labels are placed best rank first; each takes the side it had last time if that is free, so a
// label only moves when something now sits on it, then the first free side in a fixed order.
export function placeLabels(labels: MapLabel[], previous: Placement = new Map()): Placement {
  const placed: Rect[] = [];
  const result: Placement = new Map();
  const byRank = [...labels].sort((a, b) => a.rank - b.rank || a.id.localeCompare(b.id));
  for (const label of byRank) {
    const last = previous.get(label.id);
    const order = last ? [last, ...SIDES.filter((side) => side !== last)] : SIDES;
    const free = order.find((side) => !placed.some((rect) => overlap(rectOn(label, side), rect)));
    const side = free ?? (label.must ? order[0] : null);
    result.set(label.id, side);
    if (side) placed.push(rectOn(label, side));
  }
  return result;
}

// Labels are DOM elements, so their size is estimated from the text instead of measured.
export function estimatedLabelSize(
  text: string,
  fontPx: number,
  extraWidth = 0,
): { width: number; height: number } {
  return {
    width: Math.ceil(text.length * fontPx * 0.58) + 14 + extraWidth,
    height: Math.ceil(fontPx * 1.4) + 6,
  };
}

export function samePlacement(a: Placement, b: Placement): boolean {
  if (a.size !== b.size) return false;
  for (const [id, side] of a) if (b.get(id) !== side) return false;
  return true;
}
