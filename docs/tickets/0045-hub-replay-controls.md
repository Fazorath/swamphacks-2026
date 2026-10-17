# 0045: Hub Replay controls

**What to build:** On the Hub Panel the operator pauses, resumes, resets and jumps the Replay to a named phase (calm, collapse, border, Syabrubesi, DHM notice, DHM SMS, Betrawati, end), and every Node follows within a few seconds. The internet cue shows as a prompt when the Event clock reaches it.

**Blocked by:** 0044

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/flash-flood-replay.md`

**Design:** `docs/design/ui.md` ("Hub Panel")

- [ ] Hub Panel buttons for start, pause, resume, reset and a phase list; the current phase is highlighted
- [ ] Each action sends a `replay` message at once; Nodes jump their tracks to the new Event clock time
- [ ] At the internet cue the Hub Panel shows "Cut the internet now"
- [ ] Reset returns every Node to 08:30 with no Community Warning showing
- [ ] Seam A tests: pause holds every Node's readings; jump-to-phase moves every Node's Event clock; reset clears back to calm
- [ ] All **Commands** pass
