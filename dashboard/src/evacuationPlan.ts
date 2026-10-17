import { cardReasons, reasonSentence } from "./floodRiskSentences";
import type { Home, HouseholdProfile } from "./householdProfile";
import type { FloodRisk } from "./useFloodRisk";

export type Shelter = {
  id: string;
  name: string;
  pos: [number, number];
  special_needs: boolean;
  pet_friendly: boolean;
};

// GeoJSON order is [lon, lat]; a ring is a closed list of points.
type Ring = [number, number][];
type FloodProneGeometry =
  { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };

export type CachePackContents = {
  shelters: Shelter[];
  floodProne: { features: { geometry: FloodProneGeometry }[] };
};

export type EvacuationPlan = {
  risk: { level: NonNullable<FloodRisk["level"]>; reasons: string[] } | null;
  lines: string[];
  shelter: Shelter | null;
  officialLine: string;
};

export const OFFICIAL_LINE = "Evacuation decisions come from official sources.";

const EARTH_RADIUS_KM = 6371;

function distanceKm(from: Home, [lat, lon]: [number, number]): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(lat - from.lat);
  const deltaLon = toRadians(lon - from.lon);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(lat)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function insideRing({ lat, lon }: Home, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lonI, latI] = ring[i];
    const [lonJ, latJ] = ring[j];
    if (latI > lat !== latJ > lat && lon < ((lonJ - lonI) * (lat - latI)) / (latJ - latI) + lonI) {
      inside = !inside;
    }
  }
  return inside;
}

// The first ring of a polygon is its outline; any others are holes.
function insidePolygon(home: Home, [outline, ...holes]: Ring[]): boolean {
  return insideRing(home, outline) && !holes.some((hole) => insideRing(home, hole));
}

function inFloodProneArea(home: Home, pack: CachePackContents): boolean {
  return pack.floodProne.features.some(({ geometry }) =>
    geometry.type === "Polygon"
      ? insidePolygon(home, geometry.coordinates)
      : geometry.coordinates.some((polygon) => insidePolygon(home, polygon)),
  );
}

function shelterDescription(shelter: Shelter, home: Home): string {
  const km = distanceKm(home, shelter.pos).toFixed(1);
  const features = [
    shelter.special_needs && "special-needs",
    shelter.pet_friendly && "pet-friendly",
  ]
    .filter(Boolean)
    .join(", ");
  return `Nearest open Shelter: ${shelter.name}, ${km} km away${features ? ` (${features})` : ""}.`;
}

function nearestFittingShelter(
  profile: HouseholdProfile,
  pack: CachePackContents,
  openShelterIds: string[],
): { shelter: Shelter | null; line: string } {
  const open = pack.shelters.filter((shelter) => openShelterIds.includes(shelter.id));
  if (open.length === 0) {
    return { shelter: null, line: "No open Shelter announced yet. Follow official sources." };
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
      line: "No open Shelter matches this household. Follow official sources.",
    };
  }
  const [nearest] = fitting.sort(
    (a, b) => distanceKm(profile.home, a.pos) - distanceKm(profile.home, b.pos),
  );
  return { shelter: nearest, line: shelterDescription(nearest, profile.home) };
}

export function evacuationPlan({
  profile,
  pack,
  openShelterIds,
  floodRisk,
}: {
  profile: HouseholdProfile | null;
  pack: CachePackContents | null;
  openShelterIds: string[];
  floodRisk: FloodRisk | null;
}): EvacuationPlan {
  const risk = floodRisk?.level
    ? { level: floodRisk.level, reasons: cardReasons(floodRisk).map(reasonSentence) }
    : null;
  const plan = { risk, lines: [] as string[], shelter: null, officialLine: OFFICIAL_LINE };

  if (profile === null) {
    return {
      ...plan,
      lines: ["Fill in your household profile to see your Flood-Prone Area and nearest Shelter."],
    };
  }
  if (pack === null) {
    return {
      ...plan,
      lines: [
        "Shelter and flood-area information is still loading on this Node. Follow official sources.",
      ],
    };
  }

  const area = inFloodProneArea(profile.home, pack)
    ? "Your home is inside a mapped Flood-Prone Area."
    : "Your home is outside the mapped Flood-Prone Areas (FEMA zones and creek floodplains, approximate).";
  const { shelter, line } = nearestFittingShelter(profile, pack, openShelterIds);
  return { ...plan, lines: [area, line], shelter };
}
