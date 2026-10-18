import type { CachePackContents } from "./evacuationPlan";
import { exampleHousehold } from "./exampleHousehold";

const PACK: CachePackContents = {
  shelters: [],
  floodProne: { features: [] },
  routeGrid: null,
  tileMaxZoom: null,
  bbox: [27.86, 85.08, 28.46, 85.47],
};

test("a pack that covers the valley gets the example home", () => {
  expect(exampleHousehold(PACK)?.home).toEqual({ lat: 28.0599, lon: 85.2303 });
});

test("a pack for another area, or with no area, gets none", () => {
  expect(exampleHousehold({ ...PACK, bbox: [29.6, -82.4, 29.7, -82.2] })).toBeNull();
  expect(exampleHousehold({ ...PACK, bbox: null })).toBeNull();
  expect(exampleHousehold(null)).toBeNull();
});
