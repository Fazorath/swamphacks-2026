# 0063: Nepal vector Cache Pack (v4)

**What to build:** The Cache Pack carries a vector map of the whole of Nepal (country border, districts, rivers, places) and elevation tiles, so the God's Eye View draws from disk with no tiles and no internet. A Node that has the pack serves it; the build script records every source, licence and check date.

**Blocked by:** None (can start immediately; the map reads it from 0033 on)

**Status:** done

**Owner:** Fazorath

**Assignee:** refloow-0

**Spec:** `docs/specs/gods-eye-view.md`

- [x] `scripts/build_cache_pack.py` adds a Nepal vector bundle: borders and districts from geoBoundaries, rivers and places from OpenStreetMap; the four main rivers (Mahakali, Karnali, Gandaki, Koshi) and the Bhote Koshi–Trishuli carry their names (D-03)
- [x] The river lines are accurate: every river comes from OpenStreetMap waterway geometry, none is hand-drawn or simplified past what the valley zoom can show, and the design board's schematic drawing is not a source (owner's note on D-03). Visual check by hand: the drawn Nepal rivers are compared against the OSM source (or an OSM-based map) at the national zoom and over the valley, and the result is noted here
  - Done by number (2026-10-18, details in the README): lines 1 to 3 % shorter than the OpenStreetMap ways, none more than 60 m off. Compared by eye on 2026-10-18 in a throwaway canvas preview of the pack (national view and valley, with the pack's own river line overlaid): the rivers and the valley line agree.
- [x] Place data carries what D-04 needs: Kathmandu and the four valley towns (Timure, Syabrubesi, Betrawati, Trishuli) marked so the map can label them alone at the national zoom, the other cities on zoom
  - `key_places.source.json` supplies the five places with positions, sources and `key: true`.
- [x] Elevation tiles (Terrarium format) from SRTM: the valley at about 30 m, a coarse layer for the whole country; the build prints the size of each part and the total, and the pack stays within a budget agreed in the ticket (the estimate is 6 to 10 MB more than v3)
  - Budget agreed: elevation tiles at most 10 MB, pack about 10 MB (7.6 MB more than v3). Detail (zoom 9 to 12) covers the valley and the Kathmandu valley.
- [x] The build prints the pack's elevation at each Cache Pack place, read from the tiles at the pack's own coordinates, and a test checks each against a published value with a stated tolerance (about ±100 m, wider in gorges; a first sample from z12 Terrarium tiles read Syabrubesi 1781 m, Timure 2168 m, Betrawati 609 m, Trishuli 621 m, Kathmandu 1294 m, at approximate coordinates). The map credit says elevation is approximate and carries the Terrain Tiles / SRTM attribution
  - Build prints and checks all five (tests in `test_pack_nepal.py`); the "approximate" credit is in the manifest, and 0033 prints it on the map.
- [x] The manifest lists every new file with its sha256; a Node discards a pack that fails its checksums, as before
- [x] The Node serves the new files under its pack routes; a pack without them (v3) still works and the map falls back to the river and corridor it has
- [x] Sources, licences (CC BY, ODbL, SRTM) and check dates are in `scripts/cache-pack/README.md` and shown on the map credit; borders are drawn as the dataset gives them
  - README table written; the map credit is built from the manifest's `nepal.sources` by 0033 (the Leaflet map still shows CARTO's). The credit text was checked in the preview; 0033 prints it on the real map from `nepal.sources`, `boundaries_note` and `elevation.approximate`.
- [x] Release `cache-pack-v4` is built and noted in `docs/agents/lessons.md` with its real size; the raster tiles are left out
  - Published as `cache-pack-v5` (10.0 MB), because the `cache-pack-v4` tag was already taken by a 2.5 MB valley pack that `scripts/run-demo.sh` downloads. `run-demo.sh` still uses v4 until someone points it at v5 and the map no longer needs raster tiles (0033).
- [x] Python tests for the new manifest entries and the fallback; `scripts/check.sh` passes
