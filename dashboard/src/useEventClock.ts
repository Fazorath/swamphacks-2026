import { usePolledJson } from "./usePolledJson";

export type EventClock = {
  state: "playing" | "paused";
  event_t: number;
  rate: number;
};

// Fast enough that the clock moves visibly at ×30; 0019's snapshot replaces this poll.
const CLOCK_POLL_MS = 1000;

// Null while no replay is running, which is also what a Node that predates the replay answers.
export function useEventClock(): EventClock | null {
  const clock = usePolledJson<{ state: string } & EventClock>("/api/replay", CLOCK_POLL_MS);
  return clock && (clock.state === "playing" || clock.state === "paused") ? clock : null;
}
