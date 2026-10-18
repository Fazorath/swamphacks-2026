import type { Shelter } from "./evacuationPlan";

export const FLOOD_PRONE_CAPTION = "Flood-Prone Area: hand-drawn, approximate";

export function shelterLabel(shelter: Shelter, open: boolean, outOfReach = false): string {
  return [
    shelter.name,
    outOfReach && "Can't reach in time: head uphill toward it",
    shelter.special_needs && "special needs",
    shelter.pet_friendly && "pets",
    !open && "Closed",
  ]
    .filter(Boolean)
    .join(" · ");
}
