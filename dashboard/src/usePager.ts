import { useEffect, useState } from "react";

import type { Home } from "./householdProfile";
import type { NodeOnMap } from "./nodesOnMap";
import { armPagerSound, highNodesNearHome, playPager } from "./pager";

export type PagerAlert = { label: string; km: number };

// Sounds the pager and returns an alert when a Node within the radius of home newly reaches a High
// warning while this page is open. A Node already High when the page opens does not page.
export function usePager(
  nodes: NodeOnMap[],
  home: Home | null,
): { alert: PagerAlert | null; dismiss: () => void } {
  // Null until the first Nodes are listed: what is already High then is the baseline, not news.
  const [highIds, setHighIds] = useState<string[] | null>(null);
  const [alert, setAlert] = useState<PagerAlert | null>(null);

  useEffect(() => armPagerSound(), []);
  useEffect(() => {
    if (alert) playPager();
  }, [alert]);

  const high = home ? highNodesNearHome(nodes, home) : [];
  const ids = high.map(({ id }) => id);
  const listed = home !== null && nodes.length > 0;
  if (listed && (highIds === null || ids.join() !== highIds.join())) {
    // Setting state while rendering is the supported way to react to a change in props.
    setHighIds(ids);
    const known = highIds ?? ids;
    const [newest] = high.filter(({ id }) => !known.includes(id));
    if (newest) setAlert({ label: newest.label, km: newest.km });
  }

  return { alert, dismiss: () => setAlert(null) };
}
