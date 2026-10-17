import type { OfficialAlert } from "./officialAlerts";
import { usePolledJson } from "./usePolledJson";

// Every second, so a replayed alert appears when the Event clock reaches it; 0041 folds this
// into the one state snapshot hook.
const ALERTS_POLL_MS = 1000;

export function useOfficialAlerts(): OfficialAlert[] {
  const state = usePolledJson<{ official_alerts?: OfficialAlert[] }>("/api/state", ALERTS_POLL_MS);
  return state?.official_alerts ?? [];
}
