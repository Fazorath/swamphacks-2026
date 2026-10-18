import { useState } from "react";

import type { NodeOnMap } from "./nodesOnMap";
import type { ReadingKind } from "./nodeState";

export type Trend = "rising" | "falling" | "steady";

// An arrow compares now with 30 s ago (ui.md, "Readings Panel").
const WINDOW_MS = 30_000;

// The smallest move that counts as a trend, so sensor noise leaves the arrow steady.
const SMALLEST_MOVE: Record<ReadingKind, number> = {
  water_level: 2,
  rain_rate: 0.5,
  pressure: 0.5,
  soil_moisture: 1,
};

// A value is kept when it changes, not on every poll: an unchanged reading is already the newest
// sample, and the last one from before the window is the baseline the arrow compares with.
export type Sample = { at: number; value: number };
export type ReadingHistory = Record<string, Sample[]>;

export const historyKey = (nodeId: string, kind: ReadingKind) => `${nodeId}:${kind}`;

export function trendOf(samples: Sample[], kind: ReadingKind, now: number): Trend {
  if (samples.length < 2) return "steady";
  const newest = samples[samples.length - 1].value;
  const before = samples.filter((sample) => sample.at <= now - WINDOW_MS).at(-1);
  const move = newest - (before ?? samples[0]).value;
  if (Math.abs(move) < SMALLEST_MOVE[kind]) return "steady";
  return move > 0 ? "rising" : "falling";
}

export function remember(history: ReadingHistory, nodes: NodeOnMap[], now: number): ReadingHistory {
  const next: ReadingHistory = {};
  for (const node of nodes) {
    for (const { kind, value } of node.measurements) {
      const key = historyKey(node.id, kind);
      let samples = history[key] ?? [];
      if (samples.at(-1)?.value !== value) samples = [...samples, { at: now, value }];
      const baseline = samples.filter((sample) => sample.at <= now - WINDOW_MS).at(-1);
      next[key] = baseline ? samples.slice(samples.indexOf(baseline)) : samples;
    }
  }
  return next;
}

export function trendsOf(
  history: ReadingHistory,
  nodes: NodeOnMap[],
  now: number,
): Record<string, Trend> {
  const trends: Record<string, Trend> = {};
  for (const node of nodes) {
    for (const { kind } of node.measurements) {
      const key = historyKey(node.id, kind);
      trends[key] = trendOf(history[key], kind, now);
    }
  }
  return trends;
}

// The arrow of every reading on screen, keyed by `historyKey`. `now` is when the Node last
// answered, so the hook reads no clock of its own. State only changes when a sample or an arrow
// does, so a poll that changes nothing re-renders nothing.
export function useReadingTrends(nodes: NodeOnMap[], now: number): Record<string, Trend> {
  const [seen, setSeen] = useState<{ history: ReadingHistory; trends: Record<string, Trend> }>({
    history: {},
    trends: {},
  });
  const history = remember(seen.history, nodes, now);
  const trends = trendsOf(history, nodes, now);
  if (
    JSON.stringify(history) !== JSON.stringify(seen.history) ||
    JSON.stringify(trends) !== JSON.stringify(seen.trends)
  ) {
    setSeen({ history, trends });
  }
  return seen.trends;
}
