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

## Reviews

- 0007 code-review: a retry loop that catches only some exceptions can die silently and leave a Node with no pack; background loops catch `Exception` and log it with `logger.exception`.

## Flood Risk (ticket 0006)

- **`pnpm test` fails to start on Node 20.20**: vitest's jsdom worker dies loading `undici@8` (`Cannot read properties of undefined (reading 'bind')`). It passes on Node 22: `npx -y node@22 node_modules/vitest/vitest.mjs run` from `dashboard/`.
- **The Scenario cannot reach "Low from rain" alone**: its rain step also lifts water to 35 cm, which is Elevated. `MeshedNodes.hear_from(sender, water_cm=..., soil_pct=...)` publishes one hand-made reading over the in-memory Mesh to test such rules; `MeshedNodes.advance(seconds)` moves every Node's clock.
- In `MeshedNodes`, a Node only hears peers that publish after it joins. Post `/api/scenario/reset` on each Node first when a test counts Nodes.
