import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";

import { NodeTags } from "./NodeTags";
import type { NodeOnMap } from "./nodesOnMap";

const GAINESVILLE: [number, number] = [29.6516, -82.3248];

// Fits the Nodes once, so a resident who has panned or zoomed is never fought.
function FitToNodesOnce({ nodes }: { nodes: NodeOnMap[] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || nodes.length === 0) return;
    map.fitBounds(
      nodes.map((node) => node.position),
      { padding: [60, 60], maxZoom: 15 },
    );
    fitted.current = true;
  }, [map, nodes]);
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
        <FitToNodesOnce nodes={nodes} />
        {nodes.map((node) => {
          const selected = node.id === selectedId;
          // Leaflet fixes a path's class when it is created, so a state change remounts the marker.
          const state = `${node.stale ? "stale" : "fresh"} ${selected ? "selected" : ""}`;
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
