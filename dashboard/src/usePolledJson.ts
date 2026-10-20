import { useEffect, useState } from "react";

export const POLL_EVERY_MS = 3000;

// Keeps the last answer when a poll fails. The Event clock and Replay controls use
// it; what this Node knows about the Mesh comes from useNodeState. A null path stops polling and
// drops the last answer, so it is never shown again as if it were current.
export function usePolledJson<T>(path: string | null, everyMs = POLL_EVERY_MS): T | null {
  const [latest, setLatest] = useState<T | null>(null);
  useEffect(() => {
    if (path === null) return;
    let stopped = false;
    // An identical answer is not stored again, so a quiet poll re-renders nothing.
    let lastBody = "";
    const poll = () =>
      fetch(path)
        .then((response) => {
          if (!response.ok) throw new Error(`${path} returned ${response.status}`);
          return response.text();
        })
        .then((body) => {
          if (stopped || body === lastBody) return;
          lastBody = body;
          setLatest(JSON.parse(body));
        })
        .catch((error) => console.error(error));
    poll();
    const timer = setInterval(poll, everyMs);
    return () => {
      stopped = true;
      lastBody = "";
      clearInterval(timer);
      setLatest(null);
    };
  }, [path, everyMs]);
  return latest;
}
