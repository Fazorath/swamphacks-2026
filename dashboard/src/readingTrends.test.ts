import { remember, trendOf, type ReadingHistory } from "./readingTrends";
import type { NodeOnMap } from "./nodesOnMap";

const node = (value: number): NodeOnMap =>
  ({ id: "porch", measurements: [{ kind: "pressure", value, unit: "hPa" }] }) as NodeOnMap;

test("an arrow points the way a reading moved over the last 30 s", () => {
  const falling = [
    { at: 0, value: 1015 },
    { at: 20_000, value: 1010 },
  ];
  const rising = [
    { at: 0, value: 1010 },
    { at: 20_000, value: 1015 },
  ];
  expect(trendOf(falling, "pressure", 21_000)).toBe("falling");
  expect(trendOf(rising, "pressure", 21_000)).toBe("rising");
});

test("a move smaller than the sensor's noise is steady", () => {
  const samples = [
    { at: 0, value: 1015 },
    { at: 1000, value: 1014.8 },
  ];
  expect(trendOf(samples, "pressure", 2000)).toBe("steady");
});

test("a reading that has not changed is steady, however long it has been held", () => {
  expect(trendOf([{ at: 0, value: 40 }], "water_level", 120_000)).toBe("steady");
});

test("a change older than 30 s no longer counts", () => {
  let history: ReadingHistory = {};
  history = remember(history, [node(1015)], 0);
  history = remember(history, [node(1010)], 5_000);
  expect(trendOf(history["porch:pressure"], "pressure", 6_000)).toBe("falling");
  history = remember(history, [node(1010)], 40_000);
  expect(trendOf(history["porch:pressure"], "pressure", 40_000)).toBe("steady");
});

test("polls that change nothing add nothing to the history", () => {
  let history: ReadingHistory = {};
  for (let at = 0; at < 10_000; at += 1000) history = remember(history, [node(1015)], at);
  expect(history["porch:pressure"]).toHaveLength(1);
});
