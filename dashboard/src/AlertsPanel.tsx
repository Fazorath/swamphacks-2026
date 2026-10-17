import { TriangleAlert } from "lucide-react";

import {
  issuedUnix,
  leadTimeLine,
  officialTag,
  SOURCE_LABELS,
  type OfficialAlert,
} from "./officialAlerts";
import { warningSentence, type CommunityWarning } from "./communityWarnings";
import type { NodeSnapshot } from "./nodeState";

// "2026-08-26T09:15:00+05:45" reads as "2026-08-26 09:15 +05:45": the source's own time, unconverted.
function issuedAsGiven(issued: string): string {
  return `${issued.slice(0, 10)} ${issued.slice(11, 16)} ${issued.slice(19)}`;
}

export function AlertsPanel({
  alerts,
  warnings,
  nodes,
  thisNodeId,
  appliesToYouIds,
  firstCommunityWarningAt,
  online,
}: {
  alerts: OfficialAlert[];
  warnings: CommunityWarning[];
  nodes: NodeSnapshot[];
  thisNodeId: string;
  appliesToYouIds: string[];
  firstCommunityWarningAt: number | null;
  online: boolean;
}) {
  const leadTime = leadTimeLine(firstCommunityWarningAt, alerts);
  const newestFirst = [...alerts].sort((a, b) => issuedUnix(b) - issuedUnix(a));
  return (
    <section aria-label="Alerts">
      <h2>Alerts</h2>
      {leadTime && <p className="lead-time">{leadTime}</p>}
      {newestFirst.length === 0 && warnings.length === 0 && (
        <div className="empty-panel">
          <span className="empty-panel-icon">
            <TriangleAlert size={20} aria-hidden="true" />
          </span>
          <p>No Official Alerts or Community Warnings right now.</p>
        </div>
      )}
      {newestFirst.map((alert) => (
        <article key={alert.id} className="official-alert" aria-label="Official Alert">
          <p className="official-alert-tags">
            <span className="official-tag">{officialTag(alert)}</span>
            <span>{SOURCE_LABELS[alert.source]}</span>
            {appliesToYouIds.includes(alert.id) && (
              <span className="applies-chip">APPLIES TO YOUR HOUSEHOLD</span>
            )}
          </p>
          <h3>{alert.headline}</h3>
          <p className="official-alert-issued">Issued {issuedAsGiven(alert.issued)}</p>
          {online ? (
            <a href={alert.url} target="_blank" rel="noreferrer">
              Read at the source
            </a>
          ) : (
            <p className="official-alert-offline">Source link opens when online</p>
          )}
        </article>
      ))}
      {[...warnings].reverse().map((warning) => (
        <article key={warning.id} className="community-warning" aria-label="Community Warning">
          <p className="community-warning-tag">COMMUNITY WARNING · NOT OFFICIAL</p>
          <h3>{warningSentence(warning, nodes, thisNodeId)}</h3>
          <p>Signed by the Hub · verified</p>
          <p>Check official sources for any evacuation decision.</p>
        </article>
      ))}
    </section>
  );
}
