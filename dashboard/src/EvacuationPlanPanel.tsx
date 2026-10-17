import type { EvacuationPlan } from "./evacuationPlan";

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
      {plan.lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
      <p className="official-line">{plan.officialLine}</p>
    </section>
  );
}
