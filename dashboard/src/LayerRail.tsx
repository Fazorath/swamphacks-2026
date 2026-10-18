import {
  Camera,
  CloudRain,
  Gauge,
  Home,
  Network,
  Radio,
  Route,
  TriangleAlert,
  Waves,
  type LucideIcon,
} from "lucide-react";

import type { MapLayerName, MapLayers } from "./mapLayers";
import type { PanelName } from "./openPanels";

type Button = {
  label: string;
  icon: LucideIcon;
  on: boolean;
  count: number | null;
  onPress: () => void;
};

type Props = {
  layers: MapLayers;
  openPanels: PanelName[];
  registeredNodes: number;
  simulatedNodes: number;
  openShelters: number;
  liveCameras: number;
  onToggleLayer: (layer: MapLayerName) => void;
  onTogglePanel: (panel: PanelName) => void;
};

export function LayerRail({
  layers,
  openPanels,
  registeredNodes,
  simulatedNodes,
  openShelters,
  liveCameras,
  onToggleLayer,
  onTogglePanel,
}: Props) {
  const layer = (
    label: string,
    icon: LucideIcon,
    name: MapLayerName,
    count: number | null,
  ): Button => ({
    label,
    icon,
    on: layers[name],
    count,
    onPress: () => onToggleLayer(name),
  });
  const panel = (
    label: string,
    icon: LucideIcon,
    name: PanelName,
    count: number | null,
  ): Button => ({
    label,
    icon,
    on: openPanels.includes(name),
    count,
    onPress: () => onTogglePanel(name),
  });
  const buttons = [
    layer("Nodes", Radio, "nodes", registeredNodes),
    layer("Fleet", Network, "fleet", simulatedNodes),
    panel("Readings", Gauge, "readings", null),
    layer("Flood-Prone Areas", Waves, "floodProne", null),
    layer("Shelters", Home, "shelters", openShelters),
    layer("Route", Route, "route", null),
    layer("Storm Signal", CloudRain, "stormSignal", null),
    panel("Alerts", TriangleAlert, "alerts", null),
    panel("Cameras", Camera, "cameras", liveCameras),
  ];
  return (
    <nav aria-label="Layers" className="layer-rail">
      {buttons.map(({ label, icon: Icon, on, count, onPress }) => (
        <button
          key={label}
          type="button"
          className={on ? "rail-button on" : "rail-button"}
          aria-pressed={on}
          aria-label={count === null ? label : `${label}, ${count}`}
          title={label}
          onClick={onPress}
        >
          <Icon size={20} aria-hidden="true" />
          {count !== null && <span className="rail-badge">{count}</span>}
        </button>
      ))}
    </nav>
  );
}
