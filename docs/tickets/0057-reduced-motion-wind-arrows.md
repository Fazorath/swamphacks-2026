# 0057: Reduced-motion wind arrows

**What to build:** A Viewer who asks for reduced motion sees wind as a still grid of arrows (rotation shows direction, length and colour show speed) instead of moving particles.

**Blocked by:** 0056

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/weather-layers.md`

- [ ] With `prefers-reduced-motion: reduce` the Wind layer draws arrows on a screen-space grid and starts no animation loop
- [ ] Arrows use the same speed bands and legend as the particles
- [ ] Arrows redraw when the Event clock or the map moves
- [ ] Vitest: a mocked reduced-motion query gives arrows and no frame requests; arrow rotation matches the wind direction for the four compass directions
- [ ] All **Commands** pass
