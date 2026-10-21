import type { SandboxNodes } from "./useSandboxNodes";
import type { LatLon } from "./routeGrid";

const METRES_PER_DEGREE_OF_LATITUDE = 111_320;
// Enough points that a circle of a few kilometres reads as round at any zoom the map allows.
const RING_POINTS = 64;

// A ring of points `metres` from `centre`. Close to the poles it would stretch; the Sandbox's
// Regions are not there.
function ring([lat, lon]: LatLon, metres: number): [number, number][] {
  const lonScale = Math.cos((lat * Math.PI) / 180);
  const points: [number, number][] = [];
  for (let step = 0; step < RING_POINTS; step++) {
    const angle = (step / RING_POINTS) * 2 * Math.PI;
    points.push([
      lon + (Math.sin(angle) * metres) / (METRES_PER_DEGREE_OF_LATITUDE * lonScale),
      lat + (Math.cos(angle) * metres) / METRES_PER_DEGREE_OF_LATITUDE,
    ]);
  }
  return [...points, points[0]];
}

// Each Node's reach, one circle per Node.
export function rangeCircles(sandbox: SandboxNodes | null): GeoJSON.FeatureCollection {
  const { nodes, radio_range_m } = sandbox ?? { nodes: [], radio_range_m: 0 };
  return {
    type: "FeatureCollection",
    features: nodes.map((node) => ({
      type: "Feature",
      properties: { id: node.id },
      geometry: { type: "Polygon", coordinates: [ring(node.position, radio_range_m)] },
    })),
  };
}

// A line for every two Nodes in range of each other, drawn once.
export function linkLines({ nodes }: SandboxNodes): LatLon[][] {
  const positions = new Map(nodes.map((node) => [node.id, node.position]));
  return nodes.flatMap((node) =>
    node.links
      .filter((other) => node.id < other && positions.has(other))
      .map((other) => [node.position, positions.get(other)!]),
  );
}
