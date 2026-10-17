import { cardReasons, reasonSentence } from "./floodRiskSentences";
import type { FloodRisk } from "./useFloodRisk";

const LEVEL_WORDS = { low: "Low", elevated: "Elevated", high: "High" } as const;

export function FloodRiskChip({ floodRisk }: { floodRisk: FloodRisk | null }) {
  if (!floodRisk?.level) return null;
  return (
    <span className={`flood-risk-chip ${floodRisk.level}`}>
      Flood Risk · {LEVEL_WORDS[floodRisk.level]}
    </span>
  );
}

export function FloodRiskCard({ floodRisk }: { floodRisk: FloodRisk | null }) {
  if (!floodRisk?.level) return null;
  return (
    <section aria-label="Flood Risk" className={`flood-risk-card ${floodRisk.level}`}>
      <h3>Flood Risk · {LEVEL_WORDS[floodRisk.level]}</h3>
      <ul>
        {cardReasons(floodRisk).map((reason) => (
          <li key={reason.code}>{reasonSentence(reason)}</li>
        ))}
      </ul>
    </section>
  );
}
