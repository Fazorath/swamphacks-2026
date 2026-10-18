import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Cloud } from "lucide-react";

import { WEATHER_CHOICES, type WeatherLayer } from "./weatherLayer";

type Props = { layer: WeatherLayer; onChoose: (layer: WeatherLayer) => void };

// The Weather button of the Layer rail and the small menu it opens. Focus moves into the menu on
// the chosen layer, the arrow keys step through the choices, and Escape gives focus back.
export function WeatherPicker({ layer, onChoose }: Props) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const on = layer !== "off";

  useEffect(() => {
    if (open) menu.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
  }, [open]);

  const onMenuKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setOpen(false);
      button.current?.focus();
      return;
    }
    const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const choices = [...(menu.current?.querySelectorAll<HTMLElement>('[role="radio"]') ?? [])];
    const at = choices.indexOf(document.activeElement as HTMLElement);
    choices[(at + step + choices.length) % choices.length]?.focus();
  };

  return (
    <div className="weather-picker">
      <button
        ref={button}
        type="button"
        className={on ? "rail-button on" : "rail-button"}
        aria-pressed={on}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Weather"
        title="Weather"
        onClick={() => setOpen((isOpen) => !isOpen)}
      >
        <Cloud size={20} aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menu}
          className="weather-menu"
          role="radiogroup"
          aria-label="Weather layer"
          onKeyDown={onMenuKey}
        >
          {WEATHER_CHOICES.map((choice) => (
            <button
              key={choice.layer}
              type="button"
              role="radio"
              aria-checked={choice.layer === layer}
              tabIndex={choice.layer === layer ? 0 : -1}
              className={choice.layer === layer ? "weather-choice on" : "weather-choice"}
              onClick={() => {
                onChoose(choice.layer);
                setOpen(false);
                button.current?.focus();
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
