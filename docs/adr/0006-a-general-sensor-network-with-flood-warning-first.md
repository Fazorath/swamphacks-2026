# Storm Shield becomes a general sensor network, with flood warning as its first Rule set

After SwampHacks, Storm Shield turns from a Nepal flood demo into a local-first sensor network people run themselves (a farm, remote land, a stretch of coast). Flood warning stays the first use, because the Mesh, registry and dashboard are built for it, but it is no longer the product's boundary (decided 2026-10-20, issue #21).

So the core stops being flood-shaped now, while the Sandbox and the Event format are still being designed: a Community Reading becomes a list of Measurements, each with a kind and a unit declared by the Sensor Node, in place of the four fixed fields (water level, rain, soil moisture, pressure). Flood Risk, Surges and Community Warnings become the flood-warning Rule set, which reads the Measurements it knows and ignores the rest. Its thresholds move from code into each Region's file, since a Bhote Koshi flash flood (300 cm in 60 s) and a Florida storm surge (a foot or so in a quarter hour) need different ones.

## Considered Options

- **Keep the four fields through the Region work and generalise later:** less change now, but every Event file, Sandbox screen and test written in the meantime would be redone.
- **Generic Measurements and a pluggable rule engine now:** rejected; only the flood Rule set is built until a second one is needed (M6 General sensors).

## Consequences

- The reading wire format and its two exact-field tests change once, early in the Sandbox work.
- Nepal stays as the first Region only so far as moving it behind the Region module is mechanical; no Nepal-specific work is planned. The submitted demo stays runnable from the `v0-swamphacks` tag. ADR 0004 (the demo replays the Bhote Koshi flood) now describes the Nepal Region only.
- The Simulated Fleet (ADR 0005, point 2), the camera clips and the breadboard are deleted; cameras return as sensors in M6.
