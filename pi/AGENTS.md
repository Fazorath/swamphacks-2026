# Lessons: Pi and networking

Area gotchas that are still true. Claude Code loads this file (through `CLAUDE.md`) only once a session reads a file in this folder; other agents read the nearest `AGENTS.md`. Add a line when something here breaks, surprises you or takes more than one try; delete a line once your change makes it untrue. Repo-wide lessons: `docs/agents/lessons.md`.

- **On the Pi always `uv sync --group pi`** (or `pi/install.sh`); a plain sync removes `lgpio` and the Node dies on a sysfs fallback. `lgpio` needs `liblgpio-dev`.
- **firewalld blocks AutoInterface** (UDP 29716 and 42671); Docker blocks NetworkManager sharing; WSL2 and Docker Desktop never pass multicast discovery, so use TCP (`JOIN_MESH=tcp`). A Hub needs `NODE_ALSO_TCP_LISTEN=1` to be dialled.
- **"Connection refused" with a working ping** means a machine answered that has no listener, often your own (NetworkManager gives `10.42.0.1` to every shared link).
- **A TCP Node that dials only the Hub loses every other Node when the Hub stops**: list every peer.
- **Give every Node its own `NODE_LATITUDE`/`NODE_LONGITUDE`**, and wait a few seconds before restarting a killed Node.
