import { hatchImage } from "./basemap";
import { contactArc, levelRose, markerState, risenNodeIds } from "./markerState";
import type { NodeOnMap } from "./nodesOnMap";

function node(overrides: Partial<NodeOnMap> = {}): NodeOnMap {
  return {
    id: "s0",
    isThisNode: false,
    label: "S0",
    position: [28, 85],
    riverKm: null,
    waterLevelCm: 100,
    simulated: true,
    stale: false,
    registered: true,
    level: null,
    ageSeconds: 2,
    measurements: [],
    ...overrides,
  };
}

describe("markerState", () => {
  it("draws a calm Node as a flat dot with no glow (D-06)", () => {
    expect(markerState(node())).toEqual({ appearance: "calm", glowPx: 0, contactArc: null });
  });

  it("glows 16 px at Elevated and 22 px at High (D-12)", () => {
    expect(markerState(node({ level: "elevated" })).glowPx).toBe(16);
    expect(markerState(node({ level: "high" })).glowPx).toBe(22);
  });

  it("shows Stale and Unverified before any Flood Risk level, with no glow", () => {
    expect(markerState(node({ level: "high", stale: true }))).toMatchObject({
      appearance: "stale",
      glowPx: 0,
    });
    expect(markerState(node({ level: "high", registered: false }))).toMatchObject({
      appearance: "unverified",
      glowPx: 0,
    });
  });

  it("loses its glow when contact is lost, before it is Stale", () => {
    const silent = markerState(node({ level: "high", ageSeconds: 6 }));
    expect(silent.appearance).toBe("high");
    expect(silent.glowPx).toBe(0);
    expect(silent.contactArc).not.toBeNull();
  });
});

describe("contactArc", () => {
  it("is absent while the Node is heard and once it is Stale", () => {
    expect(contactArc({ ageSeconds: 4.9, stale: false })).toBeNull();
    expect(contactArc({ ageSeconds: 16, stale: true })).toBeNull();
  });

  it("drains from full at 5 s to empty at 15 s", () => {
    expect(contactArc({ ageSeconds: 5, stale: false })).toBe(1);
    expect(contactArc({ ageSeconds: 10, stale: false })).toBe(0.5);
    expect(contactArc({ ageSeconds: 15, stale: false })).toBe(0);
  });
});

describe("level rises", () => {
  it("counts only a step up", () => {
    expect(levelRose(null, "elevated")).toBe(true);
    expect(levelRose("elevated", "high")).toBe(true);
    expect(levelRose("high", "elevated")).toBe(false);
    expect(levelRose("high", "high")).toBe(false);
  });

  it("does not call a Node new to the map risen", () => {
    const risen = risenNodeIds({ a: null }, [
      { id: "a", level: "high" },
      { id: "b", level: "high" },
    ]);
    expect(risen).toEqual(["a"]);
  });
});

describe("hatchImage", () => {
  it("paints diagonal stripes in the given colour and leaves the rest clear", () => {
    const { width, height, data } = hatchImage("#6b86a8");
    expect(data).toHaveLength(width * height * 4);
    expect([...data.slice(0, 4)]).toEqual([0x6b, 0x86, 0xa8, 255]);
    const painted = [...Array(width * height).keys()].filter((at) => data[at * 4 + 3] === 255);
    expect(painted.length).toBeGreaterThan(0);
    expect(painted.length).toBeLessThan(width * height);
  });

  it("falls back to a blue-grey when the colour is not a plain hex", () => {
    expect([...hatchImage("").data.slice(0, 4)]).toEqual([107, 134, 168, 255]);
  });
});
