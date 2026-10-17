import { useEffect, useState } from "react";

export type Reading = {
  node: string;
  kind: "pressure" | "rain_rate" | "water_level" | "soil_moisture";
  value: number;
  unit: string;
  timestamp: string;
  simulated: boolean;
};

export function useReadings(): Reading[] {
  const [readings, setReadings] = useState<Reading[]>([]);
  useEffect(() => {
    const events = new EventSource("/api/readings/stream");
    events.onmessage = (event) => setReadings(JSON.parse(event.data));
    return () => events.close();
  }, []);
  return readings;
}
