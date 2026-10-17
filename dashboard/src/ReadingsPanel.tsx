import { Fragment, useEffect } from "react";

import { FloodRiskCard } from "./FloodRiskPanel";
import { NodeTags } from "./NodeTags";
import type { NodeOnMap } from "./nodesOnMap";
import type { FloodRisk, ReadingKind } from "./nodeState";

const KIND_LABELS: Record<ReadingKind, string> = {
  pressure: "Pressure",
  rain_rate: "Rain rate",
  water_level: "Water level",
  soil_moisture: "Soil moisture",
};

function post(path: string, afterPost: () => void) {
  fetch(path, { method: "POST" })
    .then((response) => {
      if (!response.ok) throw new Error(`${path} returned ${response.status}`);
      afterPost();
    })
    .catch(console.error);
}

type Props = {
  nodes: NodeOnMap[];
  floodRisk: FloodRisk | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onScenarioChanged: () => void;
};

export function ReadingsPanel({
  nodes,
  floodRisk,
  selectedId,
  onSelect,
  onScenarioChanged,
}: Props) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "n") post("/api/scenario/step", onScenarioChanged);
      if (event.key === "r") post("/api/scenario/reset", onScenarioChanged);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onScenarioChanged]);

  const firstNotCountedId = nodes.find((node) => !node.registered && !node.isThisNode)?.id;

  return (
    <section aria-label="Readings">
      <h2>Readings</h2>
      <FloodRiskCard floodRisk={floodRisk} />
      {nodes.map((node) => (
        <Fragment key={node.id}>
          {node.id === firstNotCountedId && <p className="not-counted-divider">Not counted</p>}
          <section
            aria-label={`Node ${node.label}`}
            aria-current={node.id === selectedId}
            className={["node-card", node.stale && "stale", !node.registered && "unverified"]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onSelect(node.id)}
          >
            <h3>
              {/* Clicks reach the card; the button only makes the card reachable by keyboard. */}
              <button>{node.label}</button>
              <NodeTags node={node} />
            </h3>
            <ul>
              {node.measurements.map((measurement) => (
                <li key={measurement.kind}>
                  {KIND_LABELS[measurement.kind]}: {measurement.value} {measurement.unit}
                </li>
              ))}
            </ul>
          </section>
        </Fragment>
      ))}
      <button onClick={() => post("/api/scenario/step", onScenarioChanged)}>
        Step scenario (n)
      </button>{" "}
      <button onClick={() => post("/api/scenario/reset", onScenarioChanged)}>Reset (r)</button>
    </section>
  );
}
