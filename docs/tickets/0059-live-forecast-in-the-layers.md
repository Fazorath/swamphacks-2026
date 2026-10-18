# 0059: Live forecast in the layers (stretch)

**What to build:** With no Replay running, the Weather layers show the forecast with a time slider from now to 7 days, tagged `FORECAST`, with its age and an OFFLINE tag when it has gone stale.

**Blocked by:** 0055, 0058, 0073

**Status:** in-progress

**Owner:** Fazorath

**Assignee:** refloow-0

**Spec:** `docs/specs/weather-layers.md`

- [ ] No Replay: the layers read `/api/weather/forecast`; a Replay starting switches them to the replay file, a Replay ending switches back
- [ ] A slider scrubs now to +7 days and all three layers (Temperature, Cloud cover, Rain) follow it
- [ ] Tag `FORECAST · updated 3 h ago`; past 3 hours without a fresh fetch the tag turns to `OFFLINE · last forecast 5 h old`
- [ ] No forecast file: "forecast not available on this Node", and the replay layers still work
- [ ] Vitest: file choice follows the Replay state; slider moves the layers; the tag text for fresh, old and missing forecasts
- [ ] All **Commands** pass
