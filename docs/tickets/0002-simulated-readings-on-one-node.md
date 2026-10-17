# 0002: Simulated Readings on one Node

**What to build:** On a laptop Sensor Node, a teammate steps the Scenario (normal day → pressure drop → rain → water rising) from the keyboard or over HTTP, and the Node's dashboard shows its own Community Readings updating at a steady cadence, each labeled as a Simulated Reading. A reset puts the Scenario back to normal day.

**Blocked by:** 0001

**Status:** done

**Owner:** Fazorath

**Spec:** `docs/specs/storm-shield.md`

- [x] The Scenario has the steps normal day, pressure drop, rain, water rising, plus reset
- [x] Each step changes the Simulated Readings (pressure, rain rate, water level, soil moisture) the Node produces
- [x] The Scenario can be stepped and reset over the Node HTTP API and from the keyboard on a laptop
- [x] The API returns the Node's current Community Readings with timestamps and the simulated flag
- [x] The dashboard readings area lists them, labeled simulated, and updates live
- [x] The reading shape stays inside the Node; no mesh wire format is decided here (that comes from the UI design doc)
- [x] Seam A tests: stepping the Scenario changes the readings the API returns; reset returns to normal day
- [x] All **Commands** pass
