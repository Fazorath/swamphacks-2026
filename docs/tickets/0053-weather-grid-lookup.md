# 0053: Weather Grid lookup

**What to build:** One dashboard module answers "what is the temperature, cloud cover, rain, and wind at this place and time?" from a Weather Grid, with no map and no canvas. Every weather layer is built on it.

**Blocked by:** None (can start immediately; use a hand-made grid until 0052 fixes the file layout, then match it)

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/weather-layers.md`

- [ ] `valueAt(grid, variable, lat, lon, time)`: bilinear in space, linear between hours; clamps at the grid edge and the first and last hour instead of returning NaN
- [ ] `windAt(grid, lat, lon, time)` returns u (east) and v (north) in m/s from speed and direction (a wind from the north, 0°, blows south)
- [ ] `speedBand(ms)` names the Beaufort-style band for a speed
- [ ] A malformed grid (missing variable, wrong array length) throws an error that names the problem
- [ ] Vitest: exact at grid points; midpoint between points and between hours; edge clamping; u and v for the four compass directions; band boundaries; malformed grid
- [ ] All **Commands** pass
