import type { Shelter } from "./evacuationPlan";

export const FLOOD_PRONE_CAPTION = "Flood-Prone Area: hand-drawn, approximate";

export function shelterLabel(shelter: Shelter, open: boolean): string {
  return [
    shelter.name,
    shelter.special_needs && "special needs",
    shelter.pet_friendly && "pets",
    !open && "Closed",
  ]
    .filter(Boolean)
    .join(" · ");
}
