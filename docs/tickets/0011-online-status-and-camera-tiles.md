# 0011: Online / mesh-only status and camera tiles

**What to build:** The dashboard always says whether its Node is online or mesh-only. While online it shows public camera tiles; when the internet drops, the tiles grey out with a clear "offline" state instead of showing a frozen image.

**Blocked by:** 0001

**Status:** in-progress

**Owner:** leonardorofaDV

**Spec:** `docs/specs/online-status-and-cameras.md` (parent: `docs/specs/storm-shield.md`)

- [x] Pick the public camera source (free and accessible, e.g. FL511 / FDOT) and record the choice in this ticket

  **Chosen (2026-10-17):** FL511's own website feed, which needs no key or account. Images are `https://fl511.com/map/Cctv/{id}` (live 768x432 JPEG, `cache-control: max-age=60`); the camera list is `https://fl511.com/List/GetData/Cameras` (Alachua County is `areaId` `ALA`). FL511's official developer API needs a key we cannot get, so this is the stopgap until something better turns up. It is not a documented API and may change without notice; the Node therefore fetches each camera at most once every 60 s and serves that one copy to every Viewer. Starting list (ids kept in a repo file): 1655 I-75 SB at SR-24/Archer Rd, 1647 I-75 SB at SR-26 (Newberry Rd), 1536 I-75 NB at SR-121/Williston Rd, 1463 I-75 NB at Paynes Prairie. The City of Gainesville ArcGIS layer was checked and rejected: no such layer found, and it would hold locations, not images.
- [ ] The Node probes for internet every 5 s (2 s timeout) and flips between online and mesh-only after two failures or two successes in a row; it reports its own state only, as `status` (`"online"` or `"mesh_only"`) on `GET /api/node`
- [ ] The dashboard polls `/api/node` every 3 s until 0019 replaces it, shows an "Online" / "Mesh-only" badge in the header, and shows a Cameras panel below Readings
- [ ] Each tile is Live (image and "updated Ns ago"), Offline (Node is mesh-only: grey, the word "Offline", no image at all) or Unavailable (Node is online but that camera failed)
- [ ] No camera API key exists, so nothing goes in `.env` or `.env.example`; the camera images still reach the dashboard only through the Node (`/api/cameras/{id}.jpg`)
- [ ] Seam A tests: the connectivity check is injected into `create_app`, the API stays read-only, and the status flips when the check is marked off and back on
- [ ] All **Commands** pass
