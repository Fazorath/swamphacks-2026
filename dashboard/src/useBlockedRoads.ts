import { useState } from "react";

import { loadBlockedRoads, saveBlockedRoads } from "./blockedRoads";
import { isSameRoad, type BlockedRoad } from "./rerouting";

function loadFromBrowser(): BlockedRoad[] {
  try {
    return loadBlockedRoads(window.localStorage);
  } catch (error) {
    console.error(error);
    return [];
  }
}

// Blocked Roads stay on this device like the Household Profile; no request carries them.
export function useBlockedRoads(): [BlockedRoad[], (road: BlockedRoad) => void] {
  const [roads, setRoads] = useState<BlockedRoad[]>(loadFromBrowser);
  const toggle = (road: BlockedRoad) => {
    const next = roads.some((blocked) => isSameRoad(blocked, road))
      ? roads.filter((blocked) => !isSameRoad(blocked, road))
      : [...roads, road];
    // The choice stays in memory even when the browser refuses to store it.
    setRoads(next);
    try {
      saveBlockedRoads(window.localStorage, next);
    } catch (error) {
      console.error(error);
    }
  };
  return [roads, toggle];
}
