import { Timer } from "lucide-react";

import { nepalClockTime } from "./EventClockTag";
import type { Place } from "./placeLabels";
import type { WaveArrival } from "./waveEta";

export type CountdownTone = "far" | "soon" | "now";

// White at 15 minutes or more, amber under 15, red under 5 (D-25). Zero is red too: the card then
// reads "wave expected now".
export function countdownTone(minutesLeft: number): CountdownTone {
  if (minutesLeft < 5) return "now";
  if (minutesLeft < 15) return "soon";
  return "far";
}

function nearestPlaceName(places: Place[], home: { lat: number; lon: number }): string | null {
  let nearest: { name: string; distance: number } | null = null;
  for (const place of places) {
    const distance = (place.lat - home.lat) ** 2 + (place.lon - home.lon) ** 2;
    if (nearest === null || distance < nearest.distance) nearest = { name: place.name, distance };
  }
  return nearest?.name ?? null;
}

// The only countdown on the God's Eye View (D-24). It counts down to the same arrival time the
// Evacuation Plan and the warning cards use, so the three always agree.
export function WaveEtaCard({
  arrival,
  eventT,
  home,
  places,
}: {
  arrival: WaveArrival | null;
  eventT: number | null;
  home: { lat: number; lon: number } | null;
  places: Place[];
}) {
  if (arrival === null || arrival.kind !== "expected" || eventT === null) return null;
  const secondsLeft = arrival.at - eventT;
  const arrived = secondsLeft <= 0;
  const minutesLeft = Math.ceil(secondsLeft / 60);
  const tone = arrived ? "now" : countdownTone(minutesLeft);
  const town = (home && nearestPlaceName(places, home)) ?? "your home";
  return (
    <aside className={`wave-eta-card ${tone}`} aria-label="Wave ETA">
      <span className="wave-eta-head">
        <span>
          <Timer size={12} aria-hidden="true" /> WAVE ETA
        </span>
        <span>ARRIVES {nepalClockTime(arrival.at)}</span>
      </span>
      {arrived ? (
        <span className="wave-eta-now">wave expected now</span>
      ) : (
        <span className="wave-eta-number">{minutesLeft}</span>
      )}
      <span className="wave-eta-town">{arrived ? town : `MIN · ${town}`}</span>
    </aside>
  );
}
