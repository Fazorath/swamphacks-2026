import { usePolledJson } from "./usePolledJson";

export type CameraTile = {
  id: string;
  label: string;
  // Every camera is a recording for now; a live source comes with 0075.
  kind: "replay";
  // "live" means the camera works, whatever its kind. Offline is a Mesh-only Node; Unavailable is
  // anything else that stops this Viewer getting the clip.
  state: "live" | "offline" | "unavailable";
  // Null unless the tile is working.
  credit: string | null;
  illustrative: string | null;
  flood_onset_s: number | null;
  length_s: number | null;
  // Event time (Unix seconds) at which the clip's first frame plays.
  event_start_t: number | null;
};

// Pass false while the Node is unreachable: no tiles, and no polling until it answers again.
export function useCameras(polling: boolean): CameraTile[] {
  return usePolledJson<CameraTile[]>(polling ? "/api/cameras" : null) ?? [];
}
