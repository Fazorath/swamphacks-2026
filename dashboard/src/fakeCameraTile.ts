import type { CameraTile } from "./useCameras";

// 08:30 NPT on 26 Aug 2026, when the replay's first frame plays.
export const REPLAY_START_T = 1787712300;

// A working Hub camera, as /api/cameras answers it; tests override the rest.
export function fakeCameraTile(overrides: Partial<CameraTile> = {}): CameraTile {
  return {
    id: "hub-betrawati",
    label: "Betrawati",
    site: "hub",
    lat: 27.9731,
    lon: 85.186,
    kind: "replay",
    state: "live",
    credit: "Wallowa River, BLM; Bright Angel, NPS",
    illustrative: "Illustrative footage, not filmed at this site.",
    flood_onset_s: 193,
    length_s: 300,
    event_start_t: REPLAY_START_T,
    ...overrides,
  };
}
