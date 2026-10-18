import type { CommunityWarning } from "./communityWarnings";
import type { OfficialAlert } from "./officialAlerts";

export type NodeLevel = "elevated" | "high";

export type FloodRiskReason = {
  code:
    "water_surge" | "water_high" | "water_rising" | "rain_heavy" | "pressure_falling" | "raining";
  nodes: number;
  value: number;
  seconds?: number | null;
};

export type FloodRisk = {
  level: "low" | "elevated" | "high" | null;
  reasons: FloodRiskReason[];
  storm_signal: { on: boolean; nodes: number; pressure_hpa: number | null };
  nodes: Record<string, NodeLevel | null>;
  surged: string[];
};

export type ReadingKind = "pressure" | "rain_rate" | "water_level" | "soil_moisture";

export type Measurement = { value: number; unit: string };

// What this Node last heard from one Node. The Node decides `stale`, so the browser never does.
export type NodeSnapshot = {
  id: string;
  position: [number, number];
  // Where the operator put it along the river; null when it was not told.
  river_km: number | null;
  simulated: boolean;
  age_s: number;
  stale: boolean;
  // False once the Node has been silent for 60 s: Flood Risk and Community Warnings ignore it.
  counts: boolean;
  measurements: Partial<Record<ReadingKind, Measurement>>;
  // Only Registered Nodes count toward Flood Risk; `name` is the Hub's name for it, null if none.
  registered: boolean;
  name: string | null;
};

// One Node of the Simulated Fleet, served from this Node's Cache Pack. It never travels the Mesh and
// never counts toward Flood Risk; it exists for the map.
export type FleetEntry = {
  id: string;
  name: string;
  river: string;
  site: "town" | "headwater";
  position: [number, number];
  age_s: number;
  stale: boolean;
  measurements: Partial<Record<ReadingKind, Measurement>>;
};

type NodeStatus = "online" | "mesh_only";

// Where this Node stands with the Hub; the Hub itself is always registered.
export type Registration = "unverified" | "waiting" | "registered";

// The answer of GET /api/state: one consistent instant of this Node's view of the Mesh.
export type NodeState = {
  id: string;
  name: string;
  role: "sensor" | "hub";
  status: NodeStatus;
  registration: Registration;
  scenario: { step: string };
  flood_risk: FloodRisk;
  nodes: NodeSnapshot[];
  fleet: FleetEntry[];
  official_alerts: OfficialAlert[];
  // Only warnings whose Hub signature this Node verified.
  community_warnings: CommunityWarning[];
};
