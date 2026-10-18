# 0056: Wind particles

**What to build:** Picking Wind draws animated streaks that follow the wind over the valley, coloured by speed, locked to the Event clock. A Viewer sees direction and strength at a glance.

**Blocked by:** 0052, 0054, 0044

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/weather-layers.md`

- [ ] One canvas over the map; particles ride the interpolated wind from 0053, each dragging a short tail drawn as a one-pixel line; 600 to 5,000 particles by map size
- [ ] Colours come from the Beaufort-style bands in 0053 and the theme roles; legend with speed bands in m/s and the same tag and credit as 0055
- [ ] Particles keep their lat/lon, so they stay put when the map pans and zooms
- [ ] Animation stops while the tab is hidden and resumes when it shows
- [ ] Wind changes smoothly when the Event clock moves an hour; particles are not reset
- [ ] Vitest with the animation clock injected: particles move along a known wind; a hidden tab schedules no frames; the particle count follows map size
- [ ] 60 fps panning on a mid-range phone with Panels open, checked by hand and noted in the ticket
- [ ] All **Commands** pass
