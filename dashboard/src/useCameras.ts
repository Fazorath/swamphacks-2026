import { usePolledJson } from "./usePolledJson";

export type CameraTile = {
  id: number;
  label: string;
  state: "live" | "offline" | "unavailable";
  taken_at: string | null;
  age_s: number | null;
};

// Pass false while the Node is unreachable: no tiles, and no polling until it answers again.
export function useCameras(polling: boolean): CameraTile[] {
  return usePolledJson<CameraTile[]>(polling ? "/api/cameras" : null) ?? [];
}
