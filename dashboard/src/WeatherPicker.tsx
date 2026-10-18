import { useState } from "react";
import { Cloud } from "lucide-react";

import { WEATHER_CHOICES, type WeatherLayer } from "./weatherLayer";

type Props = { layer: WeatherLayer; onChoose: (layer: WeatherLayer) => void };

// The Weather button of the Layer rail and the small menu it opens.
export function WeatherPicker({ layer, onChoose }: Props) {
  const [open, setOpen] = useState(false);
  const on = layer !== "off";
  return (
    <div
      className="weather-picker"
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <button
        type="button"
        className={on ? "rail-button on" : "rail-button"}
        aria-pressed={on}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Weather"
        title="Weather"
        onClick={() => setOpen((was) => !was)}
      >
        <Cloud size={20} aria-hidden="true" />
      </button>
      {open && (
        <div className="weather-menu" role="radiogroup" aria-label="Weather layer">
          {WEATHER_CHOICES.map((choice) => (
            <button
              key={choice.layer}
              type="button"
              role="radio"
              aria-checked={choice.layer === layer}
              className={choice.layer === layer ? "weather-choice on" : "weather-choice"}
              onClick={() => {
                onChoose(choice.layer);
                setOpen(false);
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
