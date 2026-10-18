# 0035: Marker anatomy, the fleet and map layers

**What to build:** Every Node, fleet Node, Shelter, Home and Route on the God's Eye View is drawn the way the design shows it: green glowing dots with a label that update in place, the real Nodes ringed `REAL`, a Node that goes quiet showing the contact-lost cue and then Stale, and the map layers in their own styles. A judge reads the whole network from the map alone.

**Blocked by:** 0033, 0064

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("God's Eye View", "Map"); decisions `docs/design/gods-eye-view-decisions.md` (D-06, D-08 to D-15, D-39 to D-42, D-52, D-53); canvas artboards `G-Marker-Anatomy` (every state and the 10 to 5 px shrink), `G-Contact-Lost-Stale`, `G-Fleet-Popover`, `G-High-Ground` (Shelter pins beside it), with `C-Markers` and `C-Tags` for the parts.

- [ ] Node markers follow the table in the spec: calm or Low a flat `green-400` dot with no glow (the word `LOW` stays on the chip and card; D-06, D-53), Elevated amber with a 16 px glow, High red with a 22 px glow (D-12), Unverified (hollow dashed, `NOT COUNTED`), Stale (muted grey, the last water level struck through, `STALE · age`; D-15), Selected (cyan ring), and on the Hub, the breadboard Node and any audience Node a 1.5 px white ring plus the `REAL` tag under the label (D-10)
- [ ] Valley and real Nodes are 10 px dots (D-08) with name and water level always labelled; fleet dots are labelled only on hover or when zoomed in (D-09) and shrink to 5 px points with no labels at the national zoom while the valley group keeps its size and labels (D-11)
- [ ] The shrink between the valley and national zoom is smooth: dot radius and label visibility are interpolated with the zoom, nothing pops or jumps; checked by hand on the demo laptop by zooming slowly from Nepal to the valley and back, and noted here (owner's note on D-08)
- [ ] Contact lost: a Node silent for about 5 s loses its glow and a grey arc around the dot drains from full to empty over the 10 s to Stale (D-14), with `CONTACT LOST` under its label, a small pulse and a status-strip note "name: contact lost 6 s" (D-52); a Node that speaks again fades back in over 300 ms and the strip says "heard again"; no Flood Risk or Surge rule changes
- [ ] The simulated fleet (about 40) draws from the state snapshot with the same anatomy, stays readable (no overlap that hides a valley Node), and a Fleet toggle on the Layer rail, a rail button with the count as its badge (D-41), hides it; it draws from the snapshot's `fleet` array, and every fleet dot visibly sits on its river once 0063's rivers are drawn (fix an outlier in `scripts/cache-pack/fleet.source.json`, since 0064 does not snap)
- [ ] The badge reads "40 simulated Nodes · 6 real" with live counts (D-40), first in the status strip (D-49) and in the legend; its hover tooltip lists the sources with check dates: geoBoundaries (CC BY), OpenStreetMap (ODbL), SRTM, Open-Meteo (D-42)
- [ ] The legend is a small glass box bottom-left beside the rail's foot, with the 2D / 3D switch inside it as its last row (D-39, D-34; the owner's call on 2026-10-18): green dot, REAL ring, Stale grey, wave white, the Simulated badge
- [ ] A marker updates in place on a poll and is never rebuilt; when a Node's Flood Risk rises a ring expands once from its dot and its Node card's 600 ms flash starts on the same frame (D-13), never continuously
- [ ] Selecting a marker highlights its Node card and the other way round; no popups
- [ ] Flood-Prone Areas use the blue-grey diagonal hatch; open Shelters a solid pin, closed Shelters a hollow grey pin with `CLOSED`, the nearest open Shelter for the household a cyan ring with its name always shown
- [ ] Home is a cyan house icon; the Route is a 5 px cyan line with a dark casing
- [ ] The Storm Signal darkens the map's edges statically, with no animated weather
- [ ] The layer buttons from 0034 show and hide each layer
- [ ] Vitest tests: each marker state renders its label and class (pure functions, plus the component against a mocked map); a poll with no change leaves the marker objects untouched
- [ ] Performance bar from the spec holds with 40 fleet dots and the valley visible; checked by hand and noted here
- [ ] All **Commands** pass
