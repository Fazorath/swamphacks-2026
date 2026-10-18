import type { NodeSnapshot } from "./nodeState";

type CommunityWarningReason =
  "water_surge" | "water_high" | "water_rising" | "rain_heavy" | "pressure_falling";

// A warning the Node has already checked against the Hub's signature; the browser cannot.
export type CommunityWarning = {
  id: number;
  t: number;
  nodes: string[];
  reasons: CommunityWarningReason[];
  origin: string;
  origin_km: number;
  surge_t: number;
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

export function riverKm(km: number): string {
  return `River km ${km.toFixed(1).replace("-", "−")}`;
}

// "Water is surging at S0, 12.2 km upstream of this Node". The distance needs both River kms and
// an origin above this Node; otherwise the sentence says where the Sensor sits on the river.
export function warningSentence(
  warning: CommunityWarning,
  nodes: NodeSnapshot[],
  thisNodeId: string,
): string {
  const origin = nodes.find((node) => node.id === warning.origin);
  const here = nodes.find((node) => node.id === thisNodeId);
  const what = `${reasonsSentence(warning)} at ${origin?.name ?? warning.origin}`;
  const upstreamKm = here?.river_km != null ? here.river_km - warning.origin_km : null;
  return upstreamKm !== null && upstreamKm > 0
    ? `${what}, ${upstreamKm.toFixed(1)} km upstream of this Node`
    : `${what}, ${riverKm(warning.origin_km)}`;
}
