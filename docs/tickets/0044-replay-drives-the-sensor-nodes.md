# 0044: Replay drives the Sensor Nodes

**What to build:** The Hub starts the Replay of 26 August 2026 and every Node follows its Event clock over the Mesh. Each Sensor Node plays its own track of Simulated Readings from the replay timeline, at ×30, and goes silent where its real gauge did. Every dashboard shows the Event clock ("26 Aug 2026 · 08:41 NPT · REPLAY ×30").

**Blocked by:** None (can start immediately)

**Status:** done

**Owner:** Fazorath

**Spec:** `docs/specs/flash-flood-replay.md`

- [x] One replay timeline file: tracks for S0–S3 (water, rain, soil, pressure) from 08:30 to 10:00 NPT, the time each Sensor goes silent, the named phases and the internet cue; real values where reported, the rest marked reconstructed, every fact citing a source
- [x] A Node's config names which track it plays; a Node with no track keeps the Scenario
- [x] The Hub's start action sends the `replay` message (decided, `docs/specs/wire-formats.md`) on start and every 10 s; only the Hub identity may send it
- [x] Each Node anchors the Event clock on its own clock at receipt and publishes its track's readings at the usual cadence, flagged simulated
- [x] A Sensor past the end of its track stops publishing, so it turns Stale
- [x] The Node API exposes the Event clock; the top bar shows it with the REPLAY tag
- [x] Seam A tests: a replay started on the Hub reaches every Node; a Sensor's readings follow its track; a Sensor whose track ends goes Stale; a `replay` message not from the Hub is ignored
- [x] All **Commands** pass
