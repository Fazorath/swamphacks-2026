import { useCallback, useEffect, useRef, useState } from "react";

import type { NodeState } from "./nodeState";

export const STATE_POLL_MS = 1000;
const REQUEST_TIMEOUT_MS = 2000;
// Long enough for a Wi-Fi blip to reconnect before the resident is warned.
const UNREACHABLE_AFTER_MS = 5000;

type Connection = "connecting" | "connected" | "unreachable";

type NodeStateFeed = {
  // Null before the first answer and while unreachable, so nothing live is ever shown frozen.
  state: NodeState | null;
  // Kept while unreachable, for what an old answer can still say truthfully: the Node's name and
  // role, and Official Alerts, which carry their own issue time.
  lastAnswer: { state: NodeState; at: number } | null;
  connection: Connection;
  // Polls now, e.g. after a Scenario button, so the screen shows the change without waiting.
  refresh: () => void;
};

// Chained timeouts, not an interval: the next poll starts only after the last one has ended.
export function useNodeState(): NodeStateFeed {
  const [lastAnswer, setLastAnswer] = useState<NodeStateFeed["lastAnswer"]>(null);
  const [connection, setConnection] = useState<Connection>("connecting");
  const pollNow = useRef<() => void>(() => {});
  useEffect(() => {
    let stopped = false;
    let polling = false;
    let askedWhilePolling = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Before any answer the wait counts from when polling began.
    let lastGoodAt = Date.now();

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
        lastGoodAt = Date.now();
        if (!stopped) {
          setLastAnswer({ state: answer, at: lastGoodAt });
          setConnection("connected");
        }
      } catch (error) {
        console.error(error);
        if (!stopped && Date.now() - lastGoodAt >= UNREACHABLE_AFTER_MS) {
          setConnection("unreachable");
        }
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
      if (stopped) return;
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
  const state = connection === "connected" ? (lastAnswer?.state ?? null) : null;
  return { state, lastAnswer, connection, refresh };
}
