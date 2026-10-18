# 0035: Marker anatomy, the fleet and map layers

**What to build:** Every Node, fleet Node, Shelter, Home and Route on the God's Eye View is drawn the way the design shows it: green glowing dots with a label that update in place, the real Nodes ringed `REAL`, a Node that goes quiet showing the contact-lost cue and then Stale, and the map layers in their own styles. A judge reads the whole network from the map alone.

**Blocked by:** 0033, 0064

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("God's Eye View", "Map"); canvas artboards `C-Markers`, `C-Tags`, `D-Elevated`, `D-Storm`, `D-StaleUnverified`.

- [ ] Node markers follow the table in the spec: calm or Low green with glow (the word `LOW` stays on the chip and card), Elevated amber, High red, Unverified (hollow dashed, `NOT COUNTED`), Stale (muted grey, `STALE · age`), Selected (cyan ring), and a `REAL` ring on the Hub, the breadboard Node and any audience Node
- [ ] Contact lost: a Node silent for about 5 s loses its glow and shows a ring counting down to 15 s, then Stale; a Node that speaks again fades back in over 300 ms; no Flood Risk or Surge rule changes
- [ ] The simulated fleet (about 40) draws from the state snapshot with the same anatomy, stays readable (no overlap that hides a valley Node), and a Fleet toggle with a count on the Layer rail hides it
- [ ] The "Simulated network · weather from Open-Meteo" badge shows in the status strip and legend; a fleet Node's card carries `SIMULATED`
- [ ] A marker updates in place on a poll and is never rebuilt; a Node pulses once when its Flood Risk rises
- [ ] Selecting a marker highlights its Node card and the other way round; no popups
- [ ] Flood-Prone Areas use the blue-grey diagonal hatch; open Shelters a solid pin, closed Shelters a hollow grey pin with `CLOSED`, the nearest open Shelter for the household a cyan ring with its name always shown
- [ ] Home is a cyan house icon; the Route is a 5 px cyan line with a dark casing
- [ ] The Storm Signal darkens the map's edges statically, with no animated weather
- [ ] The layer buttons from 0034 show and hide each layer
- [ ] Vitest tests: each marker state renders its label and class (pure functions, plus the component against a mocked map); a poll with no change leaves the marker objects untouched
- [ ] Performance bar from the spec holds with 40 fleet dots and the valley visible; checked by hand and noted here
- [ ] All **Commands** pass
