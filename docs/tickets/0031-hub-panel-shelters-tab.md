# 0031: Hub Panel with a Shelters tab

**What to build:** The Hub operator opens a Hub-only "Hub" button in the top bar, sees every Shelter with its status and taps to open or close one. A phone's Evacuation Plan reroutes to the next open Shelter within seconds, with no internet. This is the demo moment for 0015.

**Blocked by:** 0029

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/shelter-status.md`

- [ ] The "Hub" button appears only when the Node's role is Hub; it opens a slide-over styled like the Household panel
- [ ] The Shelters tab lists every Shelter from the Cache Pack with its name and current status, and an open/closed control that calls `POST /api/shelters/open` and shows the result
- [ ] Only the Shelters tab is built; no placeholder tabs for the registry or warning log (0012 and 0013)
- [ ] Closed Shelters show as closed in the dashboard's Shelter list
- [ ] Vitest flow tests: the button is absent on a Sensor Node; toggling calls the endpoint with the right body; a closed nearest Shelter changes the plan on the next poll
- [ ] Rehearsed on loopback with a phone over Tailscale: close the nearest Shelter on the Hub and watch the phone reroute (not a Pi check)
- [ ] All **Commands** pass
