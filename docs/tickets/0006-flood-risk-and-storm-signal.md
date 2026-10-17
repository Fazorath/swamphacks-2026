# 0006: Flood Risk with reasons and a Storm Signal

**What to build:** Every Node computes Flood Risk (Low, Elevated or High) from the Community Readings it can see and shows it on the dashboard with the reasons behind it. In calm weather no Flood Risk is shown at all. When pressure is low across Nodes, the map shows a Storm Signal. Stepping the Scenario visibly moves Flood Risk from nothing, to Low, to Elevated, to High.

**Blocked by:** 0003

**Status:** in-progress

**Owner:** leonardorofaDV

**Spec:** `docs/specs/flood-risk.md` (parent: `docs/specs/storm-shield.md`)

## Rules (first pass, decided in the 0006 grilling)

All numbers live in one module so they are easy to tune. Every Node runs the same pure function over its own reading store.

- **Which Nodes count:** every Node the store holds. Registered-only (0012) and the 60 s silence cutoff (0021) plug into one "does this Node count?" check later.
- **History:** the store keeps about 2 minutes of readings per Node, in memory only. "Water rising" means water level up at least 10 cm over that window. Soil moisture "rising" means up at least 3 points over it.
- **Level per Node** (the highest rule that fires):
  - High: water level ≥ 60 cm, or rain rate ≥ 25 mm/h while water is rising.
  - Elevated: water level ≥ 30 cm, or rain rate ≥ 10 mm/h, or water rising.
- **Raining** (Mesh-wide): soil moisture is rising at 2 or more counted Nodes; with fewer than 2 counted Nodes, at the one that counts.
- **Storm Signal:** pressure below 1009 hPa at half or more of the counted Nodes (at least 1).
- **Headline Flood Risk:** the highest level among counted Nodes. If no Node is Elevated or High but it is Raining or the Storm Signal is on, the headline is Low. Otherwise there is no Flood Risk: the level is `null`, the reasons are empty, and the dashboard hides the Flood Risk card.
- **Reasons** use the wire codes (`water_high`, `water_rising`, `rain_heavy`, `pressure_falling`) plus counts and current values, for example "water level 90 cm at 1 Node", "heavy rain: 30 mm/h at 2 Nodes", "low pressure: 1002 hPa at 3 Nodes". No durations. The dashboard writes the sentence.
- **Dashboard:** the Storm Signal is a badge on the map with its pressure reason. The Flood Risk card is hidden when there is no Flood Risk, and repeats the pressure reason only when it is what made Low appear.

## Acceptance

- [x] Flood Risk is computed per Node from the rules above, with thresholds in one place
- [x] The output is a level (or `null`) plus human-readable reasons
- [x] A Storm Signal appears when pressure is low across Nodes
- [x] The API exposes Flood Risk with reasons and the Storm Signal; the dashboard shows both and updates live
- [x] The Flood Risk card is hidden in calm weather
- [x] Seam A tests: calm day → no Flood Risk; soil moisture rising at 2 Nodes → Low; rain + water rising → High, with reasons; pressure drop → Storm Signal and Low; a lone counted Node decides by itself
- [x] The Scenario steps (normal day, pressure drop, rain, water rising) show: none, Low with Storm Signal, Elevated, High
- [x] All **Commands** pass
