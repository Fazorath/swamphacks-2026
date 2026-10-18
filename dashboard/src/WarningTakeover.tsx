import { useChimeForWarning } from "./chime";
import {
  measuredSpeedLine,
  OFFICIAL_SOURCE,
  warningSentence,
  type CommunityWarning,
} from "./communityWarnings";
import type { NodeSnapshot } from "./nodeState";
import { issuedAsGiven, officialTag, SOURCE_LABELS, type OfficialAlert } from "./officialAlerts";
import type { TakeoverWarning } from "./acknowledgedWarnings";
import type { WaveArrival } from "./waveEta";
import { WaveEtaLine } from "./WaveEtaLine";

function OfficialBody({ alert, online }: { alert: OfficialAlert; online: boolean }) {
  return (
    <>
      <p className="official-alert-tags">
        <span className="official-tag">{officialTag(alert)}</span>
        <span>{SOURCE_LABELS[alert.source]}</span>
      </p>
      <h2>{alert.headline}</h2>
      <p>Issued {issuedAsGiven(alert.issued)}</p>
      {online ? (
        <a href={alert.url} target="_blank" rel="noreferrer">
          Read at the source
        </a>
      ) : (
        <p>Source link opens when online</p>
      )}
    </>
  );
}

function CommunityBody({
  warning,
  nodes,
  thisNodeId,
  waveArrival,
  eventT,
  online,
}: {
  warning: CommunityWarning;
  nodes: NodeSnapshot[];
  thisNodeId: string;
  waveArrival: WaveArrival | null;
  eventT: number | null;
  online: boolean;
}) {
  const measuredLine = measuredSpeedLine(
    warning,
    (id) => nodes.find((node) => node.id === id)?.name ?? id,
  );
  return (
    <>
      <div className="takeover-wave">
        <WaveEtaLine arrival={waveArrival} eventT={eventT} />
      </div>
      <p className="community-warning-tag">COMMUNITY WARNING · NOT OFFICIAL</p>
      <h2>{warningSentence(warning, nodes, thisNodeId)}</h2>
      {measuredLine && <p>{measuredLine}</p>}
      <p>Check official sources for any evacuation decision.</p>
      {online ? (
        <a href={OFFICIAL_SOURCE.url} target="_blank" rel="noreferrer">
          Official source: {OFFICIAL_SOURCE.name}
        </a>
      ) : (
        <p>Official source link opens when online</p>
      )}
    </>
  );
}

// Shows the first of the warnings this device has not acknowledged, over a dimmed live map.
export function WarningTakeover({
  pending,
  nodes,
  thisNodeId,
  waveArrival,
  eventT,
  online,
  onAcknowledge,
}: {
  pending: TakeoverWarning[];
  nodes: NodeSnapshot[];
  thisNodeId: string;
  waveArrival: WaveArrival | null;
  eventT: number | null;
  online: boolean;
  onAcknowledge: (key: string) => void;
}) {
  const current = pending[0];
  useChimeForWarning(current?.key);
  if (!current) return null;
  return (
    <div className="takeover-scrim">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-label="Warning"
        className={`takeover ${current.kind}`}
      >
        {pending.length > 1 && <p className="takeover-count">1 of {pending.length}</p>}
        {current.kind === "official" ? (
          <OfficialBody alert={current.alert} online={online} />
        ) : (
          <CommunityBody
            warning={current.warning}
            nodes={nodes}
            thisNodeId={thisNodeId}
            waveArrival={waveArrival}
            eventT={eventT}
            online={online}
          />
        )}
        <button
          key={current.key}
          type="button"
          className="takeover-acknowledge"
          autoFocus
          onClick={() => onAcknowledge(current.key)}
        >
          Acknowledge
        </button>
      </section>
    </div>
  );
}

// What stays under the top bar once a warning is acknowledged.
export function WarningBanners({
  shown,
  nodes,
  thisNodeId,
}: {
  shown: TakeoverWarning[];
  nodes: NodeSnapshot[];
  thisNodeId: string;
}) {
  return shown.map((each) => (
    <p key={each.key} role="status" className={`banner warning-banner ${each.kind}`}>
      {each.kind === "official" ? (
        <>
          <strong>{officialTag(each.alert)}</strong> {each.alert.headline}
        </>
      ) : (
        <>
          <strong>COMMUNITY WARNING · NOT OFFICIAL</strong>{" "}
          {warningSentence(each.warning, nodes, thisNodeId)}
        </>
      )}
    </p>
  ));
}
