# swamphacks-2026

Our SwampHacks 2026 project. The idea gets picked at kickoff and this README gets rewritten for judges before submission.

## Teammate setup (2 minutes)

```bash
git clone git@github.com:Fazorath/swamphacks-2026.git
cd swamphacks-2026
git config core.hooksPath .githooks   # turns on secret scan + attribution strip (Claude Code does this for you)
cp .env.example .env                  # then fill in keys; .env never gets committed
```

Install the GitHub CLI and run `gh auth login` once; the agent skills use it for issues and pull requests. Then open the repo in your agent of choice. Read `AGENTS.md` once: it covers the workflow, code rules and how issues and pull requests work.

## How we work

- `AGENTS.md`: the rules for agents and humans
- `docs/roadmap.md`: what comes next and in which order
- [GitHub Issues](../../issues): the work, one issue per pull request (`docs/agents/issue-tracker.md`)
- `docs/specs/`: what we're building
- `docs/tickets/`: the hackathon tickets (frozen archive)
- `.claude/skills/`: playbooks (grill, spec, tickets, implement, review…), readable by any agent

Skills in `.claude/skills/` are adapted from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT, see `.claude/skills/LICENSE-mattpocock-skills`).

## Run the demo

`scripts/run-demo.sh` starts the Cache Pack server, the Hub and Sensors S0 to S3 on this laptop and prints the dashboard addresses for the projector and the phones; Ctrl-C stops everything. Setup notes (hotspot, projector, the two phones' Household Profiles) are in `scripts/demo-setup.md`.

A volunteer's laptop joins the same Mesh with `scripts/join-demo.sh <hub address> <town>`, or the Docker image on Windows; the runbook is `scripts/join-demo.md`.
