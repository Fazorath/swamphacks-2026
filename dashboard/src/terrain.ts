import { NATIONAL_ZOOM } from "./basemap";

// D-30, D-31: the valley is seen from an angle, with its relief stretched by half.
export const TERRAIN_PITCH = 45;
export const TERRAIN_EXAGGERATION = 1.5;

// Zoomed out past this the whole country is in view: flat, top-down, no terrain to draw (D-33).
export const TERRAIN_FROM_ZOOM = NATIONAL_ZOOM + 2;

// Where the Valley button and the warning's fly take the camera.
export const VALLEY_VIEW = { center: [85.19, 27.98] as [number, number], zoom: 10 };

export type TerrainChoice = "3d" | "2d";

const CHOICE_KEY = "storm-shield.terrain";

export function readTerrainChoice(): TerrainChoice {
  try {
    return window.localStorage.getItem(CHOICE_KEY) === "2d" ? "2d" : "3d";
  } catch (error) {
    // Unreadable storage is not an error to the resident: they get the default.
    console.error(error);
    return "3d";
  }
}

export function saveTerrainChoice(choice: TerrainChoice): void {
  try {
    window.localStorage.setItem(CHOICE_KEY, choice);
  } catch (error) {
    console.error(error);
  }
}

// Panning under this many frames per second means the laptop cannot carry terrain (D-35). It is
// a safety net, well under the 60 fps the demo is held to, and is judged only while the map moves.
export const MIN_PANNING_FPS = 24;
const FRAMES_JUDGED = 30;

// Fed one call per drawn frame while the camera moves. `now` is injected so a test can fake the
// frame clock; `onSlow` fires once, after a full run of frames whose average is too slow.
export function createFrameWatch(onSlow: () => void, now: () => number = () => performance.now()) {
  let last: number | null = null;
  let gaps: number[] = [];
  let fired = false;
  return {
    frame() {
      const at = now();
      if (last !== null) gaps.push(at - last);
      last = at;
      if (fired || gaps.length < FRAMES_JUDGED) return;
      const average = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      if (average > 1000 / MIN_PANNING_FPS) {
        fired = true;
        onSlow();
      }
      gaps = [];
    },
    // The camera stopped or started again: the first frame of a move has no gap before it.
    restart() {
      last = null;
      gaps = [];
    },
  };
}
