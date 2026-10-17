import type { FloodRisk } from "./useFloodRisk";

const LEVEL_LABELS: Record<FloodRisk["level"], string> = {
  low: "Low",
  elevated: "Elevated",
  high: "High",
};

export function FloodRiskPanel({ floodRisk }: { floodRisk: FloodRisk | null }) {
  return (
    <section aria-label="Flood Risk">
      <h2>Flood Risk</h2>
      {floodRisk ? (
        <>
          <p className={`flood-risk-level ${floodRisk.level}`}>{LEVEL_LABELS[floodRisk.level]}</p>
          <ul>
            {floodRisk.reasons.map((reason) => (
              <li key={reason.code}>{reason.text}</li>
            ))}
          </ul>
          {floodRisk.storm_signal.falling && (
            <p className="storm-signal">Storm signal · {floodRisk.storm_signal.text}</p>
          )}
        </>
      ) : (
        <p>Waiting for readings…</p>
      )}
    </section>
  );
}
