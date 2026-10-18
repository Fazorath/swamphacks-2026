import { useEffect, useState } from "react";

// The forecast is shown for "now plus the slider": now moves once a minute, which is finer than
// the hourly grid and keeps the tag's age current without repainting the map every second.
const NOW_TICK_MS = 60_000;

export function useForecastTime() {
  const [nowMs, setNowMs] = useState(Date.now);
  const [hours, setHours] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), NOW_TICK_MS);
    return () => clearInterval(timer);
  }, []);
  return { nowMs, hours, setHours, atMs: nowMs + hours * 3_600_000 };
}
