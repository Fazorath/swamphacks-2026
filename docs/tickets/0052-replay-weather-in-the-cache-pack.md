# 0052: Replay weather in the Cache Pack

**What to build:** The Cache Pack carries the recorded weather of 25 to 27 August 2026 over the valley, and every Node serves it from disk. This ticket also settles the Weather Grid file layout and checks that the data is good enough to draw.

**Blocked by:** 0043

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/weather-layers.md`

- [ ] First, fetch the Open-Meteo archive for the valley box by hand and report: are `temperature_2m`, `cloud_cover`, `precipitation`, `wind_speed_10m` and `wind_direction_10m` present hourly for 26 Aug 2026, at what spacing, and does rain visibly build over the Langtang catchment that morning? Write the answer in the ticket; if rain is flat, stop and tell the group before building more
- [ ] The Weather Grid layout (corners, spacing, hourly timestamps, one flat array per variable and hour, units) is written into `docs/specs/wire-formats.md`
- [ ] The build script fetches the archive for about 30 grid points in one request, writes `weather_replay.json` and lists its checksum in the manifest
- [ ] A Node discards a pack whose weather checksum is wrong, like any other file
- [ ] `GET /api/weather/replay` serves the file from the pack; 404 with a clear message when the pack has none
- [ ] The file carries its source and the credit text
- [ ] pytest: the build helper makes the file from a stubbed response; the route serves it; a wrong checksum discards the pack
- [ ] All **Commands** pass
