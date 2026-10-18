import { LEGEND_RANGE, VARIABLE_OF, rampGradient, type FieldLayer } from "./weatherField";
import { WEATHER_CHOICES, type WeatherLayer } from "./weatherLayer";
import type { WeatherReplay } from "./useWeatherReplay";

export const RECORDED_TAG = "RECORDED WEATHER · 26 Aug 2026";
const COARSE_NOTE =
  "Coarse grid (a point every 0.5°) of model data: context for the country, not a village measurement.";

function scale(layer: FieldLayer, unit: string) {
  if (layer === "cloud") {
    return (
      <div className="weather-scale">
        <span>clear</span>
        <span className="weather-legend-strip weather-legend-cloud" aria-hidden="true" />
        <span>overcast</span>
        <span className="weather-unit">cloud cover, {unit}</span>
      </div>
    );
  }
  const { low, high } = LEGEND_RANGE[layer];
  return (
    <div className="weather-scale">
      <span>{low}</span>
      <span
        className="weather-legend-strip"
        style={{ background: rampGradient(layer) }}
        aria-hidden="true"
      />
      <span>{high}</span>
      <span className="weather-unit">{unit}</span>
    </div>
  );
}

// What each layer's colours mean, that it is recorded and coarse, and who the data is from. When
// the pack has no recorded weather it says so instead of leaving the map looking empty.
export function WeatherLegend({ layer, weather }: { layer: WeatherLayer; weather: WeatherReplay }) {
  if (layer === "off") return null;
  const label = WEATHER_CHOICES.find((choice) => choice.layer === layer)?.label;
  return (
    <aside className="weather-legend" aria-label="Weather legend">
      <strong>{label}</strong>
      {weather.status === "missing" && (
        <p>Weather not downloaded: this Node's Cache Pack has no recorded weather.</p>
      )}
      {weather.status === "loading" && <p>Loading the recorded weather…</p>}
      {weather.status === "ready" && (
        <>
          <span className="tag weather-tag">{RECORDED_TAG}</span>
          {scale(layer, weather.grid.units[VARIABLE_OF[layer]])}
          <p>{COARSE_NOTE}</p>
          <p>{weather.grid.credit}</p>
        </>
      )}
    </aside>
  );
}
