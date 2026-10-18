# Lessons: what we tried, what broke

A running log for agents and humans starting a new ticket. Read it before you build; add to it when something surprises you (newest at the bottom of each section). Facts only: what happened, what worked, what is still open.

## Environment

- **`uv` and `pnpm` may not be installed** on the machine an agent runs on. If `uv` is missing, another checkout's `node/.venv` works: run `PYTHONPATH=src node/.venv/bin/pytest` from the worktree's `node/` (the venv's editable install points at that other checkout, so `PYTHONPATH=src` is what makes it test *your* code). Say so in the report; don't claim a Command passed that you could not run. If `pnpm` is missing but Node is there, `npx --yes pnpm@10 <command>` works (lockfile v9); run it from `dashboard/`. All dashboard Commands passed on `main` after 0007 this way (typecheck, lint, 9 Vitest tests).
- **Worktree sessions refuse compound shell commands** (`cd x && VAR=y python ...`, `$(...)` feeding a command name, pipelines with computed operands). Run plain, separate commands, or write a small script under `$CLAUDE_JOB_DIR/tmp` and run it.
- **Don't edit `node/uv.lock` by hand unless `uv` is missing.** For 0007 it was edited by hand to move `httpx` from the dev group to runtime dependencies; run `uv lock` once on a machine with `uv` and commit any difference.
- **On Windows with no `uv`, install it from PowerShell**: `irm https://astral.sh/uv/install.ps1 | iex`, then `uv sync` in `node/`. A plain `python -m venv` fails if the system Python is 3.14, because `cryptography` (needed by `rns`) has no wheel for it; `uv` fetches Python 3.12 itself. After the 0004 merge, `node/.venv` from an older checkout lacks `rns`, so `pytest` stops at `import RNS`.
- **The pre-commit secret scan matches `sk-` plus 20 characters anywhere**, so a ticket slug with "risk-" and a long tail after it (0062's first name, "flood-risk-levels-…") is blocked as an API key, here and wherever the slug is quoted (the README index, this log). Rename the slug (0062 became `flood-levels-fit-the-river`); never `--no-verify`.
- A `git pull` in the main checkout aborted with "local changes would be overwritten" while another process moved `HEAD`; `git status` was clean a moment later. Check `git status` before reaching for `reset`.
- **Check who owns a ticket right before you claim it.** A claim pushed to your own branch is not visible on `main`; two people claimed 0009 minutes apart and the conflict showed up on `git pull`. Pull `main`, check the Owner line, then claim and push the claim to `main` at once.
- **A Node left running blocks the Node tests and your next run.** `tests/test_reticulum_nodes.py` binds fixed ports (HTTP 8101 to 8103, TCP 4250 to 4252 and 4350 to 4352), and a stray Node on 8000 keeps serving old code beside a fresh one. A Node on a new port shows what is on disk; check `Get-NetTCPConnection -State Listen -LocalPort 8000` before trusting a browser tab.
- A branch named after its ticket (`NNNN-<slug>`) may already exist from the claim commit. A worktree starts on `worktree-<name>`; push it with `git push origin HEAD:NNNN-<slug>` rather than renaming.
- **Workflow scripts (2026-10-17)** cover the repeat problems above: `scripts/claim.sh` (claim on `main` in one step; `issue-tracker.md` used to say "on its branch", which is how claims went unseen), `scripts/check.sh` (every Command, with the uv/pnpm/Node 20/`node_modules` fallbacks built in), `scripts/stop-nodes.sh`, `scripts/doctor.sh`. The secret scan's `sk-` pattern now ignores matches inside a word, so a slug with "risk-" passes. `pre-push` only warns. Nobody remembers to run scripts, so they run themselves: `implement` claims with `claim.sh` and finishes with `check.sh`, `doctor.sh --quiet` runs at Claude Code session start and in `post-merge`, and `pre-commit` refuses a hand-edited claim on a branch. Git hooks come from the main checkout's `.githooks` (`core.hooksPath` is absolute there), so a hook change reaches every worktree only after the main checkout pulls.

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
- The "no request carries the profile" test now runs five real poll cycles with fake timers (0041), as promised for 0019.

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

## On-device rerouting (ticket 0018)

- **The Road graph builder (`pack_routes.build_road_graph`, `build_cache_pack.py --roads-pbf`) has only run on a toy graph.** The real Nepal extract and `pyrosm` were not run, so `cache-pack-v3` still has no `roads.json` and the valley demo cannot block a road until a pack is rebuilt with it.
- **A "route is affected" check that measures distance to the blocked road's points fires at every junction** (the Route's first point is the blocked side road's end). The check uses the blocked segment's middle instead.
- **The plan is rebuilt every second**, so `rerouteHome` and `routeIsAffected` (via `rememberLastAnswer`) keep their last answer and only search again when their inputs change (same objects). Tests that call them with fresh objects each time are unaffected.
- **Leaflet taps in jsdom have no usable position**, so tapping a specific road is tested on `roadNear` directly; the flow tests start from a stored Blocked Road.
- `test_reticulum_nodes.py::...[loopback]` failed once in a full `pytest` run (101 s) and passed alone; no stray Node was listening. Rerun it alone before chasing it.
- **Do not run `ruff format` on `scripts/*.py`**: they are not formatted by it, and it rewraps lines you did not touch (and hides the real diff). Write new lines at 100 columns by hand.

## Restarted Node is heard again (ticket 0022)

- **`seq` starts at 0 and the freshness test is on the receiver's clock**: `ReadingStore.record` drops a non-increasing `seq` only while the last accepted reading is at most `STALE_AFTER_SECONDS` old, and an ignored reading does not refresh that age. A Node that reboots faster than 15 s with a low `seq` is therefore silent to peers for up to 15 s.
- `test_a_restarted_node_is_heard_again...` used to patch `time.time` to get ahead of the old counter; it now advances the `MeshedNodes` clock 16 s instead. A test that relied on the clock-seeded `seq` fails with the old pressure still showing.

## Reviews

- 0007 code-review: a retry loop that catches only some exceptions can die silently and leave a Node with no pack; background loops catch `Exception` and log it with `logger.exception`.
- Audit 2026-10-17: `MeshedNodes` used the checkout's `dashboard/dist`, `cache-pack/` and `node/data/`, so `test_a_sensor_has_no_such_route` got 405 (from the dashboard's static mount) instead of 404 on any machine that had built the dashboard. Every test Node now gets its own folders under `tmp_path`; a new harness setting that touches disk belongs in `MeshedNodes._settings`.
- Audit 2026-10-17: the Evacuation Plan test's Shelter-marker check failed about 1 run in 12, before and after 0010, because it checked the map right after the plan text appeared. Map assertions wait with `waitFor`.
- 0004 review 2026-10-17: **`RNS.Identity.from_file` returns `None` for a damaged file** instead of raising, and `Identity.to_file` writes the private key readable by everyone (644) and only logs a failed write. `load_or_create_identity` now stops the Node with an error naming the file, writes the key 600 itself, and locks down an older 644 file when it loads it. Deleting the file gives the Node a new id; for the Hub, every Node then needs the new `HUB_IDENTITY`.

## Flood levels fit the river (ticket 0062)

- **The Scenario cannot reach the 6 m High level without being a Surge**: stepping through it in a test takes under 60 s, so any total rise of 3 m or more counts as a Surge. Its last step is 390 cm, High from heavy rain on rising water, below the 300 cm Surge size from its 100 cm start.
- **The Surge size is 3 m because S0's track rises only 3.5 m before it goes silent** (0.7 m at 08:36:30, 4.2 m at its last 08:37:30 publish); 4 m missed it.
- **The water-rising size (50 cm) sits above the replay's calm drift** (S2 gains 12 cm between 08:30 and 08:40); retune it with the levels, not alone.
- A test that plays the replay with the real publish interval waits for the Hub to hear every Sensor before reading Flood Risk; `advance` alone moves only the clock.

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

## Official Alerts: DHM replay (ticket 0014)

- **The source article never names DHM**: it says "authorities" and the Flood Forecasting Division, and gives no alert wording. The timeline's headlines paraphrase it and `official_alerts_note` says so; `issuer` follows the spec's `dhm` / `district` tags. Recheck before the pitch if a better source turns up.
- **A signed alert must fit one Reticulum packet** (464 bytes with the 64-byte signature), and headline plus URL take most of it. `test_every_replayed_alert_fits_one_reticulum_packet` guards it; shorten the headline if it fails.
- **Nodes filter alerts on their own Event clock**, so Reset (paused at 08:30) hides every alert with no extra message. The Hub only forwards; it never takes an alert back.
- The lead-time line compares with the first Official Alert (09:05 notice), so it reads "Community Warning 08:37 · first Official Alert 09:05", decided on 2026-10-17. Nothing feeds it a Community Warning until 0013; `App` passes `null` for now.
- The dashboard reads alerts from `official_alerts` in the one state snapshot (`useNodeState`, every second), so a replayed alert appears when the Event clock reaches it.
- **Icons come from `lucide-react` 1.49.0, pinned with `--save-exact`** (ui.md), first used for the empty Alerts Panel. Match canvas icons by their SVG path: the Alerts empty state's triangle is `TriangleAlert`. The empty-Panel look (icon in a raised circle, one line) is `.empty-panel` in `App.css`; reuse it for the other empty Panels on `C-States`.
- With no Cache Pack yet, the plan counts the home as possibly in the Flood-Prone Area, so a riverbank alert is still listed: a missed alert is worse than an extra one.
- Rehearsed on loopback Reticulum (Hub slot 0 / port 8320, Sensor slot 1 / port 8321 with `HUB_IDENTITY`): after a jump to `dhm-sms` the Sensor showed both alerts within 2 s, so the signed alert packet verifies against the Hub key. Software path only, not a Pi check.

## Hub Panel buttons check (2026-10-17)

- **Every Hub Panel button was clicked in Chrome** on a test Hub and Sensor (Start, Pause, Resume, Reset, all eight phases, Shelter Close/Open, Close panel) and reached both Nodes. Use private ports and `NODE_MESH_INTERFACE=tcp` with `NODE_TCP_PORT`/`NODE_TCP_PEERS` so a rehearsal never joins a teammate's running Nodes.
- **A Hub that shows Gainesville Shelters, all Closed, holds the old Florida pack**: a Node never re-downloads a valid pack, and its saved `shelter_status.json` lists valley ids that pack lacks. Stop it, delete `CACHE_PACK_DIR` and `NODE_DATA_DIR/shelter_status.json`, point `CACHE_PACK_URL` at v3 and restart.
- **The replay ends at 10:30, just after the 10:28 district warning** (decided 2026-10-17; four minutes at ×30). The Hub pauses there and refuses Resume until a Reset or jump.
- **Sections inside `.slide-over` must not shrink**: the global `section { overflow: auto }` made the Replay controls scroll inside themselves and hid the internet cue.
- Closing the last Chrome tab Claude opened can disconnect the extension; leave one tab open until the check is done.
- Still open from the check: Flood Risk reads High during Calm, because the valley's 1.5 m river levels trip the street-scale water thresholds; the cameras are still the FL511 feeds.

## Flash flood pivot (ADR 0004)

- **Two floods hit the same river 13 months apart; don't mix their facts.** The 8 July 2025 Purepu GLOF started in Tibet and killed about 11 in Nepal; the 26 August 2026 ice-rock avalanche started on Langtang Lirung, inside Nepal, and killed well over a thousand. Many search results, including ICIMOD pages, cover both. The demo replays 2026; every fact in the replay timeline cites a 2026 source.
- **Early reports of the 2026 flood were badly wrong**: "about 160 dead" and "came from the Tibetan side" were both revised within days. Use the latest NDRRMA figure with its date, or none.
- A single fixed wave speed puts Syabrubesi's ETA at about 26 min when the real arrival was about 12, because the top reach ran near 190 km/h. ETA adds up per-reach speeds from the Cache Pack's river line.

## Hub Replay controls (ticket 0045)

- **Reset is "paused at 08:30", not "stopped"**: a stopped Event clock sends Sensors back to the Scenario, so only a paused clock holds every Node's track at calm. Start plays it again.
- **Jump keeps the clock's state** (paused stays paused, otherwise it plays). Pause and resume answer 409 in the wrong state.
- `GET /api/replay/phases` lists the phases and the internet cue in Event time. "Cut the internet now" shows while the Event clock is at or past the cue. No Community Warning exists in the code yet, so Reset's "no warning showing" is untested until warnings land.
- `findLast` is not in the dashboard's TypeScript lib target; use `.filter(...).at(-1)`. macOS `sed -i` needs `-i ''`.

## Dashboard reads the state snapshot (ticket 0041)

- **Fake timers must advance with real time in dashboard flow tests**: `vi.useFakeTimers({ shouldAdvanceTime: true })`. Faking `setTimeout` without it hangs every `findBy*` (Testing Library waits on a `setTimeout` that never fires), and the symptom is a 5 s test timeout, not an error.
- **A test of "updates without waiting for the poll" must look inside the poll interval**: after the click, `advanceTimersByTimeAsync(STATE_POLL_MS / 10)` and a synchronous `getByText`. A `findBy*` (up to 1 s) passed even with `refresh()` disabled, because the next poll arrived on its own; check a new test by breaking the code it covers.
- **`useNodeState()` returns `{ state, refresh }`; `state` is null until the first answer**, which is "Connecting…". A failed poll keeps the last state and only logs; 0042 adds the `unreachable` connection and the clearing.
- **Dashboard tests build state with `fakeNodeState()` / `fakeNodeSnapshot()`** (`dashboard/src/fakeNodeState.ts`). A flow test whose `fetch` stub lacks `/api/state` stays on "Connecting…".

## Mesh ignores bad messages (ticket 0023)

- **Both Meshes decode through `mesh.decode_message` and call listeners through `deliver_to_listeners`**, so a rule added there holds on the radio and in tests. A string `kind` or integer `v` this Node does not know is dropped silently (a newer Node); a missing or non-string `kind`, a missing or non-integer `v` (`true` included) and anything else that does not parse logs a warning. Check `kind` is a string before testing set membership: a list or object `kind` raised `TypeError` (found in review). Extra fields were already ignored by pydantic default.
- `MeshedNodes.send_bytes(body)` puts raw bytes on the in-memory Mesh; `join_with_failing_listener(name)` adds a Node whose listener raises.
- Not proven: a bad packet sent to a live Reticulum Node (only `verify` is tested with signed bad bodies).

## Node unreachable (ticket 0042)

- **The 5 s rule is its own timer, restarted by each good answer**, not a check when a poll fails: checked on failure, a Node that hangs from page open was caught only at 6 s (requests end at 2, 4, 6 s). Found in review.
- **A null Event clock means "no replay" only once `/api/replay` has answered**; `useEventClock` returns `heard`, and the Replay controls wait until it is true, or Start flashes on first load and after every reconnect.
- **To test the 2 s request timeout on fake timers**, spy on `AbortSignal.timeout` and return a controller aborted by a (faked) `setTimeout(ms)`; the real one runs on a clock fake timers cannot move (`nodeUnreachableFlow.test.tsx`).
- `usePolledJson(null)` stops a poll and drops its last answer; cameras and the Event clock use it while unreachable. `useNodeState` returns `state` (null while unreachable) and `lastAnswer` (kept, for name, role and Official Alerts).
- **`evacuationFlow.test.tsx` "the Route request names a Grid point" failed about 1 full parallel run in 3**: it read the requests as soon as "Nearest open Shelter" showed, which the straight-line plan does before the Route file is asked for. It now waits for the request with `waitFor`. This may be the 0031 flake whose cause was not found.

## One-laptop demo script (ticket 0049)

- **`scripts/run-demo.sh` rehearsed on loopback** (Hub 8600, S0 to S3 8601 to 8604, `DEMO_SLOT_BASE=20` because a teammate's Node held slot 0 and port 8000): all four Sensors took `HUB_IDENTITY`, fetched the pack from the Hub, followed Start, and the Hub dashboard answered on the hotspot and Tailscale addresses. Software path only, not a Pi or Wi-Fi check.
- **`gh release download` of the 2.4 MB pack took about 6 minutes** on this network and writes its file under the final name while downloading, so the script downloads into a side folder and moves it.
- **A script started with `nohup ... &` ignores SIGINT**, so Ctrl-C style stops must be tested with `kill -TERM`; a script in a real terminal gets the trap.
- macOS `sed` has no `\|` alternation; use `awk` to filter `ifconfig`.
- River km is not a Node setting yet, so the script gives each Node only position and track; ETA reads River km from the Cache Pack's river line.
- **A Node logs "is up" before it binds its HTTP port** (`main.py`, `run()`), so the identity line does not prove the Hub is serving: with 8000 taken, the Sensors started and the projector showed the old Node. `run-demo.sh` now refuses to start while any of its HTTP, pack or loopback Reticulum ports is listening, and stops waiting if the Hub process dies.
- **macOS ships bash 3.2, where `"${arr[@]}"` on an empty array is "unbound variable" under `set -u`**; use `${arr[@]+"${arr[@]}"}` in traps that may run before anything starts.
- "Cut the internet" has two halves: stop the pack server and take away the laptop's upstream. Nodes decide online/Mesh-only by probing gstatic themselves; there is no switch.

## Node registry (ticket 0012)

- **Strict counting changed every Flood Risk test**: no registry heard means nobody counts, this Node included. `MeshedNodes.register(*names)` publishes a hand-made Hub registry listing the Hub and those names; call it after the last `start(...)`, because a Node only hears a registry published after it joins. `register` and `announce_registry` use the hand-fed Hub mesh, which **replaces the Hub app's own mesh** in the in-memory network; with a running `start_hub()` register Nodes through `/api/registry/signup` and `/accept` instead.
- **A registry is capped by one signed packet** (464 bytes with the 64-byte signature), about 4 to 5 Nodes with 32-character names, 8 with short ones. The Hub answers 409 on an accept that would not fit. Multi-packet registries are out of scope.
- **Sign-up is a broadcast signed by the Node**, so `verify` finds the key from `node` like for a reading. Only the Hub's listener keeps it; a restarted Hub forgets waiting Sign-ups, and a Node that pressed Sign up resends every `NODE_SIGN_UP_REPEAT_SECONDS` (10) until it hears itself registered.
- **Dashboard**: the Hub Panel now has tabs (Registry is the default, then Replay and Shelters), so a test that needs the Replay controls or Shelters clicks the tab first. The Node button shows only when `window.location.hostname` is localhost, evaluated at render so a test can stub `location`.
- Rehearsed on loopback Reticulum (Hub slot 40 / port 8710, Sensor slot 41 / port 8711, `HUB_IDENTITY` set): Sign-up arrived as `waiting`, accept made the Sensor `registered` within seconds and the Hub's registry showed `ver` 2. `scripts/run-demo.sh`'s new `register_sensor` step was only syntax-checked (`bash -n`), not run end to end: it needs the pack download and `ifconfig`. Software path only, not a Pi check.

## Map tiles from the Cache Pack (ticket 0026)

- **The map picks its tile URL from the pack's deepest tile zoom (`mapTiles.ts`) and a `tileerror` handler swaps a missing pack tile's `src` to `/api/tiles/...`.** Leaflet draws no tiles in jsdom (zero-size container), so tests mock `TileLayer` and assert its props; the per-tile fallback is tested as a pure function. Not seen in a real browser yet.
- **The valley pack's tiles stop at z14**, so zooming past it asked the Node for tiles that do not exist and the map went blank (no CARTO key to fall back on). `TileLayer` now gets `maxNativeZoom` from the highest `tiles/{z}` in the manifest and stretches the z14 tiles. Found on a phone.

## Surge (ticket 0046)

- **On Windows two Node tests fail on a clean `main`**: the identity-file tests assert mode `0o600`, which Windows cannot report (it shows `0o666`). The two `test_reticulum_nodes.py` loopback tests also failed until the Nodes left running from other worktrees were stopped (they held ports 4250 and 4251); they pass once those ports are free. A change that leaves exactly the two identity-file tests failing has not broken anything.
- **`evacuationFlow.test.tsx` "the Route request names a Grid point, not the home" failed once and passed on the next two runs** with no change near it; rerun before chasing it.
- **A Surge is judged on the sender's timestamps (`t`), not on when readings arrived**, so two readings that reach a Node together still count as one over time. In tests, `MeshedNodes.advance(seconds)` between two `hear_from` calls is what makes a rise slow. A slow rise to a high level is still High from `water_high`; assert on `surged` and the `water_surge` reason to tell a Surge apart.
- **`surged` is "surging now", not latched**: it empties about 60 s after the jump even while the water stays high. Ticket 0013 must remember that it already warned for a Node's Surge; it cannot ask Flood Risk.
- The Scenario cannot produce a Surge (its largest water step is 35 cm), so Surge tests hand-feed readings with `hear_from`.
- **Running a Hub and a Replay sensor on one laptop**: a sensor follows the Replay clock only with `HUB_IDENTITY` set to the Hub's id (printed at startup as `Node <id> (hub-1) is up as hub`); the id changes if `NODE_DATA_DIR` is wiped. Without it the sensor publishes the Scenario and the Hub's Flood Risk never moves. Start the Hub first, then the sensor, and make sure no Node from another worktree still holds loopback ports 4250 and 4251, or the sensor dials that one instead (`Get-NetTCPConnection -State Listen -LocalPort 4250`).
- **A full Replay from the start can skip S0's Surge**: its ramp (08:36:30 to 08:37:59, 89 event seconds, about 3 real seconds) is as short as the 3 s publish interval, so S0 can publish 0.7 m and then go silent without ever publishing a high reading. A jump to the Collapse phase did show the Surge. 0044 or 0049 should widen the ramp or publish faster during it.
- **A Hub with no `registry.json` starts `ver` at the Unix time** (like `seq`), so deleting the file no longer leaves running Nodes ignoring it. In a `MeshedNodes` test the first Hub start also uses the clock, so `advance(...)` before a start-over or the new `ver` can equal the old one.

## Replay speed toggle (2026-10-18)

- **The Hub offers x5, x10 and x30 (`POST /api/replay/rate`); x1 is refused on purpose.** Replay readings carry the real clock as their timestamp, so a Surge (300 cm in under 60 s) is judged in real seconds: S0's 3.5 m rise takes 89 s at x1 and never counts, 18 s at x5 does. `test_the_collapse_surge_still_reaches_the_hub_at_a_slower_rate` covers x5 and x10.
- **The chosen rate lives on the Hub and is used by Start, Resume, Reset and Jump**; changing it mid-replay re-announces the clock at the same `event_t`. Software path only, not seen in a browser.

## Replay weather in the Cache Pack (ticket 0052)

- **Open-Meteo answers with its own model-cell coordinates** (asked 27.86, 85.08; got 27.873, 85.034), so `weather_replay.json` stores the grid we asked for, not the answer's `latitude`/`longitude`. A multi-point request returns a list, a single point a dict.
- **Rain is flat before the flood on 26 Aug 2026**: mean 0.03 to 0.12 mm/h across the 08:30 to 10:30 NPT Replay window, wet only from about 10:45 NPT onward (numbers in ticket 0052). The Rain layer looks nearly empty during the Replay; do not "fix" it by scaling the colours.
- Real build helper run: 35 points, 72 hours, 54 KB of JSON, one request. The full `build_cache_pack.py` was not rerun (needs `CARTO_API_KEY`), so no `cache-pack-v4` with weather exists yet; a Node whose pack lacks weather answers 404 on `/api/weather/replay` and still works.
- `pack_weather.py` sits in `scripts/` beside `pack_routes.py`, so the Node tests import it through the same `../scripts` path.

## Replay Sensors publish through their Surge (ticket 0060)

- **A replay-track Sensor publishes every `REPLAY_PUBLISH_EVERY_SECONDS` (1 s, 30 event seconds)**, or the Node's `publish_every_seconds` if that is shorter; the Scenario keeps 3 s. No timeline time moved: at 3 s (90 event seconds) the miss depends on where the Sensor's publishes fall, and only one of nine tried offsets (30 event seconds after the start) lost S0's Surge.
- **A test of "a run can miss the ramp" must try several publish offsets**; the first offsets tried (0, 10, 20) passed even with the old 3 s interval. Check such a test by putting the old value back (`test_every_sensors_surge_reaches_the_hub_in_a_replay_from_the_start`).
- `pkill -f "storm_shield.main import run"` inside a compound Bash command can match and kill the command's own shell (exit 144); run it alone.
- `test_nodes_find_each_other_and_a_step_crosses_the_mesh[tcp]` failed once in a full run and passed alone, with and without this change.
- **0060 and 0012 were each green alone and clashed once merged**: 0060's Surge test started S0 to S3 without registering them, and 0012 makes Flood Risk (so `surged`) ignore unregistered Nodes. The test now signs each Sensor up and accepts it on the Hub. A test written on a branch cut before 0012 that reads Flood Risk needs the same; rerun the full Commands after every merge of `main`, not only before it.

## Community Warnings (ticket 0013)

- **The Hub gets a Node's River km from its reading** (`river_km`, from `NODE_RIVER_KM`), not from a new message. A Surging Node without it starts no warning; check `NODE_RIVER_KM` first if a Surge shows no warning. `scripts/run-demo.sh` now sets it for the Hub and S0 to S3 (spec table values), only syntax-checked, not run.
- **The Hub checks for new Surges whenever a reading arrives** (its own or heard), not on a timer, so tests need no waiting. `HubWarnings` forgets a Node once it stops surging, so a second Surge warns again.
- Adding a field to a reading or `/api/state` node entry breaks the two exact-field-list tests (`test_community_reading.py`, `test_state_snapshot.py`); update them.
- Not rehearsed on loopback Reticulum or in a browser; the signature path is covered by `verify` tests only.
- **The Hub repeats every warning it sent** each `warning_repeat_seconds` (found in review: sent once, a late or restarted Node never saw it). A Hub restart forgets its log, so a Surge still holding then warns again under a new id.

## Breadboard (ticket 0016)

- **A press is a wire from the Pi's 3.3 V pin to an input pin**, not a button. The Pi's internal pull-down (`pull_up=False`) keeps an empty pin low, and a press jumps the Scenario to that pin's step (`Scenario.go_to`); only reset goes back. Pin table: `pi/README.md`.
- **`gpiozero`'s `MockFactory` stores `bounce_time` but does not simulate bounce**, so the 50 ms debounce is untested; it is the library's, set on each `Button`. Drive a mock pin with `factory.pin(17).drive_high()`; set `Device.pin_factory = MockFactory()` in a fixture and restore `None` after.
- **`lgpio`, the backend `gpiozero` needs on a Pi, is source-only on PyPI and needs `swig`**, so `uv lock` failed on a laptop when it was a dependency (uv builds the sdist to read its metadata). `[tool.uv] dependency-metadata` in `node/pyproject.toml` declares it, so the lock works anywhere and only `uv sync --group pi` builds it. On the team's Pi (Python 3.13, so Debian 13 Trixie rather than Bookworm) the build first failed with `cannot find -llgpio` until `sudo apt install liblgpio-dev`; `swig` and `python3-dev` alone are not enough. `pi/install.sh` installs all of them.
- **`claim.sh` compares the ticket's Owner with `git config user.name`**, so an Owner written as a handle (`amitathik7`) against the name "Amit Athi Kesavan" makes it refuse. The ticket was already claimed, so 0016 skipped the script.
- **A plain `uv sync` on the Pi uninstalls `lgpio`** (it is in the `pi` group, which a plain sync leaves out; it was first installed by hand), and the Node then stops with `Falling back from lgpio: No module named 'lgpio'` followed by `OSError: [Errno 22]` from gpiozero's sysfs `NativeFactory` fallback, which modern Pi kernels no longer support. Run `pi/install.sh` or `uv sync --group pi`. `scripts/run-live.sh` used to run a plain `uv sync` and broke the Pi on every start; it now adds `--group pi` when `/proc/device-tree/model` says Raspberry Pi (confirmed on the team's Pi, 2026-10-18).
- **Real Pi (2026-10-18):** the hotspot came up, a laptop joined it, and each Breadboard wire changed the Pi's readings on the laptop's dashboard. With the laptop's `firewalld` stopped, the laptop Hub and the Pi's Node found each other over AutoInterface on the Pi's own hotspot. With `firewalld` on, opening UDP 29716 and 42671 on the zone did not fix it ("No multicast echoes received on wlan0"); the missing rule was not found. Trusting the hotspot connection's zone was suggested but not confirmed. A peer shows under its id, not its name, until the Hub's registry reaches it. Unexplained: the laptop terminal froze and both Nodes stopped once, with no Pi log kept.
- **`ssh appu@10.42.0.1` said "connection refused" while ping worked, because 10.42.0.1 was the laptop.** NetworkManager's shared mode defaults to `10.42.0.1/24` on both the laptop's Ethernet cable to the Pi and the Pi's hotspot, so the laptop answered itself. The Pi's `sshd` was fine (`Accepted publickey ... from 10.42.0.1` in its log is the laptop). The hotspot now uses `10.88.0.1`. The tell: "refused" with a working ping means a machine answered that has no listener; check `ip -4 addr | grep <address>` on the machine you are typing on.
- `MeshedNodes` Nodes start with `gpio="off"` so a test run on a real Pi never reads its pins. `pi/setup-hotspot.sh up` was only exercised for its missing-setting and bad-argument paths here; the `nmcli` part never ran.

## Pi hardware check (ticket 0004)

- **AutoInterface works between a Pi and a laptop over Ethernet and over an iPhone hotspot**: peers found each other in 10 to 18 s with nothing configured. The iPhone hotspot passes the IPv6 multicast discovery needs.
- **firewalld blocks AutoInterface on Arch**: a NetworkManager shared cable is zone `nm-shared` (only ping, DHCP, DNS, SSH) and Wi-Fi is `public`. Open UDP 29716 and 42671 on the zone of the link the Mesh should use (`sudo firewall-cmd --zone=<zone> --add-port=29716/udp --add-port=42671/udp`, gone at reboot). Leaving them closed on one link keeps the Mesh off it while SSH still works there.
- **Docker blocks NetworkManager's connection sharing**: it sets the forward policy to drop, so a Pi behind a shared cable gets DNS but no internet. `sudo iptables -I DOCKER-USER -i <cable> -o <wifi> -j ACCEPT`, plus the reverse rule for `RELATED,ESTABLISHED`.
- **Give every Node its own `NODE_LATITUDE`/`NODE_LONGITUDE`**: two Nodes on the default position stack on the map and a watcher sees one Node while `/api/state` lists two.
- **Wait a few seconds before restarting a Node you just killed**: started at once, it exited 255 with an empty log, most likely because Reticulum had not let go of its ports.
- **`pkill -f storm-shield-node` over SSH kills the remote shell too** (its command line holds the pattern; ssh exits 255). Use `pkill -f "[s]torm-shield-node"`.
- **Start a Node over SSH with only the Node in the background**: `cd dir || exit 1; setsid nohup <node> > log 2>&1 < /dev/null &`. Backgrounding a whole `cd && ... &` chain kept the ssh session open until it timed out.
- A Pi user's `uv` is in `~/.local/bin`, which a non-interactive SSH command does not have on its `PATH`; call `node/.venv/bin/storm-shield-node` directly.

## Hub forecast (ticket 0058)

- **`weather_forecast.json` is the Weather Grid plus `fetched_at`**, kept in `NODE_DATA_DIR`. The grid helpers live in `storm_shield/weather_grid.py` (the Node needs them at run time; `scripts/pack_weather.py` imports them from there). A Sensor needs `NODE_WEATHER_FORECAST_URL` (the Hub's `/api/weather/forecast`; `run-demo.sh` sets it); without it the Sensor never gets a forecast.
- **A Node with no copy retries every 30 s** (the Hub may not have fetched yet), and hourly once it has one. Tests that wait on a retry patch `storm_shield.main.RETRY_EVERY_SECONDS`.
- **A Hub started with its lifespan in a test would call the real api.open-meteo.com**: `MeshedNodes.start_hub` injects an offline `weather_source`; do the same for any new test that enters a Hub as `with TestClient(app)`.
- Rehearsed on loopback (Hub 8710 / slot 30, Sensor 8711 / slot 31) against the real Open-Meteo: both served 120 KB of forecast, and after the Hub was stopped the Sensor still served it. Software path only, not a Pi check.

## Tidy Community Reading mapping (ticket 0024)

- **Three boxes were left open on purpose.** `store_reading_from` is now `hear_community_reading` because the listener still needs its `isinstance` filter; the only other `datetime.now(UTC)` is the default clock and the Scenario's own stamp; the Mesh listeners take any `Message`, so no parameter says Community Reading. The ticket is done on the other four bullets.
- **`Position` is a distinct NamedTuple**, so tests build `Position(lat, lon)` and mypy rejects a bare tuple. The six test files changed only for that.
- The sequence, the `publishing` lock from 0020 and `share()` now live in `reading_publisher.py` (`publisher.lock`); `create_app` only wires them up.

## Unverified Node's Surge (ticket 0061)

- **`_counts` already kept an Unverified Node's Surge out of Flood Risk and warnings**; 0061 only added the missing Seam A test (`test_unverified_surge.py`). Breaking `_counts` to `return True` makes it fail.
- **The ticket's "100 cm jump" predates 0062**: a Surge is 300 cm or more now, so the test jumps 20 to 340 cm.

## Wave ETA (ticket 0047)

- **The ETA is `dashboard/src/waveEta.ts`, computed on the Viewer from `river.geojson`** (read once by `useRiverLine`; a pack without it gives no ETA and no error). The home snaps to the nearest river vertex, and a home more than 2 km from the line gets "not near the river" instead of a countdown. By hand, the spec's numbers check out: S0 (km -12.2) to Betrawati (km 45) is 12.2/190 + 45/68 h, about 43.6 min.
- **The plan and every warning card show the same line, the earliest arrival over all warnings** (code-review: per-card ETAs let a card disagree with the plan). A second Surge from a node nearer home can beat the first, so a test that expects the later origin to arrive later is wrong (it was, first time).
- **The Event clock only moves once a second in the dashboard** (`useEventClock` polls `/api/replay`), so at ×30 the minutes drop in steps. Not smoothed between polls.
- `test_reticulum_nodes.py::test_nodes_find_each_other_and_a_step_crosses_the_mesh[tcp]` failed again in one full `scripts/check.sh` run and passed alone (`scripts/stop-nodes.sh` first); no Node code changed.

## Silent Nodes stop counting and drop off (ticket 0021)

- **The reading store does the dropping, not Flood Risk**: `snapshot().recent` leaves out a Node silent for 60 s and `nodes` leaves out one silent for 10 min, so `_counts` and the Community Warning (which reads `surged`) needed no change. A Node's history stays in the store, so it reappears the moment it speaks. `NodeSnapshot.counts` is the 60 s flag for the dashboard.
- `InMemoryNetwork.join` now raises on a taken name; `leave` makes that mesh's `publish` a quiet no-op. A Node that `leave`d may rejoin under its name.
- `test_reticulum_nodes.py` errored (not failed) in a full run while another `pytest` was still going in the background; it passed alone. Run one `pytest` at a time.

## The map shows the Cache Pack (ticket 0025)

- **react-leaflet `GeoJSON` throws "Invalid GeoJSON object" on a fixture like `{ features: [] }`** (no `type`) or a feature without `type: "Feature"`. Older flow tests had such fixtures because nothing drew the overlay; they are valid GeoJSON now. A test that stubs `flood_prone.geojson` needs `type: "FeatureCollection"`.
- **The "approximate" caption shows only when the overlay has a feature**, so a pack with an empty corridor shows none.
- The closed-Shelter wording follows the Evacuation Plan: before the Hub's first announcement every Shelter reads Closed. Final pins and the hatch are 0035.
- Not seen in a real browser or on a phone yet; jsdom draws markers, tooltips and the path but not tiles.

## Audit of done tickets (2026-10-17, after 0025)

- **Every Command passes on `main`**: 252 Node tests, 170 dashboard tests. The 4 `test_reticulum_nodes.py` errors seen mid-session were a Node left running from another worktree (pid started 19:48, parent init, no run-live loop); `scripts/stop-nodes.sh` freed 4250 and 8000 and the file passed.
- **Still true after the audit:** `roads.json` and the real Road graph have never been built from the Nepal extract (0018), so the demo cannot block a road; the camera tiles are still FL511 Florida feeds in the Nepal demo (0011); `run-demo.sh` registration (0012/0049) and the full two-phone replay (0049) were never run end to end; 0016 (breadboard) is open.
- `weatherGrid.ts` (`valueAt`, `windAt`, `speedBand`) is only used by its tests until the weather layer tickets (0054 to 0057, 0059) land; that is on purpose.

## Measured wave speed (ticket 0050)

- **The second Node's Surge updates the origin's warning instead of getting a warning of its own**, when it is downstream, later, and the speed is under 300 km/h (`MAX_MEASURED_SPEED_KMH`). Otherwise it warns on its own as before, which is why `test_two_nodes_surging_make_one_warning_each` still passes: its Surges are 8 s apart, over 1,000 km/h.
- **In a replay, a test's `advance(seconds)` moves the Event clock 30 times as far**, so a measured speed there is distance over *event* time. A 32 s advance is 16 event minutes.
- **A home must be within 2 km of a river vertex to get an ETA**, and the test river has a vertex every 10 km: pick test homes on vertices (`at(0)`, `at(20)`), or the answer is `not-near-river`, not the reach you meant.
- Rerun of `test_reticulum_nodes.py` needs ports 4250 and 8000 free; another session's Node (a different worktree) held them during the first full run, so those four tests were run later. Check `ss -ltnp` before `scripts/stop-nodes.sh`: it would kill a teammate's or your own other session's Node.
- Not rehearsed on loopback Reticulum or in a browser; the update path is covered in the in-memory Mesh only.

## Shelter or higher ground (ticket 0048)

- **The plan takes a `wave` window (`arrivalAt`, `eventT`) from `App`**, null with no warning or no Wave ETA for the home, so an upstream or far-from-river home keeps the old nearest-Shelter plan. Reachability is judged on every render, so the choice flips on the Event clock without a new message.
- **Walking minutes are rounded up from the straight line x 1.4 at 4 km/h**: 0.01 degrees of latitude is 24 min, not 23. Pick test distances from the arithmetic, not from round numbers.
- **With a warning up and no Shelter reachable in time, the map used to show nothing** (found 2026-10-18 by placing a home at Syabrubesi: the gompa is a 12 min walk and the wave is 17 min away, so it fails the 5 min margin from the first second). The plan now also returns `outOfReachShelter`, the closest fitting Shelter outside the Flood-Prone Area, drawn as a dashed marker labelled "Can't reach in time: head uphill toward it", with no route and never as the chosen Shelter. A home far from every Shelter (Trishuli, 143 min) still gets a marker that is useless; real high-ground points are ticket 0068.
- **A Node left running from another worktree (found on 8000 and 4250) fails the four `test_reticulum_nodes.py` tests with errors**; it was a teammate job, so it was not killed. `test_resume_at_the_end_is_refused` failed once in the full run and passed alone.

## Theme, bundled fonts and icons (ticket 0032)

- **Vitest turns every imported stylesheet into an empty string, `?raw` and `import.meta.glob` included**, so a test that scans CSS that way passes with nothing checked. `theme.test.ts` reads the files with `node:fs` (hence `@types/node` and `"node"` in `tsconfig.json` types) and also asserts it saw `App.css` and `App.tsx`.
- **The theme file is `dashboard/src/theme.css`**, loaded before `App.css` in `main.tsx`; `App.css` uses roles only (`--accent`, `--risk-low`, `--surface-panel`…), never a primitive. The old names (`--community`, `--low`, `--muted`, `--line`…) are gone. A new colour is a role in `theme.css` first.
- **Fonts are the `latin-*.css` files** of `@fontsource/ibm-plex-sans` (400, 600, 700) and `-mono` (500, 600), so the build carries about 10 small woff/woff2 files and no Google request. Checked in Chrome from a Node on a private port: the three weights the first screen uses loaded from the Node's own origin and no resource came from another host. The internet was not actually unplugged, so "works offline" rests on that same-origin result.
- **Text-glyph icons remain**: the `⌂` home markers in `NodeMap.tsx` are not `lucide-react`. They go with the marker anatomy in 0035.
- **A rule's own `font-family` beats the grouped mono rule near the top of `App.css`**: `.tag` kept a hardcoded `ui-monospace` and showed the system font until a computed-style check in Chrome caught it. `theme.test.ts` now fails on any `font-family` that is not `var(--font-sans)` or `var(--font-mono)`.
- `.tag.stale` was amber; the design says Stale is muted grey because amber means Elevated, so it is `--text-secondary` now.

## God's Eye View artboards (2026-10-18)

- **The `G-` boards carry real geometry** (geoBoundaries ADM0/ADM2, OpenStreetMap rivers through Overpass, the pack's `river.source.geojson`, Terrarium tiles for the relief); sources, licences and the projections are in `docs/design/canvas/README.md`. The generator stayed out of the repo (about 400 lines); the README says how to redo it.
- **`overpass-api.de` answers 406 to a bare `curl`**: send a `User-Agent` (as `scripts/derive_river.py` does) and `Accept: application/json`. Natural Earth 10 m rivers hold only three partial lines inside Nepal, so they are no use for this map.
- **Douglas–Peucker on a closed ring collapses it to one point** when the first and last vertices coincide (the chord has zero length); measure from the shared point in that case. The national border vanished until this was caught on a screenshot.
- **The Claude in Chrome extension was not connected in this session**; headless Chrome (`--headless=new --screenshot --window-size=1440,900`) renders the `.dc.html` boards fine for checking overlap. Console errors were read from `--enable-logging=stderr` (none from the boards).
- A 250 m contour step at the gorge zoom made one board 530 KB; 500 m steps with loops clipped to the frame keep every board under 320 KB.

## Reticulum loopback test fails in the whole-file run (found 2026-10-17, while merging 0050; fixed the same day)

- **`test_nodes_find_each_other_and_a_step_crosses_the_mesh[loopback]` failed because a running demo dialed into the test's Nodes.** A loopback Node dialed every slot from 0 up to its own, so `run-demo.sh` with `DEMO_SLOT_BASE=20` (Nodes at slots 20 to 24) kept dialing 4250 to 4269 every 5 s. Once the test's Nodes listened there, the demo's readings arrived and `heard_from() == ids` never held. The three test Nodes themselves met in under 5 s. It failed alone too, whenever the demo was up; it "passed earlier that day" because no demo was running then. TIME_WAIT, `~/.reticulum` and a shared instance were not involved (each Node has its own config dir with `share_instance = No`).
- **Fix:** `NODE_LOOPBACK_FIRST_SLOT` (default 0) is the lowest slot of a Node's group, and a Node dials only its own group. `run-demo.sh` passes `DEMO_SLOT_BASE` as it; the test runs as group 60 (ports 4310 to 4312) and fails at once, naming the stranger, if a Node from outside the test is heard. Rehearsing at slots 20, 30 or 40 by hand, set `NODE_LOOPBACK_FIRST_SLOT` to the group's first slot too, or your group joins every Node below it.
- **The busy-port guard cannot see this**: the intruder dials *out* to the test's ports and listens elsewhere. `ss -tanp | grep 425` shows who connects, and `/proc/<pid>/environ` shows its `NODE_LOOPBACK_SLOT`.
- **Unrelated flake seen while checking the fix:** `test_replay_drives_the_sensor_nodes.py::test_resume_at_the_end_is_refused` failed 1 run in 3 of its file (`pause` answered 409). After the jump to `end` the Hub's own loop pauses the clock at 10:30 almost at once, and when it wins the race the test's `pause` is refused. The test now waits for the Hub's own pause and then checks Resume; 15 of 15 runs passed.
- **Never chain `scripts/check.sh | tail` before `git push`**: `tail` hides the exit code and a failing pytest still pushed. Test `check.sh`'s own exit status.
- **A baseline "without my change" must be a commit before your merge**: `8e8b951` already held 0050 and gave a false answer. Use the parent of your merge.

## Valley Road Routes (ticket 0051)

- **Real build, 2026-10-18** (`build_cache_pack.py --roads-pbf` with `uv run --with pyrosm`, Windows, Python 3.14 resolved fine): reading the 415 MB Nepal extract takes 40 to 100 s; 2,291 junctions and 2,405 segments in the Road graph. Route files by grid: 100 m is 36.8 MB, 250 m 5.8 MB (just over the 5 MB budget), **500 m 1.4 MB (341 files), so the pack uses 500 m**. A home can be up to about 350 m from its Grid point; the Route line starts there.
- **The corridor rule drops most Routes in the gorge.** Syabrubesi gompa has 64 Routes without it and none with it (the first build, which skipped the legs to and from the road, kept 1; code-review caught that); Sundaradevi and Karki go from 697 to 144 and 160. The road runs beside the river, so a hillside home's drive goes into the corridor and out again. Those Shelters use the straight-line walk with no line, as the ticket specifies, and the phone's own check (`routeIsAffected`) treats any touch of the corridor as affected too.
- **The leg from the Grid point to the road and the leg from the road to the Shelter are sampled too**, not only the stretches between road nodes: the Shelter's road node can be up to 500 m away, across the corridor.
- **A bridge between two road nodes can lie outside the corridor at both ends**, so `touches_segment` samples every 40 m instead of testing nodes only.
- A one-off script that imports `build_cache_pack` from `scratchpad` needs `sys.path` set to the repo's `scripts` folder; run from `node/` the path is `../scripts`.
- **A Node left over from an earlier session held loopback port 4250** and made four `test_reticulum_nodes.py` tests error in `scripts/check.sh`. `scripts/stop-nodes.sh` cannot find it on Windows (`pkill` and `lsof` are missing); use `Get-NetTCPConnection` and `Stop-Process`.
- **Example home**: with no saved profile and a valley pack, `exampleHousehold` (28.1654, 85.3398, Syabrubesi, 3.0 km by road to Komin school once the gompa lost its Route; a first pick at 28.0599, 85.2303 was 26 km by road from any Shelter, because the five Shelters sit up to 66 km apart, so choose a home by its road distance to a Shelter) feeds the plan, the Routes request and the map marker; the Cache Pack manifest's `bbox` now reaches the dashboard (`CachePackContents.bbox`) so other packs keep the prompt. Seen only through type, lint and unit checks, not yet in a browser.
- Rehearsed on loopback: a Hub started on the new pack (served by `python -m http.server`) validated its checksums and served a Route file with the Gompa's Route. Not checked in a browser; software path only, no Pi.

## Simulated Fleet (ticket 0064)

- **The real build worked against Open-Meteo** (40 sites in one request, 2 days of 3 hourly variables, 185 KB of `fleet.json`). The archive's `soil_moisture_0_to_7cm` is m³/m³ (the file stores %), and several points come back as a list, one point as an object.
- **Real rain makes the three rising towns rise only a little over the window**: the 24 h rain is a slow sum, so Taplejung sits at about 201 to 206 cm (calm base 80) the whole 08:30 to 10:30, Arughat at about 148 and Kakarbhitta at 128. They read as elevated, not as a ramp. Raise `GAIN_CM_PER_MM` only if the map needs a visible climb; the cap (200 cm) keeps every rise below the Surge size.
- **The 15 km rule dropped Chatara** (13.9 km from Dharan). The source coordinates are typed from memory and unchecked on a map; 0035 verifies them.
- **A track is cut at `silent_at`**, so the Node needs no silent logic: it reads the last point at or before the Event clock and ages from there.
- The Node reads `fleet.json` through `SimulatedFleet`, which re-parses only when the file's modified time changes; it never touches the Mesh, `ReadingStore` or the registry, so a Surging entry cannot move Flood Risk.

## Nepal vector Cache Pack (ticket 0063)

- **Real build, 2026-10-18** (`scripts/build_cache_pack.py`, no key, no `--roads-pbf`, no raster tiles): 10.0 MB zip, about 7.6 MB more than v3's 2.4 MB, inside the ticket's 6 to 10 MB. Vectors 1.3 MB (border 0.07, districts 0.07, rivers 1.13 with 1,827 lines, places 0.06), elevation 9.63 MB in 138 tiles. The elevation budget is 10 MB, raised from 8.5 when Kathmandu got detail tiles; PNGs do not compress, so it counts raw bytes. Run it again with `--roads-pbf` for the road graph and Routes; that was not done here.
- **geoBoundaries licences differ per level**: ADM0 is CC BY 4.0, ADM2 (75 districts) Public Domain, ADM1 CC BY 3.0 IGO. The build copies each from the API metadata, so check the README table if the dataset is rebuilt.
- **Overpass answers 406 without a `User-Agent` and 502 now and then**; the builder sends one and retries through `pack_weather.ATTEMPTS`. The river query is 40 MB of raw geometry (7,315 ways) and takes a minute or two.
- **The build checks its own elevation**: it decodes the Terrarium PNGs itself (no Pillow in the Node's venv) and compares each key place with a published height. Published heights are loose (Timure's 1,900 m is a climate-table label, Trishuli has no direct figure), so tolerances are 100 to 200 m and each is explained in `key_places.source.json`.
- **A place's OpenStreetMap node can sit on a hill edge**: Kathmandu's city node read 1,521 m, 240 m above the valley floor, so its position is Durbar Square. Read a point and its neighbours (a 3 by 3 spread 0.004 degrees apart) before trusting one pixel.
- **Syabrubesi and Timure have no Latin name in OpenStreetMap**, so the key places file supplies them with the replay spec's coordinates.
- **Test every raw vertex of a river against the border, not the simplified ones**: a straight river crossing Nepal simplifies to its two ends, both outside, and was dropped (caught by a test).
- **Raster tiles are opt-in now (`--raster-tiles`, needs `CARTO_API_KEY`)**, so a v4 pack has none and the current Leaflet map asks `/api/tiles` (CARTO through the Node) until 0033 replaces it. **Published as Release `cache-pack-v5`** (10.0 MB, 2026-10-18), not v4: the v4 tag already held a 2.5 MB valley pack, and `scripts/run-demo.sh` downloads `cache-pack-v4` by name. Point the demo at v5 only after 0033, because v5 has no raster tiles and the current Leaflet map needs a CARTO key without them.
- The map credit, "Boundaries are indicative" and "elevation is approximate" are in the manifest's `nepal` entry; printing them on the map is 0033.


## Weather layers regrilled on MapLibre (2026-10-18)

- **A canvas laid over a pitched MapLibre map cannot follow the terrain.** Projecting a lat/lon field onto it cell by cell with `map.project` left the cells apart in 3D (white squares with dark gaps) and floating over the mountains. A MapLibre `image` source on the Nepal box drapes on the terrain and held 60 fps; repaint the image, not the map, when the hour changes.
- **Wind particles over the map fell to about 3 fps with terrain on** (about 2,000 particles × 7 tail points re-projected every frame), so Wind was dropped: 0056 and 0057 are deleted, 0073 removes `windAt`, `speedBand` and the wind variables.
- **The valley grid (7 × 5 at 0.1°) is a small patch on the national map**; 0073 moves the Weather Grid to Nepal at 0.5° (153 points, one archive request, about 200 KB). The prototype got all 153 points from the archive in one browser `fetch` (Open-Meteo allows CORS).
- The prototype is `dashboard/prototype-weather-layers.html` on branch `prototype/weather-layers` (MapLibre 4.7.1 from unpkg, AWS Terrarium terrain); serve the folder with `python3 -m http.server` and use `?variant=A` to `D`.

## National Weather Grid (ticket 0073)

- **The grid is the points that fit inside the Nepal box**, not a cover of it: `grid_points` floors, so 26.3 to 30.5 N at 0.5° is 9 rows (last 30.3) and 80.0 to 88.3 E is 17 columns (last 88.0), 153 points. `NEPAL_BBOX` now lives in `weather_grid.py` because the Hub needs it at run time; `pack_nepal.py` imports it. `build_cache_pack.py` keeps its own valley `BBOX` for tiles, routes and the fleet.
- **Real fetch (2026-10-18):** 153 points, 72 hours, three variables, 134 KB, one request.
- **A forecast on disk with the valley grid or wind variables is refused by `_check_shape`**, so a Hub upgraded in place fetches again instead of serving a grid the dashboard cannot place.
- **Not done:** no `cache-pack-v4` carrying the national `weather_replay.json` was built or released (the full build needs Overpass and the repo is private). Until it is, a pack's weather file still has the valley grid and the dashboard layers must tolerate that.

## MapLibre shell (ticket 0033)

- **jsdom has no WebGL**, so `setup.ts` swaps `maplibre-gl` for `src/fakeMaplibre.ts` in every test; read back what the app gave the map with `sourceData(name)`, `lastMap().layerIds`, `addressesTheMapWouldFetch()` and `tapMap(lat, lon)`. A source `data` URL must be absolute (MapLibre fetches in a worker), so it is built from `window.location.origin`.
- **No text layers**: MapLibre symbol layers need a glyph server (a request to another host), so place names are `MapMarker` DOM elements chosen by zoom and view (`placeLabels.ts`).
- **A calm day opens only the Readings Panel**, so a test about another Panel calls `expandPanel("Evacuation Plan")` (`expandPanel.ts`) right after `render`.
- The Chrome extension was not connected for the build, so the owner did the by-hand checks (zoom shrink, first paint, 60 fps, real `cache-pack-v5`); all passed. Overlapping labels over the valley are still there.


## Audience Node (ticket 0069)

- **The demo Hub used to be unreachable from any other laptop**: it ran on the loopback Mesh only, and a Node has one primary interface. `NODE_ALSO_WIFI_DISCOVERY` and `NODE_ALSO_TCP_LISTEN` (both off by default) add Wi-Fi discovery and a TCP listener on all addresses beside the primary; `run-demo.sh` turns them on for the Hub only, so S0 to S3 stay loopback-only and an audience laptop never hears their readings. A Hub started with all three bound UDP 29716 and 42671 on `eth0` and listened on `0.0.0.0:<tcp port>`.
- **Docker Desktop cannot do Wi-Fi discovery**: its network is NAT behind a VM and multicast does not cross it (host networking attaches to the VM, not the Wi-Fi adapter). The image therefore defaults to `JOIN_MESH=tcp` and dials the Hub's TCP port; on Linux, `--network host -e JOIN_MESH=auto` uses discovery.
- **`scripts/join-demo.sh` died silently on a machine without `ifconfig`**: a missing command in a pipeline ends a `set -euo pipefail` script with no message (found in the Wi-Fi discovery rehearsal). Any optional lookup (`ip` on Linux, `ifconfig` on macOS) needs `|| true`.
- **Rehearsed on one machine** (WSL2 on a Windows laptop): a Hub and the script as separate processes. Over loopback and over local TCP the Node got the Hub's id from `/api/state`, signed up, was accepted with the printed `curl` line, and showed in the Hub's state. Freezing the Node with `SIGSTOP` made its age on the Hub climb past 15 s (Stale); `SIGCONT` brought it back to 2 s with no restart. A second run with the same `JOIN_DIR` kept the Node id and was already registered. Busy ports, no Hub, a Sensor instead of a Hub, an unknown town and `kill -TERM` (ports freed, Node gone) all behaved. In Wi-Fi discovery mode against a Hub not on it, the 60 s fix list printed.
- **The image was built and run on Docker Desktop (Windows, Linux engine)** against a Hub started in WSL: `docker build` took no special steps; `docker run ... host.docker.internal:8710 Dhunche` with `-e JOIN_HUB_TCP_PORT=4742` read the Hub's id, joined the Hub's Mesh over TCP, signed up, and the Hub's state showed it. After the accept, `docker pause` for 20 s took its age on the Hub to 22 s; `docker unpause` brought it back to 2 s with no restart; `docker stop` took 3 s (the script's trap handled SIGTERM; no 10 s SIGKILL) and exited 0. The WSL shell here has no Docker integration; from WSL use `docker.exe`, and start Docker Desktop with `cmd.exe /c start "" "<path>\Docker Desktop.exe"` from a script file (a worktree session refuses it as a plain command).
- **Still unproven:** Wi-Fi discovery between two real laptops (two Nodes on one host cannot share UDP 29716, and the Docker VM is on another network), `--network host` on a Linux Docker host, the firewall and Docker fixes in the list, a Windows laptop that is not the Hub's own machine, and a real Wi-Fi off and on. Never report those as passed.
- **Code-review found, and the script now handles:** a name with `.`, `(` or `/` broke the log pattern that finds the Node's id (names are limited to letters, digits, `-` and `_`; latitude and longitude must be numbers); a missing `lsof` made the port check pass silently; `grep -q` at the end of a pipe can fail the left side with SIGPIPE under `pipefail` (use `grep ... >/dev/null`); with no town argument every laptop would be called Dhunche, so the town (or a name with a position) is required.
- `scripts/check.sh`: all eight Commands pass (mypy, ruff check and format, pytest, dashboard typecheck, eslint, prettier, vitest).
- A worktree session refuses `cd x && ...`, `env VAR=... script &` and `bash script` as plain commands; write a small script under the scratchpad and run it with `bash <path> <worktree>`.
- **The pre-push check warned once on the 0069 merge to `main` ("main is getting code that fails the Commands") and the same commit passed `check.sh` three times** (before the merge, on the merged tree, and after the push). Which Command failed is unknown: the push was piped through `tail -3`, which kept only the last lines of the hook's output. Run `git push` unpiped so the hook's `check.sh` summary stays visible; the known flake is `test_reticulum_nodes.py` (see the entries above).
- `scripts/run-demo.sh` now downloads `cache-pack-v5` (Nepal vectors and elevation, no raster tiles). A laptop that already ran the demo keeps the old pack in `.demo/pack/`, and a Node never replaces a valid pack: delete `.demo/pack/` (and the Hub's saved `shelter_status.json`) once to pick up v5. Only `bash -n` was run on the script, not the download.

## Layer rail (ticket 0034)

- **Open Panels are remembered in `localStorage` (`storm-shield.open-panels`), so tests leaked state into each other** (a test that expanded Cameras left it open for the next). `setup.ts` now clears storage after every test.
- **A warning that arrives after a resident opened a third right-side Panel pushes the oldest one out** (two per side). Tests that expand Cameras must wait for the state first; `nodeUnreachableFlow.test.tsx` swaps Cameras for Alerts for that reason.
- **Defaults follow `ui.md` D-50, not the ticket's "calm: Readings and Evacuation Plan"**: calm is Readings alone; Elevated/High adds the Plan; a warning adds the Alerts too. Readings stay open (other side).
- **The Storm Signal button only hides the top-bar pill**; there is no edge-darkening layer yet. The Alerts button has no badge because nothing acknowledges warnings yet.
- Panel re-centring (`easeTo` with padding) and the rail look are tested only against the fake map; not seen in a real browser.

## Map labels do not overlap (ticket 0078)

- **Label placement is `labelPlacement.ts`, a pure function of screen points and estimated sizes** (text length x font x 0.58, not measured, so it is jsdom-testable). `NodeMap` projects with `map.project` and keeps the last placement in state, derived during render, so a label keeps its side until something sits on it. The chosen Shelter, key places and real Nodes are `must` and are never hidden; a hidden Shelter label shows on hover.
- **Not seen in a browser**: the Chrome extension was not connected, so the valley zoom on `cache-pack-v5` was not checked by eye and the width estimate is unproven. If labels still touch, raise the 0.58 factor or `GAP`. A Hub on v5 ran fine on a private port with the main checkout's venv and `PYTHONPATH=<worktree>/node/src`.

## High-warning pager and the out-of-reach Shelter (ticket 0080)

- **A pager that waits for the closest Node to go quiet never fired in the Replay**: the Syabrubesi Sensor is silent only from 08:50, one minute after the "Surge reaches Syabrubesi" phase (08:49), and a jump keeps a paused clock paused. The pager now watches each Node's own High warning within 60 km of home (S0 is High about 3 s after a Collapse jump and S1 about 12 s later).
- **Browsers play no sound until the page has been tapped once**, so `armPagerSound` makes the `AudioContext` on the first pointer or key event; before that `playPager` only logs. The tests mock the sound, so it has not been heard on real speakers or a phone.
- **A Node already High when the page first lists Nodes is the baseline, not news**: the hook keeps `null` until the first non-empty list, or "Connecting…" and the first answer would page.
- **On a Windows checkout every file has CRLF, and `layoutCss.test.ts` fails** ("no rule for .panel-column in App.css") because its regex needs `\n\n` between rules. Stripping the `\r` from `App.css` makes it pass; git stores LF, so it is a local quirk, not a repo bug. A Python script that rewrites a file in text mode also writes CRLF here; open with `newline=""` to keep the endings.
- **A Shelter with no Route is not "unreachable"**: the valley pack has no Route to the Syabrubesi gompa (the corridor rule dropped them), so the out-of-reach Shelter gets a dashed straight line from home, labelled as a direction only. Real high-ground targets are ticket 0068.

## Labels declutter, second pass (after 0078)

- **0078 was "done" but the owner's screenshot (replay, High) still showed overlapping labels**: it kept `must` labels (key places, real Nodes, the chosen Shelter) drawn even with no free side, named every town, and gave each Node label its SIMULATED and STALE tags, so the labels were very wide. Now no label is ever drawn over another (`must` is gone from `labelPlacement.ts`), only key places are named, only the plan's chosen Shelter is named (the others on hover), and a Node's map label is its name and level (tags show on hover or when selected, via `.node-label-extra`).
- Still unseen in a real browser (no Chrome extension here): the 0.58 width estimate and whether dots still crowd at Betrawati. Look at the valley zoom on the demo laptop.

## Camera Clips (ticket 0076)

- **Real run, 2026-10-18** (`scripts/make_camera_clips.py`, static ffmpeg 7.0.2 from `uv run --with imageio-ffmpeg`, WSL2): the three committed clips are 300.0 s, 6.0 MB each (17.9 MB total, budget 20), 46 to 65 s each to encode and 166 s for the run with the sources already downloaded; `--local` adds the Gyirong clip, 24.0 MB and 238 s. Sources are 7 to 73 MB each and download once into `.demo/clip-sources/`.
- **Wikimedia answers HTTP 429 to a burst** (six parallel downloads, then even a single `curl` for a few minutes). Download one file at a time; the script sleeps 3 s between sources and honours `Retry-After`. Send a `User-Agent`.
- **The sources are short, so the calm stretch is one 9 s Wallowa clip at half speed, played forward then backward, five times.** Every public-domain "calm river" clip found was 9 to 22 s, and only Wallowa was a fixed camera (Grande Ronde is raft-mounted, Klamath is whitewater, Molalla is a rock pool). A real fixed-camera calm clip of a minute or more would remove the visible repeat; look for one before the pitch.
- **No Nepal footage is public domain.** The only footage of the 26 August 2026 flood we found is CCTV from Gyirong Port on Commons, tagged `Pd-automated` with an unknown author and a news organisation's X post as its source; it is built into `.demo/clips/` only. Bondo (CC0, a real debris flow with boulders over a road) and the NPS Bright Angel videos (public domain, 2026) cover "extreme" in the committed set. Not used: usgs.gov (HTTP 403 to a scripted request, so Verde-Tangle and Kennebec were never fetched), Oak Creek (CC BY 2.0, usable but not needed), Parapara and other CC BY-SA files (share-alike would bind the joined clip). **Riera de Cabrils was built in, then dropped after the code-review:** its Commons page says `PD-self` in the permission field and `cc-by-sa-4.0` in the licence header; the API's short licence name alone said "Public domain". Read a file's wikitext (`index.php?title=File:...&action=raw`), not only the API's licence name, before committing footage; the four files kept have `PD-USGov-BLM` / `PD-USGov-NPS` plus Flickr's CC BY, or CC0, and their credit lines say so.
- **ffmpeg `xfade` needs one timebase on both inputs**, and a `concat` after `reverse` leaves 1/1000000 on its output: `fps=24` on every input of the join fixes it. Reversing five long clips inside one graph also holds them all in memory, so each piece is rendered once to a near-lossless intermediate and the join only cross-fades.
- **The licence check first accepted `CC BY-NC` and `CC BY-SA`** because it used `startswith("CC BY")`; a test that tried them caught it. The pattern is now exact (`Public domain`, `CC0`, `CC BY n.n`).
- **mypy strict follows `scripts/` imports from the Node's tests**, so a script a test imports must be fully typed; `imageio_ffmpeg` is in the mypy `ignore_missing_imports` override because it is only installed by `--with`.
- The webm sources log "File ended prematurely" while being trimmed; the clips decode and play to 300.0 s, so it is only a truncated final packet.
- **Not proven:** playback in Safari and iOS Safari (the clips are H.264 Main, yuv420p, `+faststart`, no audio, which is what they accept, but no Apple device was used) and in a browser at all; the Hub does not read `CAMERA_CLIPS_DIR` until 0075.

## Readings Panel ladder (ticket 0070)

- **The state has no flag for the breadboard Pi**, so `readingsLadder` pins the first real (non-simulated) Node with no River km that is not the Hub. A real Audience Node with no River km would be pinned by mistake; add a flag to the reading if that happens.
- **A fleet marker's popover sits inside the marker element**, so its clicks bubble to the marker's own listener; `MapMarker` ignores clicks inside `[data-marker-ignore]`.
- `test_reticulum_nodes.py` errored at setup in a full run because Nodes left by an earlier `check.sh` run of mine still held 8103/4312; they were mine (start time matched the run), killed, and the file passed alone.
- Not seen in a browser: the ladder layout, the wave marker and the popover position are tested against the fake map only.

## Phone layout (ticket 0036)

- **The phone layout is `useIsPhone()` (under 900 px, `useViewport.ts`); jsdom has no `matchMedia`**, so `setup.ts` installs `fakeViewport.ts` (desktop by default) and a test calls `setViewport(390)`. Tablets (under 1200 px) keep the desktop Panels with one open per side.
- **The map stays mounted under the other tabs**: a Plan/Readings/Alerts pane covers it (`.phone-pane`), because remounting MapLibre on every tab change would reload it.
- **Manual check done (2026-10-18):** the owner used a phone over Tailscale against `scripts/run-demo.sh` on `main`; all four tabs worked. The wrapped status strip took over 30% of the screen, so it is one sideways-scrolling line now. Tailscale was stopped on the laptop at first (`tailscale status` says so), and a leftover pack server on 8900 blocked `run-demo.sh` until it was stopped. **Still open:** the bottom sheet is a card, not a draggable peek; the Hub and Node buttons have no phone entry; a home pick has no on-screen cancel on the phone.

## 3D terrain (ticket 0067)

- **MapLibre 4.7.1 has no tint-by-height layer** (`color-relief` is 5.x), so the height bands are a custom protocol that repaints the pack's Terrarium tile; `hillshade` alone only shades slopes. The fake map records `terrain`, `pitch` and `flights`; `addressesTheMapWouldFetch` strips a custom protocol's prefix so the "own Node only" test still sees the real address.
- The owner tried the switch and terrain on the demo laptop (2026-10-18) and they work; fps and p95 frame time were not recorded, and no second laptop was tried.

## Sending email from Claude Code (ticket 0074)

- **The team address is `stormshieldteam.uf@gmail.com`**, for outreach (the Nepal camera message) and sign-ups. Its password and two-step code are never committed or pasted into chat; share them through a password manager.
- **The Gmail connector belongs to a Claude account, not to the repo**, so it is linked once per person. To send as the team address from your own laptop: `/mcp`, choose "claude.ai Gmail", Disconnect if another account is linked, connect again, pick the team account on Google's screen and tick the send permission. Without the send permission a send fails with "Insufficient scope". Then ask the agent to send; the From line of a test to yourself shows which account it used.
- **One sender is enough for a one-off message.** Only the laptop that has it linked needs to send; the demo itself never sends email.
- **A send goes out at once under that address.** Show the text and recipients first, and use a "[Rehearsal copy]" subject when the real recipients are not known yet.
- **Check vitest's exit code and its "Errors" line, not only the test counts**: a click handler that throws in jsdom (`AudioContext is not defined`, hit by another file's click once `main` brought new tests) shows as "Uncaught Exception" and "Errors 2 errors" while every test still passes, and `scripts/check.sh` fails the run. `armPagerSound` now warns instead of throwing when the browser has no Web Audio.


## Temperature, cloud cover and rain on the terrain (ticket 0055)

- **The weather picture is a MapLibre `image` source made from a canvas data address**, rows spaced in Mercator so places stay where the data puts them. jsdom has no canvas, so `setup.ts` mocks `weatherImageUrl` with a pixel checksum; tests tell pictures apart by that address, and `paintWeatherField` is tested on its raw pixels.
- **`theme.test.ts` bans `rgb(`/`rgba(`/hex anywhere outside `theme.css`, comments included.** The ramps are data, so the legend gradient is built as `color(srgb …)`.
- **Not done:** the 60 fps check in 2D and 3D with each layer on, on the laptop and a phone (no browser here). The picture is repainted on every Event-clock change, about once a second, 320 x 180 `valueAt` calls plus a PNG encode on the main thread; if panning stutters on a phone, lower `FIELD_WIDTH`/`FIELD_HEIGHT`.

## Wave front and river flow (ticket 0065)

- **The comet is two GeoJSON sources updated from `requestAnimationFrame` (`WaveFrontLayer`), not React state**, gliding between the 1 Hz clock answers by the clock's rate (capped at 2.5 s). Node flashes and town stamps use the raw 1 Hz clock, so at ×30 the comet can reach a town up to a second of real time before its label lights.
- **An effect that needs a layer added by another effect must be called after it in the same component**: child effects run before the parent's, so a `WaveLayers` child looked for the `river-flow` layer before `addNepalBasemap` had added it and never retried. `useRiverFlow` is a hook called below the basemap effect in `NodeMap`. `react-hooks/set-state-in-effect` rejects the "set a ready flag" alternative.
- **The raw-colour test rejects the text `rgba(`**, even in a transparent gradient stop; build it as the expression `["rgba", r, g, b, 0]` from the theme colour.
- **Frame rate checked in Chrome (2026-10-18)**: 60 fps (p95 17.6 ms, worst 19.3 ms) with the comet and the dashes at the national view, with the dashes off, and in the 3D valley. A Hub on a private port with the page's `fetch` patched to add a Surge at River km -12.2 and a playing ×30 clock (with 0 to 250 ms of poll jitter) was enough to drive it.
- **The first comet rubber-banded** (the owner saw it jump forward and snap back): every state poll hands `WaveFrontLayer` a new `warnings` array, which restarted the glide from the last clock answer, up to a second (30 event seconds, 1 to 2 km) old. The glide now reads the clock and the warnings through refs, never restarts, never steps back for an answer under 5 s behind, and redraws every 50 ms (redrawing the sources costs more than a frame). After the fix 0 of 350 draws went back in time and the head stepped back at most 22 m.
- Known edges left: the trail starts at the earliest origin over all warnings, so with two Surges it can start behind the head's own; with reduced motion the front is a comet that steps once per clock answer, not a separate static marker.

## Readings card motion (ticket 0037)

- **Arrows come from `readingTrends.ts`, which keeps a sample only when a value changes** and compares the newest with the last sample from 30 s ago. It takes the time of the Node's last answer (`lastAnswer.at`) instead of reading a clock, so it can derive state during render (ESLint `set-state-in-effect` rejects the effect version). The thresholds (2 cm, 0.5 mm/h, 0.5 hPa, 1 %) are guesses above the fixtures' jitter.
- **A flash is a remount**: `ReadingSlot` bumps a key when its value changes, so the CSS animation restarts. Reduced motion is checked in the components (`usePrefersReducedMotion`, test switch `setReducedMotion`) and in a media query.
- **Not done / not seen in a browser:** Stale dims by opacity only (desaturating needs `filter`, outside the transform/opacity rule); the chip fades in without fading the old one out; every card fades in on mount, not only new Nodes; the row slots have no fixed width of their own (the three grid columns do).

## Flood alert email (ticket 0081)

- **The Hub's email is separate from the Gmail connector in Claude Code.** The Hub sends over SMTP (`smtp.gmail.com:465`) with `ALERT_EMAIL_FROM`, `ALERT_EMAIL_APP_PASSWORD` and `ALERT_EMAIL_TO` from `.env` (all three, or nothing is sent). `scripts/run-demo.sh` loads `.env`, so a start from the demo script picks them up; a Node started any other way must export them.
- **Create the app password once, on the team account:** turn on 2-step verification, then Google Account, Security, App passwords, make one called "Storm Shield Hub", and paste the 16 characters into `.env` (spaces are fine to drop). The normal password is rejected for SMTP. The password never goes in chat, a ticket or the repo.
- **A send needs internet.** The first Community Warning (08:37 Surge) comes before the 09:20 internet cue, so it normally goes out; a failure is logged as `could not email the flood alert for <node>: <error type>` and nothing else changes. The log never carries the SMTP server's reply text, because it can echo the login.
- **Proven on 2026-10-18:** a demo run from `scripts/run-demo.sh` on the owner's laptop emailed "ALERT OF FLOOD INCOMING!" to the team when the Replay was started (a real Gmail send over port 465 with the team account's app password). The tests still replace `smtplib.SMTP_SSL`.
- **`.env` is sourced by bash, so a value with spaces must be quoted.** Google shows an app password as `abcd efgh ijkl mnop`; pasted unquoted, `run-demo.sh` stopped with `<word>: command not found` and that error printed the first word of the password into the log. Drop the spaces or quote the value, and revoke the password if its first group reached a log you share.

## Hub replay camera (ticket 0038)

- **jsdom cannot play a `<video>`**: `play`, `pause` and `currentTime` do nothing (and log "not implemented"). `fakeMedia.ts`, installed in `setup.ts`, gives every video a readable clock and paused flag; the sync tests read `currentTime` and `paused` back.
- **The tile text `NPT` now appears twice** (header and `CAMERA · REPLAY 09:18 NPT`), so tests that waited for the header with `/NPT/` failed on "multiple elements". Use `/NPT · REPLAY/` for the header. A `<video>` has no `img` role: find it by its label.
- **The clip is positioned from the clock the dashboard polls once a second**, so between polls the browser's own playback (1x, which is the Event clock at ×30) carries it; it is moved only when it drifts 1.5 s or the clock jumps or resets. An autoplay refusal is only logged (`console.warn`); the `TAP TO PLAY` fallback is 0077.
- **`state: "live"` on a replay tile means "working"**, not a live feed; `kind` says live or replay (0075 keeps that split). The rail counts working tiles while the Event clock is playing, so it reads 0 before Start and while paused.
- **Not seen in a real browser**: playback, seeking by range request on Safari/iOS, and frame rate with the 3D map open (0077's hand check). Backend range requests are tested with a tiny fake file only.
- **A scripted splice of `App.css` duplicated 1,300 lines** because the end marker (`.flood-risk-chip,\n.connection-badge`) also occurs near the top of the file, and `check.sh` stayed green. Code-review caught it. After editing a stylesheet by script, run `git diff --stat` and look at the deleted/added counts.

## Live forecast in the layers (ticket 0059)

- **"Replay running" is `useEventClock().clock !== null`**: Reset leaves the clock paused at 08:30, so the layers keep the recorded weather until the Hub stops the clock. With no clock they read `/api/weather/forecast`; the weather fetch waits for the first `/api/replay` answer (`heard`) so it does not ask for the wrong file first.
- **The forecast tag compares exact age, not floored hours**: OFFLINE starts just after 3 h. The slider is now + 0 to 168 h (the Hub fetches 7 days); `now` ticks once a minute, so the picture repaints once a minute with no Replay.
- Not seen in a browser; tested against the fake map only.

## Peer Mesh in Docker grilling (2026-10-18)

- **A TCP Node that dials only the Hub loses every other Node when the Hub stops.** Three Nodes in `tcp` mode on one laptop: with B and C listing only A (the Hub), B never heard C at all; with every Node listing every other, B and C kept hearing each other 30 s after A stopped. Transport is off, so nobody relays; `docs/specs/peer-mesh-in-docker.md` makes the full mesh the default.
- **A Docker published port passed firewalld with no rule**: a container on `-p 4299:8000` on an Arch laptop (firewalld on, `wlan0` in `public`) answered a phone on the same Wi-Fi. Docker adds its own forwarding rules. Laptop to laptop on the Pi's hotspot is still unproven.
- **Reticulum 1.5.7 adds an interface at run time only through the private `Reticulum._synthesize_interface`**; prove it before relying on it.

## Camera list (ticket 0075)

- **The live-source half of the ticket was dropped in grilling**: 0074 found no qualifying feed and 0038 had deleted the FL511 fetcher, so a live path would have been untested speculation. `kind` stays `replay`; a live source gets its own ticket when a feed qualifies.
- **`cameras.json` has four cameras sharing the committed clips** (`hub-betrawati` and `s3-trishuli` use clip 1). An entry with no clip, an unknown clip key or a missing file warns at startup and shows `unavailable`; a malformed entry or a repeated id is skipped; a file that is unreadable or not a list leaves the Hub with no cameras (code-review found that `null` or `5` crashed startup). Tests swap the list with `monkeypatch.setattr("storm_shield.cameras.CAMERAS_FILE", path)`.
- Tests that expected exactly one tile now pick a tile by id (`_tile(client, id)`). The dashboard still renders whatever tiles come back; the per-site timing shift is 0077.
- `dashboard: vitest` failed once in a full `check.sh` run and passed in three reruns with no change near it; rerun before chasing it.


## Warning Takeover and Join card (ticket 0039)

- **Case-only file names collided again**: `joinCard.ts` beside `JoinCard.tsx` made tsc fail ("differs only in casing") on macOS. The logic files are `joinHotspot.ts` and `acknowledgedWarnings.ts`.
- **The Join card needs the hotspot name and password, which are secrets**, so `GET /api/join` (HOTSPOT_SSID, HOTSPOT_PASSWORD, optional HOTSPOT_DASHBOARD_URL, default `http://10.88.0.1:<port>`) answers only requests from loopback (403 otherwise, 404 with no SSID). The projected Hub is localhost, so the card shows its codes there; a Node that sets nothing shows a one-line reason instead.
- **A takeover duplicates the Alerts Panel text on purpose**, so older tests that did `getByText(headline)` had to scope to the Alerts region. A new flow test that reads a warning should `within(...)` the dialog or the Panel.
- **The chime module remembers a tap for the whole test file** (`chime.ts` flag): put the "silent before a tap" test before any that fires `pointerDown`.
- Seen only in jsdom: the 880 px card, 64 px button, dimming and slow pulse are CSS and were not looked at in a browser; the phone scan of the two codes was not done.
- **Rehearsed in Chrome by the owner (2026-10-18)** on a lone Hub (port 8651, fake `HOTSPOT_SSID`): the takeover, acknowledgement, banner, reload and phone layout all worked, and the Join card showed both codes. A Hub alone is enough, since Official Alerts come from the Replay timeline; jump to "Authorities learn of the flood" in the Hub Panel's Replay tab. The Wi-Fi code for a network that does not exist makes a phone say "unable to join", which proves the phone read it as a Wi-Fi code and no more; a real join needs the Pi hotspot, still unproven.
- **Open the rehearsal at `http://localhost:<port>`, not the Tailscale address**: `/api/join` and the Hub button both need loopback. A Hub started without `CACHE_PACK_URL` has no pack and the map is blank; serve `.demo/pack/cache-pack.zip` with `python3 -m http.server --directory <dir>` and export `CACHE_PACK_URL` (the pack unpacks within seconds).
- A loopback group's slot can already be taken by a teammate's Node (4320 held a Node from another session): check `lsof -nP -iTCP -sTCP:LISTEN` and move to a free `NODE_LOOPBACK_SLOT` with a matching `NODE_LOOPBACK_FIRST_SLOT`; the failure is exit 255 with an empty log unless the Node's output is captured.
