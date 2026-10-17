# 0043: Cache Pack for the Bhote Koshi valley

**What to build:** The Cache Pack covers the valley from the Lhende Khola down to below Trishuli instead of Gainesville. It holds the river corridor as the Flood-Prone Area, hand-picked Shelters on high ground, and a river line with River km and reach speeds. A Node started with no position opens on the valley, and the map centres there.

**Blocked by:** None (can start immediately)

**Status:** done

**Owner:** Fazorath

**Spec:** `docs/specs/flash-flood-replay.md`

- [x] The build script's box, zoom range and inputs are the valley's; FEMA zones, the creek floodplains and the Florida extract are gone from the build
- [x] Hand-drawn river corridor along the Lhende Khola, Bhote Koshi and Trishuli as the Flood-Prone Area, marked approximate
- [x] 4–6 Shelters near Syabrubesi and Betrawati, each with OSM id or source, check date and height above the river (the Syabrubesi gompa and a hillside school above Betrawati among them)
- [x] `river.geojson`: the river line with River km measured from the Lhende–Kyirong confluence, and a speed per reach (about 190 km/h above the border, 68 km/h to Betrawati, 18 km/h below), each citing its source
- [x] S0's River km on the Lhende Khola is measured on the river line and written into the spec's Node table
- [x] The pack stays under the existing size budget; no route grid in the main path (the plan already copes without one)
- [x] Default Node latitude/longitude, `.env.example` and the map centre move to Betrawati; the "Downtown Gainesville" comment goes
- [x] Node tests that check pack contents use a valley fixture; tests whose location does not matter keep their coordinates
- [x] Rebuild and publish the pack as a new Release; the rehearsal recipe in the lessons log still works with it
- [x] All **Commands** pass
