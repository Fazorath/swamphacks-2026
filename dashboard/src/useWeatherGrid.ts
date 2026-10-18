import { useEffect, useState } from "react";

import { valueAt, type WeatherGrid } from "./weatherGrid";

export type WeatherSource = "replay" | "forecast";

export type WeatherData =
  { status: "loading" | "missing" } | { status: "ready"; source: WeatherSource; grid: WeatherGrid };

const URL_OF: Record<WeatherSource, string> = {
  replay: "/api/weather/replay",
  forecast: "/api/weather/forecast",
};

// The weather file is read whenever a Weather layer is switched on or the source changes (a Node
// serves both from disk, so a repeat read is cheap). A Node with no such file answers 404; a file
// the dashboard cannot read is reported in the console and counts as missing too, so the layer
// says so instead of drawing air.
export function useWeatherGrid(wanted: boolean, source: WeatherSource): WeatherData {
  const [read, setRead] = useState<WeatherData & { of: WeatherSource }>({
    status: "loading",
    of: source,
  });
  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    const settle = (next: WeatherData) => {
      if (!cancelled) setRead({ ...next, of: source });
    };
    fetch(URL_OF[source])
      .then(async (response) => {
        if (response.status === 404) return settle({ status: "missing" });
        if (!response.ok) throw new Error(`Node API returned ${response.status} for the weather`);
        const grid = (await response.json()) as WeatherGrid;
        // Reading one value checks the whole file's shape.
        valueAt(grid, "precipitation", grid.grid.south, grid.grid.west, 0);
        settle({ status: "ready", source, grid });
      })
      .catch((error) => {
        console.error(error);
        settle({ status: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [wanted, source]);
  // An answer for the other source is not this source's answer.
  return read.of === source ? read : { status: "loading" };
}
