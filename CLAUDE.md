@AGENTS.md
@docs/agents/lessons.md

## Claude Code specifics

- **Model:** this repo defaults to Sonnet. Switch with `/model opus` for `grilling`/`grill-with-docs`, `to-spec`, `to-tickets` and bugs `diagnosing-bugs` hasn't cracked in one pass; switch back to Sonnet to build.
- **Skills** live in `.claude/skills/`. The ones that write files or GitHub issues (`to-spec`, `to-tickets`, `implement`, `handoff`, `grill-me`, `grill-with-docs`, `wait-what`) only run when you type them as `/name`.
- **Before you build:** read the issue (`gh issue view <N>`), the spec it links, and the lessons for the area you touch. One issue per session, in its own worktree, with a draft PR open from the first commit (`/implement` does all of it).
- **Before every push:** `git fetch origin main` and merge it if you are behind; the pre-push hook refuses otherwise. Never push to `main`.
- Broad codebase searches → the Explore subagent; keep only its findings in the main session.
- A hook blocks destructive git (force-push, `reset --hard`, `clean -f`, `branch -D`, `checkout .`/`restore .`). Another one turns on the repo's git hooks (secret scan, attribution strip, pre-push checks) at session start. Commit attribution is off in settings; don't add trailers by hand.
- **No Pis or sensors:** agents have no Pi or sensor hardware to test on (the team has one Pi, not reachable from agents), but phones are available (over Tailscale). Rehearse mesh and offline checks with local loopback Node processes (`AGENTS.md` → "No Pis or sensors", recipe in the lessons log), and never report a Pi or sensor check as passed.
- **Lessons log:** `docs/agents/lessons.md` is loaded every session, so it holds only repo-wide gotchas that are still true. Area lessons sit in `node/`, `dashboard/`, `scripts/` and `pi/` (`AGENTS.md`, pulled in by the folder's `CLAUDE.md`) and load only when a session reads a file there. When you hit something that broke, surprised you or took more than one try, add one or two lines to the file for its area in the same PR as the work, and delete any line your change makes untrue. The hackathon's full log is `docs/agents/lessons-archive.md`; search it, don't load it.
