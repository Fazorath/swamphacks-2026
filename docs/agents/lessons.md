# Lessons: what we tried, what broke

A running log for agents and humans starting a new ticket. Read it before you build; add to it when something surprises you (newest at the bottom of each section). Facts only: what happened, what worked, what is still open.

## Environment

- **`uv` and `pnpm` may not be installed** on the machine an agent runs on. If `uv` is missing, another checkout's `node/.venv` works: run `PYTHONPATH=src node/.venv/bin/pytest` from the worktree's `node/` (the venv's editable install points at that other checkout, so `PYTHONPATH=src` is what makes it test *your* code). Say so in the report; don't claim a Command passed that you could not run. If `pnpm` is missing but Node is there, `npx --yes pnpm@10 <command>` works (lockfile v9); run it from `dashboard/`. All dashboard Commands passed on `main` after 0007 this way (typecheck, lint, 9 Vitest tests).
- **Worktree sessions refuse compound shell commands** (`cd x && VAR=y python ...`, `$(...)` feeding a command name, pipelines with computed operands). Run plain, separate commands, or write a small script under `$CLAUDE_JOB_DIR/tmp` and run it.
- **Don't edit `node/uv.lock` by hand unless `uv` is missing.** For 0007 it was edited by hand to move `httpx` from the dev group to runtime dependencies; run `uv lock` once on a machine with `uv` and commit any difference.
- A branch named after its ticket (`NNNN-<slug>`) may already exist from the claim commit. A worktree starts on `worktree-<name>`; push it with `git push origin HEAD:NNNN-<slug>` rather than renaming.

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

## Reviews

- 0007 code-review: a retry loop that catches only some exceptions can die silently and leave a Node with no pack; background loops catch `Exception` and log it with `logger.exception`.

## Flood Risk (ticket 0006)

- **`pnpm test` fails to start on Node 20.20**: vitest's jsdom worker dies loading `undici@8` (`Cannot read properties of undefined (reading 'bind')`). It passes on Node 22: `npx -y node@22 node_modules/vitest/vitest.mjs run` from `dashboard/`.
- **The Scenario cannot reach "Low from rain" alone**: its rain step also lifts water to 35 cm, which is Elevated. `MeshedNodes.hear_from(sender, water_cm=..., soil_pct=...)` publishes one hand-made reading over the in-memory Mesh to test such rules; `MeshedNodes.advance(seconds)` moves every Node's clock.
- In `MeshedNodes`, a Node only hears peers that publish after it joins. Post `/api/scenario/reset` on each Node first when a test counts Nodes.
