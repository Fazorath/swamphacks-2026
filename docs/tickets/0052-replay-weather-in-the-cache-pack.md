# 0052: Replay weather in the Cache Pack

**What to build:** The Cache Pack carries the recorded weather of 25 to 27 August 2026 over the valley, and every Node serves it from disk. This ticket also settles the Weather Grid file layout and checks that the data is good enough to draw.

**Blocked by:** 0043

**Status:** done

**Owner:** leonardorofaDV

**Spec:** `docs/specs/weather-layers.md`

- [x] First, fetch the Open-Meteo archive for the valley box by hand and report: are `temperature_2m`, `cloud_cover`, `precipitation`, `wind_speed_10m` and `wind_direction_10m` present hourly for 26 Aug 2026, at what spacing, and does rain visibly build over the Langtang catchment that morning? Write the answer in the ticket; if rain is flat, stop and tell the group before building more
- [x] The Weather Grid layout (corners, spacing, hourly timestamps, one flat array per variable and hour, units) is written into `docs/specs/wire-formats.md`
- [x] The build script fetches the archive for about 30 grid points in one request, writes `weather_replay.json` and lists its checksum in the manifest
- [x] A Node discards a pack whose weather checksum is wrong, like any other file
- [x] `GET /api/weather/replay` serves the file from the pack; 404 with a clear message when the pack has none
- [x] The file carries its source and the credit text
- [x] pytest: the build helper makes the file from a stubbed response; the route serves it; a wrong checksum discards the pack
- [x] All **Commands** pass

## Archive check (2026-10-17)

One request to `archive-api.open-meteo.com/v1/archive` for 28 points (7 × 4 at 0.1° over 27.86–28.46 N, 85.08–85.47 E), 25–27 Aug 2026, `timezone=UTC`, `wind_speed_unit=ms`:

- **All five variables are present, hourly, with no nulls** (72 hours, one flat array each). Units: °C, %, mm (per hour), m/s, °.
- **Open-Meteo snaps each point to its own model cell and returns that cell's coordinates**, up to about 0.05° from the ones asked for (first point asked 27.86, 85.08, answered 27.873, 85.034). The file must use the coordinates we asked for.
- **Rain does not build over the valley before the flood.** On 26 Aug the mean over the box is 0.03 to 0.06 mm/h from 00 to 03 UTC (06:00 to 08:45 NPT); the earthquake at 08:37 NPT is 02:52 UTC. Rain only picks up from 05 UTC (about 10:45 NPT: mean 0.4, max 2.4 mm/h), peaks 07 to 11 UTC (mean 0.7 to 0.8, max about 3 mm/h) and again 19 to 21 UTC. Across the Replay window (08:30 to 10:30 NPT = 02:45 to 04:45 UTC) the mean is 0.05 to 0.12 mm/h and the largest single cell is 0.7 mm/h: nearly flat. Cloud cover is 46 to 69 % then and 99 to 100 % in the afternoon and evening.
- So the weather exists and is usable, but a Viewer watching the 08:30 to 10:30 Replay sees almost no rain. The wet monsoon day shows only if the layer's time range runs past the Replay's 10:30 end.
