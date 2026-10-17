import { usePolledJson } from "./usePolledJson";

export type NodeStatus = "online" | "mesh_only";

export function useNodeStatus(): NodeStatus | null {
  return usePolledJson<{ status: NodeStatus }>("/api/node")?.status ?? null;
}
