import type { Map as MapLibreMap } from "maplibre-gl";
import { useEffect } from "react";

import { lineCollection, pointCollection, setOverlay } from "./basemap";
import type { CommunityWarning } from "./communityWarnings";
import type { EventClock } from "./useEventClock";
import type { RiverLine } from "./waveEta";
import { waveFront } from "./waveFront";

// The clock is only heard once a second; between answers the front is moved on by the clock's own
// rate, but never further than this, so a stalled poll does not run the front off down the river.
const MAX_GLIDE_MS = 2500;

type Props = {
  map: MapLibreMap;
  river: RiverLine | null;
  warnings: CommunityWarning[];
  clock: EventClock | null;
  reducedMotion: boolean;
};

// Draws nothing itself: it moves the wave front, which lives in the map's own layers, so a frame
// costs no React render. With reduced motion the front is a marked reach that moves once per
// clock answer instead of gliding.
export function WaveFrontLayer({ map, river, warnings, clock, reducedMotion }: Props) {
  const eventT = clock?.event_t ?? null;
  const playing = clock?.state === "playing";
  const rate = clock?.rate ?? 1;
  useEffect(() => {
    const draw = (t: number) => {
      const front = river && warnings.length > 0 ? waveFront(river, warnings, t) : null;
      setOverlay(map, "wave-trail", lineCollection(front ? [front.trail] : []));
      setOverlay(map, "wave-head", pointCollection(front ? [front.head] : []));
    };
    draw(eventT ?? 0);
    if (eventT === null || reducedMotion || !playing || warnings.length === 0) return;
    const startedAt = performance.now();
    let frame = requestAnimationFrame(function tick() {
      const glided = Math.min(performance.now() - startedAt, MAX_GLIDE_MS);
      draw(eventT + (glided / 1000) * rate);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [map, river, warnings, eventT, playing, rate, reducedMotion]);

  return null;
}
