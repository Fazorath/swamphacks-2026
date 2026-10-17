# 0011: Online / mesh-only status and camera tiles

**What to build:** The dashboard always says whether its Node is online or mesh-only. While online it shows public camera tiles; when the internet drops, the tiles grey out with a clear "offline" state instead of showing a frozen image.

**Blocked by:** 0001

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] Pick the public camera source (free and accessible, e.g. FL511 / FDOT) and record the choice in this ticket
- [ ] The Node detects whether it has internet and reports online or mesh-only through the API
- [ ] The dashboard shows the status, and camera tiles while online
- [ ] When mesh-only, camera tiles grey out and read "offline"
- [ ] Any camera API key stays on the Node (in `.env`, listed in `.env.example`), never in the dashboard
- [ ] Seam A tests: the status flips when the internet is marked off and back on
- [ ] All **Commands** pass
