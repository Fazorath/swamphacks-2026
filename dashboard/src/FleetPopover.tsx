import type { NodeOnMap } from "./nodesOnMap";
import { KIND_LABELS } from "./readingKinds";

// A Simulated Fleet Node's readings, floating beside its dot (D-38). The Readings Panel has no
// card for a fleet Node, so this is the only place its numbers are written out.
export function FleetPopover({ node, onClose }: { node: NodeOnMap; onClose: () => void }) {
  return (
    <aside
      role="dialog"
      aria-label={`Fleet Node ${node.label}`}
      className="fleet-popover"
      data-marker-ignore
    >
      <h3>
        {node.label}
        <span className="tag simulated">SIMULATED</span>
        {node.stale && <span className="tag stale">STALE</span>}
      </h3>
      <ul>
        {node.measurements.map((measurement) => (
          <li key={measurement.kind}>
            {KIND_LABELS[measurement.kind]}: {measurement.value} {measurement.unit}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </aside>
  );
}
