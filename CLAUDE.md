@AGENTS.md

## Claude Code specifics

- **Model:** this repo defaults to Sonnet. Switch with `/model opus` for `grilling`, `to-spec`, `to-tickets` and bugs `diagnosing-bugs` hasn't cracked in one pass; switch back to Sonnet to build.
- **Skills** live in `.claude/skills/`. The ones that write tracker files (`to-spec`, `to-tickets`, `implement`, `handoff`, `grill-me`, `wait-what`) only run when you type them as `/name`.
- Broad codebase searches → the Explore subagent; keep only its findings in the main session.
- A hook blocks destructive git (force-push, `reset --hard`, `clean -f`, `branch -D`, `checkout .`/`restore .`). Another one turns on the repo's git hooks (secret scan, attribution strip) at session start. Commit attribution is off in settings; don't add trailers by hand.
