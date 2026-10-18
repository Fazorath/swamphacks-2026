import { X } from "lucide-react";

import { NodeTags } from "./NodeTags";
import type { NodeOnMap } from "./nodesOnMap";
import { KIND_LABELS } from "./ReadingsPanel";

// The phone's peek at the selected Node, where the desktop highlights its card instead.
export function NodeSheet({ node, onClose }: { node: NodeOnMap; onClose: () => void }) {
  return (
    <section aria-label={`Selected Node ${node.label}`} className="node-sheet">
      <div className="node-sheet-head">
        <h2>{node.label}</h2>
        <NodeTags node={node} />
        <button type="button" aria-label="Close Node sheet" onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <ul>
        {node.measurements.map((measurement) => (
          <li key={measurement.kind}>
            {KIND_LABELS[measurement.kind]}: {measurement.value} {measurement.unit}
          </li>
        ))}
      </ul>
    </section>
  );
}
