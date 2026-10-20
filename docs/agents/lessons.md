# Lessons: gotchas that are still true

Loaded into every agent session, so it stays short. Read the section for the area you touch before building. Add a line when something breaks, surprises you or takes more than one try; delete a line once your change makes it untrue. The full hackathon log, with the story behind each line, is `docs/agents/lessons-archive.md` (search it, don't load it).

## Working in the repo

- **One `pytest` at a time, and no stray Nodes.** A Node left running (yours, another worktree's, a demo) holds test ports and serves old code. `scripts/stop-nodes.sh` clears them, but check `ss -ltnp` first: it would kill a teammate's or your other session's Node. On Windows it cannot find them; use `Get-NetTCPConnection` and `Stop-Process`.
- **Rerun before chasing a flake.** Known ones: `evacuationFlow.test.tsx` and other dashboard flow tests in full parallel `vitest` runs (`--maxWorkers=2` helps); the `mesh_integration` Reticulum tests when ports are busy. A second failure is real.
- **Check exit codes, never pipe through `tail`.** `check.sh | tail` hid a failing pytest and the push went through; vitest can pass every test and still exit 1 with "Errors" from an uncaught exception.
- **A baseline "without my change" is the parent of your merge**, not a commit that already holds it.
- **Two branches green alone can clash once merged** (0060 and 0012 did). Rerun the Commands after every merge of `main`.
- **Worktree sessions refuse compound shell commands** (`cd x && ...`, `env VAR=... cmd &`, heredocs mixed with `cd`). Run plain commands, or write a script to the scratchpad and run that.
- **`pkill -f <pattern>` inside a compound command can kill its own shell**, and over SSH the remote shell; use `pkill -f "[s]torm-shield-node"`.
- **Don't name two files apart only by case** (`joinCard.ts` and `JoinCard.tsx`): they collide on macOS.
- **After editing a file by script, read `git diff --stat`**: a splice of `App.css` once duplicated 1,300 lines and every check stayed green.
- **Windows checkouts have CRLF**: `layoutCss.test.ts` fails on them, and Python text-mode writes add CRLF (open with `newline=""`). Identity-file tests assert mode 600, which Windows cannot report; those two failing alone is expected there.
- **The secret scan matches `sk-` plus 20 characters** not inside a word. Rename what trips it; never `--no-verify`.
- **No `uv`:** another checkout's `node/.venv` works with `PYTHONPATH=src` (`check.sh` does it). **No `pnpm`:** `npx --yes pnpm@10`. Vitest needs Node 22 (its jsdom worker dies on 20). On Windows install `uv` from PowerShell; plain `venv` on Python 3.14 fails on `cryptography`.
- **Run `mypy src tests` from `node/`**, or it stops on a duplicate `__main__`. mypy strict follows `scripts/` imports from the tests, so a script a test imports must be fully typed.
- **Don't run `ruff format` on `scripts/*.py`**: they are not formatted by it. Write new lines at 100 columns by hand.
- **Don't edit `node/uv.lock` by hand.**
- **Prettier reformats new test files**: `pnpm format` before `pnpm lint`.

## Node service and the Mesh

- **Tests start Nodes with `MeshedNodes`** (in-memory Mesh). Each test Node gets its own folders under `tmp_path`; a new setting that touches disk belongs in `MeshedNodes._settings`. A Node hears only what is published after it joins. `advance(seconds)` moves the injected clock, not a loop's real sleep; in a Replay it moves the Event clock 30 times as far.
- **Strict counting:** no registry heard means nobody counts toward Flood Risk. `MeshedNodes.register(*names)` after the last `start(...)`; with a running `start_hub()` register through `/api/registry/signup` and `/accept` instead.
- **A Hub entered with its lifespan would call real services** (Open-Meteo): inject an offline `weather_source` as `MeshedNodes.start_hub` does.
- **Background loops only run under `with TestClient(app)`**; a bare `TestClient(app)` never starts them. A Node shows Mesh-only until its first connectivity probe answers.
- **Adding a field to a reading or a `/api/state` Node entry breaks two exact-field tests** (`test_community_reading.py`, `test_state_snapshot.py`).
- **Surges are judged on the sender's timestamps**, and `surged` is "surging now", not latched (it clears about 60 s after the jump). A Surge is 300 cm or more within 60 s.
- **One signed Reticulum packet is 464 bytes**, which caps a registry (4 to 8 Nodes) and an Official Alert's headline.
- **Shelter status and the registry are trusted only from `HUB_IDENTITY`**; a blank or wrong id drops them silently. When a Node shows nothing open, or a Sensor ignores the Replay, check `HUB_IDENTITY` first (printed as `Node <id> (...) is up as hub`; it changes if `NODE_DATA_DIR` is wiped).
- **A Node logs "is up" before it binds HTTP**, so that line does not prove it is serving.
- **Loopback groups:** a Node dials every slot from `NODE_LOOPBACK_FIRST_SLOT` to its own. A group not starting at 0 must set it, or it joins every Node below. A taken slot fails with exit 255 and an empty log.
- **`CACHE_PACK_URL`, `CACHE_PACK_DIR`, `CARTO_API_KEY` and the alert email settings are read unprefixed and only from the environment** (`Settings` has no `env_file`); `run-live.sh` and `run-demo.sh` load `.env`, anything else must export it. `.env` is sourced by bash: quote values with spaces.
- **A Node never re-downloads a valid Cache Pack**: delete `CACHE_PACK_DIR` (and the Hub's `shelter_status.json`) to change packs.
- **Never log `httpx` errors whole**: their message holds the URL, and the URL can hold a key. `create_app` keeps the `httpx` logger at WARNING for the same reason.
- **`RNS.Identity.from_file` returns `None` on a damaged file** and `to_file` writes 644; `load_or_create_identity` handles both.
- **Mesh decode and delivery go through `mesh.decode_message` and `deliver_to_listeners`** for both Meshes; add rules there.

## Dashboard

- **jsdom has no WebGL, canvas, Web Audio, `matchMedia` or `<video>` playback.** `setup.ts` swaps in `fakeMaplibre.ts`, `fakeViewport.ts`, `fakeMedia.ts` and a mocked `weatherImageUrl`; read back what the app gave the map with `sourceData`, `lastMap().layerIds`, `tapMap`.
- **Fake timers must use `shouldAdvanceTime: true`**, or every `findBy*` hangs into a 5 s timeout. To prove "updates without waiting for the poll", look inside the poll interval with `advanceTimersByTimeAsync(STATE_POLL_MS / 10)`; a `findBy*` passes even when the code is broken.
- **Map assertions wait with `waitFor`.** Check a new test by breaking the code it covers.
- **`localStorage` is cleared after every test** (open Panels are remembered there). A calm day opens only the Readings Panel: call `expandPanel(...)` first.
- **Build test state with `fakeNodeState()` / `fakeNodeSnapshot()`**; a `fetch` stub without `/api/state` stays on "Connecting…". GeoJSON fixtures need `type: "FeatureCollection"`.
- **`theme.test.ts` bans raw colours outside `theme.css`** (even in comments and as `rgba(`) and any `font-family` that is not a theme variable. A new colour is a role in `theme.css` first.
- **ESLint `react-hooks/set-state-in-effect`** rejects setting state at the top of an effect; derive it during render instead.
- **An effect that needs a MapLibre layer from another effect must run after it in the same component** (child effects run first).
- **MapLibre data URLs must be absolute and `{z}/{x}/{y}` must stay literal**: `new URL(...)` percent-encodes the braces and the map silently loses its terrain.
- **No MapLibre text layers** (they need a glyph server); labels are DOM markers placed by `labelPlacement.ts`.
- **Browsers play no sound until the first tap**; sound code must warn, never throw, without Web Audio.
- **`findLast` is not in the TypeScript lib target**: use `.filter(...).at(-1)`.
- **Icons are `lucide-react`, pinned exact.** Fonts are bundled `@fontsource` files; the page makes no request to another host.

## Data builds (scripts/)

- **External sources are flaky; retry, don't conclude.** FEMA and Overpass reset or answer 502 at random; Overpass and Wikimedia need a `User-Agent`; Wikimedia answers 429 to bursts.
- **CARTO without a key returns HTTP 200 with an "API KEY REQUIRED" PNG** (about 2.5 KB). Check tile sizes, not status codes.
- **Open-Meteo answers with its own grid coordinates** and returns a dict for one point, a list for several.
- **`pack_nepal.elevation_at` decodes a whole tile per call**; cache `_decode_rgb` for any scan.
- **Before committing footage, read the file's wikitext licence**, not only the API's short name. CC BY-SA and NC are out.
- **Walking time is straight line x 1.4 at 4 km/h, rounded up, in two places** (`pack_high_ground.py`, `evacuationPlan.ts`); change both.

## Pi and networking

- **On the Pi always `uv sync --group pi`** (or `pi/install.sh`); a plain sync removes `lgpio` and the Node dies on a sysfs fallback. `lgpio` needs `liblgpio-dev`.
- **firewalld blocks AutoInterface** (UDP 29716 and 42671); Docker blocks NetworkManager sharing; WSL2 and Docker Desktop never pass multicast discovery, so use TCP (`JOIN_MESH=tcp`). A Hub needs `NODE_ALSO_TCP_LISTEN=1` to be dialled.
- **"Connection refused" with a working ping** means a machine answered that has no listener, often your own (NetworkManager gives `10.42.0.1` to every shared link).
- **A TCP Node that dials only the Hub loses every other Node when the Hub stops**: list every peer.
- **Give every Node its own `NODE_LATITUDE`/`NODE_LONGITUDE`**, and wait a few seconds before restarting a killed Node.
- **Rehearsing without devices:** Hub on slot 0 and Sensors on later slots with `NODE_MESH_INTERFACE=loopback`, their own ports and data dirs; serve a pack with `python3 -m http.server`; "no internet" is stopping that server. Open `http://localhost:<port>` for Hub-only pages (`/api/join` needs loopback). This proves the software path only; say so.
