import type { Shelter } from "./evacuationPlan";
import { inFloodProneArea, type FloodProneAreas } from "./floodProne";
import type { Home } from "./householdProfile";
import type { LatLon } from "./routeGrid";

// Junctions and bends as `nodes`; an edge joins two of them (both ways) with its length along the
// road and, optionally, the vertices between them that only matter for drawing.
export type RoadGraph = {
  nodes: LatLon[];
  edges: [from: number, to: number, lengthM: number, via?: LatLon[]][];
};

// A road segment is named by its two end points, which survive a rebuilt pack better than an index.
export type BlockedRoad = { a: LatLon; b: LatLon };

export type ReroutedShelter = {
  shelter: Shelter;
  route: LatLon[];
  km: number;
  crossesFloodProneArea: boolean;
};

const METERS_PER_DEGREE_LAT = 111_320;
const FLOOD_PRONE_COST_FACTOR = 10;
const MAX_HOME_TO_ROAD_M = 500;
const MAX_SHELTER_TO_ROAD_M = 500;
const MAX_TAP_TO_ROAD_M = 50;
const ROUTE_SAMPLE_SPACING_M = 25;
const ROUTE_TO_BLOCKED_ROAD_M = 15;

function pointKey([lat, lon]: LatLon): string {
  return `${lat.toFixed(5)},${lon.toFixed(5)}`;
}

function roadKey(a: LatLon, b: LatLon): string {
  return [pointKey(a), pointKey(b)].sort().join("|");
}

function toHome([lat, lon]: LatLon): Home {
  return { lat, lon };
}

// Flat-earth distances: roads are short and the error is far below the 25 m the rest works at.
function metersBetween(from: LatLon, to: LatLon): number {
  const meanLat = (((from[0] + to[0]) / 2) * Math.PI) / 180;
  return Math.hypot(
    (to[0] - from[0]) * METERS_PER_DEGREE_LAT,
    (to[1] - from[1]) * METERS_PER_DEGREE_LAT * Math.cos(meanLat),
  );
}

function metersFromSegment(point: LatLon, start: LatLon, end: LatLon): number {
  const cosLat = Math.cos((point[0] * Math.PI) / 180);
  const toMeters = (p: LatLon): LatLon => [
    (p[0] - point[0]) * METERS_PER_DEGREE_LAT,
    (p[1] - point[1]) * METERS_PER_DEGREE_LAT * cosLat,
  ];
  const [startNorth, startEast] = toMeters(start);
  const [endNorth, endEast] = toMeters(end);
  const alongNorth = endNorth - startNorth;
  const alongEast = endEast - startEast;
  const lengthSquared = alongNorth ** 2 + alongEast ** 2;
  const along =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, (-startNorth * alongNorth + -startEast * alongEast) / lengthSquared),
        );
  return Math.hypot(startNorth + along * alongNorth, startEast + along * alongEast);
}

function drawnLine(graph: RoadGraph, edge: RoadGraph["edges"][number]): LatLon[] {
  const [from, to, , via = []] = edge;
  return [graph.nodes[from], ...via, graph.nodes[to]];
}

// Halfway along the middle segment, which is where a road is judged to be in or out of the water.
function midpointOf(line: LatLon[]): LatLon {
  const index = Math.floor((line.length - 1) / 2);
  return [(line[index][0] + line[index + 1][0]) / 2, (line[index][1] + line[index + 1][1]) / 2];
}

function metersFromLine(point: LatLon, line: LatLon[]): number {
  let nearest = Infinity;
  for (let i = 1; i < line.length; i++) {
    nearest = Math.min(nearest, metersFromSegment(point, line[i - 1], line[i]));
  }
  return nearest;
}

// The road segment under a tap, or null when no road is within reach.
export function roadNear(graph: RoadGraph, point: Home): BlockedRoad | null {
  const tapped: LatLon = [point.lat, point.lon];
  let best: { road: BlockedRoad; meters: number } | null = null;
  for (const edge of graph.edges) {
    const meters = metersFromLine(tapped, drawnLine(graph, edge));
    if (meters <= MAX_TAP_TO_ROAD_M && (best === null || meters < best.meters)) {
      best = { road: { a: graph.nodes[edge[0]], b: graph.nodes[edge[1]] }, meters };
    }
  }
  return best?.road ?? null;
}

export function isSameRoad(x: BlockedRoad, y: BlockedRoad): boolean {
  return roadKey(x.a, x.b) === roadKey(y.a, y.b);
}

// What to draw for the Blocked Roads that are still in this graph.
export function blockedRoadLines(graph: RoadGraph, blocked: BlockedRoad[]): LatLon[][] {
  const keys = new Set(blocked.map(({ a, b }) => roadKey(a, b)));
  return graph.edges
    .filter(([from, to]) => keys.has(roadKey(graph.nodes[from], graph.nodes[to])))
    .map((edge) => drawnLine(graph, edge));
}

function sampled(route: LatLon[]): LatLon[] {
  const points: LatLon[] = [route[0]];
  for (let i = 1; i < route.length; i++) {
    const steps = Math.max(
      1,
      Math.ceil(metersBetween(route[i - 1], route[i]) / ROUTE_SAMPLE_SPACING_M),
    );
    for (let step = 1; step <= steps; step++) {
      const share = step / steps;
      points.push([
        route[i - 1][0] + (route[i][0] - route[i - 1][0]) * share,
        route[i - 1][1] + (route[i][1] - route[i - 1][1]) * share,
      ]);
    }
  }
  return points;
}

// Whether a Route should be replaced: it runs along a Blocked Road or through a Flood-Prone Area.
let lastAffected: { key: unknown[]; result: boolean } | null = null;

export function routeIsAffected(
  route: LatLon[],
  graph: RoadGraph,
  blocked: BlockedRoad[],
  floodProne: FloodProneAreas,
): boolean {
  const key = [route, graph, blocked, floodProne];
  if (lastAffected?.key.every((part, index) => Object.is(part, key[index]))) {
    return lastAffected.result;
  }
  const result = routeIsAffectedUncached(route, graph, blocked, floodProne);
  lastAffected = { key, result };
  return result;
}

function routeIsAffectedUncached(
  route: LatLon[],
  graph: RoadGraph,
  blocked: BlockedRoad[],
  floodProne: FloodProneAreas,
): boolean {
  // A road that only meets the Route at a junction does not affect it, so a blocked segment
  // counts when its middle lies on the Route.
  const blockedMiddles = blockedRoadLines(graph, blocked).map(midpointOf);
  return (
    blockedMiddles.some((middle) => metersFromLine(middle, route) <= ROUTE_TO_BLOCKED_ROAD_M) ||
    sampled(route).some((point) => inFloodProneArea(toHome(point), floodProne))
  );
}

function nearestNode(graph: RoadGraph, point: LatLon, withinM: number): number | null {
  let nearest: number | null = null;
  let nearestMeters = withinM;
  for (let index = 0; index < graph.nodes.length; index++) {
    const meters = metersBetween(point, graph.nodes[index]);
    if (meters <= nearestMeters) {
      nearest = index;
      nearestMeters = meters;
    }
  }
  return nearest;
}

type Arc = { to: number; lengthM: number; cost: number; flooded: boolean; line: LatLon[] };

function adjacencyAvoiding(
  graph: RoadGraph,
  blocked: BlockedRoad[],
  floodProne: FloodProneAreas,
): Arc[][] {
  const blockedKeys = new Set(blocked.map(({ a, b }) => roadKey(a, b)));
  const arcs: Arc[][] = graph.nodes.map(() => []);
  for (const edge of graph.edges) {
    const [from, to, lengthM] = edge;
    if (blockedKeys.has(roadKey(graph.nodes[from], graph.nodes[to]))) continue;
    const line = drawnLine(graph, edge);
    const middle = midpointOf(line);
    const flooded = inFloodProneArea(toHome(middle), floodProne);
    const cost = flooded ? lengthM * FLOOD_PRONE_COST_FACTOR : lengthM;
    arcs[from].push({ to, lengthM, cost, flooded, line });
    arcs[to].push({ to: from, lengthM, cost, flooded, line: [...line].reverse() });
  }
  return arcs;
}

// Binary min-heap on cost, so a search over a valley's roads stays quick enough for a phone.
class CostQueue {
  private items: [cost: number, node: number][] = [];

  push(cost: number, node: number): void {
    const items = this.items;
    items.push([cost, node]);
    for (let i = items.length - 1; i > 0;) {
      const parent = (i - 1) >> 1;
      if (items[parent][0] <= items[i][0]) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): [cost: number, node: number] | null {
    const items = this.items;
    if (items.length === 0) return null;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      for (let i = 0; ;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < items.length && items[left][0] < items[smallest][0]) smallest = left;
        if (right < items.length && items[right][0] < items[smallest][0]) smallest = right;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top;
  }
}

type Reach = { cost: number; from: number; arc: Arc | null };

function cheapestReach(arcs: Arc[][], start: number): Map<number, Reach> {
  const reach = new Map<number, Reach>([[start, { cost: 0, from: start, arc: null }]]);
  const queue = new CostQueue();
  queue.push(0, start);
  for (let next = queue.pop(); next !== null; next = queue.pop()) {
    const [cost, node] = next;
    if (cost > reach.get(node)!.cost) continue;
    for (const arc of arcs[node]) {
      const total = cost + arc.cost;
      if (total < (reach.get(arc.to)?.cost ?? Infinity)) {
        reach.set(arc.to, { cost: total, from: node, arc });
        queue.push(total, arc.to);
      }
    }
  }
  return reach;
}

// The plan is rebuilt every second, but the search only has to run again when its inputs change.
let lastReroute: { key: unknown[]; result: ReroutedShelter[] | null } | null = null;

// The open Shelters a resident can still reach from home, quickest first. Blocked Roads are gone
// from the map; a road inside a Flood-Prone Area is only costly, so a Shelter ringed by water stays
// reachable. Null when home is too far from any road to start from.
function rerouteHomeUncached({
  graph,
  home,
  shelters,
  blocked,
  floodProne,
}: {
  graph: RoadGraph;
  home: Home;
  shelters: Shelter[];
  blocked: BlockedRoad[];
  floodProne: FloodProneAreas;
}): ReroutedShelter[] | null {
  const homePoint: LatLon = [home.lat, home.lon];
  const start = nearestNode(graph, homePoint, MAX_HOME_TO_ROAD_M);
  if (start === null) return null;
  const reach = cheapestReach(adjacencyAvoiding(graph, blocked, floodProne), start);

  const reached: (ReroutedShelter & { cost: number })[] = [];
  for (const shelter of shelters) {
    const end = nearestNode(graph, shelter.pos, MAX_SHELTER_TO_ROAD_M);
    if (end === null || !reach.has(end)) continue;
    const arcs: Arc[] = [];
    for (let node = end; node !== start; node = reach.get(node)!.from) {
      arcs.unshift(reach.get(node)!.arc!);
    }
    const route: LatLon[] = [homePoint, graph.nodes[start]];
    for (const arc of arcs) route.push(...arc.line.slice(1));
    route.push(shelter.pos);
    reached.push({
      shelter,
      route,
      km: arcs.reduce((total, arc) => total + arc.lengthM, 0) / 1000,
      crossesFloodProneArea: arcs.some((arc) => arc.flooded),
      cost: reach.get(end)!.cost,
    });
  }
  return reached
    .sort((a, b) => a.cost - b.cost)
    .map(({ shelter, route, km, crossesFloodProneArea }) => ({
      shelter,
      route,
      km,
      crossesFloodProneArea,
    }));
}

export function rerouteHome(
  input: Parameters<typeof rerouteHomeUncached>[0],
): ReroutedShelter[] | null {
  const { graph, home, shelters, blocked, floodProne } = input;
  const key = [graph, home.lat, home.lon, shelters.map(({ id }) => id).join(), blocked, floodProne];
  if (lastReroute?.key.every((part, index) => Object.is(part, key[index]))) {
    return lastReroute.result;
  }
  const result = rerouteHomeUncached(input);
  lastReroute = { key, result };
  return result;
}
