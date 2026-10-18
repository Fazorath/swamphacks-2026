import type { NepalMap } from "./evacuationPlan";
import { SimulatedBadge } from "./SimulatedBadge";
import type { TerrainChoice } from "./terrain";

type Props = {
  simulated: number;
  real: number;
  nepal: NepalMap | null;
  // What the map shows now; a frame-rate drop makes it "2d" without changing the saved choice.
  terrain: TerrainChoice;
  onChooseTerrain: (choice: TerrainChoice) => void;
  onFlyToValley: () => void;
};

// A key to the markers, small enough to stay out of the way. Its last row is the 2D | 3D switch
// (D-34) and the Valley button, which flies the camera to the valley.
export function MapLegend({
  simulated,
  real,
  nepal,
  terrain,
  onChooseTerrain,
  onFlyToValley,
}: Props) {
  const terrainAvailable = nepal !== null;
  return (
    <aside className="map-legend" aria-label="Legend">
      <ul>
        <li>
          <span className="legend-dot calm" /> Healthy Node
        </li>
        <li>
          <span className="legend-dot real" /> Real Node (REAL)
        </li>
        <li>
          <span className="legend-dot stale" /> Stale, not heard for 15 s
        </li>
        <li>
          <span className="legend-dot wave" /> Wave passing
        </li>
      </ul>
      {simulated > 0 && <SimulatedBadge simulated={simulated} real={real} nepal={nepal} />}
      <div className="terrain-row">
        <div className="terrain-switch" role="group" aria-label="Terrain">
          {(["2d", "3d"] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={terrainAvailable && terrain === choice}
              disabled={!terrainAvailable}
              onClick={() => onChooseTerrain(choice)}
            >
              {choice === "2d" ? "2D" : "3D"}
            </button>
          ))}
        </div>
        <button type="button" className="valley-button" onClick={onFlyToValley}>
          Valley
        </button>
      </div>
      {!terrainAvailable && (
        <p className="terrain-reason">3D needs a Cache Pack with elevation tiles</p>
      )}
    </aside>
  );
}
