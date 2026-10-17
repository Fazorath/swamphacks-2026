import { waveEtaLine, type WaveArrival } from "./waveEta";

// Without a running Event clock there is nothing to count down against, so nothing is shown.
export function WaveEtaLine({
  arrival,
  eventT,
}: {
  arrival: WaveArrival | null;
  eventT: number | null;
}) {
  if (arrival === null) return null;
  if (arrival.kind === "not-near-river") {
    return (
      <p className="wave-eta">Your home is not near the river, so no wave arrival time applies.</p>
    );
  }
  if (eventT === null) return null;
  return <p className="wave-eta">{waveEtaLine(arrival.at, eventT)}</p>;
}
