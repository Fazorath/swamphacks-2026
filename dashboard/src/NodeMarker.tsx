import type { Map as MapLibreMap } from "maplibre-gl";
import type { CSSProperties } from "react";

import type { Side } from "./labelPlacement";
import { MapMarker } from "./MapMarker";
import { markerState } from "./markerState";
import { NodeTags } from "./NodeTags";
import type { NodeOnMap } from "./nodesOnMap";

// The arc around the dot is a circle drawn with a dash: `pathLength` 1 makes "draining from full
// to empty" a plain 0 to 1 number.
const ARC_RADIUS = 9;

type Props = {
  map: MapLibreMap;
  node: NodeOnMap;
  selected: boolean;
  // How many times this Node's Flood Risk has risen; a new count plays the ring once.
  rises: number;
  // Where 0078 put the label beside the dot, or null when it lost its spot.
  labelSide: Side | null;
  onSelect: (id: string) => void;
};

// One Node on the map. It updates in place on every poll: React changes the class and the text,
// and MapMarker keeps the same element on the map until the Node's position changes.
export function NodeMarker({ map, node, selected, rises, labelSide, onSelect }: Props) {
  const { appearance, glowPx, contactArc } = markerState(node);
  const real = !node.simulated;
  const classes = [
    "node-marker",
    node.fleet ? "fleet" : "valley",
    real ? "real" : "simulated",
    appearance,
    contactArc !== null && "contact-lost",
    selected && "selected",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <MapMarker
      map={map}
      lat={node.position[0]}
      lon={node.position[1]}
      className={classes}
      onClick={node.fleet ? undefined : () => onSelect(node.id)}
    >
      {rises > 0 && <span key={rises} className="rise-ring" />}
      <span className="node-dot" style={{ "--glow": `${glowPx}px` } as CSSProperties}>
        {contactArc !== null && (
          <svg className="contact-arc" viewBox="-12 -12 24 24" aria-hidden="true">
            <circle
              r={ARC_RADIUS}
              pathLength={1}
              strokeDasharray={`${contactArc} 1`}
              transform="rotate(-90)"
            />
          </svg>
        )}
      </span>
      <span
        className={`map-label node-label label-${labelSide ?? "right"}${
          labelSide === null ? " label-hidden" : ""
        }`}
      >
        <strong>{node.label}</strong>
        {node.waterLevelCm !== null && (
          <span className={node.stale ? "water-level struck" : "water-level"}>
            {" · "}
            {node.waterLevelCm} cm
          </span>
        )}
        <NodeTags node={node} />
        {contactArc !== null && <span className="tag contact-lost">CONTACT LOST</span>}
        {real && <span className="tag real">REAL</span>}
      </span>
    </MapMarker>
  );
}
