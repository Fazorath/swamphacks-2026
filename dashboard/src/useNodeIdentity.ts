import { useEffect, useState } from "react";

export type NodeIdentity = { name: string; role: "sensor" | "hub" };

export function useNodeIdentity(): NodeIdentity | null {
  const [identity, setIdentity] = useState<NodeIdentity | null>(null);
  useEffect(() => {
    fetch("/api/node")
      .then((response) => response.json())
      .then(setIdentity);
  }, []);
  return identity;
}
