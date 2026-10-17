import type { FloodRisk, FloodRiskReason } from "./useFloodRisk";

function nodeCount(count: number): string {
  return count === 1 ? "1 Node" : `${count} Nodes`;
}

function howLong(seconds: number): string {
  if (seconds === 0) return "at once";
  return seconds < 60 ? `in ${seconds} s` : `in ${Math.round(seconds / 60)} min`;
}

export function reasonSentence({ code, nodes, value, seconds }: FloodRiskReason): string {
  const at = `at ${nodeCount(nodes)}`;
  switch (code) {
    case "water_surge":
      return `water rose ${value / 100} m ${howLong(seconds ?? 0)}`;
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
// made Flood Risk appear. A Surge already says the water is rising, so that sentence is dropped.
export function cardReasons(floodRisk: FloodRisk): FloodRiskReason[] {
  if (floodRisk.reasons.length === 1) return floodRisk.reasons;
  const surging = floodRisk.reasons.some((reason) => reason.code === "water_surge");
  return floodRisk.reasons.filter(
    (reason) => reason.code !== "pressure_falling" && !(surging && reason.code === "water_rising"),
  );
}

export function stormSignalSentence({ nodes, pressure_hpa }: FloodRisk["storm_signal"]): string {
  return `Low pressure: ${pressure_hpa} hPa at ${nodeCount(nodes)}`;
}
