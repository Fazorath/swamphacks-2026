import { useEffect, useState } from "react";

import { agoWords } from "./agoWords";
import { Panel, type PanelControl } from "./Panel";
import type { EvacuationPlan } from "./evacuationPlan";
import { officialTag, SOURCE_LABELS } from "./officialAlerts";
import type { WaveArrival } from "./waveEta";
import { WaveEtaLine } from "./WaveEtaLine";

const LEVEL_WORDS = { low: "Low", elevated: "Elevated", high: "High" } as const;

// Nothing can check Shelter status while the Node is unreachable, so the plan says how old it is.
function ShelterStatusAge({ confirmedAt }: { confirmedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const ageSeconds = Math.max(0, (now - confirmedAt) / 1000);
  return (
    <p className="shelter-status-age">
      Shelter status last confirmed {agoWords(ageSeconds)}; it may have changed since.
    </p>
  );
}

export function EvacuationPlanPanel({
  plan,
  exampleHome,
  waveArrival,
  eventT,
  shelterStatusConfirmedAt,
  panel,
}: {
  plan: EvacuationPlan;
  exampleHome: boolean;
  waveArrival: WaveArrival | null;
  eventT: number | null;
  // Set only while the Node is unreachable: when its last answer arrived.
  shelterStatusConfirmedAt: number | null;
  panel: PanelControl;
}) {
  return (
    <Panel label="Evacuation Plan" {...panel}>
      {exampleHome && (
        <p className="example-home">
          Example home, not yours. Fill in your household profile to see your own plan.
        </p>
      )}
      <WaveEtaLine arrival={waveArrival} eventT={eventT} />
      {plan.risk && (
        <div className={`plan-risk ${plan.risk.level}`}>
          <h3>Flood Risk: {LEVEL_WORDS[plan.risk.level]}</h3>
          <ul>
            {plan.risk.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      )}
      {plan.officialAlerts.length > 0 && (
        <ul className="plan-official-alerts" aria-label="Official Alerts for your household">
          {plan.officialAlerts.map((alert) => (
            <li key={alert.id} className="official-alert">
              <span className="official-tag">{officialTag(alert)}</span>{" "}
              {SOURCE_LABELS[alert.source]}: {alert.headline}
            </li>
          ))}
        </ul>
      )}
      {plan.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      {shelterStatusConfirmedAt !== null && (
        <ShelterStatusAge confirmedAt={shelterStatusConfirmedAt} />
      )}
      <p className="official-line">{plan.officialLine}</p>
    </Panel>
  );
}
