import type { NepalMap } from "./evacuationPlan";

// The sources behind the map and the fleet's weather, with the dates the pack's builder checked
// them (D-42). Open-Meteo is the fleet's weather, so it is named even if the manifest is silent.
function sourcesTooltip(nepal: NepalMap | null): string {
  const lines = (nepal?.sources ?? []).map(
    (source) => `${source.name} (${source.licence}), checked ${source.checked}`,
  );
  if (!lines.some((line) => line.startsWith("Open-Meteo"))) lines.push("Open-Meteo (CC BY 4.0)");
  return lines.join("\n");
}

type Props = { simulated: number; real: number; nepal: NepalMap | null };

// "40 simulated Nodes · 6 real": the numbers say what the map is made of, so no one has to be told.
export function SimulatedBadge({ simulated, real, nepal }: Props) {
  return (
    <span className="simulated-badge" title={sourcesTooltip(nepal)}>
      {simulated} simulated Nodes · {real} real
    </span>
  );
}
