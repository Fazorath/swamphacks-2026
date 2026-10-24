import type { Shelter } from "./evacuationPlan";

const FLOOD_PRONE_CAPTIONS = {
  river: "Flood-Prone Area: hand-drawn, approximate",
  coast: "Flood-Prone Area: traced from the terrain, approximate",
};

export function floodProneCaption(waterType: "river" | "coast"): string {
  return FLOOD_PRONE_CAPTIONS[waterType];
}

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
