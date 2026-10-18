import type { NepalMap } from "./evacuationPlan";
import { SimulatedBadge } from "./SimulatedBadge";

type Props = { simulated: number; real: number; nepal: NepalMap | null };

// A key to the markers, small enough to stay out of the way. The 2D / 3D switch joins it as its
// last row with the terrain (0067).
export function MapLegend({ simulated, real, nepal }: Props) {
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
    </aside>
  );
}
