# 0065: Wave front and river flow

**What to build:** When the Replay's Surge fires, a white comet-shaped wave front runs down the Bhote Koshi and Trishuli on the map at the replay's per-reach speeds, leaving a trail that fades over the last 15 km and lighting each Node and town as it passes, in step with the Wave ETA countdown. Every other river shows slow, dim drifting dashes. Decisions D-16 to D-21 in `docs/design/gods-eye-view-decisions.md`.

**Blocked by:** 0033, 0063

**Status:** done

**Owner:** Fazorath

**Assignee:** leonardorofaDV

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/gods-eye-view-decisions.md`; canvas artboards `G-Warning-Moment` (comet and 15 km trail) and `G-Wave-Arrival` (a town as the wave passes).

- [x] The wave front's position is computed from the river line, the Surge's origin and time and the per-reach speeds (the same functions as the Wave ETA in `waveEta.ts`), on the Event clock, so it reaches a town when that town's ETA reads zero
- [x] A test fixes the Event clock and checks the front's position at three times and its arrival at a town against the ETA
- [x] The front is a comet in white (`ink-50`): a bright head with a soft glow and a trail that fades over the last 15 km behind it (D-16, D-17, D-19); it never borrows a risk colour, the cyan Route or the violet Community colour
- [x] A Node the front passes goes wave-white for about 2 event minutes, then follows its real state (High, then Stale as the data says; D-18); at each town the place label turns wave-white and the arrival time (for example "08:53") appears beside it and stays for the rest of the replay (D-21); no animation runs before a Surge exists
- [x] Ambient flow: slow dim drifting dashes along the other rivers (D-20), decorative only, off when the Fleet toggle is off or reduced motion is on
- [x] With reduced motion on, the front is a marked reach (a comet that steps once per clock answer, no gliding) plus the ETA, not an animation
- [x] The measured wave speed (0050), when present, moves the front the same way it moves the ETA
- [ ] Performance bar holds with the front and ambient flow running; checked by hand and noted here. NOT checked: no browser in this session. Check 60 fps on the demo laptop (see `lessons.md`, "Wave front and river flow")
- [x] All **Commands** pass
