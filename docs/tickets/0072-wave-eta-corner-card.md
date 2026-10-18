# 0072: Wave ETA corner card

**What to build:** On the desktop God's Eye View the Wave ETA counts down in a fixed corner card, bottom-right of the map beside the right-hand Panels, with the number at 120 px and the town as its label. The number is white, turns amber under 15 minutes and red under 5, and reads "wave expected now" in red at zero. The owner wants it to read as critical danger from the back of a room, so its treatment is drawn and picked before it is built. Decisions D-24, D-25 and D-54 in `docs/design/gods-eye-view-decisions.md`; the owner's note on D-24 is binding.

**Blocked by:** 0033

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("God's Eye View"); the card's artboard is drawn on the canvas first.

- [ ] Two or three treatments of the card are drawn on the canvas, each making the card read as urgent, critical danger from the back of a room (owner's note on D-24); one is picked and noted here, with why
- [ ] The card is fixed bottom-right of the map, beside the right Panel stack and above the status strip, so the map and the home town's marker stay uncovered; it carries the Wave ETA number at 120 px in mono and the town as its label, for example `35` over `MIN · BETRAWATI`, inside the violet dashed Community edge (D-24)
- [ ] The number is white, amber under 15 minutes, red under 5, and "wave expected now" in red at or past zero; it borrows only amber and red from the Flood Risk palette, never green (D-25, D-54)
- [ ] The card shows while a Community Warning with a Wave ETA for this home is in effect and hides when there is none (a home upstream of the origin or more than 2 km from the river gets no card); acknowledging the warning (D-27) does not hide it
- [ ] The minutes come from `waveEta.ts` as the Evacuation Plan's do, so the card, the plan and the wave front (0065) always agree
- [ ] Animates only `transform` and `opacity`, with at most one text shadow on the number; with reduced motion on, colour changes are instant swaps
- [ ] Vitest: the colour thresholds as a pure function (16, 15, 5, 0 minutes); a flow test in which a warning arrives and the card appears with the town's name, and one in which a home with no Wave ETA shows no card
- [ ] All **Commands** pass
