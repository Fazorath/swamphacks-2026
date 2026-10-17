# 0060: Replay Sensors publish through their Surge

**What to build:** Each Sensor's replayed Surge reaches the Mesh. A Sensor publishes every 3 s, which is 90 event seconds at ×30, and the ramps in `replay_timeline.json` last 59 to 89 event seconds, so a run can publish the calm level and then go silent without ever publishing a high reading (found while checking 0046: S0 sat at 70 cm and went silent). Widen each ramp, or publish faster while a track is ramping, so every Sensor sends at least two readings from its calm level to its first surge reading before it goes silent.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/flash-flood-replay.md`

- [ ] Each Sensor track (S0 to S3) puts a reading above its Surge size on the Mesh before its `silent_at`, however the run is phased, and not only when the Replay starts at a phase right before the ramp
- [ ] The widened ramps keep their sourced times: keyframes that cite a reported time stay where they are, and only reconstructed ones move, each labelled `reconstructed`
- [ ] Seam A test: start the Replay from the beginning with the Sensors' real publish interval; the Hub's Flood Risk lists the Sensor in `surged` for each Sensor, once its ramp has played
- [ ] The Hub dashboard shows the "water rose ... m in ... s" reason during the demo's first Surge without a jump to a phase
- [ ] All **Commands** pass
