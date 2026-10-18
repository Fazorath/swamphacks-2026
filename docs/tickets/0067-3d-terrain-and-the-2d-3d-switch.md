# 0067: 3D terrain and the 2D / 3D switch

**What to build:** The map tilts over the valley with real terrain from the Cache Pack's elevation tiles, exaggerated about 1.5 times, so the steep valley walls read at a glance. A bottom-left 2D / 3D switch turns it off, and terrain turns itself off if the frame rate drops. The national view stays flat and top-down.

**Blocked by:** 0033, 0063

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

- [ ] Terrain loads from the pack's elevation tiles through a local tile protocol (no AWS URL), with a small cache and cancellable requests; the helpers ported from Osiris (`terrain-tiles`, `map-terrain`, `map-projection`) keep its MIT notice in their headers and in the README, and are written to match this codebase
- [ ] Pitch is capped at 60 degrees, exaggeration about 1.5, and terrain is released when the view is zoomed out to the national level
- [ ] The 2D / 3D switch works and remembers the choice on this device
- [ ] A frame-rate watch turns terrain off (and says so in the status strip) when panning drops under a threshold named in the code; checked by forcing it in a test with a fake frame clock
- [ ] Without elevation tiles (a v3 pack) the switch is disabled with a one-line reason and the map stays flat
- [ ] Performance bar: first paint under 1 s and 60 fps panning with terrain on, on the demo laptop; checked by hand and noted here
- [ ] Manual check on a second laptop: 3D on a weaker GPU either holds the bar or drops to 2D by itself
- [ ] All **Commands** pass
