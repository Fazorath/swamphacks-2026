import "leaflet/dist/leaflet.css";

import { divIcon } from "leaflet";
import { useEffect, useRef } from "react";
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { NodeTags } from "./NodeTags";
import type { Home } from "./householdProfile";
import type { NodeOnMap } from "./nodesOnMap";

const GAINESVILLE: [number, number] = [29.6516, -82.3248];

const DRAFT_HOME_ICON = divIcon({ className: "home-draft-marker", html: "⌂", iconSize: [28, 28] });
const HOME_ICON = divIcon({ className: "home-marker", html: "⌂", iconSize: [28, 28] });

function PickHomeOnClick({ onPick }: { onPick: (home: Home) => void }) {
  useMapEvents({ click: (event) => onPick({ lat: event.latlng.lat, lon: event.latlng.lng }) });
  return null;
}

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
  home: Home | null;
  // The unsaved spot being chosen in the form; the saved Home is `home`.
  draftHome: Home | null;
  picking: boolean;
  onPickHome: (home: Home) => void;
  onDonePicking: () => void;
};

export function NodeMap({
  nodes,
  selectedId,
  onSelect,
  home,
  draftHome,
  picking,
  onPickHome,
  onDonePicking,
}: Props) {
  return (
    <section aria-label="Map">
      {picking && (
        <div className="pick-banner">
          Tap the map to place your home
          <button type="button" onClick={onDonePicking}>
            Done
          </button>
        </div>
      )}
      <MapContainer
        center={GAINESVILLE}
        zoom={13}
        className={picking ? "node-map picking" : "node-map"}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <FitToNodesUntilMoved nodes={nodes} />
        {picking && <PickHomeOnClick onPick={onPickHome} />}
        {draftHome && (
          <Marker
            position={[draftHome.lat, draftHome.lon]}
            icon={DRAFT_HOME_ICON}
            interactive={false}
          />
        )}
        {home && <Marker position={[home.lat, home.lon]} icon={HOME_ICON} interactive={false} />}
        {nodes.map((node) => {
          const selected = node.id === selectedId;
          // Leaflet fixes a path's class when it is created, so a state change remounts the marker.
          const state = [
            node.stale ? "stale" : "fresh",
            selected && "selected",
            picking && "picking",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <CircleMarker
              key={`${node.id} ${state}`}
              center={node.position}
              radius={selected ? 12 : 8}
              className={`node-dot ${state}`}
              interactive={!picking}
              eventHandlers={{ click: () => onSelect(node.id) }}
            >
              {/* An interactive tooltip bubbles its clicks to the marker, so only the marker listens. */}
              <Tooltip
                permanent
                interactive={!picking}
                direction="right"
                className={`node-label ${state}`}
              >
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
