# 0001: Walking skeleton

**What to build:** A teammate starts a Node with one command and opens its dashboard in a browser. The dashboard shows a light UI scaffold: the Node's identity and role (Sensor Node or Hub) and empty placeholder areas for the map, readings, alerts and Evacuation Plan, so later tickets have a place to land. Tests, lint and typecheck run on both the Node service and the dashboard, so every later ticket starts from a green `main`.

**Blocked by:** None (can start immediately)

**Status:** in-progress

**Owner:** Fazorath

**Spec:** `docs/specs/storm-shield.md`

- [ ] One command starts a Node (Python FastAPI, uv); a config value picks the role, Sensor Node or Hub
- [ ] The Node serves the built dashboard (React + Vite + TypeScript, pnpm) as static files
- [ ] The Node HTTP API returns this Node's identity and role, and the dashboard shows them
- [ ] The dashboard has placeholder areas for map, readings, alerts and Evacuation Plan
- [ ] One pytest test hits the Node API through the FastAPI test client (seed of seam A)
- [ ] One Vitest test runs in the dashboard (seed of seam B)
- [ ] Lint, format and typecheck are set up for both sides
- [ ] **Stack** and **Commands** in `AGENTS.md` are filled in, and every command passes
