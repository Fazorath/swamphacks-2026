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
  // The wave front passed this Node in the last two event minutes (D-18): wave-white, then its
  // real state again.
  wavePassed?: boolean;
  // How many times this Node's Flood Risk has risen; a new count plays the ring once.
  rises: number;
  // The key of the warning this Node started, while it is shown: the Node rings red (D-28).
  originOf?: string;
  onSelect: (id: string) => void;
  // Where the label sits, and whether it lost its spot to a more important one (0078).
  side: Side;
  labelHidden: boolean;
};

// One Node on the map. It updates in place on every poll: React changes the class and the text,
// and MapMarker keeps the same element on the map until the Node's position changes.
export function NodeMarker({
  map,
  node,
  selected,
  wavePassed = false,
  rises,
  originOf,
  onSelect,
  side,
  labelHidden,
}: Props) {
  const { appearance, glowPx, contactArc } = markerState(node);
  const real = !node.simulated;
  const classes = [
    "node-marker",
    "valley",
    real ? "real" : "simulated",
    appearance,
    contactArc !== null && "contact-lost",
    selected && "selected",
    wavePassed && "wave-passed",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <MapMarker
      map={map}
      lat={node.position[0]}
      lon={node.position[1]}
      className={classes}
      onClick={() => onSelect(node.id)}
    >
      {originOf !== undefined && <span key={originOf} className="origin-ring" />}
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
      <span className={`map-label node-label label-${side}${labelHidden ? " label-hidden" : ""}`}>
        <strong>{node.label}</strong>
        {node.waterLevelCm !== null && (
          <span className={node.stale ? "water-level struck" : "water-level"}>
            {" · "}
            {node.waterLevelCm} cm
          </span>
        )}
        <span className="node-label-extra">
          <NodeTags node={node} />
        </span>
        {contactArc !== null && <span className="tag contact-lost">CONTACT LOST</span>}
        {real && <span className="tag real">REAL</span>}
      </span>
    </MapMarker>
  );
}
