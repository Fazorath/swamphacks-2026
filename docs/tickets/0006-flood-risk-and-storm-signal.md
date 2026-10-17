# 0006: Flood Risk with reasons and a storm signal

**What to build:** Every Node computes Flood Risk (Low, Elevated or High) from the Community Readings it can see and shows it on the dashboard with the reasons behind it. When pressure falls across Nodes, the dashboard shows a storm signal. Stepping the Scenario visibly moves Flood Risk from Low to High.

**Blocked by:** 0003

**Status:** in-progress

**Owner:** leonardorofaDV

**Spec:** `docs/specs/storm-shield.md`

- [ ] Flood Risk is computed per Node from transparent rules on water level, rain rate and trend
- [ ] The output is a level plus human-readable reasons (for example "water level rising at 2 Nodes")
- [ ] Thresholds are a first pass, kept in one place, and easy to tune later
- [ ] A storm signal appears when pressure is falling across Nodes
- [ ] The API exposes Flood Risk with reasons and the storm signal; the dashboard shows both and updates live
- [ ] Seam A tests: normal day → Low; rain + water rising → High, with reasons; pressure drop → storm signal
- [ ] All **Commands** pass
