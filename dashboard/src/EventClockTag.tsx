import { useRegion } from "./RegionContext";
import { regionClockTime, regionDate, regionZoneLabel } from "./regionTime";
import type { EventClock } from "./useEventClock";

// "28 Sep 2022 · 14:06 EDT · REPLAY ×30": the Event's time in the Region's zone, whatever the
// viewer's zone is.
function formatEventClock({ event_t, state, rate }: EventClock, timeZone: string): string {
  const tag = state === "playing" ? `REPLAY ×${rate}` : "REPLAY PAUSED";
  const when = `${regionDate(event_t, timeZone)} · ${regionClockTime(event_t, timeZone)}`;
  return `${when} ${regionZoneLabel(event_t, timeZone)} · ${tag}`;
}

export function EventClockTag({ clock }: { clock: EventClock | null }) {
  const region = useRegion();
  if (!clock || !region) return null;
  return <span className="event-clock">{formatEventClock(clock, region.time_zone)}</span>;
}
