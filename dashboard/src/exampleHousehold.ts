import type { CachePackContents } from "./evacuationPlan";
import type { HouseholdProfile } from "./householdProfile";

// A home in Syabrubesi, with a Route to Komin school in the pack, shown until a resident saves their own
// so the Evacuation Plan and its Route line are on screen from the first load. Never stored.
const EXAMPLE_HOUSEHOLD: HouseholdProfile = {
  home: { lat: 28.1654, lon: 85.3398 },
  housing: "site-built",
  needsSpecialNeedsShelter: false,
  needsPetFriendlyShelter: false,
};

// Only for a pack that covers the example's valley; any other pack keeps the "fill in your
// profile" prompt, since an example home outside its area would route nowhere.
export function exampleHousehold(pack: CachePackContents | null): HouseholdProfile | null {
  if (!pack?.bbox) return null;
  const [south, west, north, east] = pack.bbox;
  const { lat, lon } = EXAMPLE_HOUSEHOLD.home;
  return lat >= south && lat <= north && lon >= west && lon <= east ? EXAMPLE_HOUSEHOLD : null;
}
