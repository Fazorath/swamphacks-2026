# Regions

A Region is one hand-written file, `regions/<name>/region.json`: the place's area, time zone, display units, official alert sources, the water it watches, the thresholds its flood-warning Rule set uses, its Shelters, High-ground points (each with its town's position), suggested sensor sites and the `sources` its Cache Pack is built from (`scripts/cache-pack/README.md`). The schema is `node/src/storm_shield/region.py`; a Node (`NODE_REGION`, default `nepal`) and the Cache Pack build both read the file through it, and a bad field is named in the error. Raw inputs sit beside it in `sources/`, and hand-written Events in `events/`; `scripts/build-cache-pack.sh <name>` turns the folder into the Region's Cache Pack. Spec: `docs/specs/regions-events-and-sandbox.md`, decision 2.

Thresholds are written with their units and converted where the Rule set reads them (`cm`, `m`, `ft`; `mm/h`, `in/h`; `hPa`, `inHg`).

## Nepal's thresholds

Tuned for a mountain river: the Bhote Koshi replay's calm water is 0.6 to 2.1 m and its calm pressure 1002 to 1008 hPa, so nothing below counts those as a flood. The 600 cm High level is the reported Syabrubesi warning level (danger 9 m); the Elevated level, the rise sizes and the pressure are reconstructed, as are the replay's own water values. The replay never goes below 1002 hPa: the 2026 flood was not a storm.
