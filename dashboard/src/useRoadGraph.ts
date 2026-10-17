import { useEffect, useState } from "react";

import type { RoadGraph } from "./rerouting";

// The Road graph is in the pack only when it was built with one; a 404 means this pack has none.
// Like the pack itself it never changes once a Node holds it, so it is read once.
export function useRoadGraph(packLoaded: boolean): RoadGraph | null {
  const [graph, setGraph] = useState<RoadGraph | null>(null);
  useEffect(() => {
    if (!packLoaded) return;
    let cancelled = false;
    fetch("/api/cache-pack/files/roads.json")
      .then((response) => {
        if (response.status === 404) return null;
        if (!response.ok) throw new Error(`Node API returned ${response.status} for roads.json`);
        return response.json();
      })
      .then((loaded) => {
        if (loaded !== null && !(Array.isArray(loaded?.nodes) && Array.isArray(loaded?.edges))) {
          throw new Error("roads.json is not a Road graph");
        }
        if (!cancelled) setGraph(loaded);
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [packLoaded]);
  return graph;
}
