import { fakeNodeSnapshot, fakeNodeState } from "./fakeNodeState";
import { nodesOnMap } from "./nodesOnMap";

test("a Node shows its water level, position and simulated flag", () => {
  const state = fakeNodeState({
    nodes: [
      fakeNodeSnapshot("garage", { measurements: { water_level: { value: 84, unit: "cm" } } }),
    ],
  });
  const [node] = nodesOnMap(state);
  expect(node).toMatchObject({ waterLevelCm: 84, position: [29.652, -82.324], simulated: true });
});

test("this Node is labeled with its name and every other Node with its id", () => {
  const state = fakeNodeState({
    id: "b7e1f40a92c5",
    name: "porch",
    nodes: [fakeNodeSnapshot("91c2e0b47a3d"), fakeNodeSnapshot("b7e1f40a92c5")],
  });
  expect(nodesOnMap(state).map((node) => node.label)).toEqual(["91c2e0b47a3d", "porch"]);
});

test("a Node is stale and old exactly as the Node says, with no threshold of its own", () => {
  const state = fakeNodeState({
    nodes: [
      fakeNodeSnapshot("fresh", { age_s: 16, stale: false }),
      fakeNodeSnapshot("silent", { age_s: 3, stale: true }),
    ],
  });
  const [fresh, silent] = nodesOnMap(state);
  expect(fresh).toMatchObject({ stale: false, ageSeconds: 16 });
  expect(silent).toMatchObject({ stale: true, ageSeconds: 3 });
});

test("a Node carries its level from Flood Risk, and no level when Flood Risk has none", () => {
  const state = fakeNodeState({
    flood_risk: { ...fakeNodeState().flood_risk, nodes: { garage: "high" } },
    nodes: [fakeNodeSnapshot("garage"), fakeNodeSnapshot("porch")],
  });
  expect(nodesOnMap(state).map((node) => node.level)).toEqual(["high", null]);
});

test("before the first answer there are no Nodes on the map", () => {
  expect(nodesOnMap(null)).toEqual([]);
});
