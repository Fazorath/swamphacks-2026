import { WEATHER_CHOICES, type WeatherLayer } from "./weatherLayer";

// A stand-in strip until each layer draws its own legend.
export function WeatherLegend({ layer }: { layer: WeatherLayer }) {
  if (layer === "off") return null;
  const label = WEATHER_CHOICES.find((choice) => choice.layer === layer)?.label;
  return (
    <aside className="weather-legend" aria-label="Weather legend">
      <span>{label}</span>
      <span className="weather-legend-strip" aria-hidden="true" />
    </aside>
  );
}
