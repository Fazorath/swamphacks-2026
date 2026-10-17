# 0017: Live NWS and NHC feeds (stretch)

**What to build:** When the Hub is online and not in replay mode, it pulls live Official Alerts from NWS (zone FLZ136) and NHC through the same path the Helene replay uses, so the dashboard shows real conditions outside the demo.

**Blocked by:** 0014

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

**Design:** `docs/design/ui.md` ("Hub Panel"); canvas artboard `D-Hub-Feeds`.

- [ ] The Hub polls `api.weather.gov/alerts/active?zone=FLZ136` (with a User-Agent header) and NHC `CurrentStorms.json` while online
- [ ] Live alerts go through the same normalization as replay and are tagged live
- [ ] Config picks live or replay; the demo defaults to replay
- [ ] Feed errors are shown, never silently swallowed
- [ ] Seam A tests with recorded feed responses: live alerts reach every Node tagged live
- [ ] All **Commands** pass
