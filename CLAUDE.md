@AGENTS.md
@docs/agents/lessons.md

## Claude Code specifics

- **Model:** this repo defaults to Sonnet. Switch with `/model opus` for `grilling`/`grill-with-docs`, `to-spec`, `to-tickets` and bugs `diagnosing-bugs` hasn't cracked in one pass; switch back to Sonnet to build.
- **Skills** live in `.claude/skills/`. The ones that write tracker files (`to-spec`, `to-tickets`, `implement`, `handoff`, `grill-me`, `grill-with-docs`, `wait-what`) only run when you type them as `/name`.
- Broad codebase searches → the Explore subagent; keep only its findings in the main session.
- A hook blocks destructive git (force-push, `reset --hard`, `clean -f`, `branch -D`, `checkout .`/`restore .`). Another one turns on the repo's git hooks (secret scan, attribution strip) at session start. Commit attribution is off in settings; don't add trailers by hand.
- **No Pis or sensors:** there is no Pi or sensor hardware to test on, but phones are available (over Tailscale). Rehearse mesh and offline checks with local loopback Node processes (`AGENTS.md` → "No Pis or sensors", recipe in the lessons log), and never report a Pi or sensor check as passed.
- **Lessons log:** `docs/agents/lessons.md` is loaded every session. Read it before building. When you hit something that broke, surprised you or took more than one try, add a short entry in the same commit as the work.
