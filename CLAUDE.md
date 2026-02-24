# CLAUDE.md

## What This Is

iSDLC — invisible AI-powered SDLC framework for Claude Code. Orchestrates 64 agents, 273 skills, and 28 hooks to manage development workflows (feature, fix, test, upgrade) from requirements through code review.

**Package:** `@enactor/isdlc` (v0.1.0-alpha) · **Registry:** `npm.enactor.co.uk`

## Commands

```bash
npm test                # lib/*.test.js + lib/utils/*.test.js
npm run test:hooks      # src/claude/hooks/tests/*.test.cjs (19 files)
npm run test:all        # All tests (used by CI)
node --test src/claude/hooks/tests/gate-requirements-injector.test.cjs  # single file
```

Note: `test:char` and `test:e2e` are defined in package.json but test files don't exist yet. Only `src/claude/hooks/tests/` has actual tests.

## Architecture

**Three-tier system:**
1. **Intent detection** (`src/claude/CLAUDE.md.template`) — NL intent classification triggers workflows
2. **Workflow coordination** (agents + orchestrators) — phase sequences in `src/isdlc/config/workflows.json`
3. **Deterministic enforcement** (hooks) — 28 CJS hooks intercept tool calls via `PreToolUse`/`PostToolUse`

**Key paths:**
- `bin/isdlc.js` → `lib/cli.js` — CLI entry
- `lib/` — CLI modules: installer, updater, doctor, uninstaller, monorepo-handler, project-detector
- `src/claude/agents/` — 40+ agent definitions (markdown). 1-to-1 agent-phase mapping
- `src/claude/hooks/` — 28 CJS hooks + dispatchers + config. All fail-open
- `src/claude/skills/` — 273 skills across 20 categories
- `src/isdlc/config/workflows.json` — workflow phase sequences (feature, fix, test-generate, upgrade)

**Critical hooks:** `gate-blocker.cjs` (phase gate), `iteration-corridor.cjs` (test/const confinement), `test-watcher.cjs` (10 iter max, 80% coverage), `delegation-gate.cjs` (agent-phase validation)

## CI/CD

- **Jenkinsfile** — manual trigger: tag param → checkout → `npm ci` → `npm run test:all` → version validation → publish to `npm.enactor.co.uk` → Gitea release. Uses `jenkins.builduser` (AD service account, not personal creds).
- **`.github/workflows/ci.yml`** — lint + multi-platform tests (Ubuntu/macOS/Windows, Node 20/22/24)

## Current Working Decisions

- **Do NOT run `npm test`** — tests are disabled until CI failures from the release pipeline are resolved (see `root-cause-report-build2.md`)
- **Do NOT touch the `main` branch** — all work happens on the `EDIAPT-482` branch

## Conventions

- ESM (`"type": "module"`) for lib/bin; CJS (`.cjs`) for hooks
- Agent files: markdown with MODE ENFORCEMENT, CORE MISSION, PHASE ENTRY sections
- `CLAUDE.md.template` in `src/claude/` is what gets installed into user projects — not this file

### Single-Line Bash Convention

All fenced Bash/sh code blocks in agent and command markdown files MUST contain only a single command line (one non-empty line). Claude Code's permission auto-allow rules use `*` glob patterns (e.g., `Bash(npm *)`) which do not match newlines -- multiline commands bypass these rules and trigger interactive permission prompts.

**Transformation patterns:**

| Multiline Pattern | Single-Line Equivalent |
|-------------------|----------------------|
| for-loop (`for f in ...; do ... done`) | `find ... \| xargs ...` on one line |
| Newline-separated commands | `command1 && command2 && command3` |
| Comments interleaved with commands | Move comments to markdown prose above the code block |
| Pipe chains split across lines | Join into a single `cmd1 \| cmd2 \| cmd3` line |
| Multiline `node -e "..."` | `node -e "compact single-line JS"` or extract to `bin/script.js` |

**Escape hatch:** If a command cannot be reasonably expressed as a single line, extract it to a script file in `bin/` and call it with `node bin/script-name.js` or `bash bin/script-name.sh`. The single-line call matches permission glob patterns.

Agent files reference this convention with:
> See **Single-Line Bash Convention** in CLAUDE.md.
