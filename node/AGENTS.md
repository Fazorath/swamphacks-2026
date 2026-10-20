# Lessons: Node service and the Mesh

Area gotchas that are still true. Claude Code loads this file (through `CLAUDE.md`) only once a session reads a file in this folder; other agents read the nearest `AGENTS.md`. Add a line when something here breaks, surprises you or takes more than one try; delete a line once your change makes it untrue. Repo-wide lessons: `docs/agents/lessons.md`.

- **Tests start Nodes with `MeshedNodes`** (in-memory Mesh). Each test Node gets its own folders under `tmp_path`; a new setting that touches disk belongs in `MeshedNodes._settings`. A Node hears only what is published after it joins. `advance(seconds)` moves the injected clock, not a loop's real sleep; in a Replay it moves the Event clock 30 times as far.
- **Strict counting:** no registry heard means nobody counts toward Flood Risk. `MeshedNodes.register(*names)` after the last `start(...)`; with a running `start_hub()` register through `/api/registry/signup` and `/accept` instead.
- **A Hub entered with its lifespan would call real services** (Open-Meteo): inject an offline `weather_source` as `MeshedNodes.start_hub` does.
- **Background loops only run under `with TestClient(app)`**; a bare `TestClient(app)` never starts them. A Node shows Mesh-only until its first connectivity probe answers.
- **Adding a field to a reading or a `/api/state` Node entry breaks two exact-field tests** (`test_community_reading.py`, `test_state_snapshot.py`). A reading's values are Measurements (`m`, `[kind, value, unit]`); build a hand-fed one with `MeshedNodes.hear_from(..., leaving_out=..., also=[Measurement(...)])`.
- **Each mesh message kind has its own `v`** (`reading` is 2, the rest 1); `decode_message` reads it from the class, so a version bump is a one-line change on that class.
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

Networking and Pi lessons (firewalls, TCP peers, `uv sync --group pi`) are in `pi/AGENTS.md`.
