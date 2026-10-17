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
      {readings.map((reading) => (
        <ul key={reading.t}>
          {measurements(reading).map(([label, text]) => (
            <li key={label}>
              {label}: {text}
              {reading.sim && <span className="simulated"> (simulated)</span>}
            </li>
          ))}
        </ul>
      ))}
      <button onClick={() => post("/api/scenario/step")}>Step scenario (n)</button>{" "}
      <button onClick={() => post("/api/scenario/reset")}>Reset (r)</button>
    </section>
  );
}
