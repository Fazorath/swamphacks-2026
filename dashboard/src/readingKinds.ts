import type { ReadingKind } from "./nodeState";

export const KIND_LABELS: Record<ReadingKind, string> = {
  pressure: "Pressure",
  rain_rate: "Rain rate",
  water_level: "Water level",
  soil_moisture: "Soil moisture",
};
