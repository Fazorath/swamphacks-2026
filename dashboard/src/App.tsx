import { useState } from "react";

import { NodeMap } from "./NodeMap";
import { nodesOnMap } from "./nodesOnMap";
import { ReadingsPanel } from "./ReadingsPanel";
import { useNodeIdentity } from "./useNodeIdentity";
import { useReadings } from "./useReadings";

const ROLE_LABELS = { sensor: "Sensor Node", hub: "Hub" } as const;

const PLACEHOLDER_AREAS = ["Alerts", "Evacuation Plan"];

export function App() {
  const { identity, failed } = useNodeIdentity();
  const nodes = nodesOnMap(useReadings(), identity);
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
      </header>
      <div className="areas">
        <ReadingsPanel nodes={nodes} selectedId={selectedId} onSelect={setSelectedId} />
        <NodeMap nodes={nodes} selectedId={selectedId} onSelect={setSelectedId} />
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
