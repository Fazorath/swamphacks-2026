import { cardReasons, reasonSentence } from "./floodRiskSentences";
import type { FloodRisk } from "./nodeState";
import { usePrefersReducedMotion } from "./useViewport";

const LEVEL_WORDS = { low: "Low", elevated: "Elevated", high: "High" } as const;

export function FloodRiskChip({ floodRisk }: { floodRisk: FloodRisk | null }) {
  const reducedMotion = usePrefersReducedMotion();
  if (!floodRisk?.level) return null;
  // A new level draws the chip again (a new key), so it fades in where the old one was.
  return (
    <span
      key={floodRisk.level}
      className={`flood-risk-chip ${floodRisk.level}${reducedMotion ? "" : " fades-in"}`}
    >
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
