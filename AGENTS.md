# AGENTS.md

Rules for every coding agent on this repo (Claude Code, Cursor, Copilot, Codex…) and for the humans driving them. Four people, one weekend, one demo. Keep it working, keep it readable, leak nothing.

## Project

**Idea:** TBD — decided at kickoff (Fri 8:40 pm). Spec: `docs/specs/`.

## Stack

- Node service: Python 3.12+, FastAPI, managed with uv (`node/`)
- Dashboard: React + Vite + TypeScript, managed with pnpm (`dashboard/`), built to `dashboard/dist` and served by every Node
- Tests: pytest (Node API seam), Vitest (dashboard seam)
- Hosting for the demo: laptops and Raspberry Pis on the local Wi-Fi, no cloud

## Commands

Run these before calling any ticket done. An agent must not claim "done" without running them.

| Task | Command |
|---|---|
| Install | `cd node && uv sync` and `cd dashboard && pnpm install` |
| Build dashboard | `cd dashboard && pnpm build` |
| Run a Node | `cd node && uv run storm-shield-node` (serves the built dashboard; `NODE_ROLE=hub` for the Hub, default `sensor`) |
| Keep a Node on your checkout | `scripts/run-live.sh` (rebuilds and restarts whenever `HEAD` moves, e.g. after `git pull`) |
| Dashboard dev server | `cd dashboard && pnpm dev` (proxies `/api` to port 8000) |
| Typecheck | `cd node && uv run mypy src tests` and `cd dashboard && pnpm typecheck` |
| Lint + format | `cd node && uv run ruff check . && uv run ruff format --check .` and `cd dashboard && pnpm lint` (`pnpm format` to fix) |
| Tests | `cd node && uv run pytest` and `cd dashboard && pnpm test` |

## No Pis or sensors

Agents and their drivers currently have **no Raspberry Pis or sensors**; phones are available. Any check that says "unplug the internet" or "over the mesh" is rehearsed on one laptop: two or more Node processes with `NODE_MESH_INTERFACE=loopback`, each with its own `NODE_PORT`, `NODE_LOOPBACK_SLOT` and `NODE_DATA_DIR`, and "no internet" simulated by stopping whatever serves the Cache Pack. A phone on the same Tailscale network can open the dashboard from the laptop's Tailscale address, which covers "renders on a phone". Never report a Pi or sensor check as passed; say it was rehearsed locally and what is still unproven on real devices. The recipe is in `docs/agents/lessons.md`.

## Workflow

Idea → spec → tickets → build → review → merge.

1. **Grill** the idea until it's sharp (`grilling` skill, or `/grill-with-docs` to also update `CONTEXT.md` and ADRs as you go). Opus.
2. **Spec** it: `to-spec` writes `docs/specs/<feature>.md`. Opus.
3. **Slice** it: `to-tickets` writes `docs/tickets/NNNN-<slug>.md` — thin vertical slices, each one demoable. Opus.
4. **Build** one ticket per session: `implement`. Sonnet.
5. **Review** before merge: `code-review` against `main`.
6. **Merge** into `main` yourself and push. No waiting on a teammate.

Tracker rules: `docs/agents/issue-tracker.md`. Claim a ticket before starting it, and say so in the group chat.

Other playbooks: `prototype` (throwaway UI/logic experiments), `diagnosing-bugs` (anything broken or slow), `domain-modeling` (keeps `CONTEXT.md`, the shared glossary), `resolving-merge-conflicts`, `handoff` (context running low), `wait-what` (agent lost you).

**Not using Claude Code?** Every playbook is plain markdown at `.claude/skills/<name>/SKILL.md`. Tell your agent "follow `.claude/skills/implement/SKILL.md` for ticket 0004".

## Code

The repo goes public at submission and judges read it. Write for a teammate seeing the file for the first time at 4 am.

- **Deep modules.** Small interface, real work behind it. `saveTrip(trip)` hides the three API calls; callers never see them. No pass-through wrappers, no one-line "service" classes.
- **Names say what it is.** No `data`, `info`, `handle`, `utils`, `helpers`, `manager`. Use the words in `CONTEXT.md`.
- **No speculative code.** Build what the ticket asks. No config options, plugin points or abstractions for needs nobody has.
- **No dead code.** Delete commented-out blocks, unused exports, `console.log` debugging and placeholder TODOs before merge.
- **Comments explain why, never what.** If code needs a "what" comment, rename things instead.
- **One feature, one place.** Code that changes together lives together (feature folders over layer folders).
- **Match the file you're in.** Same naming, same patterns, same formatting as the surrounding code.
- **Errors are visible.** No empty `catch`. Fail loudly in dev; show the user something sane in the demo.

## Secrets — nothing leaks

- Secrets live only in `.env` (gitignored). Every key you add goes into `.env.example` with a blank value and a one-line comment.
- **Never** put a secret in frontend code. Anything shipped to the browser is public. Proxy paid/secret APIs through the backend.
- Never paste keys into chat logs, specs, tickets, commit messages or screenshots.
- The pre-commit hook (`.githooks/pre-commit`) blocks staged `.env` files and things shaped like keys. If it fires, remove the secret — don't bypass it with `--no-verify`. If a key ever reaches GitHub, rotate it immediately; deleting the commit is not enough.

## Git

- Branch per ticket: `NNNN-<slug>` from an up-to-date `main`.
- Small commits, imperative subject: `add trip search endpoint`.
- Merge into `main` when `code-review` is clean and **Commands** pass, then push. `main` must always be demoable.
- Pull `main` often; merge it into long branches rather than letting them drift.
- Never force-push, `reset --hard`, or delete someone else's branch (Claude Code blocks these via a hook).
- No AI attribution in commits or PRs (no `Co-Authored-By: Claude`, no "Generated with" footers). Commits are authored by whoever is driving; the `commit-msg` hook strips any trailer an agent adds.

## Saving limits

- One ticket per session. Start a fresh session for the next ticket instead of continuing a long one.
- When context runs low, run `handoff` and start fresh from the file it writes.
- Point agents at exact files and tickets; don't ask them to "look around the codebase".
- Big searches go to a subagent so the main session keeps only the answer.
