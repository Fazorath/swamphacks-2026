import { useEffect, useState } from "react";

export type Reading = {
  t: number;
  sim: boolean;
  pressure_hpa: number;
  water_m: number;
  rain_mmh: number;
  soil_pct: number;
};

const POLL_MS = 1000;

export function useReadings(): Reading[] {
  const [readings, setReadings] = useState<Reading[]>([]);
  useEffect(() => {
    const poll = () =>
      fetch("/api/readings")
        .then((response) => {
          if (!response.ok) throw new Error(`Node API returned ${response.status}`);
          return response.json();
        })
        .then(setReadings)
        .catch(console.error);
    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => clearInterval(timer);
  }, []);
  return readings;
}
