import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";

import { NodeTags } from "./NodeTags";
import type { NodeOnMap } from "./nodesOnMap";

const GAINESVILLE: [number, number] = [29.6516, -82.3248];

// This Node hears itself before it hears anyone else, so the view is re-framed as new Nodes
// appear, until the resident pans or zooms. After that it is never moved again.
function FitToNodesUntilMoved({ nodes }: { nodes: NodeOnMap[] }) {
  const map = useMap();
  const moved = useRef(false);
  const nodeIds = nodes.map((node) => node.id).join();

  useEffect(() => {
    const container = map.getContainer();
    const markMoved = () => (moved.current = true);
    container.addEventListener("pointerdown", markMoved);
    container.addEventListener("wheel", markMoved);
    return () => {
      container.removeEventListener("pointerdown", markMoved);
      container.removeEventListener("wheel", markMoved);
    };
  }, [map]);

  useEffect(() => {
    if (moved.current || nodeIds === "") return;
    map.fitBounds(
      nodeIds.split(",").map((id) => nodes.find((node) => node.id === id)!.position),
      { padding: [60, 60], maxZoom: 15 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-frame only when the set of Nodes changes
  }, [map, nodeIds]);
  return null;
}

type Props = {
  nodes: NodeOnMap[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function NodeMap({ nodes, selectedId, onSelect }: Props) {
  return (
    <section aria-label="Map">
      <MapContainer center={GAINESVILLE} zoom={13} className="node-map">
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <FitToNodesUntilMoved nodes={nodes} />
        {nodes.map((node) => {
          const selected = node.id === selectedId;
          // Leaflet fixes a path's class when it is created, so a state change remounts the marker.
          const state = [node.stale ? "stale" : "fresh", selected && "selected"]
            .filter(Boolean)
            .join(" ");
          return (
            <CircleMarker
              key={`${node.id} ${state}`}
              center={node.position}
              radius={selected ? 12 : 8}
              className={`node-dot ${state}`}
              eventHandlers={{ click: () => onSelect(node.id) }}
            >
              {/* An interactive tooltip bubbles its clicks to the marker, so only the marker listens. */}
              <Tooltip permanent interactive direction="right" className={`node-label ${state}`}>
                <strong>{node.label}</strong>
                {node.waterLevelCm !== null && ` · ${node.waterLevelCm} cm`}
                <NodeTags node={node} />
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </section>
  );
}
