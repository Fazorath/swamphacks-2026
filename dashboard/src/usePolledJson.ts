import { useEffect, useState } from "react";

export const POLL_EVERY_MS = 3000;

// Keeps the last answer when a poll fails: saying the Node is unreachable belongs to the
// one-second state snapshot (0019), which replaces this.
export function usePolledJson<T>(path: string): T | null {
  const [latest, setLatest] = useState<T | null>(null);
  useEffect(() => {
    let stopped = false;
    const poll = () =>
      fetch(path)
        .then((response) => {
          if (!response.ok) throw new Error(`${path} returned ${response.status}`);
          return response.json();
        })
        .then((body) => {
          if (!stopped) setLatest(body);
        })
        .catch((error) => console.error(error));
    poll();
    const timer = setInterval(poll, POLL_EVERY_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [path]);
  return latest;
}
