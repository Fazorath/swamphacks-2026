import { useState } from "react";

export const MAP_LAYERS = [
  { name: "nodes", label: "Nodes" },
  { name: "fleet", label: "Fleet" },
  { name: "floodProne", label: "Flood-Prone Areas" },
  { name: "shelters", label: "Shelters" },
  { name: "route", label: "Route" },
  { name: "stormSignal", label: "Storm Signal" },
] as const;

export type MapLayerName = (typeof MAP_LAYERS)[number]["name"];
export type MapLayers = Record<MapLayerName, boolean>;

const ALL_ON: MapLayers = {
  nodes: true,
  fleet: true,
  floodProne: true,
  shelters: true,
  route: true,
  stormSignal: true,
};

export function useMapLayers(): [MapLayers, (name: MapLayerName) => void] {
  const [layers, setLayers] = useState(ALL_ON);
  const toggle = (name: MapLayerName) => setLayers((on) => ({ ...on, [name]: !on[name] }));
  return [layers, toggle];
}
