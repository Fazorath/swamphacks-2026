import { useEffect } from "react";

import { useReadings, type Reading } from "./useReadings";

function measurements(reading: Reading): [label: string, text: string][] {
  return [
    ["Pressure", `${reading.pressure_hpa} hPa`],
    ["Rain rate", `${reading.rain_mmh} mm/h`],
    ["Water level", `${reading.water_m} m`],
    ["Soil moisture", `${reading.soil_pct} %`],
  ];
}

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
