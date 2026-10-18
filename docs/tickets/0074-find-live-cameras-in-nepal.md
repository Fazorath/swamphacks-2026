# 0074: Find out which live cameras in Nepal we can use

**What to build:** A short research note that says, for every candidate live camera in Nepal, whether the demo can show it: what it looks at, how to read it, whether its terms allow it, and whether it stayed up. The note ends with a decision: which camera sites get a live source and which fall back to a recorded demo clip (0075, 0076). The FL511 Florida cameras are not candidates; they are being removed (0038).

**Blocked by:** None (can start immediately)

**Status:** done

**Owner:** leonardorofaDV

**Assignee:** leonardorofaDV

**Spec:** `docs/specs/flash-flood-replay.md` ("Cameras")

Leads found on 2026-10-18, none confirmed as a public feed:

- **Timure CCTV (Rasuwa):** a real-time camera put up after the 26 August 2026 flood by the Centre for Hydrology and Water Resources Research under the Water and Energy Commission Secretariat, over VSAT. Reports say it was still being brought fully online in early September and give no public address. Two more CCTVs on the Nepal-China border (Rasuwa) were being fixed from 31 August, to watch lakes formed by the flood.
- **Webcam Nepal Live (YouTube):** a one-person channel that, per a Nepali Times article of about 2024, streams from 21 locations round the clock. Which locations, and whether any look at a river, is not known.
- **DHM flood forecasting site:** publishes bulletins; no public camera images found.

- [x] A note at `docs/research/nepal-cameras.md`: one block per candidate with address, what it shows (river, bridge, town, mountains), how it is read (JPEG you can poll, HLS stream, YouTube embed, none), the terms of use as written, and the date you checked it
- [ ] Each candidate is opened a few times over at least two days and the note says whether it stayed up and how old its picture was _(not met: first check done 2026-10-18; the second check, on or after 2026-10-20, is a follow-up in the note)_
- [ ] For Timure and the border cameras: a message sent to the Centre or the Secretariat asking whether the feed is public and may be shown in a demo; the date sent and any answer are in the note (a reply is not required to finish the ticket) _(not met: drafted, and a rehearsal copy went to the team on 2026-10-18; sending it to the agencies waits for their addresses, a follow-up in the note)_
- [x] For a YouTube or embed-only source the note says whether the Node can fetch it once and share it (the Cameras rule in `docs/specs/online-status-and-cameras.md`) or only the Viewer's browser can show it, and what that means while the Viewer has no internet
- [x] A decision table: for each demo Node site that should have a camera (the Hub at Betrawati at least), the live source if one qualifies, otherwise "clip". A source qualifies only if it needs no key we cannot keep secret, its terms allow showing it, and it stayed up
- [x] If nothing qualifies, the note says so plainly and every site is "clip"; that is an acceptable result
- [x] `docs/specs/flash-flood-replay.md` "Cameras" gains a line pointing at the note

**Notes:** the camera sites and their River km are in the spec's Region and Nodes table. Do not add a camera address to the repo before the terms are read.
