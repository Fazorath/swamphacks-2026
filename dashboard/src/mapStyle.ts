import type { LayerSpecification } from "maplibre-gl";

// The one place for how the map's drawn data looks: fills, line widths and opacities. Colours come
// in as arguments, read from the theme's roles, so a new look is a change here and in theme.css and
// touches no map logic.
export type StyleColors = { radioRange: string; radioLink: string };

const RADIO_RANGE_FILL_OPACITY = 0.08;
const RADIO_RANGE_LINE_WIDTH = 1;
const RADIO_RANGE_LINE_OPACITY = 0.5;
const RADIO_LINK_WIDTH = 2;
const RADIO_LINK_OPACITY = 0.7;

// Under the Node markers and the routes, over the ground: they say who can hear whom, nothing more.
export function radioLayers(colors: StyleColors): LayerSpecification[] {
  return [
    {
      id: "radio-range-fill",
      type: "fill",
      source: "radio-range",
      paint: { "fill-color": colors.radioRange, "fill-opacity": RADIO_RANGE_FILL_OPACITY },
    },
    {
      id: "radio-range-line",
      type: "line",
      source: "radio-range",
      paint: {
        "line-color": colors.radioRange,
        "line-width": RADIO_RANGE_LINE_WIDTH,
        "line-opacity": RADIO_RANGE_LINE_OPACITY,
      },
    },
    {
      id: "radio-links",
      type: "line",
      source: "radio-links",
      layout: { "line-cap": "round" },
      paint: {
        "line-color": colors.radioLink,
        "line-width": RADIO_LINK_WIDTH,
        "line-opacity": RADIO_LINK_OPACITY,
      },
    },
  ];
}
