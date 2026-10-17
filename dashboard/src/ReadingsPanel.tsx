import { useEffect } from "react";

import { NodeTags } from "./NodeTags";
import type { NodeOnMap } from "./nodesOnMap";
import type { Reading } from "./useReadings";

const KIND_LABELS: Record<Reading["kind"], string> = {
  pressure: "Pressure",
  rain_rate: "Rain rate",
  water_level: "Water level",
  soil_moisture: "Soil moisture",
};

function post(path: string) {
  fetch(path, { method: "POST" }).catch(console.error);
}

type Props = {
  nodes: NodeOnMap[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function ReadingsPanel({ nodes, selectedId, onSelect }: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "n") post("/api/scenario/step");
      if (event.key === "r") post("/api/scenario/reset");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section aria-label="Readings">
      <h2>Readings</h2>
      {nodes.map((node) => (
        <section
          key={node.id}
          aria-label={`Node ${node.label}`}
          aria-current={node.id === selectedId}
          className={node.stale ? "node-card stale" : "node-card"}
          onClick={() => onSelect(node.id)}
        >
          <h3>
            {/* Clicks reach the card; the button only makes the card reachable by keyboard. */}
            <button>{node.label}</button>
            <NodeTags node={node} />
          </h3>
          <ul>
            {node.readings.map((reading) => (
              <li key={reading.kind}>
                {KIND_LABELS[reading.kind]}: {reading.value} {reading.unit}
              </li>
            ))}
          </ul>
        </section>
      ))}
      <button onClick={() => post("/api/scenario/step")}>Step scenario (n)</button>{" "}
      <button onClick={() => post("/api/scenario/reset")}>Reset (r)</button>
    </section>
  );
}
