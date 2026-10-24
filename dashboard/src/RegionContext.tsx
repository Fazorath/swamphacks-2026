import { createContext, useContext } from "react";

import type { Region } from "./nodeState";

// The Region the Node serves; null until the first answer. Time and units are read here by the
// components that print them, so the Region does not travel through every panel in between.
export const RegionContext = createContext<Region | null>(null);

export function useRegion(): Region | null {
  return useContext(RegionContext);
}
