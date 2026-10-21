import { cardReasons, reasonSentence } from "./floodRiskSentences";
import type { FloodRisk, Hazard, Region } from "./nodeState";
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

export function FloodRiskCard({
  floodRisk,
  region,
  hazard,
}: {
  floodRisk: FloodRisk | null;
  region: Region | null;
  hazard: Hazard | null;
}) {
  if (!floodRisk?.level || !region || !hazard) return null;
  return (
    <section aria-label="Flood Risk" className={`flood-risk-card ${floodRisk.level}`}>
      <h3>Flood Risk · {LEVEL_WORDS[floodRisk.level]}</h3>
      <ul>
        {cardReasons(floodRisk).map((reason) => (
          <li key={reason.code}>{reasonSentence(reason, region, hazard)}</li>
        ))}
      </ul>
    </section>
  );
}
