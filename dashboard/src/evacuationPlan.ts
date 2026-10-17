import { inFloodProneArea, type FloodProneAreas } from "./floodProne";
import { cardReasons, reasonSentence } from "./floodRiskSentences";
import type { Home, HouseholdProfile } from "./householdProfile";
import { appliesToHousehold, type OfficialAlert } from "./officialAlerts";
import type { LatLon, RouteGrid, Routes } from "./routeGrid";
import type { FloodRisk } from "./nodeState";
import { rerouteHome, routeIsAffected, type BlockedRoad, type RoadGraph } from "./rerouting";

export type Shelter = {
  id: string;
  name: string;
  pos: [number, number];
  special_needs: boolean;
  pet_friendly: boolean;
  height_above_river_m: number;
};

export type CachePackContents = {
  shelters: Shelter[];
  floodProne: FloodProneAreas;
  routeGrid: RouteGrid | null;
  // The deepest zoom the pack holds tiles for; null when it holds none.
  tileMaxZoom: number | null;
};

// What the phone needs to find its own way when the precomputed Route will not do.
export type Rerouting = { graph: RoadGraph; blocked: BlockedRoad[] };

export type EvacuationPlan = {
  risk: { level: NonNullable<FloodRisk["level"]>; reasons: string[] } | null;
  // Official Alerts that apply to this household, oldest first; the plan only ever quotes them.
  officialAlerts: OfficialAlert[];
  lines: string[];
  shelter: Shelter | null;
  // From the Grid point nearest home to the Shelter; null when the plan has no Route to draw.
  route: LatLon[] | null;
  officialLine: string;
};

export const OFFICIAL_LINE = "Evacuation decisions come from official sources.";
export const HIGHER_GROUND_LINE =
  "No Shelter you can reach in time. Get to higher ground, away from the river, now.";

// When the wave reaches home, on the Event clock (Unix seconds), and what the clock says now.
export type WaveWindow = { arrivalAt: number; eventT: number };

// A Shelter must be reached this long before the wave, to leave room for a slower walk.
export const SAFETY_MARGIN_SECONDS = 5 * 60;
// Roads and paths wind, so the walk is longer than the straight line.
export const DETOUR_FACTOR = 1.4;
export const WALKING_SPEED_KMH = 4;

const EARTH_RADIUS_KM = 6371;

function distanceKm(from: Home, [lat, lon]: LatLon): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(lat - from.lat);
  const deltaLon = toRadians(lon - from.lon);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(lat)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function routeLengthKm(route: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    total += distanceKm({ lat: route[i - 1][0], lon: route[i - 1][1] }, route[i]);
  }
  return total;
}

function walkingSeconds(from: Home, to: LatLon): number {
  return ((distanceKm(from, to) * DETOUR_FACTOR) / WALKING_SPEED_KMH) * 3600;
}

const minutesUp = (seconds: number) => Math.ceil(seconds / 60);

function waveWords(secondsLeft: number): string {
  return secondsLeft > 0 ? `wave in ${minutesUp(secondsLeft)} min` : "wave expected now";
}

function walkAndWave(home: Home, shelter: Shelter, secondsLeft: number): string {
  const walk = minutesUp(walkingSeconds(home, shelter.pos));
  return `${walk} min walk, ${waveWords(secondsLeft)}.`;
}

type Candidate = { shelter: Shelter; route: LatLon[] | null; km: number };

function describe({ shelter, route, km }: Candidate, showHeight: boolean): string {
  const features = [
    shelter.special_needs && "special-needs",
    shelter.pet_friendly && "pet-friendly",
  ]
    .filter(Boolean)
    .join(", ");
  const distance = route
    ? `${km.toFixed(1)} km by road`
    : `${km.toFixed(1)} km away in a straight line, no road route available`;
  const height = showHeight ? `, ${shelter.height_above_river_m} m above the river` : "";
  return `Nearest open Shelter: ${shelter.name}, ${distance}${height}${features ? ` (${features})` : ""}.`;
}

// A Shelter with no Route from home's Grid point ranks after every one that has a Route.
function byRoadThenStraightLine(a: Candidate, b: Candidate): number {
  if ((a.route === null) !== (b.route === null)) return a.route === null ? 1 : -1;
  return a.km - b.km;
}

function nearestFittingShelter(
  profile: HouseholdProfile,
  pack: CachePackContents,
  openShelterIds: string[],
  routes: Routes | null,
  rerouting: Rerouting | null,
  wave: WaveWindow | null,
): { shelter: Shelter | null; route: LatLon[] | null; lines: string[] } {
  const open = pack.shelters.filter((shelter) => openShelterIds.includes(shelter.id));
  if (open.length === 0) {
    return {
      shelter: null,
      route: null,
      lines: ["No open Shelter announced yet. Follow official sources."],
    };
  }
  // A need is a filter: a household without it can still use a Shelter that offers it.
  const fitting = open.filter(
    (shelter) =>
      (!profile.needsSpecialNeedsShelter || shelter.special_needs) &&
      (!profile.needsPetFriendlyShelter || shelter.pet_friendly),
  );
  if (fitting.length === 0) {
    return {
      shelter: null,
      route: null,
      lines: ["No open Shelter matches this household. Follow official sources."],
    };
  }
  const secondsLeft = wave ? wave.arrivalAt - wave.eventT : 0;
  const reachable = wave
    ? fitting.filter(
        (shelter) =>
          !inFloodProneArea({ lat: shelter.pos[0], lon: shelter.pos[1] }, pack.floodProne) &&
          walkingSeconds(profile.home, shelter.pos) < secondsLeft - SAFETY_MARGIN_SECONDS,
      )
    : fitting;
  if (wave && reachable.length === 0) {
    const [closest] = [...fitting].sort(
      (a, b) => distanceKm(profile.home, a.pos) - distanceKm(profile.home, b.pos),
    );
    return {
      shelter: null,
      route: null,
      lines: [
        `Nearest Shelter ${closest.name}: ${walkAndWave(profile.home, closest, secondsLeft)}`,
        HIGHER_GROUND_LINE,
      ],
    };
  }
  const candidates = reachable
    .map((shelter): Candidate => {
      const route = routes?.[shelter.id] ?? null;
      return {
        shelter,
        route,
        km: route ? routeLengthKm(route) : distanceKm(profile.home, shelter.pos),
      };
    })
    .sort(byRoadThenStraightLine);
  const [nearest] = candidates;
  const rerouted = rerouting && reroutedPlan(profile, pack, reachable, nearest, rerouting, wave);
  if (rerouted) return rerouted;
  const lines = [describe(nearest, wave !== null)];
  if (wave) lines.push(walkAndWave(profile.home, nearest.shelter, secondsLeft));
  if (nearest.route) {
    lines.push("The route is the shortest by road and ignores flooding and road closures.");
  }
  return { shelter: nearest.shelter, route: nearest.route, lines };
}

// A Route is replaced only when it is affected: it runs along a Blocked Road or through a
// Flood-Prone Area, or a resident has blocked roads and there is no Route to draw at all.
function reroutedPlan(
  profile: HouseholdProfile,
  pack: CachePackContents,
  fitting: Shelter[],
  nearest: Candidate,
  { graph, blocked }: Rerouting,
  wave: WaveWindow | null,
): { shelter: Shelter | null; route: LatLon[] | null; lines: string[] } | null {
  const affected = nearest.route
    ? routeIsAffected(nearest.route, graph, blocked, pack.floodProne)
    : blocked.length > 0;
  if (!affected) return null;
  const reached = rerouteHome({
    graph,
    home: profile.home,
    shelters: fitting,
    blocked,
    floodProne: pack.floodProne,
  });
  // Without Blocked Roads, "nothing reachable" is the graph's doing, so the warning would be wrong.
  if (reached === null || (reached.length === 0 && blocked.length === 0)) return null;
  if (reached.length === 0) {
    return {
      shelter: nearest.shelter,
      route: null,
      lines: [
        describe(
          { ...nearest, route: null, km: distanceKm(profile.home, nearest.shelter.pos) },
          wave !== null,
        ),
        "Roads you marked as blocked cut off every Shelter. Follow official sources.",
      ],
    };
  }
  const [best] = reached;
  const lines = [describe(best, wave !== null)];
  if (wave) lines.push(walkAndWave(profile.home, best.shelter, wave.arrivalAt - wave.eventT));
  if (blocked.length > 0) {
    lines.push(`Rerouted around ${blocked.length} blocked road${blocked.length === 1 ? "" : "s"}.`);
  }
  lines.push(
    best.crossesFloodProneArea
      ? "This route still crosses a Flood-Prone Area."
      : "The route avoids the mapped Flood-Prone Areas.",
  );
  return { shelter: best.shelter, route: best.route, lines };
}

export function evacuationPlan({
  profile,
  pack,
  openShelterIds,
  floodRisk,
  routes,
  rerouting,
  officialAlerts,
  wave,
}: {
  profile: HouseholdProfile | null;
  pack: CachePackContents | null;
  openShelterIds: string[];
  floodRisk: FloodRisk | null;
  routes: Routes | null;
  rerouting: Rerouting | null;
  officialAlerts: OfficialAlert[];
  // Null with no Community Warning, or none with a Wave ETA for this home.
  wave: WaveWindow | null;
}): EvacuationPlan {
  const risk = floodRisk?.level
    ? { level: floodRisk.level, reasons: cardReasons(floodRisk).map(reasonSentence) }
    : null;
  const plan = {
    risk,
    officialAlerts: [] as OfficialAlert[],
    lines: [] as string[],
    shelter: null,
    route: null,
    officialLine: OFFICIAL_LINE,
  };

  if (profile === null) {
    return {
      ...plan,
      lines: ["Fill in your household profile to see your Flood-Prone Area and nearest Shelter."],
    };
  }
  if (pack === null) {
    return {
      ...plan,
      // Without the pack the home might be in the Flood-Prone Area, and a missed alert is worse.
      officialAlerts: officialAlerts.filter((alert) => appliesToHousehold(alert, profile, true)),
      lines: [
        "Shelter and flood-area information is still loading on this Node. Follow official sources.",
      ],
    };
  }

  const homeInFloodProneArea = inFloodProneArea(profile.home, pack.floodProne);
  const area = homeInFloodProneArea
    ? "Your home is inside a mapped Flood-Prone Area."
    : "Your home is outside the mapped Flood-Prone Areas (the river corridor, approximate).";
  const { shelter, route, lines } = nearestFittingShelter(
    profile,
    pack,
    openShelterIds,
    routes,
    rerouting,
    wave,
  );
  return {
    ...plan,
    officialAlerts: officialAlerts.filter((alert) =>
      appliesToHousehold(alert, profile, homeInFloodProneArea),
    ),
    lines: [area, ...lines],
    shelter,
    route,
  };
}
