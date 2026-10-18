# 0075: Camera list where each camera is live or a clip

**What to build:** The Hub keeps one list of cameras. Each camera is at a Node site, and each has a live source, a recorded clip, or both. While the Hub is Online it uses the live source if it answers; otherwise, and always when there is no live source, it serves the camera's clip. The cameras API says which of the two a tile is, so the dashboard never presents a clip as live.

**Blocked by:** 0038, 0074

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** refloow-0

**Spec:** `docs/specs/flash-flood-replay.md` ("Cameras")

- [ ] One file lists the cameras: id, label, Node site and position, an optional live source (what 0074 decided) and an optional clip name. A camera with neither is invalid and the Hub refuses to start naming it
- [ ] The live path is the existing fetch-once-and-share one (at most one request per camera per minute, only while Online, one failed camera leaves the rest working); a live source that stops answering falls back to the camera's clip, and goes back to live when it answers again
- [ ] `GET /api/cameras` gives each camera `kind` (`live` or `replay`), its Node site, and for a clip its credit line and `flood_onset_s` from the clip manifest (0076); the existing `live` / `offline` / `unavailable` state stays, and a Mesh-only Node still reports every camera `offline`
- [ ] The Hub serves a clip from `GET /api/cameras/{id}/clip` with HTTP range requests, so a phone can start and seek; the clip comes from a gitignored folder on the demo laptop if present, otherwise from the committed fallback
- [ ] A Sensor Node answers 404 for a clip, so a Viewer connected to a Sensor sees Unavailable, not a broken player
- [ ] A camera whose clip file is missing is `unavailable`, never `offline`
- [ ] No camera address, key or token is committed; a live source that needs a key reads it from `.env` and the key goes in `.env.example` (AGENTS.md "Secrets")
- [ ] pytest: a live camera that answers, one that fails and falls back to its clip, one with only a clip, one with a missing clip, a Mesh-only Node, a range request, a Sensor's 404, and an invalid list
- [ ] `docs/specs/online-status-and-cameras.md` and `docs/specs/wire-formats.md` show the new fields
- [ ] All **Commands** pass

**Notes:** the FL511 code is removed by 0038; this ticket generalises the one Hub clip to a list. The story beat stays: at the internet cue every tile goes Offline.
