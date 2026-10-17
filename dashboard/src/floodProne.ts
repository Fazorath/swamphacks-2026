// GeoJSON order is [lon, lat]; a ring is a closed list of points.
type Ring = [number, number][];
type FloodProneGeometry =
  { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] };

export type FloodProneAreas = { features: { geometry: FloodProneGeometry }[] };

type Point = { lat: number; lon: number };

function insideRing({ lat, lon }: Point, ring: Ring): boolean {
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
function insidePolygon(point: Point, [outline, ...holes]: Ring[]): boolean {
  return insideRing(point, outline) && !holes.some((hole) => insideRing(point, hole));
}

export function inFloodProneArea(point: Point, areas: FloodProneAreas): boolean {
  return areas.features.some(({ geometry }) =>
    geometry.type === "Polygon"
      ? insidePolygon(point, geometry.coordinates)
      : geometry.coordinates.some((polygon) => insidePolygon(point, polygon)),
  );
}
