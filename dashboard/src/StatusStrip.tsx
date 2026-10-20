import { agoWords } from "./agoWords";
import type { NepalMap } from "./evacuationPlan";
import type { NodeOnMap } from "./nodesOnMap";
import type { NodeState } from "./nodeState";

const ROLE_LABELS = { sensor: "Sensor Node", hub: "Hub" } as const;

// What the map is drawn from, as the pack's manifest records it (it also carries the check dates).
function mapCredit(nepal: NepalMap | null): string {
  if (!nepal) return "Map: this Node's Cache Pack";
  const sources = nepal.sources.map((source) => `${source.name} (${source.licence})`).join(" · ");
  return nepal.elevation.approximate ? `${sources} · elevation is approximate` : sources;
}

type Props = {
  nodes: NodeOnMap[];
  // Nodes that went quiet or came back, already worded.
  contactNotes: { key: string; text: string }[];
  identity: Pick<NodeState, "name" | "role"> | null;
  connecting: boolean;
  status: NodeState["status"] | null;
  cachePackBuilt: string | null;
  cachePackLoaded: boolean;
  nepal: NepalMap | null;
  // True once the frame-rate watch has turned terrain off (D-35).
  terrainDropped: boolean;
  // True while the map draws a water level, which is always a reconstruction (D-47).
  waterDrawn: boolean;
};

export function StatusStrip({
  nodes,
  contactNotes,
  identity,
  connecting,
  status,
  cachePackBuilt,
  cachePackLoaded,
  nepal,
  terrainDropped,
  waterDrawn,
}: Props) {
  const simulated = nodes.filter((node) => node.simulated).length;
  const youngest = nodes.length > 0 ? Math.min(...nodes.map((node) => node.ageSeconds)) : null;
  return (
    <footer className="status-strip" aria-label="Status">
      {nodes.length > 0 && (
        <span className="simulated-badge">
          {simulated} simulated · {nodes.length - simulated} real
        </span>
      )}
      {waterDrawn && <span className="water-reconstruction-note">Water level: RECONSTRUCTION</span>}
      {contactNotes.map((note) => (
        <span key={note.key} className="contact-note">
          {note.text}
        </span>
      ))}
      <span>Readings {youngest === null ? "none yet" : agoWords(youngest)}</span>
      <span>
        Cache Pack{" "}
        {cachePackLoaded ? `built ${cachePackBuilt?.slice(0, 10) ?? "(date unknown)"}` : "not yet"}
      </span>
      <span>
        {identity
          ? `${identity.name} · ${ROLE_LABELS[identity.role]}`
          : connecting
            ? "Connecting…"
            : null}
      </span>
      {status === "mesh_only" && (
        <span className="mesh-only">Mesh-only · Mesh features keep working</span>
      )}
      {terrainDropped && <span className="terrain-off">Terrain off · frame rate</span>}
      <span className="map-credit" title={mapCredit(nepal)}>
        {mapCredit(nepal)}
      </span>
      <span className="boundaries-note">
        {nepal?.boundariesNote ?? "Boundaries are indicative"}
      </span>
    </footer>
  );
}
