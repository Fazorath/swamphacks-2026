import { useEffect, useState } from "react";

import { valueAt, type WeatherGrid } from "./weatherGrid";

export type WeatherReplay =
  { status: "loading" | "missing" } | { status: "ready"; grid: WeatherGrid };

// The recorded weather is read whenever a Weather layer is switched on (a Node serves it from its
// pack, so a repeat read is cheap). A pack built before the Weather layers has none (404); a file
// the dashboard cannot read is reported in the console and counts as missing too, so the layer
// says so instead of drawing air.
export function useWeatherReplay(wanted: boolean): WeatherReplay {
  const [replay, setReplay] = useState<WeatherReplay>({ status: "loading" });
  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    const settle = (next: WeatherReplay) => {
      if (!cancelled) setReplay(next);
    };
    fetch("/api/weather/replay")
      .then(async (response) => {
        if (response.status === 404) return settle({ status: "missing" });
        if (!response.ok) throw new Error(`Node API returned ${response.status} for the weather`);
        const grid = (await response.json()) as WeatherGrid;
        // Reading one value checks the whole file's shape.
        valueAt(grid, "precipitation", grid.grid.south, grid.grid.west, 0);
        settle({ status: "ready", grid });
      })
      .catch((error) => {
        console.error(error);
        settle({ status: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [wanted]);
  return replay;
}
