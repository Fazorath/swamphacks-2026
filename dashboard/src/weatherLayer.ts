import { useState } from "react";

export type WeatherLayer = "temperature" | "cloud" | "rain" | "off";

export const WEATHER_CHOICES: { layer: WeatherLayer; label: string }[] = [
  { layer: "temperature", label: "Temperature" },
  { layer: "cloud", label: "Cloud cover" },
  { layer: "rain", label: "Rain" },
  { layer: "off", label: "Off" },
];

const STORAGE_KEY = "storm-shield.weather-layer";

function readStored(): WeatherLayer {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    // A choice that no longer exists (the dropped Wind) is Off, like unreadable storage.
    return WEATHER_CHOICES.find((choice) => choice.layer === stored)?.layer ?? "off";
  } catch (error) {
    console.error(error);
    return "off";
  }
}

function writeStored(layer: WeatherLayer) {
  try {
    window.localStorage.setItem(STORAGE_KEY, layer);
  } catch (error) {
    console.error(error);
  }
}

// Exactly one Weather layer is on, and the choice is remembered on this device.
export function useWeatherLayer() {
  const [layer, setLayer] = useState<WeatherLayer>(readStored);
  const choose = (next: WeatherLayer) => {
    setLayer(next);
    writeStored(next);
  };
  return { layer, choose };
}
