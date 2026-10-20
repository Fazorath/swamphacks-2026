# Building and publishing the Cache Pack

Run once, ahead of the event, with internet. Spec: `docs/tickets/0007-cache-pack-shelters-flood-prone-areas-tiles.md`, layout: `docs/specs/wire-formats.md`.

```
uv run --project node python scripts/build_cache_pack.py          # writes build/cache-pack.zip
gh release create cache-pack-v1 build/cache-pack.zip              # or `gh release upload` to replace it
```

Then set `CACHE_PACK_URL` on the Hub to the Release asset's download URL. Sensor Nodes set it to the Hub's `/api/cache-pack.zip`.

- `--roads-pbf <nepal-latest.osm.pbf>` (the build downloads the Geofabrik `asia/nepal` extract to that path when the file is missing; run with `uv run --project node --with pyrosm`) adds `roads.json`, the Road graph the phone reroutes on (ticket 0018), and `routes/` with the `route_grid` in the manifest (ticket 0051): the shortest drive from each Grid point to each Shelter, left out when it crosses the Flood-Prone Area. Without it the pack has no graph or Routes and Blocked Roads are unavailable.
- Needs `httpx` (a Node dependency). `CARTO_API_KEY` is needed only with `--raster-tiles`, which fetches the valley's CARTO raster tiles; v4 leaves them out.
- The pack covers the Bhote Koshi valley, from the Lhende Khola down to below Trishuli (`BBOX` in the script, about 66 x 40 km). Without `--roads-pbf` there is no route grid and the plan works without one. The valley's CARTO raster tiles (zoom 10 to 14) are built only with `--raster-tiles`; v4 leaves them out.
- The build takes a few minutes. With `--raster-tiles` it fetches CARTO Dark Matter tiles politely (identifying `User-Agent`, delay between requests), credited "© OpenStreetMap contributors © CARTO" on the map.
- `shelters.source.json` is the curated list. Each entry's `source` note records the OSM id, how the height above the river was measured and when it was checked. The build fails if a Shelter lies outside the box. None has been visited or confirmed by the district; the notes say so.
- `high_ground.source.json` lists the High-ground points (ticket 0068): name, position, the key place it belongs to, a `source` note and a check date. The build reads each point's climb above the nearest river vertex from the elevation tiles it has just fetched, and fails on a point inside or within 100 m of the Flood-Prone Area, a climb under 50 m, or no key place within 2 km. Every point is a PLACEHOLDER picked from the tiles, not visited.
- `river.source.geojson` (the river line with River km and a speed per reach) and `flood_corridor.source.geojson` (the Flood-Prone Area: 150 m each side of the river line, approximate) are written by `uv run --project node python scripts/derive_river.py` from OpenStreetMap ways through Overpass. Run it again only when the river inputs change, and commit the two files. The speeds are reconstructed from reported arrival times, and each reach cites its source.
- River km is zero at the Lhende-Kyirong confluence (28.2781 N, 85.3770 E), negative upstream.
- The build also asks Open-Meteo's archive once for the recorded weather of 25 to 27 Aug 2026 at the 153 grid points of the Weather Grid over all of Nepal (`pack_weather.py`, no key) and stores it as `weather_replay.json`. It needs the internet like the tile fetch; the layout is in `docs/specs/wire-formats.md`.
- `bbox` in the manifest is `[south, west, north, east]`.

## The Nepal map (ticket 0063, `pack_nepal.py`)

The God's Eye View draws Nepal from the pack, with no tiles and no internet. The build adds `nepal/border.geojson`, `nepal/districts.geojson`, `nepal/rivers.geojson`, `nepal/places.geojson` and Terrarium elevation tiles under `elevation/{z}/{x}/{y}.png`; the manifest's `nepal` entry lists the elevation zooms and every source below, so the map credit reads them from the pack. It needs the internet (geoBoundaries, Overpass, AWS) and no key.

| Layer | Source | Licence | Checked |
|---|---|---|---|
| Border (ADM0) | geoBoundaries, "Geoboundaries, Open Data Nepal", built 12 Dec 2023 | CC BY 4.0 | 2026-10-18 |
| Districts (ADM2, 75 of them) | geoBoundaries, "geoBoundaries, Wikimedia Commons", built 12 Dec 2023 | Public Domain | 2026-10-18 |
| Rivers, places | OpenStreetMap through the Overpass API | ODbL 1.0 | 2026-10-18 |
| Elevation | AWS Terrain Tiles (Terrarium); over Nepal from SRTM | SRTM is public domain; attribution at `github.com/tilezen/joerd/blob/master/docs/attribution.md` | 2026-10-18 |

- **Licences differ by level**: geoBoundaries takes each level from a different source (ADM1, the provinces, is CC BY 3.0 IGO and is not used). The build reads the licence from the dataset's own metadata each time and writes it into the manifest.
- **Borders are drawn as the dataset gives them**: geoBoundaries' simplified geometry, coordinates rounded to 4 decimals, no editing. The map shows "Boundaries are indicative" beside the credit (`boundaries_note` in the manifest). The dataset has 75 districts, not Nepal's 77.
- **Rivers**: every OpenStreetMap `waterway=river` way with a vertex in Nepal (every tenth raw vertex and the last are tested, before simplifying), simplified to about 55 m (`RIVER_TOLERANCE_DEGREES`). A way with no Latin-letter name is kept only if it is 12 km or longer. `main` is `Koshi`, `Gandaki`, `Karnali`, `Mahakali` or `Bhote Koshi–Trishuli` for ways OpenStreetMap names as that river's main stem (the table is `MAIN_RIVERS`; the Koshi group includes the Sun Kosi, the Gandaki group the Narayani and Kali Gandaki); tributaries such as the Tamakoshi, Budhi Gandaki and Mugu Karnali are `null`. Names come from `name:en`, else a Latin `name`: the map has no Devanagari font. Nothing is hand-drawn.
- **Key places** (`key_places.source.json`): Kathmandu and the four valley towns (Timure, Syabrubesi, Betrawati, Trishuli) are written by hand with a position, a published height, a tolerance and a source note, and carry `"key": true` in `places.geojson` so the map can label them alone at the national zoom. They replace any OpenStreetMap copy of the same name. The other places are all cities and towns in Nepal, plus the villages and hamlets inside the valley box.
- **Elevation**: zoom 5 to 8 over the whole country (about 600 m a pixel at zoom 8) and zoom 9 to 12 (about 35 m a pixel) over the valley box and the Kathmandu valley (`KATHMANDU_BBOX`). The build prints the size of each part and fails over 10 MB of elevation tiles (`ELEVATION_BUDGET_BYTES`). It then reads the height at each key place from its own tiles and fails if one is further from the published height than its tolerance. The last run: Kathmandu 1,281 m (published 1,400, ±150), Timure 1,732 (1,900, ±200), Syabrubesi 1,403 (1,460, ±150), Betrawati 549 (600, ±100), Trishuli 636 (620, ±100). Heights are approximate (the manifest says `"approximate": true`) and the map credit must say so. The real run: 9.6 MB of elevation tiles (138), 1.3 MB of vectors, a 10.0 MB zip (v3 was 2.4 MB with its raster tiles).
- **River accuracy**: checked by number, not by eye, on 2026-10-18. Against the raw OpenStreetMap ways of each main river, the pack's lines were 1 to 3 % shorter and no vertex lay further than 60 m from them (Gandaki's two apparent outliers were my matching two ways that start at the same point). The look of the national and valley views is still for a person to judge once the map ticket (0033) draws them.
- The credit the map prints: "Boundaries © geoBoundaries (CC BY 4.0, Public Domain) · Rivers and places © OpenStreetMap contributors (ODbL) · Elevation (approximate): SRTM via AWS Terrain Tiles". The map ticket (0033) builds it from the manifest's `sources`.
