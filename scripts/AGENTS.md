# Lessons: Data builds

Area gotchas that are still true. Claude Code loads this file (through `CLAUDE.md`) only once a session reads a file in this folder; other agents read the nearest `AGENTS.md`. Add a line when something here breaks, surprises you or takes more than one try; delete a line once your change makes it untrue. Repo-wide lessons: `docs/agents/lessons.md`.

- **External sources are flaky; retry, don't conclude.** FEMA and Overpass reset or answer 502 at random; Overpass and Wikimedia need a `User-Agent`; Wikimedia answers 429 to bursts.
- **CARTO without a key returns HTTP 200 with an "API KEY REQUIRED" PNG** (about 2.5 KB). Check tile sizes, not status codes.
- **Open-Meteo answers with its own grid coordinates** and returns a dict for one point, a list for several.
- **`pack_nepal.elevation_at` decodes a whole tile per call**; cache `_decode_rgb` for any scan.
- **Before committing footage, read the file's wikitext licence**, not only the API's short name. CC BY-SA and NC are out.
- **Walking time is straight line x 1.4 at 4 km/h, rounded up, in two places** (`pack_high_ground.py`, `evacuationPlan.ts`); change both.
- **Every httpx builder fetches through `http_retry.get_with_retries`.** It prints only the error type and status, never `str(error)`: an httpx message holds the URL, which can carry a key.
