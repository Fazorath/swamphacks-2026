import { divIcon } from "leaflet";
import type { ComponentProps } from "react";
import { GeoJSON, Marker, Tooltip } from "react-leaflet";

import type { Shelter } from "./evacuationPlan";
import type { FloodProneAreas } from "./floodProne";

// The pack's file is plain GeoJSON, which FloodProneAreas narrows to what the plan reads.
type GeoJSONData = ComponentProps<typeof GeoJSON>["data"];

export const FLOOD_PRONE_CAPTION = "Flood-Prone Area: hand-drawn, approximate";

const CHOSEN_ICON = divIcon({ className: "shelter-marker", html: "+", iconSize: [28, 28] });
const OUT_OF_REACH_ICON = divIcon({
  className: "shelter-marker out-of-reach",
  html: "+",
  iconSize: [28, 28],
});
const OPEN_ICON = divIcon({ className: "shelter-pin", html: "+", iconSize: [22, 22] });
const CLOSED_ICON = divIcon({ className: "shelter-pin closed", html: "+", iconSize: [22, 22] });

function shelterLabel(shelter: Shelter, open: boolean, outOfReach: boolean): string {
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

// What the Cache Pack holds, drawn from the Node's own disk so it shows with no internet.
export function PackLayers({
  shelters,
  openShelterIds,
  chosenShelterId,
  outOfReachShelterId,
  floodProne,
}: {
  shelters: Shelter[];
  openShelterIds: string[];
  // The Shelter the Evacuation Plan picked, drawn apart from the rest.
  chosenShelterId: string | null;
  // The closest one when none can be reached before the wave; drawn dashed and labelled as such.
  outOfReachShelterId: string | null;
  floodProne: FloodProneAreas | null;
}) {
  return (
    <>
      {floodProne && (
        <GeoJSON
          data={floodProne as unknown as GeoJSONData}
          style={{ className: "flood-prone-area", dashArray: "6 4" }}
          interactive={false}
        />
      )}
      {shelters.map((shelter) => {
        const open = openShelterIds.includes(shelter.id);
        const chosen = shelter.id === chosenShelterId;
        const outOfReach = shelter.id === outOfReachShelterId;
        const icon = chosen
          ? CHOSEN_ICON
          : outOfReach
            ? OUT_OF_REACH_ICON
            : open
              ? OPEN_ICON
              : CLOSED_ICON;
        // Leaflet fixes an icon's class when the marker is created, so a state change remounts it.
        return (
          <Marker
            key={`${shelter.id} ${open} ${chosen} ${outOfReach}`}
            position={shelter.pos}
            icon={icon}
            interactive={false}
          >
            <Tooltip permanent interactive={false} direction="right" className="shelter-label">
              {shelterLabel(shelter, open, outOfReach)}
            </Tooltip>
          </Marker>
        );
      })}
    </>
  );
}
