import { useState } from "react";

import { FloodRiskChip } from "./FloodRiskPanel";
import { NodeMap } from "./NodeMap";
import { nodesOnMap } from "./nodesOnMap";
import { ReadingsPanel } from "./ReadingsPanel";
import { useFloodRisk } from "./useFloodRisk";
import { useNodeIdentity } from "./useNodeIdentity";
import { useReadings } from "./useReadings";

const ROLE_LABELS = { sensor: "Sensor Node", hub: "Hub" } as const;

const PLACEHOLDER_AREAS = ["Alerts", "Evacuation Plan"];

export function App() {
  const { identity, failed } = useNodeIdentity();
  const floodRisk = useFloodRisk();
  const nodes = nodesOnMap(useReadings(), identity, floodRisk?.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toggleSelected = (id: string) => setSelectedId((current) => (current === id ? null : id));
  return (
    <main>
      <header>
        <h1>Storm Shield</h1>
        <p>
          {identity
            ? `${identity.name} · ${ROLE_LABELS[identity.role]}`
            : failed
              ? "Node unreachable"
              : "Connecting…"}
        </p>
        <FloodRiskChip floodRisk={floodRisk} />
      </header>
      <div className="areas">
        <ReadingsPanel
          nodes={nodes}
          floodRisk={floodRisk}
          selectedId={selectedId}
          onSelect={toggleSelected}
        />
        <NodeMap
          nodes={nodes}
          selectedId={selectedId}
          onSelect={toggleSelected}
          stormSignal={floodRisk?.storm_signal ?? null}
        />
        {PLACEHOLDER_AREAS.map((title) => (
          <section key={title} aria-label={title}>
            <h2>{title}</h2>
            <p>Coming soon</p>
          </section>
        ))}
      </div>
    </main>
  );
}
