# Building and publishing the Cache Pack

Run once, ahead of the event, with internet. Spec: `docs/tickets/0007-cache-pack-shelters-flood-prone-areas-tiles.md`, layout: `docs/specs/wire-formats.md`.

```
uv run --project node python scripts/build_cache_pack.py          # writes build/cache-pack.zip
gh release create cache-pack-v1 build/cache-pack.zip              # or `gh release upload` to replace it
```

Then set `CACHE_PACK_URL` on the Hub to the Release asset's download URL. Sensor Nodes set it to the Hub's `/api/cache-pack.zip`.

- `--roads-pbf <nepal-latest.osm.pbf>` (download from Geofabrik `asia/nepal`, run with `uv run --project node --with pyrosm`) adds `roads.json`, the Road graph the phone reroutes on (ticket 0018). Without it the pack has no graph and Blocked Roads are unavailable. Not yet run against the real extract.
- Needs `httpx` (a Node dependency) and `CARTO_API_KEY` exported (see `.env.example`).
- The pack covers the Bhote Koshi valley, from the Lhende Khola down to below Trishuli (`BBOX` in the script, about 66 x 40 km). Tiles are zoom 10 to 14 so it stays small. There is no route grid: the plan works without one, and Road Routes are a stretch ticket (`pack_routes.py` is kept for it).
- The build takes a few minutes: it fetches CARTO Dark Matter tiles politely (identifying `User-Agent`, delay between requests). Tiles are credited "© OpenStreetMap contributors © CARTO" on the map.
- `shelters.source.json` is the curated list. Each entry's `source` note records the OSM id, how the height above the river was measured and when it was checked. The build fails if a Shelter lies outside the box. None has been visited or confirmed by the district; the notes say so.
- `river.source.geojson` (the river line with River km and a speed per reach) and `flood_corridor.source.geojson` (the Flood-Prone Area: 150 m each side of the river line, approximate) are written by `uv run --project node python scripts/derive_river.py` from OpenStreetMap ways through Overpass. Run it again only when the river inputs change, and commit the two files. The speeds are reconstructed from reported arrival times, and each reach cites its source.
- River km is zero at the Lhende-Kyirong confluence (28.2781 N, 85.3770 E), negative upstream.
- `bbox` in the manifest is `[south, west, north, east]`.
