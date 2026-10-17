import type { EvacuationPlan } from "./evacuationPlan";
import { officialTag, SOURCE_LABELS } from "./officialAlerts";

const LEVEL_WORDS = { low: "Low", elevated: "Elevated", high: "High" } as const;

export function EvacuationPlanPanel({ plan }: { plan: EvacuationPlan }) {
  return (
    <section aria-label="Evacuation Plan">
      <h2>Evacuation Plan</h2>
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
      <p className="official-line">{plan.officialLine}</p>
    </section>
  );
}
