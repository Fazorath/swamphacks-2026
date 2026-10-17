# 0013: Community Warnings

**What to build:** When one Registered Node reports a Surge, the Hub sends one signed Community Warning over the mesh, naming that Node, its River km and the Event clock time of the Surge. Every Viewer then sees it, labelled non-official and pointing to official sources for evacuation. The Hub dashboard shows a log of what was sent and why.

**Blocked by:** 0012, 0044, 0046, and the warning format (decided, `docs/specs/wire-formats.md`)

**Status:** done

**Owner:** Fazorath

**Spec:** `docs/specs/flash-flood-replay.md` (replaces the "two Registered Nodes High" rule in `docs/specs/storm-shield.md`)

**Design:** `docs/design/ui.md` ("Alerts Panel", "Hub Panel"); canvas artboards `C-Alerts`, `D-Hub-Warnings`, `P-Alerts`.

- [x] Each Node's River km is set in its config and known to the Hub
- [x] The Hub issues a Community Warning when a Registered Node reports a Surge, carrying `origin`, `origin_km` and `surge_t`
- [x] It does not re-issue while that Node's Surge holds
- [x] Each warning is signed with the Hub identity; Nodes show only warnings whose signature verifies
- [x] The dashboard shows warnings in their own style: labelled non-official, linking to official sources, never ordering evacuation, naming the Sensor and how far upstream it is
- [x] The Hub dashboard shows the Community Warning log
- [x] Seam A tests: exactly one warning for one Registered Node's Surge, with origin, River km and event time; none for an Unverified Node; no repeat while the Surge holds; a badly signed warning is not shown
- [x] All **Commands** pass

**Built (2026-10-17):** 0012 and 0046 had merged. 0047, 0048, 0039, 0050 and 0051 were waiting on this ticket.

**Decisions:** the Hub learns a Node's River km from an optional `river_km` on its signed reading (`NODE_RIVER_KM`), so no new message kind. A Surging Node with no River km starts no warning (the Hub logs it once). A warning's `surge_t` is the Event clock when the Hub saw the Surge, or the Hub's own time with no replay. A Node hides a warning its Event clock has not reached, so a replay Reset clears the Alerts Panel but not the Hub's log. "Upstream" on the card is measured from the connected Node's River km; the viewer's own home waits for 0047.
