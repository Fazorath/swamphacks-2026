# 0013: Community Warnings

**What to build:** When one Registered Node reports a Surge, the Hub sends one signed Community Warning over the mesh, naming that Node, its River km and the Event clock time of the Surge. Every Viewer then sees it, labelled non-official and pointing to official sources for evacuation. The Hub dashboard shows a log of what was sent and why.

**Blocked by:** 0012, 0044, 0046, and the warning format (decided, `docs/specs/wire-formats.md`)

**Status:** in-progress

**Owner:** Fazorath

**Spec:** `docs/specs/flash-flood-replay.md` (replaces the "two Registered Nodes High" rule in `docs/specs/storm-shield.md`)

**Design:** `docs/design/ui.md` ("Alerts Panel", "Hub Panel"); canvas artboards `C-Alerts`, `D-Hub-Warnings`, `P-Alerts`.

- [ ] Each Node's River km is set in its config and known to the Hub
- [ ] The Hub issues a Community Warning when a Registered Node reports a Surge, carrying `origin`, `origin_km` and `surge_t`
- [ ] It does not re-issue while that Node's Surge holds
- [ ] Each warning is signed with the Hub identity; Nodes show only warnings whose signature verifies
- [ ] The dashboard shows warnings in their own style: labelled non-official, linking to official sources, never ordering evacuation, naming the Sensor and how far upstream it is
- [ ] The Hub dashboard shows the Community Warning log
- [ ] Seam A tests: exactly one warning for one Registered Node's Surge, with origin, River km and event time; none for an Unverified Node; no repeat while the Surge holds; a badly signed warning is not shown
- [ ] All **Commands** pass

**On hold (2026-10-17):** no code yet. Claimed, but waiting until 0012 (Node registry, amitathik7) and 0046 (Surge, refloow-0) merge, since a warning fires on a Registered Node's Surge. 0047, 0048, 0039, 0050 and 0051 wait on this ticket.
