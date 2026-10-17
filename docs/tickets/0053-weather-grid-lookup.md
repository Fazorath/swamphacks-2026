# 0053: Weather Grid lookup

**What to build:** One dashboard module answers "what is the temperature, cloud cover, rain, and wind at this place and time?" from a Weather Grid, with no map and no canvas. Every weather layer is built on it.

**Blocked by:** None (can start immediately; use a hand-made grid until 0052 fixes the file layout, then match it)

**Status:** in-progress

**Owner:** refloow-0

**Spec:** `docs/specs/weather-layers.md`

- [x] `valueAt(grid, variable, lat, lon, time)`: bilinear in space, linear between hours; clamps at the grid edge and the first and last hour instead of returning NaN
- [x] `windAt(grid, lat, lon, time)` returns u (east) and v (north) in m/s from speed and direction (a wind from the north, 0°, blows south)
- [x] `speedBand(ms)` names the Beaufort-style band for a speed
- [x] A malformed grid (missing variable, wrong array length) throws an error that names the problem
- [x] Vitest: exact at grid points; midpoint between points and between hours; edge clamping; u and v for the four compass directions; band boundaries; malformed grid
- [x] All **Commands** pass
