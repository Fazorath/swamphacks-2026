# 0070: Readings Panel for a network

**What to build:** The Readings Panel for a map with about 45 Nodes, built as the river ladder the owner picked: the valley Nodes in River km order on a vertical river line with the wave's position marked between them, the real Nodes off the river under it, the breadboard Pi's card pinned at the top with its live sensors, and the readings (water level, barometric pressure, rain, soil moisture) readable from a projector. A fleet Node clicked on the map opens a popover beside its dot and leaves the Panel alone. Decisions D-36 to D-38 in `docs/design/gods-eye-view-decisions.md`.

**Blocked by:** 0035

**Status:** done

**Owner:** Fazorath

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("Readings Panel", "God's Eye View"); canvas artboard `G-Readings-Ladder` (calm, wave passing, Stale; the Pi's card pinned).

**Variant picked:** C, the river ladder by River km (D-36), chosen on the design board on 2026-10-18 over A (today's stacked cards: ten cards do not fit 666 px) and B (compact rows that expand on select: hides the hero number). Why C: the Panel becomes a second view of the same story, upstream to downstream with the wave between the Nodes, so River km and the wave's position are in the Panel itself and the order needs no explaining.

- [x] The Panel is a vertical river line with one rung per valley Node in River km order, top of the river first; each rung shows the name, its tags, the water level as the hero number and the three other readings; the wave front's current position is marked on the line between the rungs it is passing (D-36)
- [x] The real Nodes that are not on the river (the Hub when it is not a valley Node, an Audience Node) are listed under the ladder (D-36)
- [x] The breadboard Pi's card is pinned at the top of the Panel with a cyan `LIVE SENSORS` tag and shows what each sensor reads, so a button press on the breadboard is visible within seconds (D-37)
- [x] A fleet Node clicked on the map opens a popover beside its dot carrying `SIMULATED`; the Panel does not change (D-38; the one exception to "no popups" in `ui.md`); a valley or real Node clicked on the map highlights its rung and the other way round
- [x] The order never changes on its own, a rung flashes once when its risk rises on the same frame as its marker's ring (D-13), and a Stale Node says `STALE` with its age and its last water level struck through (D-15)
- [x] Existing aria-labels the tests query are kept; flow tests cover selecting from the map and from the Panel, and the fleet popover
- [x] All **Commands** pass
