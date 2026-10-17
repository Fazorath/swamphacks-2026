import type { FloodRisk, FloodRiskReason } from "./useFloodRisk";

function nodeCount(count: number): string {
  return count === 1 ? "1 Node" : `${count} Nodes`;
}

export function reasonSentence({ code, nodes, value }: FloodRiskReason): string {
  const at = `at ${nodeCount(nodes)}`;
  switch (code) {
    case "water_high":
      return `water level ${value} cm ${at}`;
    case "water_rising":
      return `water level rising ${at}`;
    case "rain_heavy":
      return `heavy rain: ${value} mm/h ${at}`;
    case "pressure_falling":
      return `low pressure: ${value} hPa ${at}`;
    case "raining":
      return `soil moisture rising ${at}`;
  }
}

// The map badge already shows the Storm Signal, so the card repeats it only when it is all that
// made Flood Risk appear.
export function cardReasons(floodRisk: FloodRisk): FloodRiskReason[] {
  return floodRisk.reasons.length === 1
    ? floodRisk.reasons
    : floodRisk.reasons.filter((reason) => reason.code !== "pressure_falling");
}

export function stormSignalSentence({ nodes, pressure_hpa }: FloodRisk["storm_signal"]): string {
  return `Low pressure: ${pressure_hpa} hPa at ${nodeCount(nodes)}`;
}
