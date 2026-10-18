# 0065: Wave front and river flow

**What to build:** When the Replay's Surge fires, a bright wave front runs down the Bhote Koshi and Trishuli on the map at the replay's per-reach speeds, leaving a fading trail and lighting each Node and town as it passes, in step with the Wave ETA countdown. Every other river shows slow, dim flow.

**Blocked by:** 0033, 0063

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** leonardorofaDV

**Spec:** `docs/specs/gods-eye-view.md`

- [ ] The wave front's position is computed from the river line, the Surge's origin and time and the per-reach speeds (the same functions as the Wave ETA in `waveEta.ts`), on the Event clock, so it reaches a town when that town's ETA reads zero
- [ ] A test fixes the Event clock and checks the front's position at three times and its arrival at a town against the ETA
- [ ] Nodes and towns light as the front passes them and settle after; no animation runs before a Surge exists
- [ ] Ambient flow: slow dim dashes along the other rivers, decorative only, off when the Fleet toggle is off or reduced motion is on
- [ ] With reduced motion on, the front is a static marked reach plus the ETA, not an animation
- [ ] The measured wave speed (0050), when present, moves the front the same way it moves the ETA
- [ ] Performance bar holds with the front and ambient flow running; checked by hand and noted here
- [ ] All **Commands** pass
