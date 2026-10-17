import { formatAge, type NodeOnMap } from "./nodesOnMap";

export function NodeTags({ node }: { node: NodeOnMap }) {
  return (
    <>
      {node.simulated && <span className="tag simulated">SIMULATED</span>}
      {node.stale && <span className="tag stale">STALE · {formatAge(node.ageSeconds)}</span>}
    </>
  );
}
