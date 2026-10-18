import { useEffect, useState } from "react";

import type { Home } from "./householdProfile";
import type { NodeOnMap } from "./nodesOnMap";
import { armPagerSound, closestNodeToHome, playPager } from "./pager";

export type PagerAlert = { label: string };

type Watched = { id: string; stale: boolean };

// Sounds the pager and returns an alert when the Node closest to home, seen responding on this
// page, goes quiet. A Node that is already quiet when the page opens does not page.
export function usePager(
  nodes: NodeOnMap[],
  home: Home | null,
): { alert: PagerAlert | null; dismiss: () => void } {
  const [watched, setWatched] = useState<Watched | null>(null);
  const [alert, setAlert] = useState<PagerAlert | null>(null);

  useEffect(() => armPagerSound(), []);
  useEffect(() => {
    if (alert) playPager();
  }, [alert]);

  const closest = home ? closestNodeToHome(nodes, home) : null;
  const now = closest ? { id: closest.id, stale: closest.stale } : null;
  if (watched?.id !== now?.id || watched?.stale !== now?.stale) {
    // Setting state while rendering is the supported way to react to a change in props.
    setWatched(now);
    if (closest && watched?.id === closest.id && !watched.stale && closest.stale) {
      setAlert({ label: closest.label });
    }
  }

  return { alert, dismiss: () => setAlert(null) };
}
