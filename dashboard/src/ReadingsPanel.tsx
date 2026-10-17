import { useEffect } from "react";

import { useReadings, type Reading } from "./useReadings";

const KIND_LABELS: Record<Reading["kind"], string> = {
  pressure: "Pressure",
  rain_rate: "Rain rate",
  water_level: "Water level",
  soil_moisture: "Soil moisture",
};

function post(path: string) {
  fetch(path, { method: "POST" }).catch(console.error);
}

function groupByNode(readings: Reading[]): [string, Reading[]][] {
  const byNode = new Map<string, Reading[]>();
  for (const reading of readings) {
    byNode.set(reading.node, [...(byNode.get(reading.node) ?? []), reading]);
  }
  return [...byNode];
}

export function ReadingsPanel() {
  const readings = useReadings();

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
      {groupByNode(readings).map(([node, nodeReadings]) => (
        <section key={node} aria-label={`Node ${node}`}>
          <h3>{node}</h3>
          <ul>
            {nodeReadings.map((reading) => (
              <li key={reading.kind}>
                {KIND_LABELS[reading.kind]}: {reading.value} {reading.unit}
                {reading.simulated && <span className="simulated"> (simulated)</span>}
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
