# Lessons: what we tried, what broke

A running log for agents and humans starting a new ticket. Read it before you build; add to it when something surprises you (newest at the bottom of each section). Facts only: what happened, what worked, what is still open.

## Environment

- **`uv` and `pnpm` may not be installed** on the machine an agent runs on. If `uv` is missing, another checkout's `node/.venv` works: run `PYTHONPATH=src node/.venv/bin/pytest` from the worktree's `node/` (the venv's editable install points at that other checkout, so `PYTHONPATH=src` is what makes it test *your* code). Say so in the report; don't claim a Command passed that you could not run. If `pnpm` is missing but Node is there, `npx --yes pnpm@10 <command>` works (lockfile v9); run it from `dashboard/`. All dashboard Commands passed on `main` after 0007 this way (typecheck, lint, 9 Vitest tests).
- **Worktree sessions refuse compound shell commands** (`cd x && VAR=y python ...`, `$(...)` feeding a command name, pipelines with computed operands). Run plain, separate commands, or write a small script under `$CLAUDE_JOB_DIR/tmp` and run it.
- **Don't edit `node/uv.lock` by hand unless `uv` is missing.** For 0007 it was edited by hand to move `httpx` from the dev group to runtime dependencies; run `uv lock` once on a machine with `uv` and commit any difference.
- **On Windows with no `uv`, install it from PowerShell**: `irm https://astral.sh/uv/install.ps1 | iex`, then `uv sync` in `node/`. A plain `python -m venv` fails if the system Python is 3.14, because `cryptography` (needed by `rns`) has no wheel for it; `uv` fetches Python 3.12 itself. After the 0004 merge, `node/.venv` from an older checkout lacks `rns`, so `pytest` stops at `import RNS`.
- **Check who owns a ticket right before you claim it.** A claim pushed to your own branch is not visible on `main`; two people claimed 0009 minutes apart and the conflict showed up on `git pull`. Pull `main`, check the Owner line, then claim and push the claim to `main` at once.
- **A Node left running blocks the Node tests and your next run.** `tests/test_reticulum_nodes.py` binds fixed ports (HTTP 8101 to 8103, TCP 4250 to 4252 and 4350 to 4352), and a stray Node on 8000 keeps serving old code beside a fresh one. A Node on a new port shows what is on disk; check `Get-NetTCPConnection -State Listen -LocalPort 8000` before trusting a browser tab.
- A branch named after its ticket (`NNNN-<slug>`) may already exist from the claim commit. A worktree starts on `worktree-<name>`; push it with `git push origin HEAD:NNNN-<slug>` rather than renaming.

## Rehearsing without devices

There are no Pis or sensors (see **No Pis or sensors** in `AGENTS.md`); a phone on the same Tailscale network works (`tailscale ip -4` gives the laptop's address; open `http://<that address>:<NODE_PORT>`). What worked for ticket 0009, all on one machine, no `uv`/`pnpm`:

- Build the dashboard with `dashboard/node_modules/.bin/vite build` (symlink another checkout's `node_modules` if the worktree has none).
- A real Cache Pack needs a CARTO key. For a rehearsal, zip `shelters.json` and `flood_prone.geojson` (from `scripts/cache-pack/shelters.source.json` and `flood_corridor.source.geojson`, plus `river.source.geojson` as `river.geojson`) with a manifest of sha256 checksums, and serve it with `python3 -m http.server`. Tiles will 404 without a key; that is expected.
- Hub: `env PYTHONPATH=node/src NODE_ROLE=hub NODE_PORT=8000 NODE_MESH_INTERFACE=loopback NODE_LOOPBACK_SLOT=0 NODE_DATA_DIR=<dir> CACHE_PACK_URL=http://127.0.0.1:9000/cache-pack.zip CACHE_PACK_DIR=<dir> node/.venv/bin/python -c "from storm_shield.main import run; run()"`. Sensor: the same with `NODE_PORT=8001`, `NODE_LOOPBACK_SLOT=1`, its own dirs, a different `NODE_LATITUDE`/`NODE_LONGITUDE`, and `CACHE_PACK_URL=http://127.0.0.1:8000/api/cache-pack.zip`. Use `PYTHONPATH=<this worktree>/node/src`, because the venv's editable install points at another checkout.
- A Sensor that asks the Hub before the Hub has its pack waits up to 30 s for the retry.
- "Unplug the internet": stop the pack server, restart the Hub, then `POST /api/scenario/step` on the Sensor. The Hub keeps its pack and Shelters from disk, re-hears the Sensor within seconds, and readings keep updating.
- This proves the software path only. It does not prove Wi-Fi discovery or Pi performance.

## Cache Pack (ticket 0007)

- **The FEMA NFHL ArcGIS query is flaky**, not blocked: `hazards.fema.gov` resets connections at random (`Connection reset by peer`), then answers on a later try. `scripts/build_cache_pack.py` retries each page 8 times, 10 s apart; the real build needed 2 tries. If the build still fails, wait and rerun; a plain `curl` failing once proves nothing.
- Real build result (2026-10-16): 371 FEMA zones (A, AE) + 2 hand-made creek floodplains, 566 CARTO tiles (z11 to 16), 1.7 MB zip. Published as GitHub Release `cache-pack-v1`.
- **While the repo is private, the Release download link returns 404 without a login**, so a Node cannot use it as `CACHE_PACK_URL`. Until the repo goes public at submission: serve the zip from a laptop (`python3 -m http.server` in the folder holding `cache-pack.zip`) and point the Hub's `CACHE_PACK_URL` at it. Sensors point at the Hub's `/api/cache-pack.zip` as usual.
- **Shelter data is approximate** (`scripts/cache-pack/shelters.source.json`, all marked PLACEHOLDER). Before the presentation: verify names and coordinates against Alachua County Emergency Management and FEMA, give each `source` note a check date, rebuild, upload a new Release (`cache-pack-v2`) and re-point the Hub.
- `CACHE_PACK_URL` and `CACHE_PACK_DIR` are read unprefixed (not `NODE_...`) and `Settings` has no `env_file`, so a value in `.env` reaches a Node only if the shell exports it. Check how your run script loads `.env` before assuming it works.
- A Node discards a pack that fails its checksums, at download and again at startup, and retries every 30 s; it never downloads again once it holds a valid one. To force a refresh, delete `CACHE_PACK_DIR`.
- `bbox` in the manifest is `[south, west, north, east]`.

## Household Profile (ticket 0008)

- **Leaflet map clicks work in jsdom**: `fireEvent.click(document.querySelector(".node-map")!, { clientX, clientY })` reaches `useMapEvents({ click })`, so pick mode is testable without mocking Leaflet. The tapped lat/lon is meaningless in jsdom (zero-size container); assert on what the app does with it, not its value.
- **Don't name two files apart only by case** (`householdProfile.test.ts` vs `HouseholdProfile.test.tsx`): they collide on macOS. The flow test is `householdFlow.test.tsx`.
- The dashboard has no polling yet, so the "no request carries the profile" test waits briefly on the only request there is (`/api/node`). When polling lands (0019), make that test run a real poll cycle.

## Map tiles (CARTO key)

- **CARTO's keyless tile URL now returns HTTP 200 with a PNG that reads "API KEY REQUIRED"** (about 2.5 KB), so `raise_for_status` and a quick `curl -i` both look fine. Open the image, or check for tiles under 3 KB. `cache-pack-v1` was built before this and its 566 tiles are real.
- The key goes in as `?key=`: `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=...`. It is secret, so the Node proxies tiles at `/api/tiles/{z}/{x}/{y}.png` and the dashboard never sees it. `CARTO_API_KEY` is unprefixed like the Cache Pack settings; `scripts/run-live.sh` now loads `.env`, anything else must export it.
- `httpx` error and `raise_for_status` messages include the request URL, and the URL carries the key. Catch them and log only the exception type or status. The `httpx` logger itself prints every request URL at INFO (`HTTP Request: GET ...?key=...`), so `create_app` sets it to WARNING; `run()` turns on INFO logging for everything else, which is how the key reached the console before this was caught in the review after the merge.
- The proxy always asks CARTO. Serving tiles from the Cache Pack when offline is ticket 0025.

## Online status and cameras (ticket 0011)

- **FL511's official developer key is not available to us, but its website feed needs no key**: `https://fl511.com/map/Cctv/{id}` serves a live JPEG, `https://fl511.com/List/GetData/Cameras` lists every camera (the server returns at most 100 rows per page, and an empty search term gives HTTP 500; search by road such as `I-75`). It is not a documented API and can change without notice. The four camera ids live in `node/src/storm_shield/cameras.py`; ids were checked on 2026-10-17.
- **A Node shows Mesh-only for its first moment**: it claims nothing until its first connectivity probe answers. Tests that need `online` wait for it (`_wait_until` in `test_online_status_and_cameras.py`); the background loops only run when the app is entered as `with TestClient(app)`, and the older tests that build a bare `TestClient(app)` never start them.
- **Run `mypy src tests` from `node/`**: from another directory it stops with "Duplicate module named `__main__`". From a worktree use `uv run --directory <worktree>/node mypy src tests`.
- **Prettier reformats test files you just wrote**: run `pnpm format` before `pnpm lint`.

## Routes (ticket 0010)

- **`pyrosm` cuts every way into one edge per pair of consecutive OSM nodes** (all geometries have 2 points), so a Route can follow the road with graph nodes alone. `oneway` is `yes`, `no`, `-1` (against node order) or NaN (two-way). Reading the Florida extract for the demo box takes about a minute each run.
- **Real build, 2026-10-17:** 6,296 Grid point files at 100 m, 2.8 MB zipped (budget 5 MB), 84 s. The shelters are still PLACEHOLDERs, so rebuild after they are checked.
- **The build script imports `pack_routes`, which the Node's tests also import** (`pythonpath`/`mypy_path` `../scripts` in `node/pyproject.toml`); `pyrosm` is only in `uv sync --group build`.
- **A page that never serves a pack sends no Route request**, so the 0008 test "no request carries the profile" passed vacuously until its stub served a pack with a grid; it now asserts that the only Route-related request is `routes/{gx}_{gy}.json` (ADR 0003).
- **Known limits (code-review, not fixed):** a Grid point is kept if a road *node* is within 100 m, so a long straight stretch between nodes can lose a file a home on it would want; the 5 MB budget counts only the route files (2.8 MB), not the tiles beside them; a failed Route-file request (not a 404) shows "no road route available" and only logs the cause; the route length starts at the Grid point, up to about 100 m from home.
- **ESLint `react-hooks/set-state-in-effect` rejects `setX(null)` at the top of an effect**; `useRoutes` stores the file with the Routes and derives "still loading" instead.

## Replay drives the Sensor Nodes (ticket 0044)

- **The replay timeline is `node/src/storm_shield/replay_timeline.json`.** Syabrubesi's last gauge reading (1.62 m at 08:40) and its 08:50 silence are from the Kathmandu Post piece, checked 2026-10-17; every other water value, and all rain, soil and pressure values, are invented and marked `reconstructed`. Its 08:37 is the earthquake, which the spec calls the collapse.
- **A Sensor with a track plays it only while the Event clock is playing or paused**; before the Hub starts the replay (or after a stop) it keeps the Scenario. Past `silent_at` it publishes nothing, so its reading ages and turns Stale.
- **Tests drive a Sensor's publish loop with `MeshedNodes.start_sensor`** (loop every 20 ms on the injected clock) and move time with `advance`; 1 s of real time is 30 s of event time.

## Valley Cache Pack (ticket 0043)

- **Release `cache-pack-v3` is the valley pack** (2.4 MB, 795 tiles at z10 to 14, five Shelters, river line, corridor, no route grid); `v1` and `v2` are the Gainesville packs. The repo is private, so serve it from a laptop as before. Rebuild with `scripts/build_cache_pack.py`; `derive_river.py` only when the river inputs change.
- **Measured River km differs a little from the spec's table**: nearest river vertices give Timure 3.6 (spec 3.4), Syabrubesi 14.4 (14.6), Betrawati 45.0 (45.6), Trishuli 53.3 (54.0), because the line is simplified to 25 m and the place coordinates sit up to 275 m from it. Only S0 (-12.2) comes from the line; the others are the spec's numbers.
- **A Node with no `NODE_LATITUDE` now sits at Betrawati**, so tests that read a Node's shared position see (27.974, 85.186). Tests that pass their own coordinates keep Gainesville ones.
- **Tests that leave Nodes running** (`test_reticulum_nodes.py`) fail the next run on busy ports; `pkill -f "storm_shield.main import run"` before rerunning if `[loopback]` or `[tcp]` fails for no reason you can see.

## Reviews

- 0007 code-review: a retry loop that catches only some exceptions can die silently and leave a Node with no pack; background loops catch `Exception` and log it with `logger.exception`.
- Audit 2026-10-17: `MeshedNodes` used the checkout's `dashboard/dist`, `cache-pack/` and `node/data/`, so `test_a_sensor_has_no_such_route` got 405 (from the dashboard's static mount) instead of 404 on any machine that had built the dashboard. Every test Node now gets its own folders under `tmp_path`; a new harness setting that touches disk belongs in `MeshedNodes._settings`.
- Audit 2026-10-17: the Evacuation Plan test's Shelter-marker check failed about 1 run in 12, before and after 0010, because it checked the map right after the plan text appeared. Map assertions wait with `waitFor`.

## Flood Risk (ticket 0006)

- **`pnpm test` fails to start on Node 20.20**: vitest's jsdom worker dies loading `undici@8` (`Cannot read properties of undefined (reading 'bind')`). It passes on Node 22: `npx -y node@22 node_modules/vitest/vitest.mjs run` from `dashboard/`.
- **The Scenario cannot reach "Low from rain" alone**: its rain step also lifts water to 35 cm, which is Elevated. `MeshedNodes.hear_from(sender, water_cm=..., soil_pct=...)` publishes one hand-made reading over the in-memory Mesh to test such rules; `MeshedNodes.advance(seconds)` moves every Node's clock.
- In `MeshedNodes`, a Node only hears peers that publish after it joins. Post `/api/scenario/reset` on each Node first when a test counts Nodes.

## Evacuation Plan (ticket 0009)

- **"Nearest" Shelter is straight-line distance** until 0010 ranks by road distance.
- **Map tiles stutter** because every tile is fetched live from CARTO through the Node; ticket 0026 serves them from the Cache Pack first.
- **The open-Shelter list is read from the pack on every request** (`CachePack.shelter_ids()`), not copied at startup, so a Node whose pack arrives late still lists its Shelters. It is empty until a valid pack is on disk.
- Dashboard checks in a fresh worktree: symlink the main checkout's `dashboard/node_modules` into it and run `node_modules/.bin/{tsc,eslint,prettier,vitest}` directly (Node 22 here). Remove the symlink before committing; it shows up as untracked.

## Shelter status over the Mesh (ticket 0027)

- **Shelter status carries no `node` field**, so the Reticulum Mesh cannot look up its signer from the message. `verify` checks it against the key of the configured `HUB_IDENTITY` instead; a blank or wrong id (or a Hub that has not announced yet) drops it silently. That is the safe failure, so when a Node shows nothing open, check `HUB_IDENTITY` first.
- Both Meshes filter on the Hub identity before any listener runs, so later features never re-check the sender. `InMemoryNetwork.join(name, hub_identity)` takes it as a second argument.
- Listeners now receive `CommunityReading | ShelterStatus`; narrow with `isinstance` before use.

## Shelters on Nodes (ticket 0028)

- **Nothing is open until the Hub has announced it**, and the Hub does not hear itself, so until 0029 gives the Hub its own status a Hub also lists no open Shelter. `MeshedNodes.start(..., cache_pack=(dir, zip))` installs a pack before the app starts and `announce_shelters(ver, ids, sender=...)` publishes a hand-made Hub status.

## Hub sets Shelter status (ticket 0029)

- **The Hub seeds and repeats from the same loop.** `ShelterRegistry` opens every pack Shelter at `ver` 1 on the first snapshot that has a pack; the Hub does this at startup if the pack is on disk, otherwise within one `NODE_SHELTER_REPEAT_SECONDS` (default 30). Tests set it to 0.02 and wait; `MeshedNodes.advance` only moves the injected clock, not the loop's sleep.
- `MeshedNodes.start_hub(...)` runs the Hub with its lifespan loops; the Hub's name must stay `hub` so Sensors trust it. The `meshed_nodes` fixture now closes it.
- Rehearsal on loopback (Hub slot 0 / port 8210, Sensor slot 1 / port 8211, `HUB_IDENTITY` is the id in the Hub's "is up" log line): a Sensor started after the Hub showed `[]` for its first ~10 s, then converged on the next repeat or change. Software path only, not a Pi check.

## Hub remembers Shelter status (ticket 0030)

- **The Hub keeps `ver` and the open list in `NODE_DATA_DIR/shelter_status.json`** and starts every restart at saved `ver` + 1, so Nodes that held the old `ver` take the restart announcement. Delete the file to reseed all-open. A saved id missing from the pack drops out of announcements but stays in the file until the next change.
- `MeshedNodes.start_hub` now gives the Hub its own data dir under the pack directory (without it the Hub wrote into the repo node/data); `stop_hub()` then `start_hub()` with the same directory is a restart.
- **A Hub whose `shelter_status.json` is unreadable refuses to start**, and the error names the file; fix it, or delete it to reseed all-open. A save that fails (disk full) changes nothing in memory and announces nothing: the request returns 500 and the Hub stays consistent with its file.

## Hub Panel (ticket 0031)

- **`evacuationFlow.test.tsx` failed once in a full parallel `vitest run`** (no `.shelter-marker` yet) and passed alone and in three later full runs. Cause not found; rerun before suspecting your change.
- `useOpenShelterIds` now returns `[ids, setIds]` so the Hub Panel shows a change at once; a poll already in flight when a change is shown is ignored, so the old list cannot come back, and later polls overwrite it as usual.
- Rehearsed locally on loopback (Hub 8210, Sensor 8211) with a phone over Tailscale: closing the nearest Shelter on the Hub rerouted the phone. Not a Pi check.

## State snapshot (ticket 0040)

- **`GET /api/state` is built from `ReadingStore.snapshot(now)`**, which holds the lock once and returns the per-Node entries and the histories Flood Risk reads. Add later state fields beside them, not through a second store call.
- **In a `MeshedNodes` test, a Node started after another hears it at once** (both publish at startup), so "only this Node is listed" needs a single `start("porch")`. `hear_from(...)` Nodes have no client; `remove` only works on app Nodes.
- `STOPS_COUNTING_AFTER_SECONDS` in `timing.py` has no reader until 0021; that is on purpose.

## Flash flood pivot (ADR 0004)

- **Two floods hit the same river 13 months apart; don't mix their facts.** The 8 July 2025 Purepu GLOF started in Tibet and killed about 11 in Nepal; the 26 August 2026 ice-rock avalanche started on Langtang Lirung, inside Nepal, and killed well over a thousand. Many search results, including ICIMOD pages, cover both. The demo replays 2026; every fact in the replay timeline cites a 2026 source.
- **Early reports of the 2026 flood were badly wrong**: "about 160 dead" and "came from the Tibetan side" were both revised within days. Use the latest NDRRMA figure with its date, or none.
- A single fixed wave speed puts Syabrubesi's ETA at about 26 min when the real arrival was about 12, because the top reach ran near 190 km/h. ETA adds up per-reach speeds from the Cache Pack's river line.

## Hub Replay controls (ticket 0045)

- **Reset is "paused at 08:30", not "stopped"**: a stopped Event clock sends Sensors back to the Scenario, so only a paused clock holds every Node's track at calm. Start plays it again.
- **Jump keeps the clock's state** (paused stays paused, otherwise it plays). Pause and resume answer 409 in the wrong state.
- `GET /api/replay/phases` lists the phases and the internet cue in Event time. "Cut the internet now" shows while the Event clock is at or past the cue. No Community Warning exists in the code yet, so Reset's "no warning showing" is untested until warnings land.
- `findLast` is not in the dashboard's TypeScript lib target; use `.filter(...).at(-1)`. macOS `sed -i` needs `-i ''`.
