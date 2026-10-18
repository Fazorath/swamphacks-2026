# 0067: 3D terrain and the 2D / 3D switch

**What to build:** Terrain is on by default: the map tilts over the valley with real terrain from the Cache Pack's elevation tiles at a 45° pitch, exaggerated 1.5 times, the walls shaded in height bands, so the steep valley walls read at a glance. The national view stays flat and top-down, and the map tilts only when the camera flies. A bottom-left segmented 2D | 3D switch turns terrain off by hand, and an automatic drop to 2D on frame-rate loss is a safety net only, never the normal state. Decisions D-30 to D-35 in `docs/design/gods-eye-view-decisions.md`; the performance acceptance is the owner's call of 2026-10-18 (no separate benchmark will be run).

**Blocked by:** 0033, 0063

**Status:** in-progress

**Owner:** Fazorath

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

- [x] Terrain loads from the pack's elevation tiles through a local tile protocol (no AWS URL), with a small cache (the demo laptop has 8 GB of RAM, so the elevation tile cache stays small) and cancellable requests; the helpers ported from Osiris (`terrain-tiles`, `map-terrain`, `map-projection`) keep its MIT notice in their headers and in the README, and are written to match this codebase
- [x] 3D is the default on a pack with elevation tiles: the valley view pitches to 45° (D-30) with exaggeration 1.5 (D-31), and terrain is released when the view is zoomed out to the national level
- [x] The valley walls are shaded by height bands (hypsometric tint): the ground lightens with elevation in two or three steps, in theme roles (D-32)
- [x] Manual zooming and panning never tilt the map; the pitch comes in only on the warning's camera fly (0066) and from a Valley button (D-33)
- [x] The 2D / 3D switch is a segmented `2D | 3D` control that is the last row of the legend box bottom-left (D-34, owner's call on 2026-10-18); it works and remembers the choice on this device
- [x] The automatic drop to 2D is a safety net: a frame-rate watch turns terrain off when panning drops under a threshold named in the code, and the only sign is one status-strip line, "Terrain off · frame rate", in amber mono; nothing else moves (D-35); checked by forcing it in a test with a fake frame clock. On the demo laptop it must not fire in normal use
- [x] Without elevation tiles (a v3 pack) the switch is disabled with a one-line reason and the map stays flat
- [ ] Performance, measured by hand on the actual demo laptop (MacBook Pro, Apple M2, 8 GB RAM, Chrome, on the projector or an external display at 120% scale, the Node serving over the local network) and recorded in this ticket: first paint time, and the fps while panning and while the camera flies, with terrain on, the 40 fleet dots drawn, a wave front running and two glass Panels open (Chrome's rendering FPS meter or a frame-time readout; note the p95 frame time)
- [ ] The bar is 60 fps held. If it is not held, this ticket lists what was cut, in this order, before 2D by default is accepted: backdrop-filter blur off over the map canvas; fleet dots as map layers, never DOM markers; DEM maxzoom or tile size lowered; `pixelRatio` capped; exaggeration lowered
- [ ] If a second laptop with a weaker GPU is available: 3D on it either holds the bar or drops to 2D by itself, noted here
- [ ] All **Commands** pass

## Build notes (2026-10-18)

- Terrain draws from the pack's own `elevation` source through the Node (`/api/cache-pack/files/elevation/...`), so no AWS URL. The height bands come from a `elevation-bands://` protocol (`heightBands.ts`) that repaints the same Terrarium tile into a three-step tint. Nothing was ported from Osiris, so no MIT notice was needed; the first criterion's "ported helpers" clause does not apply. The tile cache is capped with `maxTileCacheSize: 40`, and a cancelled tile aborts its fetch.
- The 24 fps floor (`MIN_PANNING_FPS`) is judged over 30 frames, only while the camera moves with terrain drawn.
- **Not done, by-hand on the demo laptop:** the performance criteria (first paint, fps panning and flying, p95), the cut list if 60 fps is not held, and the second-laptop check. No browser was available in this session, so the real WebGL terrain, the banded tint protocol (`OffscreenCanvas`) and the Valley fly are unseen outside jsdom. 0066's warning fly does not exist yet; the Valley button is the only fly.
- The Valley view (`VALLEY_VIEW`, centre 85.19, 27.98, zoom 10) is a guess; tune it by eye.
