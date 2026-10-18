# 0076: Five-minute demo camera clips, with real flood footage

**What to build:** A script that builds five-minute camera clips for the demo from short source clips, and a manifest that credits every source. The clips show a river that stays calm, then rises, then floods, so the Cameras Panel can show the system working on an extreme case. The footage includes real floods, not only a stylised rise.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** leonardorofaDV

**Spec:** `docs/specs/flash-flood-replay.md` ("Cameras")

**Why five minutes:** the Replay runs 08:30 to 10:30 at ×30, which is 4 real minutes. A clip of 300 s covers a whole run with a minute to spare, and its position is `(event time - replay start) / 30` seconds.

Sources found on 2026-10-18 (check each licence on its own page before use):

- **USGS media library, public domain:** "Verde-Tangle Severe Flood 1993" (2 min 58 s, an Arizona flood), "Kennebec River" (about 25 s, flooding in Augusta, Maine), "Flash Floods: USGS Against the Water" (2 min 22 s). None is Nepal, and none was found to show a debris flow or a boulder-laden surge.
- **Wikimedia Commons** may hold flood videos; the search did not confirm a category. Check each file's licence on its page.
- **News footage of the 26 August 2026 Bhote Koshi flood** exists, but we do not hold its rights. It may only be used from a gitignored folder on the demo laptop, as the spec already says for the stage clip.

- [ ] `scripts/make-camera-clips.sh` (or a Python script beside the other build scripts) reads a source list, downloads or reads each source, trims it, scales it to 854 × 480, joins the pieces with short cross-fades and writes a 300 s H.264 MP4 with no audio that plays in Chrome, Safari and iOS Safari, plus a poster frame. It uses `ffmpeg` and says what to install when it is missing
- [ ] The source list is a file in the repo: for each source its address, licence, credit line, the second range used and its role (`calm`, `rising`, `flood`, `extreme`). The script refuses a source with no licence and no credit
- [ ] A manifest is written beside the clips: file name, length, credit line for every source used, and `flood_onset_s` (the second the water visibly jumps), which 0075 and 0077 use to line the clip up with a Node's wave arrival
- [ ] At least three clips: (1) calm then a fast surge (the story clip), (2) an extreme case with real flood footage showing water over a bridge or road and debris, (3) a rise that stays below flooding, so not every camera floods. At least one of them contains real flood footage, and the manifest says which seconds are real footage from which event
- [ ] Every clip is clearly illustrative: nothing in the file or manifest claims it was filmed at the Node site it plays for
- [ ] The committed fallback uses only public-domain or Creative Commons sources and stays under 20 MB in total (lower the bitrate before cutting length); the README credits each one. The clips with unlicensed footage go in `.demo/clips/`, which is gitignored, and the README says where they come from and that they are never committed
- [ ] `scripts/run-demo.sh` points the Hub at `.demo/clips/` when it exists, otherwise at the committed fallback, and prints which one it is using
- [ ] The script is run for real; the sizes, lengths and the time it took are noted here and in `docs/agents/lessons.md`, along with any source that could not be used and why
- [ ] `bash -n` and `scripts/check.sh` pass

**Notes:** a 25-second source cannot fill five minutes by looping without looking like a loop; use it as the flood moment, with calm footage before it. If no public-domain footage shows an extreme case, say so in the lessons and ask the group before using anything else.
