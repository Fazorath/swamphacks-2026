import { usePolledJson } from "./usePolledJson";

export type EventClock = {
  event: string;
  state: "playing" | "paused";
  event_t: number;
  rate: number;
};

// Fast enough that the clock moves visibly at ×30. It keeps its own poll: the state snapshot does
// not carry the Event clock.
const CLOCK_POLL_MS = 1000;

export type EventClockFeed = {
  // Null while no replay is running, which is also what a Node that predates the replay answers.
  clock: EventClock | null;
  // False until the Node has answered, and again while it is unreachable: a null clock then means
  // "not known", not "no replay", so the Replay controls must not offer Start.
  heard: boolean;
};

// Pass false while the Node is unreachable: no clock, and no polling until it answers again.
export function useEventClock(polling: boolean): EventClockFeed {
  const answer = usePolledJson<{ state: string } & EventClock>(
    polling ? "/api/replay" : null,
    CLOCK_POLL_MS,
  );
  const running = answer && (answer.state === "playing" || answer.state === "paused");
  return { clock: running ? answer : null, heard: answer !== null };
}
