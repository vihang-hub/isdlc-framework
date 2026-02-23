# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

iSDLC is an invisible AI-powered SDLC framework for Claude Code. It orchestrates 64 agents, 273 skills, and 28 hooks to manage development workflows (feature, fix, test, upgrade) from requirements through code review. Users interact through natural conversation; the framework detects intent and runs the right workflow automatically.

**Package:** `@enactor/isdlc` (v0.1.0-alpha)
**Registry:** Gitea NPM at `https://dev.enactor.co.uk/gitea/api/packages/DevOpsInfra/npm/`

## Commands

```bash
# Tests (Node.js built-in test runner)
npm test                    # lib/*.test.js + lib/utils/*.test.js
npm run test:hooks          # src/claude/hooks/tests/*.test.cjs (19 test files)
npm run test:char           # tests/characterization/*.test.js
npm run test:e2e            # tests/e2e/*.test.js
npm run test:all            # All of the above (used by CI)

# Run a single test file
node --test src/claude/hooks/tests/gate-requirements-injector.test.cjs

# Lint (placeholder — no linter configured yet)
npm run lint
```

Note: `lib/*.test.js`, `tests/characterization/`, and `tests/e2e/` test scripts are defined in package.json but test files don't exist yet. Only `src/claude/hooks/tests/*.test.cjs` has actual tests.

## Architecture

### Three-tier system

1. **Intent detection** (`src/claude/CLAUDE.md.template`) — natural language intent classification triggers workflows without slash commands
2. **Workflow coordination** (agents + orchestrators) — fixed phase sequences defined in `src/isdlc/config/workflows.json`, enforced by 5 orchestrators
3. **Deterministic enforcement** (hooks as separate Node.js processes) — 28 hooks intercept Claude Code tool calls via `PreToolUse`/`PostToolUse` events, outside the LLM conversation

### Key directories

- **`bin/isdlc.js`** — CLI entry point, shim to `lib/cli.js`
- **`lib/`** — Node.js CLI: `cli.js` (command router), `installer.js`, `updater.js`, `doctor.js`, `uninstaller.js`, `monorepo-handler.js`, `project-detector.js`
- **`src/claude/agents/`** — 40+ agent definitions as markdown. 1-to-1 agent-phase mapping. Multi-agent debate teams (Creator/Critic/Refiner) for creative phases, Writer/Reviewer/Updater for implementation
- **`src/claude/commands/`** — 4 slash commands: `isdlc.md` (main, 122KB), `discover.md`, `provider.md`, `tour.md`
- **`src/claude/skills/`** — 273 skills across 20 categories (requirements, architecture, testing, security, discover, tracing, etc.)
- **`src/claude/hooks/`** — 28 CJS hooks + dispatchers + config. All hooks are fail-open
- **`src/isdlc/config/`** — `workflows.json` (phase sequences), checklists, templates
- **`install.sh` / `install.ps1`** — Cross-platform installer scripts that copy framework into user projects

### Hooks architecture

Hooks live in `src/claude/hooks/` as `.cjs` files. They are registered in `src/claude/settings.json` and routed through dispatchers in `src/claude/hooks/dispatchers/` (pre-task, post-task, pre-skill, pre-bash, etc.).

Critical hooks:
- **`gate-blocker.cjs`** — blocks phase advancement unless iteration/artifact/constitutional requirements met
- **`iteration-corridor.cjs`** — confines agent to TEST/CONST corridors when tests failing
- **`test-watcher.cjs`** — 10 iteration max, 80% coverage minimum, circuit breaker at 3 identical failures
- **`delegation-gate.cjs`** — validates correct agent-to-phase mapping, parallel session safety

Hook config in `src/claude/hooks/config/`:
- `iteration-requirements.json` — per-phase validation rules
- `artifact-paths.json` — single source of truth for phase artifact locations
- `schemas/` — JSON schemas for hook data structures

### Workflow definitions

`src/isdlc/config/workflows.json` defines fixed phase sequences:
- **feature:** quick-scan → requirements → impact-analysis → architecture → design → test-strategy → implementation → quality-loop → code-review
- **fix:** requirements → tracing → test-strategy → implementation → quality-loop → code-review
- **test-generate / test-run:** scoped to testing phases only
- **upgrade:** scoped to upgrade + quality validation

### State management

When installed into a user project, `.isdlc/state.json` persists workflow progress, phase counters, iteration tracking, and active agent across Claude Code sessions. The framework resumes at the exact phase where the user left off.

## CI/CD

- **Jenkinsfile** — Gitea-triggered: tag push (`v*`) → checkout → `npm ci` → `npm run test:all` → version validation → publish to Gitea NPM → create Gitea release. Uses `@Library('Pipeline-Helper@trunk')`, agent `linux && release`, `NodeJS-22`
- **`.github/workflows/ci.yml`** — GitHub Actions: lint + multi-platform tests (Ubuntu/macOS/Windows, Node 20/22/24)
- **`.github/workflows/publish.yml`** — GitHub Actions: publish to npmjs.com + GitHub Packages on release

## ES Modules

The package uses `"type": "module"` — all `lib/` and `bin/` files use ESM imports. Hooks are CJS (`.cjs`) because Claude Code hooks run as separate Node.js processes and CJS is simpler for that context.

## Conventions

- Agent files are markdown with structured sections: MODE ENFORCEMENT, CORE MISSION, PHASE ENTRY, SUGGESTED NEXT STEPS, CONSTITUTIONAL PRINCIPLES
- Skill files are markdown with `/Skill` headers for Claude Code integration
- Hook filenames match their purpose: `gate-blocker.cjs`, `test-watcher.cjs`, `iteration-corridor.cjs`
- Workflows are sized adaptively: light (< 5 files), standard, epic (> 20 files)
- The `CLAUDE.md.template` in `src/claude/` is what gets installed into user projects — it is NOT the same as this file
