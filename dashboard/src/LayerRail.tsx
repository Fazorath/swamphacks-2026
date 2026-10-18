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

import type { PanelName } from "./openPanels";
import type { WeatherLayer } from "./weatherLayer";
import { WeatherPicker } from "./WeatherPicker";

export type MapLayerName =
  "nodes" | "fleet" | "flood-prone" | "shelters" | "route" | "storm-signal";

type Button = {
  label: string;
  icon: LucideIcon;
  on: boolean;
  count: number | null;
  onPress: () => void;
};

type Props = {
  hiddenLayers: MapLayerName[];
  openPanels: PanelName[];
  registeredNodes: number;
  openShelters: number;
  fleetNodes: number;
  playingCameras: number;
  onToggleLayer: (layer: MapLayerName) => void;
  onTogglePanel: (panel: PanelName) => void;
  weatherLayer: WeatherLayer;
  onChooseWeather: (layer: WeatherLayer) => void;
};

export function LayerRail({
  hiddenLayers,
  openPanels,
  registeredNodes,
  openShelters,
  fleetNodes,
  playingCameras,
  onToggleLayer,
  onTogglePanel,
  weatherLayer,
  onChooseWeather,
}: Props) {
  const layer = (
    label: string,
    icon: LucideIcon,
    name: MapLayerName,
    count: number | null,
  ): Button => ({
    label,
    icon,
    on: !hiddenLayers.includes(name),
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
    layer("Fleet", Network, "fleet", fleetNodes),
    panel("Readings", Gauge, "readings", null),
    layer("Flood-Prone Areas", Waves, "flood-prone", null),
    layer("Shelters", Home, "shelters", openShelters),
    layer("Route", Route, "route", null),
    layer("Storm Signal", CloudRain, "storm-signal", null),
    panel("Alerts", TriangleAlert, "alerts", null),
    panel("Cameras", Camera, "cameras", playingCameras),
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
      <WeatherPicker layer={weatherLayer} onChoose={onChooseWeather} />
    </nav>
  );
}
