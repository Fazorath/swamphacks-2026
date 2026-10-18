import { MAP_LAYERS, type MapLayerName, type MapLayers } from "./mapLayers";

type Props = {
  layers: MapLayers;
  onToggle: (name: MapLayerName) => void;
  // Shown beside a layer's name where a count applies (D-41: the Fleet button carries its count).
  counts: Partial<Record<MapLayerName, number>>;
};

export function MapLayerButtons({ layers, onToggle, counts }: Props) {
  return (
    <div className="layer-buttons" role="group" aria-label="Map layers">
      {MAP_LAYERS.map(({ name, label }) => (
        <button key={name} type="button" aria-pressed={layers[name]} onClick={() => onToggle(name)}>
          {label}
          {counts[name] !== undefined && <span className="layer-count">{counts[name]}</span>}
        </button>
      ))}
    </div>
  );
}
