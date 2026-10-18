import type { NodeOnMap } from "./nodesOnMap";
import { readingsLadder, rungBeforeWave } from "./readingsLadder";

function node(id: string, overrides: Partial<NodeOnMap> = {}): NodeOnMap {
  return {
    id,
    isThisNode: false,
    label: id,
    position: [28, 85],
    riverKm: null,
    waterLevelCm: 100,
    simulated: true,
    fleet: false,
    stale: false,
    registered: true,
    level: null,
    ageSeconds: 2,
    measurements: [],
    ...overrides,
  };
}

describe("readingsLadder", () => {
  it("orders the river Nodes by River km, top of the river first", () => {
    const { rungs } = readingsLadder(
      [node("c", { riverKm: 45 }), node("a", { riverKm: -12.2 }), node("b", { riverKm: 3.6 })],
      null,
    );
    expect(rungs.map((each) => each.id)).toEqual(["a", "b", "c"]);
  });

  it("pins the real Node off the river that is not the Hub, and lists the rest under the ladder", () => {
    const hub = node("hub", { simulated: false });
    const pi = node("pi", { simulated: false });
    const audience = node("laptop", { simulated: true });
    const ladder = readingsLadder([hub, pi, audience, node("s0", { riverKm: 0 })], "hub");
    expect(ladder.pinned).toBe(pi);
    expect(ladder.offRiver).toEqual([hub, audience]);
  });

  it("pins nothing when every real Node is the Hub or on the river", () => {
    const ladder = readingsLadder([node("hub", { simulated: false })], "hub");
    expect(ladder.pinned).toBeNull();
  });
});

describe("rungBeforeWave", () => {
  const rungs = [0, 10, 20].map((km) => node(`s${km}`, { riverKm: km }));

  it("is the rung the front has just passed", () => {
    expect(rungBeforeWave(rungs, 10)).toBe(1);
    expect(rungBeforeWave(rungs, 4)).toBe(0);
  });

  it("is null with no wave, above the first rung and below the last", () => {
    expect(rungBeforeWave(rungs, null)).toBeNull();
    expect(rungBeforeWave(rungs, -3)).toBeNull();
    expect(rungBeforeWave(rungs, 25)).toBeNull();
  });
});
