# Building and publishing the Cache Pack

Run once, ahead of the event, with internet. Spec: `docs/tickets/0007-cache-pack-shelters-flood-prone-areas-tiles.md`, layout: `docs/specs/wire-formats.md`.

```
uv run --project node python scripts/build_cache_pack.py          # writes build/cache-pack.zip
gh release create cache-pack-v1 build/cache-pack.zip              # or `gh release upload` to replace it
```

Then set `CACHE_PACK_URL` on the Hub to the Release asset's download URL. Sensor Nodes set it to the Hub's `/api/cache-pack.zip`.

- Needs `httpx` (a Node dependency) and, for Routes, `pyrosm` from the build-only group: `uv sync --project node --group build`.
- Routes need the Geofabrik Florida extract (about 650 MB, kept out of git): `curl -L -o build/florida-latest.osm.pbf https://download.geofabrik.de/north-america/us/florida-latest.osm.pbf`, or pass `--osm-extract`. Reading it takes about a minute and the whole route step about 90 s. The grid is 100 m, and 250 m if the routes would pass 5 MB zipped.
- The build takes a few minutes: it fetches CARTO Dark Matter tiles politely (identifying `User-Agent`, delay between requests). Tiles are credited "© OpenStreetMap contributors © CARTO" on the map (ticket 0025).
- `shelters.source.json` is the curated list. Each entry's `source` note records where it was checked and when. The build fails if a Shelter lies outside the box.
- `creek_floodplains.geojson` is a hand-made, approximate layer for Hogtown Creek and Sweetwater Branch. The FEMA zones (A and AE) are fetched from the NFHL ArcGIS service.
- `bbox` in the manifest is `[south, west, north, east]`.
