import type { CommunityWarning } from "./communityWarnings";
import {
  MAX_DISTANCE_TO_RIVER_KM,
  parseRiverLine,
  riverKmOfHome,
  waveArrival,
  waveEtaLine,
  type RiverLine,
} from "./waveEta";

// A straight north-to-south river at lon 85, one vertex per km (0.009 degrees of latitude is
// about 1 km): 190 km/h down to km 0, then 60 km/h to km 30.
const RIVER: RiverLine = [
  {
    speedKmh: 190,
    km: [-10, -5, 0],
    points: [
      [28.09, 85],
      [28.045, 85],
      [28, 85],
    ],
  },
  {
    speedKmh: 60,
    km: [0, 10, 20, 30],
    points: [
      [28, 85],
      [27.91, 85],
      [27.82, 85],
      [27.73, 85],
    ],
  },
];

const SURGE_T = 1_787_716_020;

function warningAt(originKm: number, surgeT = SURGE_T): CommunityWarning {
  return {
    id: 1,
    t: surgeT,
    nodes: ["s0"],
    reasons: ["water_surge"],
    origin: "s0",
    origin_km: originKm,
    surge_t: surgeT,
  };
}

const at = (km: number, offsetDegrees = 0) => ({ lat: 28 - km * 0.009, lon: 85 + offsetDegrees });

describe("the wave's ETA at home", () => {
  it("adds up each reach's time from the origin's River km to home", () => {
    // -10 to 0 at 190 km/h, then 0 to 20 at 60 km/h.
    const seconds = (10 / 190 + 20 / 60) * 3600;
    const arrival = waveArrival(RIVER, at(20), [warningAt(-10)]);
    expect(arrival?.kind === "expected" && arrival.at).toBeCloseTo(SURGE_T + seconds, 0);
  });

  it("counts only the reach a home is in when the origin is in the same reach", () => {
    const arrival = waveArrival(RIVER, at(20), [warningAt(10)]);
    expect(arrival?.kind === "expected" && arrival.at).toBeCloseTo(SURGE_T + (10 / 60) * 3600, 0);
  });

  it("gives a home upstream of the origin no ETA", () => {
    expect(waveArrival(RIVER, at(-5), [warningAt(0)])).toBeNull();
    expect(waveArrival(RIVER, at(10), [warningAt(10)])).toBeNull();
  });

  it("follows the earliest arrival and ignores origins below home", () => {
    // From km -10 the wave needs about 1990 s to reach km 30; the second Surge, 60 s later at
    // km 20, needs 10 km at 60 km/h = 600 s, so it is the one to count down to.
    const second = warningAt(20, SURGE_T + 60);
    expect(waveArrival(RIVER, at(30), [warningAt(-10), second])).toEqual({
      kind: "expected",
      at: SURGE_T + 660,
    });
    const belowHome = waveArrival(RIVER, at(10), [warningAt(20), warningAt(0)]);
    const upstreamOnly = waveArrival(RIVER, at(10), [warningAt(0)]);
    expect(belowHome).toEqual(upstreamOnly);
  });

  it("has nothing to say before any warning", () => {
    expect(waveArrival(RIVER, at(20), [])).toBeNull();
  });

  it("says the home is not near the river when it is beyond the limit", () => {
    expect(riverKmOfHome(RIVER, at(20, 0.001))).toBe(20);
    const farLonOffset = (MAX_DISTANCE_TO_RIVER_KM + 1) / (111.32 * Math.cos((28 * Math.PI) / 180));
    expect(riverKmOfHome(RIVER, at(20, farLonOffset))).toBeNull();
    expect(waveArrival(RIVER, at(20, farLonOffset), [warningAt(-10)])).toEqual({
      kind: "not-near-river",
    });
  });
});

describe("the countdown line", () => {
  it("rounds minutes up", () => {
    expect(waveEtaLine(1000 + 9 * 60 - 20, 1000)).toBe("Wave expected at your home in about 9 min");
    expect(waveEtaLine(1000 + 1, 1000)).toBe("Wave expected at your home in about 1 min");
  });

  it("says the wave is expected now at zero and never goes negative", () => {
    expect(waveEtaLine(1000, 1000)).toBe("Wave expected now");
    expect(waveEtaLine(1000, 5000)).toBe("Wave expected now");
  });
});

describe("reading the pack's river line", () => {
  it("turns each GeoJSON reach into lat/lon points with their River km", () => {
    const river = parseRiverLine({
      features: [
        {
          properties: { speed_kmh: 68, km: [0, 1] },
          geometry: {
            coordinates: [
              [85.1, 28.1],
              [85.2, 28.2],
            ],
          },
        },
      ],
    });
    expect(river).toEqual([
      {
        speedKmh: 68,
        km: [0, 1],
        points: [
          [28.1, 85.1],
          [28.2, 85.2],
        ],
      },
    ]);
  });

  it("refuses a reach whose km list does not match its vertices", () => {
    expect(() =>
      parseRiverLine({
        features: [
          {
            properties: { speed_kmh: 68, km: [0] },
            geometry: {
              coordinates: [
                [1, 2],
                [3, 4],
              ],
            },
          },
        ],
      }),
    ).toThrow(/river.geojson/);
  });
});
