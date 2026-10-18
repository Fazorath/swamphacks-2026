import type { EventClock } from "./useEventClock";

// The replay's place is Nepal, so its clock is shown in Nepal time whatever the viewer's zone is.
const NEPAL_OFFSET_SECONDS = (5 * 60 + 45) * 60;

function asNepalTime(unixSeconds: number): Date {
  return new Date((unixSeconds + NEPAL_OFFSET_SECONDS) * 1000);
}

// "08:37" for an Event time in Unix seconds.
export function nepalClockTime(unixSeconds: number): string {
  return asNepalTime(unixSeconds).toISOString().slice(11, 16);
}

function formatEventClock({ event_t, state, rate }: EventClock): string {
  const date = asNepalTime(event_t).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const tag = state === "playing" ? `REPLAY ×${rate}` : "REPLAY PAUSED";
  return `${date} · ${nepalClockTime(event_t)} NPT · ${tag}`;
}

export function EventClockTag({ clock }: { clock: EventClock | null }) {
  if (!clock) return null;
  return <span className="event-clock">{formatEventClock(clock)}</span>;
}
