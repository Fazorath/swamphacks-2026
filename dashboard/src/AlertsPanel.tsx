import { TriangleAlert } from "lucide-react";

import {
  issuedAsGiven,
  issuedUnix,
  leadTimeLine,
  officialTag,
  SOURCE_LABELS,
  type OfficialAlert,
} from "./officialAlerts";
import {
  measuredSpeedLine,
  OFFICIAL_SOURCE,
  warningSentence,
  type CommunityWarning,
} from "./communityWarnings";
import type { NodeSnapshot } from "./nodeState";
import { Panel, type PanelControl } from "./Panel";
import type { WaveArrival } from "./waveEta";
import { WaveEtaLine } from "./WaveEtaLine";

export function AlertsPanel({
  alerts,
  warnings,
  nodes,
  thisNodeId,
  appliesToYouIds,
  firstCommunityWarningAt,
  waveArrival,
  eventT,
  online,
  panel,
}: {
  alerts: OfficialAlert[];
  warnings: CommunityWarning[];
  nodes: NodeSnapshot[];
  thisNodeId: string;
  appliesToYouIds: string[];
  firstCommunityWarningAt: number | null;
  waveArrival: WaveArrival | null;
  eventT: number | null;
  online: boolean;
  panel: PanelControl;
}) {
  const leadTime = leadTimeLine(firstCommunityWarningAt, alerts);
  const newestFirst = [...alerts].sort((a, b) => issuedUnix(b) - issuedUnix(a));
  return (
    <Panel label="Alerts" {...panel}>
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
      {[...warnings].reverse().map((warning) => {
        const measuredLine = measuredSpeedLine(
          warning,
          (id) => nodes.find((node) => node.id === id)?.name ?? id,
        );
        return (
          <article key={warning.id} className="community-warning" aria-label="Community Warning">
            <WaveEtaLine arrival={waveArrival} eventT={eventT} />
            <p className="community-warning-tag">COMMUNITY WARNING · NOT OFFICIAL</p>
            <h3>{warningSentence(warning, nodes, thisNodeId)}</h3>
            {measuredLine && <p className="measured-speed">{measuredLine}</p>}
            <p>Signed by the Hub · verified</p>
            <p>Check official sources for any evacuation decision.</p>
            {online ? (
              <a href={OFFICIAL_SOURCE.url} target="_blank" rel="noreferrer">
                Official source: {OFFICIAL_SOURCE.name}
              </a>
            ) : (
              <p>Official source link opens when online</p>
            )}
          </article>
        );
      })}
    </Panel>
  );
}
