import { useEffect, useState } from "react";

export type NodeIdentity = { id: string; name: string; role: "sensor" | "hub" };

export type NodeIdentityState = { identity: NodeIdentity | null; failed: boolean };

export function useNodeIdentity(): NodeIdentityState {
  const [state, setState] = useState<NodeIdentityState>({ identity: null, failed: false });
  useEffect(() => {
    fetch("/api/node")
      .then((response) => {
        if (!response.ok) throw new Error(`Node API returned ${response.status}`);
        return response.json();
      })
      .then((identity) => setState({ identity, failed: false }))
      .catch((error) => {
        console.error(error);
        setState({ identity: null, failed: true });
      });
  }, []);
  return state;
}
