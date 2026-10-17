# Weather layers: wind, temperature, cloud cover and rain on the map

**Status:** ready-for-agent

Feature slice of `docs/specs/flash-flood-replay.md`. The look and the Layer rail come from `docs/design/ui.md`. Words follow `CONTEXT.md`.

## Problem Statement

The dashboard shows what the river is doing (Community Readings) and what officials say (Official Alerts), but nothing about the sky above the valley. A judge watching the replay cannot see the monsoon that sat over the catchment that morning, and the project has no way to show off the other data streams the Hub can collect. Osiris, the dashboard whose look we borrowed, does this with weather layers, but every one of its layers needs the internet, which is exactly what Storm Shield must not depend on.

## Solution

A single **Weather** button on the Layer rail picks one weather layer at a time: Wind, Temperature, Cloud cover, Rain, or Off. Wind is drawn as animated particles whose colour shows speed; the other three are smooth colour fields with a legend. Each reads a **Weather Grid**: hourly values on a coarse grid of points over the valley.

While a Replay runs, the layer shows the recorded weather of 26 August 2026 on the Event clock, from a file in the Cache Pack, so it works with no internet. With no Replay running, the Hub fetches a 7-day forecast from Open-Meteo, keeps the last good copy on disk and serves it to Nodes. If the forecast source goes down, the layer keeps showing the last copy and says how old it is.

## User Stories

### Resident / judge (Viewer)

1. As a Viewer, I want one Weather button on the Layer rail, so that I can switch weather layers without crowding the rail.
2. As a Viewer, I want to pick Wind, Temperature, Cloud cover, Rain or Off, so that I see exactly one layer at a time and the map stays readable.
3. As a Viewer, I want wind drawn as moving streaks that show direction and strength, so that I can read the airflow at a glance.
4. As a Viewer, I want the streaks coloured by speed with a legend, so that "strong" means the same thing everywhere.
5. As a Viewer, I want temperature, cloud cover and rain drawn as colour fields with a legend and units, so that I can read a value for any place.
6. As a Viewer, I want the weather to follow the Event clock during the Replay, so that the rain I see matches the minute of the flood I am watching.
7. As a Viewer, I want a time slider from now to 7 days ahead when no Replay is running, so that I can look at the forecast.
8. As a Viewer, I want the layer to say "recorded weather, 26 Aug 2026" during the Replay and "forecast" otherwise, so that I never take one for the other.
9. As a Viewer, I want to see how old the forecast is, and an OFFLINE tag when it has gone stale, so that I know how far to trust it.
10. As a Viewer on a phone, I want the layers to pan smoothly, so that the map does not stutter with a weather layer on.
11. As a Viewer who prefers reduced motion, I want wind drawn as still arrows, so that nothing moves that I did not ask for.
12. As a Viewer, I want the layer remembered on this device, so that it is still there after a reload.
13. As a Viewer, I want the weather credit shown while a layer is on, so that the data source is acknowledged.

### Hub operator and Node operator

14. As a Hub operator, I want the Hub to fetch the forecast itself and keep the last good copy on disk, so that a restart or an outage does not blank the layers.
15. As a Node operator, I want my Node to download the weather from the Hub like the Cache Pack, so that a Mesh-only Node still has it.
16. As a Hub operator, I want the Hub to fetch no more often than once an hour, so that it stays inside the free usage terms.
17. As a pack builder, I want the recorded weather of 26 August built into the Cache Pack with checksums, so that the replay works offline and is reproducible.

### Reviewer

18. As a judge reading the repo, I want weather shown as context only, so that the pitch never implies rain caused the avalanche.

## Implementation Decisions

- **Source.** Open-Meteo, no key. Forecast: `api.open-meteo.com/v1/forecast`. Recorded weather: `archive-api.open-meteo.com/v1/archive` (reanalysis). Both accept many coordinates in one request. Hourly variables: `temperature_2m`, `cloud_cover`, `precipitation`, `wind_speed_10m`, `wind_direction_10m`. Credit "Weather data by Open-Meteo.com (CC BY 4.0)" is shown while a layer is on. Nothing goes in `.env.example`: no key, no setting.
- **Weather Grid.** A regular grid over the valley box, about 0.1° apart (roughly 30 points), one JSON file: grid corners and spacing, a list of hourly timestamps, and for each variable a flat array per hour. Speeds in m/s, direction in degrees, temperature in °C, cloud cover in %, rain in mm/h. The file layout was fixed in 0052 and is in `docs/specs/wire-formats.md` (UTC hourly timestamps, row-major flat arrays, 7 × 5 points over the pack's box). The data is reanalysis or model output at roughly 10 to 25 km, so it is context for the valley, not a measurement at a village; the legend says so.
- **Two weather files, one shape.** `weather_replay.json` is built into the Cache Pack and covers 25 to 27 August 2026. `weather_forecast.json` is written by the Hub in `NODE_DATA_DIR` and covers now to +7 days. The dashboard code does not care which it was given.
- **Which one is shown.** While a Replay runs the layer reads the replay file and follows the Event clock; with no Replay it reads the forecast file and the slider. There is no separate switch.
- **Distribution.** The replay file travels inside the Cache Pack (no new path). The forecast is served by the Hub at `/api/weather/forecast` and downloaded by other Nodes over the local network when reachable, with the same retry as the Cache Pack. It is not a Mesh message: a 7-day grid is far too large for Reticulum. A Mesh-only Node that never reached the Hub shows no forecast and says so; replay weather still works.
- **Hub fetcher (deep module).** Interface: "give me the newest good forecast and its age". It hides the request, validation of the response shape, writing the file atomically, the hourly refresh and the fall back to the last good copy. A failed fetch changes nothing on disk. A corrupt file on disk is treated as absent.
- **Dashboard modules.** A pure `weatherGrid` module: value at (lat, lon, time) by bilinear then linear-in-time interpolation, and speed and direction to u and v. A `weatherLayers` set of canvas overlays (colour field, wind particles) that take that module. Both are tested without Leaflet.
- **Wind drawing.** One canvas over the map. Particles ride the interpolated wind and are redrawn from stored tails each frame as one-pixel lines, 600 to 5,000 depending on map size, coloured by Beaufort-style speed bands. They pause when the tab is hidden. With `prefers-reduced-motion` the layer draws a static arrow grid instead. The approach follows Osiris (MIT); no code is copied.
- **Colour fields.** One canvas at low resolution, interpolated and upscaled with smoothing, colours from the theme roles. Temperature uses a diverging scale, cloud cover a white-to-grey ramp, rain a transparent-to-deep-blue ramp that never uses the risk colours.
- **Design changes.** `docs/design/ui.md`: the Layer rail gains the Weather button (nine buttons), and "no animated weather" now applies to the Storm Signal only. Weather layers sit under Nodes, Route and Shelters.
- **Tone.** The Replay's tone rules apply. The layers are context; no copy, legend or tooltip links rain to the avalanche.

## Testing Decisions

Test behaviour at the seams, not Leaflet or canvas pixels.

- **Dashboard seam (Vitest):** interpolation returns the right value at grid points, between them and between hours; speed and direction become the expected u and v; the Weather picker allows one layer at a time and remembers it; the replay file is chosen while a Replay runs and the forecast otherwise; a legend and the credit render for each layer; with reduced motion the wind layer renders arrows and starts no animation frame loop.
- **Node API seam (pytest):** `/api/weather/forecast` serves the last good file; a failed fetch keeps it; a corrupt file is treated as absent; the replay file in a valid pack is served; a pack whose weather checksum is wrong is discarded.
- **Build script:** a test with a stubbed Open-Meteo response checks the file shape.
- **By hand, noted in the ticket:** 60 fps panning on a phone with each layer on; the layer through a full Replay on one laptop.

## Out of Scope

- Satellite cloud imagery, radar and 3D clouds (Osiris has them; they need the internet).
- Several weather layers at once (Rain over another layer is a possible later change).
- Sensor Nodes measuring wind, temperature or rain, and drawing them next to the grid.
- Weather alerts, rain thresholds feeding Flood Risk, or any use of the grid in the Community Warning.
- Elevation-corrected temperature or terrain-aware rain; the grid is coarse by design.
- A user setting for the grid, the source or the refresh rate.

## Further Notes

- **Checked in 0052 (2026-10-17):** the archive has hourly values for all five variables, no gaps, at model-cell resolution. Rain is nearly flat over the valley before and during the Replay (mean 0.03 to 0.12 mm/h from 06:00 to 10:30 NPT) and builds only from about 10:45 NPT on 26 August, peaking in the afternoon and evening. The Rain layer therefore looks nearly empty while the Replay runs; the wet day shows only if the slider runs past 10:30. Details are in ticket 0052. This also keeps the tone rule: the data does not suggest rain triggered the avalanche.
- Open-Meteo's free tier is for non-commercial use with a daily call limit; one request for about 30 points an hour is well under it.
- Live forecast tickets (0057, 0058) are stretch: the demo is the replay.
