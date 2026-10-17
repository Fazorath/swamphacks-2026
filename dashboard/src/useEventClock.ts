import { usePolledJson } from "./usePolledJson";

export type EventClock = {
  state: "playing" | "paused";
  event_t: number;
  rate: number;
};

// Fast enough that the clock moves visibly at ×30. It keeps its own poll: the state snapshot does
// not carry the Event clock.
const CLOCK_POLL_MS = 1000;

// Null while no replay is running, which is also what a Node that predates the replay answers.
// Pass false while the Node is unreachable: no clock, and no polling until it answers again.
export function useEventClock(polling: boolean): EventClock | null {
  const clock = usePolledJson<{ state: string } & EventClock>(
    polling ? "/api/replay" : null,
    CLOCK_POLL_MS,
  );
  return clock && (clock.state === "playing" || clock.state === "paused") ? clock : null;
}
