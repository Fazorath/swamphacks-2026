import { LEGEND_RANGE, VARIABLE_OF, rampGradient, type FieldLayer } from "./weatherField";
import { WEATHER_CHOICES, type WeatherLayer } from "./weatherLayer";
import type { WeatherData } from "./useWeatherGrid";

export const RECORDED_TAG = "RECORDED WEATHER · 26 Aug 2026";
// Past this long without a fresh fetch the Hub is probably offline, and the tag says so.
const FORECAST_OLD_AFTER_HOURS = 3;
const FORECAST_SLIDER_MAX_HOURS = 7 * 24;
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

export function forecastTag(fetchedAt: string | undefined, nowMs: number): string {
  if (fetchedAt === undefined) return "FORECAST";
  const ageMs = Math.max(0, nowMs - Date.parse(fetchedAt));
  const hours = Math.floor(ageMs / 3_600_000);
  if (ageMs > FORECAST_OLD_AFTER_HOURS * 3_600_000) return `OFFLINE · last forecast ${hours} h old`;
  return hours === 0 ? "FORECAST · updated just now" : `FORECAST · updated ${hours} h ago`;
}

type Props = {
  layer: WeatherLayer;
  weather: WeatherData;
  // Whether a Replay is running: the layer then shows the recorded weather, otherwise the forecast.
  replaying: boolean;
  nowMs: number;
  forecastHours: number;
  onForecastHours: (hours: number) => void;
};

// What each layer's colours mean, whether it is recorded or forecast and coarse, and who the data
// is from. When the Node has no such file it says so instead of leaving the map looking empty.
export function WeatherLegend({
  layer,
  weather,
  replaying,
  nowMs,
  forecastHours,
  onForecastHours,
}: Props) {
  if (layer === "off") return null;
  const label = WEATHER_CHOICES.find((choice) => choice.layer === layer)?.label;
  return (
    <aside className="weather-legend" aria-label="Weather legend">
      <strong>{label}</strong>
      {weather.status === "missing" && replaying && (
        <p>Weather not downloaded: this Node's Cache Pack has no recorded weather.</p>
      )}
      {weather.status === "missing" && !replaying && <p>Forecast not available on this Node.</p>}
      {weather.status === "loading" && (
        <p>{replaying ? "Loading the recorded weather…" : "Loading the forecast…"}</p>
      )}
      {weather.status === "ready" && (
        <>
          <span className="tag weather-tag">
            {weather.source === "replay"
              ? RECORDED_TAG
              : forecastTag(weather.grid.fetched_at, nowMs)}
          </span>
          {weather.source === "forecast" && (
            <label className="weather-slider">
              <span>Forecast time: now + {forecastHours} h</span>
              <input
                type="range"
                min={0}
                max={FORECAST_SLIDER_MAX_HOURS}
                value={forecastHours}
                onChange={(event) => onForecastHours(Number(event.target.value))}
              />
            </label>
          )}
          {scale(layer, weather.grid.units[VARIABLE_OF[layer]])}
          <p>{COARSE_NOTE}</p>
          <p>{weather.grid.credit}</p>
        </>
      )}
    </aside>
  );
}
