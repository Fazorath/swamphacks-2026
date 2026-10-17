import { loadBlockedRoads, saveBlockedRoads } from "./blockedRoads";
import type { BlockedRoad } from "./rerouting";

const ROAD: BlockedRoad = { a: [29.65, -82.32], b: [29.66, -82.32] };

beforeEach(() => localStorage.clear());

test("saved Blocked Roads come back after a reload", () => {
  saveBlockedRoads(localStorage, [ROAD]);
  expect(loadBlockedRoads(localStorage)).toEqual([ROAD]);
});

test("nothing stored means no Blocked Roads", () => {
  expect(loadBlockedRoads(localStorage)).toEqual([]);
});

test("an unusable stored value counts as no Blocked Roads", () => {
  localStorage.setItem("storm-shield.blocked-roads", "not json");
  expect(loadBlockedRoads(localStorage)).toEqual([]);
  localStorage.setItem("storm-shield.blocked-roads", JSON.stringify({ version: 9, roads: [ROAD] }));
  expect(loadBlockedRoads(localStorage)).toEqual([]);
});

test("a stored road with a bad point is dropped, the others kept", () => {
  localStorage.setItem(
    "storm-shield.blocked-roads",
    JSON.stringify({ version: 1, roads: [ROAD, { a: [1], b: [2, 3] }] }),
  );
  expect(loadBlockedRoads(localStorage)).toEqual([ROAD]);
});
