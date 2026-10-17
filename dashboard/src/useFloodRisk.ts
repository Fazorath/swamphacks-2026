import { useEffect, useState } from "react";

export type FloodRisk = {
  level: "low" | "elevated" | "high";
  reasons: { code: string; nodes: string[]; text: string }[];
  storm_signal: { falling: boolean; text: string };
};

const POLL_EVERY_MS = 1000;

export function useFloodRisk(): FloodRisk | null {
  const [floodRisk, setFloodRisk] = useState<FloodRisk | null>(null);
  useEffect(() => {
    const poll = () =>
      fetch("/api/flood-risk")
        .then((response) => {
          if (!response.ok) throw new Error(`Node API returned ${response.status}`);
          return response.json();
        })
        .then(setFloodRisk)
        .catch((error) => {
          console.error(error);
          // A stale level on screen would look current.
          setFloodRisk(null);
        });
    poll();
    const timer = setInterval(poll, POLL_EVERY_MS);
    return () => clearInterval(timer);
  }, []);
  return floodRisk;
}
