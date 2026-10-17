import { usePolledJson } from "./usePolledJson";

export type CameraTile = {
  id: number;
  label: string;
  state: "live" | "offline" | "unavailable";
  taken_at: string | null;
  age_s: number | null;
};

export function useCameras(): CameraTile[] {
  return usePolledJson<CameraTile[]>("/api/cameras") ?? [];
}
