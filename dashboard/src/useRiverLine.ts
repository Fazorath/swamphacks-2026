import { useEffect, useState } from "react";

import { parseRiverLine, type RiverLine } from "./waveEta";

// The river line is in the pack only when it was built for the valley; a 404 means this pack has
// none and there is simply no Wave ETA. Like the pack itself it never changes, so it is read once.
export function useRiverLine(packLoaded: boolean): RiverLine | null {
  const [river, setRiver] = useState<RiverLine | null>(null);
  useEffect(() => {
    if (!packLoaded) return;
    let cancelled = false;
    fetch("/api/cache-pack/files/river.geojson")
      .then((response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Node API returned ${response.status} for river.geojson`);
        return response.json().then(parseRiverLine);
      })
      .then((loaded) => {
        if (!cancelled) setRiver(loaded);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [packLoaded]);
  return river;
}
