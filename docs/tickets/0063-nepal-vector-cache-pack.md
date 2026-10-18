# 0063: Nepal vector Cache Pack (v4)

**What to build:** The Cache Pack carries a vector map of the whole of Nepal (country border, districts, rivers, places) and elevation tiles, so the God's Eye View draws from disk with no tiles and no internet. A Node that has the pack serves it; the build script records every source, licence and check date.

**Blocked by:** None (can start immediately; the map reads it from 0033 on)

**Status:** in-progress

**Owner:** Fazorath

**Assignee:** refloow-0

**Spec:** `docs/specs/gods-eye-view.md`

- [ ] `scripts/build_cache_pack.py` adds a Nepal vector bundle: borders and districts from geoBoundaries, rivers and places from OpenStreetMap; the four main rivers (Mahakali, Karnali, Gandaki, Koshi) and the Bhote Koshi–Trishuli carry their names (D-03)
- [ ] The river lines are accurate: every river comes from OpenStreetMap waterway geometry, none is hand-drawn or simplified past what the valley zoom can show, and the design board's schematic drawing is not a source (owner's note on D-03). Visual check by hand: the drawn Nepal rivers are compared against the OSM source (or an OSM-based map) at the national zoom and over the valley, and the result is noted here
- [ ] Place data carries what D-04 needs: Kathmandu and the four valley towns (Timure, Syabrubesi, Betrawati, Trishuli) marked so the map can label them alone at the national zoom, the other cities on zoom
- [ ] Elevation tiles (Terrarium format) from SRTM: the valley at about 30 m, a coarse layer for the whole country; the build prints the size of each part and the total, and the pack stays within a budget agreed in the ticket (the estimate is 6 to 10 MB more than v3)
- [ ] The build prints the pack's elevation at each Cache Pack place, read from the tiles at the pack's own coordinates, and a test checks each against a published value with a stated tolerance (about ±100 m, wider in gorges; a first sample from z12 Terrarium tiles read Syabrubesi 1781 m, Timure 2168 m, Betrawati 609 m, Trishuli 621 m, Kathmandu 1294 m, at approximate coordinates). The map credit says elevation is approximate and carries the Terrain Tiles / SRTM attribution
- [ ] The manifest lists every new file with its sha256; a Node discards a pack that fails its checksums, as before
- [ ] The Node serves the new files under its pack routes; a pack without them (v3) still works and the map falls back to the river and corridor it has
- [ ] Sources, licences (CC BY, ODbL, SRTM) and check dates are in `scripts/cache-pack/README.md` and shown on the map credit; borders are drawn as the dataset gives them
- [ ] Release `cache-pack-v4` is built and noted in `docs/agents/lessons.md` with its real size; the raster tiles are left out
- [ ] Python tests for the new manifest entries and the fallback; `scripts/check.sh` passes
