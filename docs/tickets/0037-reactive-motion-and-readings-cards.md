# 0037: Reactive motion and Readings cards

**What to build:** The Readings Panel shows each Node as a card with the water level as the hero number, a trend arrow, and rain, pressure and soil moisture beneath. Every change in the data is visible: numbers tick, slots flash once, a rising Flood Risk pulses once, and nothing jumps. With reduced motion on, every change is an instant swap.

**Blocked by:** 0033, 0019

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

**Design:** `docs/design/ui.md` ("Readings Panel", "Motion", "Performance"); canvas artboards `C-NodeCard`, `C-Tags`, `D-PressureDrop`, `D-Raining`, `D-Elevated`, `Flow-Transitions`.

- [ ] Node card: name and tags (`THIS NODE`, `SIMULATED`, risk, `STALE · age`, `NOT COUNTED`), water level hero number with arrow, a three-column row for rain rate, pressure and soil moisture with their arrows
- [ ] Arrows come from the last 30 s of polls held in the browser; no sparklines
- [ ] Card order never changes on its own: this Node first, the other Registered Nodes A to Z, Unverified Nodes under a "Not counted" divider
- [ ] A reading change ticks its number and flashes its slot for 600 ms; a Flood Risk rise cross-fades the chip, pulses the marker once and flashes the card once; a new Node fades in over 300 ms; a Node going Stale desaturates over 300 ms
- [ ] Numbers use tabular figures in fixed-width slots, so nothing shifts when they change
- [ ] With `prefers-reduced-motion`, no tick, pulse or flash: an instant swap
- [ ] Only `transform` and `opacity` are animated; a poll that changes nothing re-renders nothing
- [ ] Vitest tests: arrow direction from a poll history, card order stays fixed across polls, reduced motion removes the animation classes
- [ ] The 0008 test "no request carries the profile" now runs a real poll cycle (see the lessons log)
- [ ] All **Commands** pass
