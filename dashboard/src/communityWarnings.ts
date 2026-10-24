import { distanceInDisplayUnit, speedInDisplayUnit } from "./displayUnits";
import type { DisplayUnits, NodeSnapshot } from "./nodeState";

type CommunityWarningReason =
  "water_surge" | "water_high" | "water_rising" | "rain_heavy" | "pressure_falling";

// The wave's speed between the warning's origin and `node`, the next Node downstream to surge.
export type MeasuredSpeed = { node: string; km: number; surge_t: number; speed_kmh: number };

// A warning the Node has already checked against the Hub's signature; the browser cannot.
export type CommunityWarning = {
  id: number;
  t: number;
  nodes: string[];
  reasons: CommunityWarningReason[];
  origin: string;
  origin_km: number;
  surge_t: number;
  // Present once a second Node has surged downstream; the same warning, so not a new one.
  measured?: MeasuredSpeed | null;
};

// Nepal's Department of Hydrology and Meteorology, the authority whose flood warnings count.
export const OFFICIAL_SOURCE = { name: "DHM Nepal", url: "https://www.hydrology.gov.np/" };

const REASON_SENTENCES: Record<CommunityWarningReason, string> = {
  water_surge: "Water is surging",
  water_high: "Water is high",
  water_rising: "Water is rising",
  rain_heavy: "Heavy rain",
  pressure_falling: "Pressure is falling",
};

export function reasonsSentence(warning: CommunityWarning): string {
  return warning.reasons.map((reason) => REASON_SENTENCES[reason]).join(", ");
}

export function firstSurgeAt(warnings: CommunityWarning[]): number | null {
  return warnings.length > 0 ? Math.min(...warnings.map((warning) => warning.surge_t)) : null;
}

// "Measured: 15.6 km in 12 min = 78 km/h (S0 to S1)"; null until a second Node has surged.
export function measuredSpeedLine(
  warning: CommunityWarning,
  nameOf: (nodeId: string) => string,
  units: DisplayUnits | null,
): string | null {
  const { measured } = warning;
  if (!measured) return null;
  const distance = distanceInDisplayUnit(measured.km - warning.origin_km, units);
  const minutes = Math.round((measured.surge_t - warning.surge_t) / 60);
  const speed = speedInDisplayUnit(measured.speed_kmh, units);
  return `Measured: ${distance} in ${minutes} min = ${speed} (${nameOf(warning.origin)} to ${nameOf(measured.node)})`;
}

export function riverKm(km: number): string {
  return `River km ${km.toFixed(1).replace("-", "−")}`;
}

// "Water is surging at S0, 12.2 km upstream of this Node". The distance needs both River kms and
// an origin above this Node; otherwise the sentence says where the Sensor sits on the river.
export function warningSentence(
  warning: CommunityWarning,
  nodes: NodeSnapshot[],
  thisNodeId: string,
  units: DisplayUnits | null,
): string {
  const origin = nodes.find((node) => node.id === warning.origin);
  const here = nodes.find((node) => node.id === thisNodeId);
  const what = `${reasonsSentence(warning)} at ${origin?.name ?? warning.origin}`;
  const upstreamKm = here?.river_km != null ? here.river_km - warning.origin_km : null;
  return upstreamKm !== null && upstreamKm > 0
    ? `${what}, ${distanceInDisplayUnit(upstreamKm, units)} upstream of this Node`
    : `${what}, ${riverKm(warning.origin_km)}`;
}
