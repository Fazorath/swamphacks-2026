# swamphacks-2026

Our SwampHacks 2026 project. The idea gets picked at kickoff and this README gets rewritten for judges before submission.

## Teammate setup (2 minutes)

```bash
git clone git@github.com:Fazorath/swamphacks-2026.git
cd swamphacks-2026
git config core.hooksPath .githooks   # turns on secret scan + attribution strip (Claude Code does this for you)
cp .env.example .env                  # then fill in keys; .env never gets committed
```

Then open the repo in your agent of choice. Read `AGENTS.md` once: it covers the workflow, code rules and how tickets work.

## How we work

- `AGENTS.md`: the rules for agents and humans
- `docs/specs/`: what we're building
- `docs/tickets/`: thin, claimable slices of it
- `.claude/skills/`: playbooks (grill, spec, tickets, implement, review…), readable by any agent

Skills in `.claude/skills/` are adapted from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT, see `.claude/skills/LICENSE-mattpocock-skills`).
