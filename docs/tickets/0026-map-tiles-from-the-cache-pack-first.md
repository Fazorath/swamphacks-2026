# 0026: Map tiles come from the Cache Pack first (9.5)

**What to build:** The map loads its tiles from the Node's own disk when the Cache Pack is available, so panning and zooming inside the demo box no longer stalls on live CARTO fetches and the map still draws with the internet unplugged. Split out of 0025 and built right after 0009, before the cut-line check.

**Blocked by:** 0005, 0007, 0009

**Status:** done

**Owner:** Fazorath

**Spec:** `docs/specs/cache-pack.md`

- [x] The tile source is one setting the map reads: the Node's own `/api/cache-pack/files/tiles/{z}/{x}/{y}.png` when the pack is available, the online tiles 0005 uses (`/api/tiles/...`) when it is not
- [x] A tile the pack does not hold (outside the box, or above zoom 16) still loads from the online tiles when there is internet
- [x] The data credit "© OpenStreetMap contributors © CARTO" is always shown on the map
- [x] Vitest tests with a fixture pack: the map reads tiles from the pack when available and falls back when not
- [ ] Manual check: zooming and panning inside the box shows no multi-second stalls, and with the internet off the map tiles still draw on a phone (NOT DONE: no phone or browser run yet; software paths covered by Vitest only)
- [x] All **Commands** pass
