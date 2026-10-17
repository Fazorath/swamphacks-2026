# Dashboard UI design

How the Storm Shield dashboard looks and where things go. Ticket 0001 ships the skeleton of this; each later ticket fills one area. Spec: `docs/specs/storm-shield.md`. Words follow `CONTEXT.md`.

## Reference

The look is borrowed from [Osiris](https://github.com/carbon-evolution/osiris) (osirisai.live), an open-source OSINT dashboard that layers cameras, weather and satellite data on one map. We searched for "Osiris AI Eagle Eye" and found no product by that exact name; Osiris is the closest match, so this doc is based on its README, not hands-on use. Worth confirming that is the one meant.

What we take from it:

- **The map is the page.** A full-viewport map with everything else floating over it.
- **Left rail** of layer toggles with live counts.
- **Translucent glass panels** (backdrop blur) over the map, with pulse dots for live status.
- **Per-feed freshness badges** and an **OFFLINE banner** at the bottom-left when a source is down.
- **Camera viewer** opened from a map marker.
- **Dark "ops room" theme**, all colors from CSS variables.

What we leave out: the 40 layers, globe, AI analyst, finance, cyber. Storm Shield has one neighborhood, one storm.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ Storm Shield   porch · Hub        ● Mesh only     Flood: LOW │  top bar
├────────┬─────────────────────────────────────┬───────────────┤
│Readings│                                     │ Alerts        │
│  rail  │              MAP                    │ (official,    │
│ (live  │   Node markers, storm signal,       │  distinct)    │
│ counts)│   route, camera markers             ├───────────────┤
│        │                                     │ Evacuation    │
│        │                                     │ Plan          │
├────────┴─────────────────────────────────────┴───────────────┤
│ freshness badges · OFFLINE banner                            │  status strip
└──────────────────────────────────────────────────────────────┘
```

- **Phone width:** map on top, then Alerts, Evacuation Plan, Readings stacked. Residents open this on a phone first.
- Panel to ticket: Map → 0005, Readings → 0002/0003, Flood Risk in the top bar → 0006, Evacuation Plan → 0009/0010, camera tiles and online status → 0011, Alerts → 0013/0014.

## Visual language

| Thing | Rule |
|---|---|
| Theme | Dark by default; colors only through CSS variables in `App.css` |
| Panels | Translucent surface, 1 px border, backdrop blur, small radius |
| Type | System sans; uppercase small caps for labels; tabular numbers for readings |
| Flood Risk | Low green, Elevated amber, High red; always with the word, never color alone |
| Official Alerts | Their own panel, solid border, "OFFICIAL" tag (and "OFFICIAL · REPLAY" for replays) |
| Community info | Cool blue/cyan accents, never the official style |
| Simulated Readings | Always carry a "SIMULATED" tag |
| Unverified Nodes | Greyed out, "not counted" tag |
| Stale / offline | Greyed with age shown; camera tiles say "offline" |

## Skeleton scope (ticket 0001 follow-up)

Only the page frame: top bar with Node identity, a placeholder area per region in the layout above, dark glass styling. No map, no data. Later tickets replace each "Coming soon" without moving the frame.
