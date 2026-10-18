# 0070: Readings Panel for a network

**What to build:** Two or three drawn variants of the Readings Panel for a map with about 45 Nodes, then the chosen one built: the valley and real Nodes as cards, any clicked dot opening its card, the readings (water level, barometric pressure, rain, soil moisture) readable from a projector, and the Pi's own card showing its live sensors.

**Blocked by:** 0035

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("Readings Panel", "God's Eye View"); variants drawn on the canvas first.

- [ ] Two or three variants are drawn and one is picked and noted in this ticket, with why
- [ ] The Panel lists the valley and real Nodes only (about 6 to 10 cards); a Node opened from any dot (fleet included) appears as a card until dismissed
- [ ] The order never changes on its own, a card flashes once when its risk rises, and a Stale Node says `STALE` with its age
- [ ] The Pi's card shows what each sensor reads, so a button press on the breadboard is visible within seconds
- [ ] Existing aria-labels the tests query are kept; flow tests cover selecting from the map and from the Panel
- [ ] All **Commands** pass
