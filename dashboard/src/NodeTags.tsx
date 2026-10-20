import type { NodeOnMap } from "./nodesOnMap";

// Rounded up so a Node shown as STALE never reads "15 s", which is not yet stale.
function formatAge(seconds: number): string {
  const rounded = Math.ceil(seconds);
  return rounded < 60 ? `${rounded} s` : `${Math.floor(rounded / 60)} min`;
}

export function NodeTags({ node }: { node: NodeOnMap }) {
  return (
    <>
      {node.simulated && <span className="tag simulated">SIMULATED</span>}
      {!node.registered && <span className="tag not-counted">NOT COUNTED</span>}
      {node.level && <span className={`tag ${node.level}`}>{node.level.toUpperCase()}</span>}
      {node.stale && <span className="tag stale">STALE · {formatAge(node.ageSeconds)}</span>}
    </>
  );
}
