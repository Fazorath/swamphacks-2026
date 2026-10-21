import type { DisplayUnits } from "./nodeState";

// How many of the Node's own units (cm, mm/h, hPa) one display unit is; the flood-warning rules
// send those, and the Region says what residents read.
const PER_DISPLAY_UNIT = {
  cm: 1,
  m: 100,
  ft: 30.48,
  "mm/h": 1,
  "in/h": 25.4,
  hPa: 1,
  inHg: 33.8639,
};
const DECIMALS = { cm: 1, m: 2, ft: 1, "mm/h": 1, "in/h": 2, hPa: 1, inHg: 2 };

type Shown = "water_level" | "rain_rate" | "air_pressure";

// "90 cm", "3 ft", "0.4 in/h": a number the Node measured, written in the Region's unit for it.
export function inDisplayUnit(value: number, kind: Shown, units: DisplayUnits): string {
  const unit = units[kind];
  return `${Number((value / PER_DISPLAY_UNIT[unit]).toFixed(DECIMALS[unit]))} ${unit}`;
}
