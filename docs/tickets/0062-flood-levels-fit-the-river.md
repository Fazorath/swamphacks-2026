# 0062: Flood Risk levels fit the river

**What to build:** The replay opens at 08:30 "calm", but every Sensor is already High and the Storm Signal is on, so the Surge at 08:37 never stands out. The fixed levels in the Flood Risk module are still the Gainesville creek ones (High at 60 cm water, Storm Signal below 1009 hPa). Every track's calm water level in `replay_timeline.json` is 0.6 to 2.1 m, and every calm pressure is 1002 to 1008 hPa, so all four Sensors start as `water_high` and four of five Nodes count toward the Storm Signal (found in the full code review, 2026-10-17). Retune the levels for a mountain river, so the calm phase reads Low and only the Surge, and the water it brings, raises Flood Risk.

Suggested levels, to be checked against the tracks: water Elevated at 3 m and High at 6 m. The 6 m figure is the reported Syabrubesi warning level (danger 9 m; `docs/specs/flash-flood-replay.md`, "Reconstructed values"). The calm levels (0.6 to 2.1 m) sit below 3 m and the surge peaks (7.5 to 9.6 m) above 6 m. Lower the Storm Signal pressure below the replay's range or leave it there, whichever keeps it off through the replay; the 2026 flood was an ice-rock avalanche, not a storm. Keep every value a named constant in the Flood Risk module, as now.

**Blocked by:** None (can start immediately)

**Status:** done

**Owner:** refloow-0

**Spec:** `docs/specs/flash-flood-replay.md` (demo story: "08:30 calm"; Surge "High before any fixed level is reached")

- [x] Replayed from 08:30 with the real publish interval, no Node is Elevated or High and the Storm Signal is off before S0's Surge at 08:37
- [x] After a Sensor's Surge it is High with `water_surge`, and once its water passes the High level it stays High after the Surge window ends, until it goes silent
- [x] The Storm Signal stays off for the whole replay
- [x] The slow 10 cm drift before the ramps (for example S0 0.6 to 0.7 m by 08:36:30) does not raise "water rising"; if it does, the rising amount is retuned with the levels
- [x] The Scenario's steps (`normal_day`, `pressure_drop`, `rain`, `water_rising`) are rescaled so they still walk Low, Storm Signal, Elevated, High on a Sensor with no track
- [x] The comment above the levels says what they are tuned for and where the 6 m comes from; reconstructed values are labelled as such
- [x] Seam A tests: the existing Flood Risk tests move to the new levels; one new test plays the replay calm phase and finds every Node Low with no Storm Signal
- [x] `docs/specs/wire-formats.md` and `docs/specs/flood-risk.md` mention no cm figure that no longer holds
- [x] All **Commands** pass

Not in this ticket: the Surge sentence counts real seconds, not Event time ("water rose 3.2 m in 3 s" at ×30), and 0060 (a Sensor may go silent before it publishes its Surge). Both also affect the 08:37 moment; do 0060 first if both are picked up together.
