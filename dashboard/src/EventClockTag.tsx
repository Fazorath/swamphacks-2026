import type { EventClock } from "./useEventClock";

// The replay's place is Nepal, so its clock is shown in Nepal time whatever the viewer's zone is.
const NEPAL_OFFSET_SECONDS = (5 * 60 + 45) * 60;

export function formatEventClock({ event_t, state, rate }: EventClock): string {
  const nepalTime = new Date((event_t + NEPAL_OFFSET_SECONDS) * 1000);
  const date = nepalTime.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const time = nepalTime.toISOString().slice(11, 16);
  const tag = state === "playing" ? `REPLAY ×${rate}` : "REPLAY PAUSED";
  return `${date} · ${time} NPT · ${tag}`;
}

export function EventClockTag({ clock }: { clock: EventClock | null }) {
  if (!clock) return null;
  return <span className="event-clock">{formatEventClock(clock)}</span>;
}
