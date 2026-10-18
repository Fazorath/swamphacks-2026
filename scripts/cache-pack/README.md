# Building and publishing the Cache Pack

Run once, ahead of the event, with internet. Spec: `docs/tickets/0007-cache-pack-shelters-flood-prone-areas-tiles.md`, layout: `docs/specs/wire-formats.md`.

```
uv run --project node python scripts/build_cache_pack.py          # writes build/cache-pack.zip
gh release create cache-pack-v1 build/cache-pack.zip              # or `gh release upload` to replace it
```

Then set `CACHE_PACK_URL` on the Hub to the Release asset's download URL. Sensor Nodes set it to the Hub's `/api/cache-pack.zip`.

- `--roads-pbf <nepal-latest.osm.pbf>` (download from Geofabrik `asia/nepal`, run with `uv run --project node --with pyrosm`) adds `roads.json`, the Road graph the phone reroutes on (ticket 0018), and `routes/` with the `route_grid` in the manifest (ticket 0051): the shortest drive from each Grid point to each Shelter, left out when it crosses the Flood-Prone Area. Without it the pack has no graph or Routes and Blocked Roads are unavailable.
- Needs `httpx` (a Node dependency). `CARTO_API_KEY` is needed only with `--raster-tiles`, which fetches the valley's CARTO raster tiles; v4 leaves them out.
- The pack covers the Bhote Koshi valley, from the Lhende Khola down to below Trishuli (`BBOX` in the script, about 66 x 40 km). Tiles are zoom 10 to 14 so it stays small. Without `--roads-pbf` there is no route grid and the plan works without one.
- The build takes a few minutes: it fetches CARTO Dark Matter tiles politely (identifying `User-Agent`, delay between requests). Tiles are credited "© OpenStreetMap contributors © CARTO" on the map.
- `shelters.source.json` is the curated list. Each entry's `source` note records the OSM id, how the height above the river was measured and when it was checked. The build fails if a Shelter lies outside the box. None has been visited or confirmed by the district; the notes say so.
- `river.source.geojson` (the river line with River km and a speed per reach) and `flood_corridor.source.geojson` (the Flood-Prone Area: 150 m each side of the river line, approximate) are written by `uv run --project node python scripts/derive_river.py` from OpenStreetMap ways through Overpass. Run it again only when the river inputs change, and commit the two files. The speeds are reconstructed from reported arrival times, and each reach cites its source.
- River km is zero at the Lhende-Kyirong confluence (28.2781 N, 85.3770 E), negative upstream.
- The build also asks Open-Meteo's archive once for the recorded weather of 25 to 27 Aug 2026 at the 153 grid points of the Weather Grid over all of Nepal (`pack_weather.py`, no key) and stores it as `weather_replay.json`. It needs the internet like the tile fetch; the layout is in `docs/specs/wire-formats.md`.
- The same request step asks the archive once for the Simulated Fleet (`pack_fleet.py`, no key): `fleet.source.json` is the hand-written list of 30 towns and 10 headwater sites (none in the valley box, none within 15 km of another; the build fails otherwise), and `fleet.json` holds their modelled tracks from 08:30 to 10:30. Water is modelled, not measured (`water_model` in the file). The coordinates are from memory of OpenStreetMap/Wikipedia place data, rounded, and have not been checked on a map: 0035 does that.
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
- **Rivers**: every OpenStreetMap `waterway=river` way with a vertex (first, middle or last) in Nepal, simplified to about 160 m. A way with no Latin-letter name is kept only if it is 12 km or longer. `main` is `Koshi`, `Gandaki`, `Karnali`, `Mahakali` or `Bhote Koshi–Trishuli` for ways OpenStreetMap names as part of those rivers (the table is `MAIN_RIVERS`; the Koshi group includes the Sun Kosi and Tamakoshi, the Gandaki group the Narayani and Kali Gandaki), and `null` otherwise. Names come from `name:en`, else a Latin `name`: the map has no Devanagari font.
- **Places**: all cities and towns in Nepal, and the villages and hamlets inside the valley box. Syabrubesi and Timure are not among them, because OpenStreetMap lists them without a Latin name; the Shelters and the fleet carry the valley names.
- **Elevation**: zoom 5 to 8 over the whole country (about 600 m a pixel at zoom 8, 28 tiles) and zoom 9 to 12 over the valley box (about 35 m a pixel, 45 tiles). The build prints each part's size and fails over 8.5 MB of elevation tiles (`ELEVATION_BUDGET_BYTES`); the real run was 8.2 MB of tiles, 0.8 MB of vectors, an 8.4 MB zip (v3 was 2.4 MB with its raster tiles).
- The credit the map prints: "Boundaries © geoBoundaries (CC BY 4.0, Public Domain) · Rivers and places © OpenStreetMap contributors (ODbL) · Elevation: SRTM via AWS Terrain Tiles". The map ticket (0033) builds it from the manifest's `sources`.
