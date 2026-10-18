# 0073: Nepal-wide Weather Grid

**What to build:** The Weather Grid covers the whole of Nepal at 0.5° instead of the valley at 0.1°, and carries temperature, cloud cover and rain only. The Cache Pack's `weather_replay.json` and the Hub's forecast both use it, so the Weather layers fill the God's Eye View instead of a small patch over Langtang.

**Blocked by:** None (can start immediately; the Nepal box is in 0063's `nepal.bbox`, already on `main`)

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** refloow-0

**Spec:** `docs/specs/weather-layers.md`

- [ ] `weather_grid.py`: the grid step is 0.5° and the box is the pack's Nepal box (about 9 × 17 = 153 points); the valley box and step leave the weather code
- [ ] `VARIABLES` is `temperature_2m`, `cloud_cover`, `precipitation`; neither the archive nor the forecast request asks for wind
- [ ] `build_cache_pack.py` writes the national `weather_replay.json` (25 to 27 Aug 2026); the real build is run and its size and point count noted here (expect about 200 KB)
- [ ] The Hub's forecast (0058) fetches the same grid; a forecast file on disk with the old valley grid or wind variables counts as absent and is fetched again
- [ ] `weatherGrid.ts` loses `windAt` and `speedBand` and their tests; `valueAt` and the malformed-grid check keep working on the new file
- [ ] `docs/specs/wire-formats.md` Weather Grid section shows the national grid and the three variables
- [ ] pytest: the stubbed archive and forecast answers produce 153 points in row-major order with no wind; Vitest: `valueAt` on a national-shaped grid
- [ ] A rebuilt pack (`cache-pack-v4` or later) carries the file; record which release in the lessons log
- [ ] All **Commands** pass
