import { useCallback, useEffect, useRef, useState } from "react";

import type { NodeState } from "./nodeState";

export const STATE_POLL_MS = 1000;
const REQUEST_TIMEOUT_MS = 2000;

type NodeStateFeed = {
  // Null until the first answer; a failed poll keeps the last answer.
  state: NodeState | null;
  // Polls now, e.g. after a Scenario button, so the screen shows the change without waiting.
  refresh: () => void;
};

// Chained timeouts, not an interval: the next poll starts only after the last one has ended.
export function useNodeState(): NodeStateFeed {
  const [state, setState] = useState<NodeState | null>(null);
  const pollNow = useRef<() => void>(() => {});
  useEffect(() => {
    let stopped = false;
    let polling = false;
    let askedWhilePolling = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      clearTimeout(timer);
      polling = true;
      const startedAt = Date.now();
      try {
        const response = await fetch("/api/state", {
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (!response.ok) throw new Error(`Node API returned ${response.status}`);
        const answer: NodeState = await response.json();
        if (!stopped) setState(answer);
      } catch (error) {
        console.error(error);
      }
      polling = false;
      if (stopped) return;
      if (askedWhilePolling) {
        // The answer that just arrived may predate the change the caller made.
        askedWhilePolling = false;
        void poll();
      } else {
        timer = setTimeout(poll, Math.max(0, STATE_POLL_MS - (Date.now() - startedAt)));
      }
    };

    pollNow.current = () => {
      if (polling) askedWhilePolling = true;
      else void poll();
    };
    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);
  const refresh = useCallback(() => pollNow.current(), []);
  return { state, refresh };
}
