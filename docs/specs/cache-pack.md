# Cache Pack: build it, download it, serve it

**Status:** ready-for-agent

> **Area superseded.** The pack now covers the Bhote Koshi valley with a hand-drawn river corridor, hand-picked Shelters and a river line (`docs/specs/flash-flood-replay.md`, ticket 0043). How the pack is built, checked, downloaded and served is unchanged.

Feature slice of `docs/specs/storm-shield.md` (ticket 0007). File layout: `docs/specs/wire-formats.md`. Words follow `CONTEXT.md`.

## Problem Statement

When the internet goes down, a resident's Evacuation Plan still needs to know where the Shelters are, which land is Flood-Prone, and what the map looks like. None of that can be fetched at that moment. Today no Node holds any of it, so the dashboard has nothing to show offline and the Cache Pack exists only as a name in the glossary.

## Solution

A build script prepares one Cache Pack ahead of the event for a single demo box around central Gainesville: Shelters, Flood-Prone Areas and map tiles. While online, every Node downloads the pack once, checks it, keeps it on disk and serves it to Viewers and to other Nodes. After that the Node serves it from disk with no connectivity at all. A Node that cannot reach a source keeps retrying in the background until it has a valid pack. Showing the pack on the map is ticket 0025; precomputed routes are ticket 0010.

## User Stories

1. As a Sensor Node operator, I want my Node to download the Cache Pack automatically while online, so that I never have to copy files by hand.
2. As a Sensor Node operator, I want my Node to keep the pack on disk, so that a restart with no internet still has it.
3. As a Sensor Node operator, I want a Node that already has a valid pack to never download it again, so that it doesn't waste the Hub's bandwidth or my tethered data.
4. As a Sensor Node operator, I want a Node without a pack to keep retrying every 30 seconds in the background, so that it picks the pack up as soon as a source appears.
5. As a Sensor Node operator, I want my Node to fetch the pack from the Hub over the local Wi-Fi when it has no internet, so that a Node on the hotspot still gets one.
6. As a Sensor Node operator, I want my Node to fetch from the Release directly when it does have internet, so that it doesn't depend on the Hub being up.
7. As a Sensor Node operator, I want a damaged or incomplete download discarded, so that a half-written pack never serves wrong Shelters.
8. As a Sensor Node operator, I want a clear log line saying why a pack was refused, so that I can tell a corrupt file from an unreachable source at 4 am.
9. As a Hub operator, I want the Hub to download the pack from the GitHub Release while it has internet, so that the neighborhood's copy comes from one place.
10. As a Hub operator, I want the Hub to serve the whole pack as one zip, so that other Nodes can fetch it in a single request.
11. As a Hub operator, I want the Hub to keep serving the pack after its internet cable is pulled, so that Nodes that start later still get it.
12. As a resident, I want the dashboard to load the Shelter list from the Node I'm connected to, so that it works on the neighborhood Wi-Fi with no internet.
13. As a resident, I want the Flood-Prone Area shapes and map tiles served by the same Node, so that the map and my plan don't depend on any outside server.
14. As a resident, I want the Node to say clearly when it has no pack yet, so that the dashboard can show "map data not downloaded" instead of a blank map.
15. As a resident, I want a pack that failed its checks to be treated as absent, so that I never see Shelters from a half-downloaded file.
16. As the pack builder, I want one script that produces `cache-pack.zip`, so that the pack is reproducible rather than hand-assembled.
17. As the pack builder, I want the manifest to hold the box corners and a checksum for every file, so that Nodes can verify the pack and the map knows where to look.
18. As the pack builder, I want map tiles for zoom 11 to 16 over the 10 × 10 km box, so that the map is usable from town level down to streets.
19. As the pack builder, I want the tile fetch to identify itself and pause between requests, so that the build respects the tile provider.
20. As the pack builder, I want Shelters kept in a curated source file in the repo, so that anyone can review the list by eye in a pull request.
21. As the pack builder, I want each Shelter to carry a source note with the check date, so that the FEMA cross-check is recorded, not remembered.
22. As the pack builder, I want the build to fail if a Shelter lies outside the box, so that a typo in coordinates can't produce a Shelter nobody can route to.
23. As the pack builder, I want FEMA flood zones A and AE pulled from the official service, so that the Flood-Prone Areas rest on a public source.
24. As the pack builder, I want a small hand-made layer for the Hogtown Creek and Sweetwater Branch floodplains, so that the creeks FEMA zones miss are still covered.
25. As the pack builder, I want every flood shape tagged with its source, so that the dashboard and reviewers can tell official data from our approximation.
26. As the pack builder, I want a short note next to the script on building and publishing the pack, so that any teammate can rebuild it.
27. As a judge reading the repo, I want the Shelter list and the floodplain layer to be plain reviewable files, so that I can see where the data came from.
28. As a developer, I want a tiny fixture pack built by a test helper, so that tests don't need the internet or the 10 × 10 km tile set.

## Implementation Decisions

- **Area.** One demo box of about 10 × 10 km around central Gainesville, covering both creeks and every Shelter the demo can pick. Zoom levels 11 to 16. The box corners go into `manifest.json` as `bbox`.
- **Pack layout.** As in `docs/specs/wire-formats.md`: `manifest.json` (with `v`, `built`, `bbox` and a SHA-256 per file), `shelters.json`, `flood_prone.geojson`, `tiles/{z}/{x}/{y}.png`. The `routes/` directory is not part of this slice; the manifest simply lists the files that are present, so ticket 0010 adds routes without a format change.
- **Tiles.** CARTO Dark Matter rasters, fetched once by the build script with an identifying `User-Agent` and a delay between requests. The credit "© OpenStreetMap contributors © CARTO" is displayed by the map (0025), not by this slice. Fallback if the provider blocks us: render tiles from the Geofabrik Florida extract.
- **Shelters.** A curated source file in the repo holds each Shelter's id slug, name, address, coordinates, the special-needs and pet-friendly flags, and a `source` note with the check date. The FEMA cross-check against open shelters is a manual review recorded in that note. The build script turns the source file into `shelters.json` and fails if any Shelter lies outside the box. Shelter ids are the slugs the mesh Shelter status messages use.
- **Flood-Prone Areas.** FEMA NFHL zones A and AE from the ArcGIS REST service, coordinates rounded to 4 decimals (about 1.6 MB), merged with a small hand-made, approximate layer for the Hogtown Creek and Sweetwater Branch floodplains. Every shape carries a `source` tag. The hand-made layer is a file in the repo.
- **Build script.** A single Python script run with the Node project's environment; its extra dependencies live in a separate dependency group so Nodes do not install them. Output is `cache-pack.zip`. A short build-and-publish note sits next to it.
- **Distribution.** The zip is uploaded as a GitHub Release asset. Every Node has a `CACHE_PACK_URL`: the Hub's points at the Release; a sensor's points at the Hub's `/api/cache-pack.zip`, or at the Release if it has internet. `CACHE_PACK_URL` and `CACHE_PACK_DIR` are documented in `.env.example`; `CACHE_PACK_DIR` is gitignored.
- **Fetcher module (deep, small interface).** One Node module owns the whole lifecycle: given a source URL and a directory, make sure a valid pack is on disk. Callers see only "pack available or not" and the manifest. It hides download, checksum verification, staged unpacking, discard-on-failure and the 30-second retry.
- **Lifecycle rules.** A Node with a valid pack on disk at startup does nothing. Otherwise it tries at startup and retries every 30 seconds in the background without blocking the API or the mesh. A pack is valid only if `manifest.json` parses, every listed file exists and every checksum matches. An invalid or incomplete pack is discarded entirely and never partly served; unpacking is staged and swapped in only after the checks pass, so a crash mid-download leaves no half pack.
- **Internet off.** Serving the pack from disk does not depend on connectivity. This slice builds no online/offline flag; that is ticket 0011.
- **API contract.** Three routes on the Node HTTP API:
  - `GET /api/cache-pack`: availability plus the manifest when available.
  - `GET /api/cache-pack/files/{path}`: any file in the pack, including tiles, with a correct content type. The path is confined to the pack directory; anything that escapes it is refused.
  - `GET /api/cache-pack.zip`: the original zip, for other Nodes. The Node keeps the zip alongside the unpacked files to serve it.
- **Not on the mesh.** The pack never crosses the mesh (spec Out of Scope); Nodes fetch it over HTTP on the local Wi-Fi or from the internet.

## Testing Decisions

- **What a good test is.** It drives a Node only through the HTTP API and asserts what a Viewer or another Node would observe: pack available or not, the manifest, Shelters, flood zones, a tile. It never inspects the fetcher's internals, temp directories or retry counters. Names use the glossary's words.
- **Seam.** Seam A, the Node HTTP API with the in-memory Mesh. No new seam. The build script is checked by the manual step below, not unit-tested.
- **Fixture.** A test helper builds a tiny valid Cache Pack (one Shelter, one flood shape, one tile) and can corrupt it, so tests need no internet.
- **Behaviors covered:**
  - a Node downloads the pack from a source and serves the manifest, Shelters, flood zones and a tile;
  - the source is shut down and the Node still serves the manifest, Shelters, flood zones and a tile;
  - a Node with a valid pack on disk does not download again;
  - a corrupt or incomplete pack is refused, discarded, and reported as not available;
  - a Node with no pack and an unreachable source reports not available, then picks the pack up once the source appears;
  - a sensor downloads the pack from a Hub Node's `/api/cache-pack.zip`;
  - a file path escaping the pack directory is refused.
- **Prior art.** `node/tests/meshed_nodes.py` (several Nodes in one process), `test_node_api.py` (driving the API), `test_readings_shared.py` (behavior across Nodes).
- **Manual check.** The real pack builds, is uploaded as a Release asset, and two Nodes download it.

## Out of Scope

- Showing the pack on the map and the tile credit (ticket 0025).
- An online/offline flag and camera tiles (ticket 0011).
- Shelter open status over the mesh (ticket 0015).
- Carrying the pack over the mesh.
- Replacing a pack that is already valid; a new pack means clearing the directory.
- Coverage beyond the demo box.

## Further Notes

- The FEMA service and the tile provider are external; the build runs once ahead of the event and the zip is the only thing Nodes depend on.
- Node settings use the `NODE_` prefix today, while the ticket names `CACHE_PACK_URL` and `CACHE_PACK_DIR` without it. The implementer picks one and updates the ticket and `.env.example` together.
- Check the final zip's size against the Release asset limit during the manual check.

## Routes (ticket 0010)

Ticket 0010 adds `routes/` to the pack; the manifest lists and checksums those files like any other. Decisions from the 0010 grill:

- **Grid points.** About 100 m apart, kept only within about 100 m of a drivable road, so homes on a road always have one. Coordinates are rounded to 5 decimals. If the zip grows past about 5 MB, the spacing coarsens to about 250 m.
- **Build.** The script reads the Geofabrik Florida extract clipped to `bbox` with `pyrosm` and runs one Dijkstra per Shelter (plain Python in `scripts/pack_routes.py`, so its tests run with the Node's); `pyrosm` lives in the build-only dependency group (`uv sync --group build`), never in the Node's runtime dependencies. The manifest gains `route_grid` (`south`, `west`, `lat_step`, `lon_step`) so a Viewer can find its Grid point's file; a pack without it has no Routes. The extract stays out of git.
- **Routes are shortest drives.** They ignore Flood-Prone Areas and live road conditions, and the dashboard says so.
- **No route.** A Shelter with no Route from the resident's Grid point ranks after the routed ones by straight-line distance, labelled as such, with no line drawn.
- **Privacy.** The Viewer asks its connected Node for the file of its home's Grid point, which reveals the home to about 100 m to that Node only (`docs/adr/0003-routes-reveal-a-grid-point-to-the-connected-node.md`).
