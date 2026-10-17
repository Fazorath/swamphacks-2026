import { useEffect, useState } from "react";

export const POLL_EVERY_MS = 3000;

// Keeps the last answer when a poll fails. Camera tiles, the Event clock and Replay controls use
// it; what this Node knows about the Mesh comes from useNodeState. A null path stops polling and
// drops the last answer, so it is never shown again as if it were current.
export function usePolledJson<T>(path: string | null, everyMs = POLL_EVERY_MS): T | null {
  const [latest, setLatest] = useState<T | null>(null);
  useEffect(() => {
    if (path === null) return;
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
    const timer = setInterval(poll, everyMs);
    return () => {
      stopped = true;
      clearInterval(timer);
      setLatest(null);
    };
  }, [path, everyMs]);
  return latest;
}
