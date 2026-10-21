import { useCallback, useEffect, useState } from "react";

export const SANDBOX_POLL_MS = 1000;

// One Node as the Sandbox's Hub lists it (GET /api/sandbox/nodes).
export type SandboxNode = {
  id: string;
  name: string;
  role: "sensor" | "hub";
  // The true spot the radio range is measured from.
  position: [number, number];
  // The Nodes within radio range of this one.
  links: string[];
  // Radio hops to the Hub; null when no chain of Nodes reaches it.
  hops: number | null;
  // Whether this Node has the newest Community Warning the Hub sent.
  heard_warning: boolean;
};

export type SandboxNodes = { radio_range_m: number; nodes: SandboxNode[] };

export type SandboxFeed = {
  // Null before the first answer, and while the page is not in the Sandbox.
  sandbox: SandboxNodes | null;
  setRadioRange: (metres: number) => Promise<void>;
};

async function ask(path: string, init?: RequestInit): Promise<SandboxNodes> {
  const response = await fetch(path, init);
  if (!response.ok) {
    const { detail } = await response.json().catch(() => ({ detail: undefined }));
    throw new Error(typeof detail === "string" ? detail : `Node API returned ${response.status}`);
  }
  return response.json();
}

// Polls the Sandbox's Node list while `inSandbox`. Setting the range shows the new radius at once
// and then the Hub's answer, so the circles and links follow the slider without waiting for a poll.
export function useSandboxNodes(inSandbox: boolean): SandboxFeed {
  const [sandbox, setSandbox] = useState<SandboxNodes | null>(null);
  useEffect(() => {
    if (!inSandbox) return;
    let stopped = false;
    const poll = () =>
      ask("/api/sandbox/nodes")
        .then((answer) => {
          if (!stopped) setSandbox(answer);
        })
        .catch((error) => console.error(error));
    void poll();
    const timer = setInterval(poll, SANDBOX_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
      setSandbox(null);
    };
  }, [inSandbox]);

  const setRadioRange = useCallback(async (metres: number) => {
    setSandbox((current) => current && { ...current, radio_range_m: metres });
    const answer = await ask("/api/sandbox/radio-range", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ radio_range_m: metres }),
    });
    setSandbox(answer);
  }, []);

  return { sandbox: inSandbox ? sandbox : null, setRadioRange };
}
