# Weather layers: temperature, cloud cover and rain on the map

**Status:** ready-for-agent

Feature slice of `docs/specs/flash-flood-replay.md`, drawn on the God's Eye View (`docs/specs/gods-eye-view.md`, ADR 0005). The look and the Layer rail come from `docs/design/ui.md`. Words follow `CONTEXT.md`.

Regrilled on 2026-10-18 once the map became a MapLibre map of all of Nepal with 3D terrain: the grid now covers the country, the layers are draped on the terrain, and Wind is dropped. The prototype that settled it is on branch `prototype/weather-layers`.

## Problem Statement

The dashboard shows what the river is doing (Community Readings) and what officials say (Official Alerts), but nothing about the sky over Nepal. A judge watching the replay cannot see the monsoon that sat over the country that morning, and the project has no way to show off the other data streams the Hub can collect. Osiris, the dashboard whose look we borrowed, does this with weather layers, but every one of its layers needs the internet, which is exactly what Storm Shield must not depend on.

## Solution

A single **Weather** button on the Layer rail picks one Weather layer at a time: Temperature, Cloud cover, Rain, or Off. Each is laid over the map's terrain, so it follows the mountains and valleys in 3D: Temperature and Rain as smooth colour fields with a legend, Cloud cover as soft white cloud whose amount follows the data. Each reads a **Weather Grid**: hourly values on a coarse grid of points over the whole of Nepal.

While a Replay runs, the layer shows the recorded weather of 26 August 2026 on the Event clock, from a file in the Cache Pack, so it works with no internet. With no Replay running (stretch), the Hub's last good forecast is shown with its age.

## User Stories

### Resident / judge (Viewer)

1. As a Viewer, I want one Weather button on the Layer rail, so that I can switch weather layers without crowding the rail.
2. As a Viewer, I want to pick Temperature, Cloud cover, Rain or Off, so that I see exactly one layer at a time and the map stays readable.
3. As a Viewer, I want the layer to lie on the terrain, so that in 3D the rain sits between the mountains instead of floating over them.
4. As a Viewer, I want temperature and rain drawn as smooth colour fields with a legend and units, so that I can read a value for any place.
5. As a Viewer, I want cloud cover drawn as cloud, so that I read it at a glance without a legend.
6. As a Viewer, I want the weather to follow the Event clock during the Replay, so that the sky I see matches the minute of the flood I am watching.
7. As a Viewer, I want the layer to say "recorded weather, 26 Aug 2026" during the Replay, so that I never take it for a forecast.
8. As a Viewer on a phone, I want the map to pan smoothly with a layer on.
9. As a Viewer, I want the layer remembered on this device, so that it is still there after a reload.
10. As a Viewer, I want the weather credit shown while a layer is on, so that the data source is acknowledged.
11. (stretch) As a Viewer, I want the forecast with a time slider and its age when no Replay is running.

### Hub operator, Node operator, pack builder

12. As a pack builder, I want the recorded weather of 26 August over all of Nepal built into the Cache Pack with checksums, so that the replay works offline and is reproducible.
13. As a Node operator, I want my Node to serve the weather from its own pack, so that a Mesh-only Node still has it.

### Reviewer

14. As a judge reading the repo, I want weather shown as context only, so that the pitch never implies rain caused the avalanche.

## Implementation Decisions

- **Source.** Open-Meteo, no key. Recorded weather: `archive-api.open-meteo.com/v1/archive` (reanalysis); forecast: `api.open-meteo.com/v1/forecast`. Both take every grid point in one request. Hourly variables: `temperature_2m`, `cloud_cover`, `precipitation`. Credit "Weather data by Open-Meteo.com (CC BY 4.0)" is shown while a layer is on. Nothing goes in `.env.example`.
- **Weather Grid over Nepal.** A regular grid over the pack's Nepal box (the manifest's `nepal.bbox`) at 0.5°, about 9 × 17 = 153 points, replacing the 7 × 5 valley grid. Same file layout as before (`docs/specs/wire-formats.md`) without the two wind variables. The recorded file is about 200 KB. The data is reanalysis or model output at roughly 10 to 25 km, so it is context for the country, not a measurement at a village; the legend says so. Ticket 0073.
- **Two weather files, one shape.** `weather_replay.json` is in the Cache Pack and covers 25 to 27 August 2026. `weather_forecast.json` is written by the Hub (0058) on the same grid. The dashboard code does not care which it was given.
- **Which one is shown.** While a Replay runs the layer reads the replay file and follows the Event clock. With no Replay it reads the forecast (0059, stretch); until 0059 lands it shows the replay file's first hour.
- **Drawing: draped on the terrain.** The field is painted into an offscreen canvas in latitude/longitude (a few hundred pixels wide), turned into an image and given to the map as a MapLibre `image` source on the Nepal box, under the Nodes, Route, Shelters and place labels. MapLibre warps it, drapes it on the 3D terrain and keeps it aligned when the map moves; the dashboard repaints the image only when the Event clock's hour position changes (at most once a second). Rejected in the prototype: a canvas over the map projected cell by cell (in 3D the cells came apart into visible white squares and floated over the terrain), and a custom WebGL layer (shader work for no visible gain).
- **Look per layer** (prototype variants B and D):
  - Temperature: smooth diverging ramp in °C (blue through white to red), about 60% opaque.
  - Rain: smooth transparent-to-deep-blue ramp in mm/h; zero is fully transparent, so dry country shows the map. Never a risk colour.
  - Cloud cover: white cloud built from a fixed noise texture; the cover value decides how much of the texture shows (100% is overcast, 30% is scattered wisps). The noise is fixed in latitude/longitude, so clouds do not crawl when the hour changes, only grow and thin. Legend: "cloud cover, %" with a clear-to-overcast swatch.
  - Stepped colour bands (variant C) were rejected: they make a coarse grid look more precise than it is.
- **Wind is dropped.** Particles over the map fell to about 3 fps with terrain on in the prototype (each particle's tail is re-projected every frame), and a still arrow grid is the grid look we are avoiding. `windAt` and `speedBand` leave `weatherGrid.ts` and the wind variables leave the file (0073). Tickets 0056 and 0057 are removed.
- **Dashboard modules.** The pure `weatherGrid` module (0053): value at (lat, lon, time) by bilinear then linear-in-time interpolation. A `weatherField` module paints one layer for one moment into an image (tested without MapLibre); a small map component hands the image to MapLibre.
- **Rain is what the data says.** Over the valley the recorded rain is nearly zero during the Replay (see Further Notes); the colour scale is not stretched to make it show.
- **Design changes.** `docs/design/ui.md`: the Weather button picks Temperature / Cloud cover / Rain / Off, and "no animated weather" holds everywhere: the Weather layers do not move except when the hour changes.
- **Tone.** The Replay's tone rules apply. The layers are context; no copy, legend or tooltip links rain to the avalanche.

## Testing Decisions

Test behaviour at the seams, not MapLibre or canvas pixels.

- **Dashboard seam (Vitest):** interpolation (0053, already tested); the picker allows one layer at a time and remembers it; the field image changes when the Event clock moves an hour and not when it moves a second within the same interpolated value; a legend and the credit render for each layer; the missing-file state renders; rain of zero paints a transparent pixel; full cloud cover paints more opaque pixels than 30%.
- **Node API seam (pytest):** the replay file in a valid pack is served; a pack whose weather checksum is wrong is discarded (already tested); the forecast is fetched on the same grid as the replay file.
- **Build script:** a test with a stubbed Open-Meteo answer checks the national grid's shape and that no wind variable is asked for.
- **By hand, noted in the ticket:** 60 fps panning in 3D with each layer on, on the demo laptop and a phone; the layer through a full Replay on one laptop.

## Out of Scope

- Wind in any form (particles, arrows, streamlines).
- Satellite cloud imagery, radar and 3D clouds (Osiris has them; they need the internet).
- Several Weather layers at once.
- Sensor Nodes measuring temperature or rain, and drawing them next to the grid.
- Weather alerts, rain thresholds feeding Flood Risk, or any use of the grid in the Community Warning.
- Elevation-corrected temperature or terrain-aware rain; the grid is coarse by design.
- A user setting for the grid, the source or the refresh rate.

## Further Notes

- **Checked in 0052 (2026-10-17):** the archive has hourly values for all variables, no gaps, at model-cell resolution. Rain over the valley is nearly flat before and during the Replay (mean 0.03 to 0.12 mm/h from 06:00 to 10:30 NPT) and builds only from about 10:45 NPT on 26 August. Over the whole country the prototype showed more rain earlier in the morning, lying in the valleys between the ridges. This also keeps the tone rule: the data does not suggest rain triggered the avalanche.
- **Prototype (2026-10-18):** `dashboard/prototype-weather-layers.html` on branch `prototype/weather-layers`, a single page with MapLibre 4.7, AWS Terrarium terrain and the real archive for the 153-point grid. Draped fields held 60 fps in 3D; canvas-over-the-map wind particles dropped to about 3 fps on the user's machine.
- Open-Meteo's free tier is for non-commercial use with a daily call limit, weighted by the number of points; one forecast request for 153 points an hour stays under it.
- Live forecast tickets (0058 done, 0059) are stretch: the demo is the replay.
