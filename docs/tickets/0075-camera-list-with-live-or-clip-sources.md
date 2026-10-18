# 0075: Camera list where each camera is live or a clip

**What to build:** The Hub keeps one list of cameras instead of the single hard-coded `hub-betrawati`. Each camera is at a Node site and plays one Camera Clip. The live-source path (fetch-once-and-share, fallback to the clip) is **deferred**: 0074 found no qualifying live feed, 0038 deleted the FL511 fetcher, and building it now would be speculative code. Decided in grilling on 2026-10-18.

**Blocked by:** 0038, 0074 (both done)

**Status:** done

**Owner:** Amit Athi Kesavan

**Assignee:** refloow-0

**Spec:** `docs/specs/flash-flood-replay.md` ("Cameras")

- [x] `node/src/storm_shield/cameras.json` lists four cameras: `hub-betrawati` (Betrawati, clip 1), `s2-syabrubesi` (clip 2, the extreme case), `s1-timure` (clip 3) and `s3-trishuli` (clip 1). Each has `id`, `label`, `site` (Node name), `lat`, `lon` and `clip`. Clips may be shared; the footage is illustrative
- [x] A camera whose entry has no clip, names a clip key the manifest lacks, or whose mp4 or poster is missing logs a warning naming the camera at startup, and shows `unavailable`, never `offline`; a malformed entry (missing field) is logged and skipped; the Hub still starts and the other cameras keep working (decided 2026-10-18, over refusing to start)
- [x] `GET /api/cameras` gives each tile `site`, `lat` and `lon` beside the existing fields; `kind` stays `replay`; a Mesh-only Node still reports every camera `offline`
- [x] `GET /api/cameras/{id}/clip` and `/poster` work for every camera (range requests already done in 0038); a Sensor Node answers 404
- [x] pytest: four cameras listed with their sites, a camera with no clip or an unknown clip key (warning logged, tile `unavailable`, Hub starts), a missing clip file, a Mesh-only Node, a range request on a second camera, a Sensor's 404
- [x] `docs/specs/online-status-and-cameras.md` points at, and the "The camera list" bullet of the spec's "Cameras" section shows, the new fields and the deferred live path; 0077's "live tile" wording is marked deferred (`wire-formats.md` covers Mesh messages only, so it has no camera section)
- [x] All **Commands** pass

**Notes:** 0038 already built range requests, the poster, the Sensor 404 and the offline/unavailable states; this ticket generalises the one Hub clip to a list. A live source gets its own ticket when one qualifies. The story beat stays: at the internet cue every tile goes Offline.
