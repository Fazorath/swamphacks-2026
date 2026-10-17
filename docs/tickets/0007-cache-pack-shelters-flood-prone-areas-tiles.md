# 0007: Cache Pack: build it, download it, serve it

**What to build:** A build script produces the Cache Pack for one demo box (Shelters, Flood-Prone Areas, map tiles). While online, every Node downloads it, keeps it on disk and serves it to Viewers and to other Nodes. The map half (showing the pack on the map) is 0025. Precomputed routes are 0010.

**Blocked by:** 0003

**Status:** in-progress

**Owner:** Fazorath

**Spec:** `docs/specs/storm-shield.md`

**Decided in grilling:**
- Area: one demo box of about 10 × 10 km around central Gainesville (covers both creeks and every Shelter the demo can pick), zoom 11 to 16. The corners go into `manifest.json` as `bbox`.
- Tiles: CARTO Dark Matter rasters, fetched once by the build script (identifying `User-Agent`, a delay between requests). The credit "© OpenStreetMap contributors © CARTO" is shown on the map (0025). Fallback if blocked: render from the Geofabrik extract.
- Shelters: a curated source file in the repo (`shelters.source.json`: id slug, name, address, coordinates, the two flags, and a `source` note with the check date). The FEMA cross-check is a manual review recorded in that note. The build script fails if a Shelter lies outside the box.
- Flood-Prone Areas: FEMA NFHL zones A and AE from the ArcGIS REST service (coordinates rounded to 4 decimals, about 1.6 MB), plus a small hand-made, approximate layer for the Hogtown Creek and Sweetwater Branch floodplains. Every shape carries a `source` tag.
- Distribution: the zip is uploaded as a GitHub Release asset. Every Node has `CACHE_PACK_URL` (the Hub: the Release; a sensor: the Hub's `/api/cache-pack.zip`, or the Release if it has internet). A Node with a valid pack on disk does nothing; otherwise it tries at startup and retries every 30 s. A pack failing its checksums is discarded.
- "Internet off": serving the pack from disk does not depend on connectivity. 0007 builds no online/offline flag (that is 0011).

- [ ] `scripts/build_cache_pack.py` (run with `uv run --project node`, its extra dependencies in a separate group) produces `cache-pack.zip` in the layout of `docs/specs/wire-formats.md`: `manifest.json` with `bbox` and checksums, `shelters.json`, `flood_prone.geojson`, `tiles/{z}/{x}/{y}.png`
- [ ] The curated Shelter source and the creek floodplain layer are in the repo, reviewable by eye; the script fails on a Shelter outside the box
- [ ] A Node downloads the pack from `CACHE_PACK_URL`, checks the checksums in `manifest.json`, unpacks it into `CACHE_PACK_DIR` (gitignored) and refuses and discards an incomplete or corrupt pack
- [ ] A Node without a valid pack retries every 30 s in the background; a Node with one never downloads again
- [ ] The API serves the pack: `GET /api/cache-pack` (availability and manifest), `GET /api/cache-pack/files/{path}` (any file or tile), `GET /api/cache-pack.zip` (for other Nodes)
- [ ] `CACHE_PACK_URL` and `CACHE_PACK_DIR` are in `.env.example`, and a short build-and-publish note sits next to the script
- [ ] Seam A tests, using a tiny fixture pack built by a test helper: a Node downloads and serves it; the source is shut down and the Node still serves the manifest, Shelters, flood zones and a tile; a corrupt pack is refused; a sensor downloads from a Hub Node
- [ ] Manual check: the real pack builds, is uploaded as a Release asset, and two Nodes download it
- [ ] All **Commands** pass
