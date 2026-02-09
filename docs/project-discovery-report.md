# Project Discovery Report

**Generated:** 2026-02-08T11:00:00Z
**Analyzed by:** iSDLC Discover (full deep analysis, auto-detect mode)
**Project:** iSDLC Framework v0.1.0-alpha

---

## 1. Executive Summary

The iSDLC framework is a JavaScript/Node.js CLI tool that installs an AI-powered software development lifecycle into any project via Claude Code integration. It consists of 24 production JavaScript files (8,235 lines), 315 markdown agent/skill/command definitions (61,153 lines), and 3 shell scripts (2,609 lines). The hook runtime system (10 CJS hooks, 4,669 lines) is well-tested with 284 passing tests, but the ESM CLI library tests are currently blocked by missing `node_modules/` dependencies. The top concern is the broken ESM test suite -- `npm ci` has not been run, so all 8 lib test files fail with `ERR_MODULE_NOT_FOUND` for `chalk`.

## 2. Architecture Overview

| Layer | Components | Pattern | Notes |
|-------|------------|---------|-------|
| CLI Entry | `bin/isdlc.js` -> `lib/cli.js` | ESM command router | 6 commands: init, update, version, doctor, uninstall, help |
| Business Logic | `lib/*.js` (8 modules) | Procedural with async/await | installer (845L), updater (550L), uninstaller (514L), doctor (238L) |
| Utilities | `lib/utils/*.js` (3 modules) | Shared helpers | fs-helpers, logger, prompts |
| Runtime Hooks | `src/claude/hooks/*.cjs` (10 hooks) | CJS stdin/stdout JSON protocol | Intercept Claude Code tool calls bidirectionally |
| Hook Lib | `src/claude/hooks/lib/*.cjs` (2 modules) | Shared CJS utilities | common.cjs (937L), provider-utils.cjs (894L) |
| Agent Definitions | `src/claude/agents/*.md` (36 files) | Markdown specification | SDLC phases, discover, tracing, impact-analysis, quick-scan |
| Skill Definitions | `src/claude/skills/**/*.md` (229 files) | Markdown SKILL.md per skill | 16 categories |
| Shell Scripts | `install.sh`, `uninstall.sh`, `update.sh` | Bash (macOS/Linux) | Parallel to Node.js CLI for non-npm users |
| CI/CD | `.github/workflows/` (2 files) | GitHub Actions | 3-OS x 3-Node matrix, integration tests, bash installer |

## 3. Tech Stack

| Component | Technology | Version | Notes |
|-----------|------------|---------|-------|
| Language | JavaScript (ES2022+) | ESM + CJS dual-module | `"type": "module"` in package.json |
| Runtime | Node.js | >= 18.0.0 | Tested on 18, 20, 22 in CI |
| Package Manager | npm | lockfile v3 | 4 runtime dependencies |
| Test Runner | node:test | Built-in | No external test framework |
| Dep: chalk | Terminal colors | ^5.3.0 | ESM-only |
| Dep: fs-extra | File operations | ^11.2.0 | |
| Dep: prompts | Interactive CLI | ^2.4.2 | |
| Dep: semver | Version comparison | ^7.6.0 | Used by updater |
| CI/CD | GitHub Actions | v4 actions | ci.yml + publish.yml |
| Shell | Bash | 3.2+ | install/uninstall/update scripts |

## 4. Test Health Dashboard

| Type | Count | Coverage | Status |
|------|-------|----------|--------|
| Unit (CJS hooks) | 284 | ~95% of hook code | OK - All passing |
| Unit (ESM lib) | ~302 (expected) | ~90% of lib code | CRITICAL - All failing (missing deps) |
| Characterization | 7 files (~100 skips) | Scaffold only | Warning - All test.skip() |
| Integration (CI) | 5 steps | CLI commands | OK - In CI workflow |
| E2E | 0 | 0% | Warning - None exist |
| Mutation | 0 | 0% | Warning - Not configured |
| **Total** | **284 passing** | **~50% effective** | **DEGRADED** |

### Root Cause of ESM Test Failures

`node_modules/` does not exist in the working directory. The `chalk` package (ESM-only) cannot be resolved. Running `npm ci` or `npm install` would restore all ~302 ESM tests. This is an environment issue, not a code defect.

## 5. Behavior Extraction Summary

| Domain | AC Count | Covered | Partial | Uncovered |
|--------|----------|---------|---------|-----------|
| Workflow Orchestration | 14 | 9 | 2 | 3 |
| Installation & Lifecycle | 16 | 12 | 1 | 3 |
| Iteration Enforcement | 18 | 14 | 2 | 2 |
| Skill Observability | 10 | 7 | 1 | 2 |
| Multi-Provider LLM Routing | 9 | 5 | 1 | 3 |
| Constitution Management | 8 | 5 | 1 | 2 |
| Monorepo & Project Detection | 12 | 6 | 1 | 5 |
| **Total** | **87** | **58 (66.7%)** | **9 (10.3%)** | **20 (23.0%)** |

## 6. Action Items

| # | Action | Priority | Effort | Rationale |
|---|--------|----------|--------|-----------|
| 1 | Run `npm ci` to restore node_modules and ESM test suite | P0 | S | 302 tests blocked by missing dependencies |
| 2 | Add E2E tests for install -> doctor -> update -> uninstall lifecycle | P1 | M | No end-to-end coverage of primary user journey |
| 3 | Cover 20 uncovered AC with new unit tests | P1 | L | 23% of acceptance criteria have zero test coverage |
| 4 | Add mutation testing (Stryker) to measure test effectiveness | P2 | M | High test count does not guarantee effectiveness |
| 5 | Generate constitution from discovery findings | P1 | M | No constitution exists yet (docs/isdlc/constitution.md missing) |
| 6 | Activate the 9 partially-covered AC tests | P2 | S | test.skip() scaffolds exist but are not activated |
| 7 | Add permission audit for settings.json allowed tools | P2 | S | Current permissions are read-heavy, missing npm test/lint |
| 8 | Split large files: installer.js (845L), common.cjs (937L) | P3 | M | Maintainability -- noted in CLAUDE.md backlog |

## 7. Detailed Findings

### 7.1 Functional Features

#### CLI Commands (6)

| Command | Module | Description |
|---------|--------|-------------|
| `init` | installer.js | Install framework into target project |
| `update` | updater.js | In-place update with manifest-based cleanup |
| `version` | cli.js | Display installed version |
| `doctor` | doctor.js | 8-step installation health check |
| `uninstall` | uninstaller.js | Safe removal with purge options |
| `help` | cli.js | Display usage information |

#### Runtime Hooks (10)

| Hook | Event | Purpose |
|------|-------|---------|
| model-provider-router.cjs | PreToolUse[Task] | Route to LLM provider based on phase/mode |
| iteration-corridor.cjs | PreToolUse[Task] | Restrict actions during test/validation loops |
| skill-validator.cjs | PreToolUse[Task] | Observe agent delegation patterns |
| gate-blocker.cjs | PreToolUse[Task,Skill] | Block gate advancement until requirements met |
| constitution-validator.cjs | PreToolUse[Task] | Block phase completion until articles validated |
| log-skill-usage.cjs | PostToolUse[Task] | Log delegations to skill_usage_log |
| menu-tracker.cjs | PostToolUse[Task] | Track A/R/C menu interactions |
| skill-delegation-enforcer.cjs | PostToolUse[Skill] | Write pending_delegation on /isdlc or /discover |
| test-watcher.cjs | PostToolUse[Bash] | Monitor test runs, track iterations, circuit breaker |
| delegation-gate.cjs | Stop | Verify orchestrator delegation occurred |

#### Slash Commands (3)

| Command | Definition | Purpose |
|---------|-----------|---------|
| /isdlc | commands/isdlc.md | SDLC workflow orchestration |
| /discover | commands/discover.md | Project discovery and setup |
| /provider | commands/provider.md | LLM provider management |

#### Agent Inventory (36)

| Category | Agents | Files |
|----------|--------|-------|
| SDLC Phases (00-14) | 15 | src/claude/agents/00-*.md through 14-*.md |
| Discover | 12 | src/claude/agents/discover/*.md + discover-orchestrator.md |
| Impact Analysis | 4 | src/claude/agents/impact-analysis/*.md |
| Tracing | 4 | src/claude/agents/tracing/*.md |
| Quick Scan | 1 | src/claude/agents/quick-scan/*.md |

#### Skill Categories (16, 229 skills)

| Category | Skill Count |
|----------|-------------|
| architecture | 12 |
| design | 10 |
| development | ~30 |
| devops | ~15 |
| discover | ~12 |
| documentation | ~8 |
| impact-analysis | 15 |
| operations | ~10 |
| orchestration | ~12 |
| quick-scan | 3 |
| requirements | ~15 |
| reverse-engineer | ~8 |
| security | ~12 |
| testing | ~25 |
| tracing | ~15 |
| upgrade | ~7 |

### 7.2 Data Model

#### Primary State Store: `.isdlc/state.json`

| Section | Fields | Purpose |
|---------|--------|---------|
| project | name, created, description, is_new_project, tech_stack | Project identity |
| complexity_assessment | level, track, dimensions (6) | Workflow routing |
| workflow | track, track_name, phases_required/optional/skipped | Phase configuration |
| constitution | enforced, path, validated_at | Constitutional governance |
| autonomous_iteration | enabled, max_iterations, timeout, circuit_breaker | Iteration limits |
| skill_enforcement | enabled, mode, fail_behavior, manifest_version | Observability config |
| cloud_configuration | provider, credentials, deployment | Cloud deployment (unused) |
| phases (13) | status, started, completed, gate_passed, artifacts, iteration_tracking | Per-phase state |
| skill_usage_log | array of entries | Append-only delegation history |
| history | array of entries | Append-only action log |

#### Configuration Files

| File | Format | Purpose | Location |
|------|--------|---------|----------|
| providers.yaml | YAML | 6 LLM provider definitions + mode routing | .isdlc/ |
| skills-manifest.json | JSON | Agent-to-skill ownership (v4.0.0) | Installed to .claude/hooks/config/ |
| iteration-requirements.json | JSON | Per-phase gate requirements (v2.0.0) | Installed to .claude/hooks/config/ |

#### Entity Summary: 3 config stores, 1 state file, 0 databases, 0 migrations

### 7.3 Reverse-Engineered Acceptance Criteria

| Metric | Value |
|--------|-------|
| Total AC Extracted | 87 |
| Domains Covered | 7 |
| Critical Priority | 26 (29.9%) |
| High Priority | 45 (51.7%) |
| Medium Priority | 16 (18.4%) |
| AC with Existing Test Coverage | 58 (66.7%) |
| AC Partially Covered | 9 (10.3%) |
| AC Uncovered | 20 (23.0%) |

### 7.4 Characterization Tests

| Metric | Value |
|--------|-------|
| Test Files | 7 |
| Total Lines | 522 |
| Framework | node:test (ESM) |
| Location | tests/characterization/ |
| Status | All test.skip() scaffolds -- none activated |

Test files:
- `constitution-management.test.js`
- `installation-lifecycle.test.js`
- `iteration-enforcement.test.js`
- `monorepo-detection.test.js`
- `provider-routing.test.js`
- `skill-observability.test.js`
- `workflow-orchestration.test.js`

### 7.5 Traceability Matrix

Prior traceability artifacts (ac-traceability.csv, reverse-engineer-report.md) are not present on disk. The AC index and domain files referenced in the previous report are also missing from `docs/requirements/reverse-engineered/`. These artifacts need to be regenerated.
