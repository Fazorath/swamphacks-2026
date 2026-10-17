import { nodesOnMap } from "./nodesOnMap";
import type { Reading } from "./useReadings";

function reading(overrides: Partial<Reading>): Reading {
  return {
    node: "91c2e0b47a3d",
    kind: "pressure",
    value: 1015,
    unit: "hPa",
    position: [29.652, -82.324],
    timestamp: "2026-10-16T12:00:00Z",
    age_s: 1,
    simulated: true,
    ...overrides,
  };
}

const own = { id: "b7e1f40a92c5", name: "porch", role: "sensor" } as const;

test("a Node shows its water level, position and simulated flag", () => {
  const [node] = nodesOnMap(
    [reading({}), reading({ kind: "water_level", value: 84, unit: "cm" })],
    own,
  );
  expect(node).toMatchObject({ waterLevelCm: 84, position: [29.652, -82.324], simulated: true });
});

test("this Node is labeled with its name and every other Node with its id", () => {
  const nodes = nodesOnMap([reading({ node: own.id }), reading({})], own);
  expect(nodes.map((node) => node.label)).toEqual(["porch", "91c2e0b47a3d"]);
});

test("a Node is stale only after 15 seconds of silence", () => {
  const [fresh] = nodesOnMap([reading({ age_s: 15 })], own);
  const [stale] = nodesOnMap([reading({ age_s: 16 })], own);
  expect(fresh.stale).toBe(false);
  expect(stale).toMatchObject({ stale: true, ageSeconds: 16 });
});
