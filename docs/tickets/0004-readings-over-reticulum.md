# 0004: Readings over Reticulum

**What to build:** Two laptops on the same Wi-Fi each run a Node and see each other's Community Readings on their dashboards, carried by Reticulum with no internet and no addresses configured. This is the riskiest ticket in the project (ADR 0001); rehearse it on Saturday.

**Blocked by:** 0003, and the Community Reading format (decided, `docs/specs/wire-formats.md`)

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] A Reticulum implementation of the Mesh interface (AutoInterface over the local Wi-Fi), chosen by config
- [ ] Each Node has a persistent Reticulum identity; incoming messages carry the verified sender identity
- [ ] Nodes find each other automatically on the same network
- [ ] Manual check: two laptops on one Wi-Fi show each other's readings; turning one off leaves the other working
- [ ] Manual check: still works with the internet unplugged
- [ ] Short setup and run notes for teammates, kept next to the code
- [ ] Seam A tests still run on the in-memory Mesh and pass
- [ ] All **Commands** pass
