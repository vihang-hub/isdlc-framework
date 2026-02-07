# Project Discovery Report

**Generated**: 2026-02-07 (updated with full behavior extraction)
**Analyzed by**: iSDLC Discover (full deep analysis)
**Project**: iSDLC Framework v0.1.0-alpha

---

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Language | JavaScript (ES2022+) | ESM (lib/) + CJS (hooks/) |
| Runtime | Node.js | >= 18.0.0 |
| Package Manager | npm | 10.x |
| Dependencies | chalk, fs-extra, prompts, semver | 4 total |
| Module System | Dual: ESM (`"type": "module"`) for CLI, CJS for hooks | v3.0.0 |

**No database, no framework, no build step.** Pure Node.js CLI with runtime hooks.

---

## Architecture

| Aspect | Details |
|--------|---------|
| Pattern | Plugin-based agent framework with symlink installation |
| Entry Point | `bin/isdlc.js` -> `lib/cli.js` (ESM dynamic import) |
| Deployment | npm package (`npx isdlc init`) + shell script (`install.sh`) |
| Installation Model | Copies framework files into target project's `.claude/` and `.isdlc/` |
| Runtime Model | 8 hooks intercept Claude Code tool calls via stdin JSON, process, and respond |
| State Model | JSON files on filesystem (`.isdlc/state.json`) -- no database |
| CI/CD | GitHub Actions (multi-platform matrix: Ubuntu/macOS/Windows x Node 18/20/22) |

### Directory Structure

```
isdlc/
  bin/isdlc.js              # CLI entry point (ESM)
  lib/                       # CLI modules (7 modules, ESM)
    cli.js                   # Command router (233 lines)
    installer.js             # Cross-platform installer (845 lines)
    updater.js               # In-place updater (550 lines)
    uninstaller.js           # Safe uninstaller (514 lines)
    doctor.js                # Health checker (238 lines)
    project-detector.js      # Project type detection (277 lines)
    monorepo-handler.js      # Monorepo detection (247 lines)
    utils/                   # Shared utilities
      fs-helpers.js          # File system operations (250 lines)
      logger.js              # Structured colored output (137 lines)
      prompts.js             # Interactive prompts (110 lines)
  src/claude/
    agents/                  # 36 agent definitions (.md)
    skills/                  # 229 skill definitions (.md)
    hooks/                   # 8 runtime hooks (CJS)
      gate-blocker.js        # Gate advancement blocker (575 lines)
      iteration-corridor.js  # Iteration corridor enforcement (337 lines)
      skill-validator.js     # Skill observability (202 lines)
      log-skill-usage.js     # Skill usage logger (175 lines)
      constitution-validator.js  # Constitutional validation (323 lines)
      menu-tracker.js        # Menu interaction tracker (261 lines)
      test-watcher.js        # Test result watcher (545 lines)
      model-provider-router.js   # Provider router (153 lines)
      lib/common.js          # Shared hook utilities (898 lines)
      lib/provider-utils.js  # Provider routing utilities (894 lines)
      config/                # Skills manifest, iteration requirements
    commands/                # Slash commands
  install.sh                 # Shell-based installer (1,162 lines)
  uninstall.sh               # Shell-based uninstaller (867 lines)
  update.sh                  # Shell-based updater (580 lines)
```

### Integration Points

| Integration | Type | Direction |
|-------------|------|-----------|
| Claude Code | Runtime hooks (PreToolUse/PostToolUse) | Bidirectional |
| npm Registry | Version check, package distribution | Outbound |
| skills.sh | Skill discovery and installation | Outbound |
| Ollama | Local LLM provider (optional) | Outbound |
| OpenRouter | Cloud LLM routing (optional) | Outbound |

---

## Data Model

### Primary Data Store: `.isdlc/state.json`

| Field | Type | Purpose |
|-------|------|---------|
| framework_version | string | Installed version |
| project | object | Name, created, description, is_new_project, discovery_completed |
| complexity_assessment | object | 6-dimension complexity scoring |
| workflow | object | Track type, required/optional/skipped phases |
| constitution | object | Enforced flag, path, validated_at |
| autonomous_iteration | object | Enabled, max_iterations, timeout, circuit_breaker |
| skill_enforcement | object | Mode (observe), fail_behavior, manifest_version |
| cloud_configuration | object | Provider, credentials, deployment config |
| iteration_enforcement | object | Enabled flag |
| skill_usage_log | array | Append-only delegation log |
| phases | object | 13 phases with status, started, completed, gate_passed, artifacts |
| history | array | Append-only action log |

### Configuration Files

| File | Format | Purpose |
|------|--------|---------|
| skills-manifest.json | JSON | Agent-to-skill ownership mapping (v4.0.0) |
| iteration-requirements.json | JSON | Per-phase gate requirements (v2.0.0) |
| providers.yaml | YAML | LLM provider configuration |
| workflows.json | JSON | Workflow type definitions |

### Entity Count: 4 JSON stores, 0 databases, 0 migrations

---

## Functional Features

### By Category

| Category | Count |
|----------|-------|
| CLI Commands | 6 (init, update, version, doctor, uninstall, help) |
| Runtime Hooks | 8 (4 PreToolUse, 4 PostToolUse) |
| Agent Definitions | 36 |
| Skill Definitions | 229 |
| Shell Scripts | 3 (install, uninstall, update) |
| Gate Checklists | 16 |

### 8 Runtime Hooks

| Hook | Type | Purpose |
|------|------|---------|
| gate-blocker | PreToolUse | Blocks gate advancement until 4 requirements met |
| iteration-corridor | PreToolUse | Restricts actions during active test/validation loops |
| skill-validator | PreToolUse | Observes agent delegation patterns (never blocks) |
| constitution-validator | PreToolUse | Blocks phase completion until articles validated |
| model-provider-router | PreToolUse | Routes Task calls to appropriate LLM provider |
| test-watcher | PostToolUse | Monitors test commands, tracks iteration state, circuit breaker |
| log-skill-usage | PostToolUse | Logs all Task delegations to skill_usage_log |
| menu-tracker | PostToolUse | Tracks A/R/C menu interactions for Phase 01 |

### 7 Business Domains

1. **Workflow Orchestration** (14 AC) - CLI routing, phase management, workflow state
2. **Installation & Lifecycle** (16 AC) - Install, update, uninstall, health check
3. **Iteration Enforcement** (18 AC) - Gate blocking, corridors, test watching, menus
4. **Skill Observability** (10 AC) - Agent delegation logging, cross-phase tracking
5. **Multi-Provider LLM Routing** (9 AC) - Provider selection, health checks, fallback
6. **Constitution Management** (8 AC) - Validation loops, article checking, generation
7. **Monorepo & Project Detection** (12 AC) - Workspace detection, CWD resolution, state routing

---

## Test Coverage

| Test Suite | Tests | Framework | Module System |
|------------|-------|-----------|---------------|
| lib/*.test.js + lib/utils/*.test.js | 302 | node:test | ESM |
| src/claude/hooks/tests/*.test.cjs | 253 | node:test | CJS (temp dir isolation) |
| **Total** | **555** | | **All passing** |

### Coverage by Module

| Module | Tests | Status |
|--------|-------|--------|
| cli.js | ~40 | COVERED |
| installer.js | ~35 | COVERED |
| updater.js | ~30 | COVERED |
| uninstaller.js | ~25 | COVERED |
| doctor.js | ~45 | COVERED |
| project-detector.js | ~60 | COVERED |
| monorepo-handler.js | ~50 | COVERED |
| fs-helpers.js | ~30 | COVERED |
| logger.js | ~15 | COVERED |
| prompts.js | ~10 | COVERED |
| gate-blocker.js | ~24 | COVERED |
| iteration-corridor.js | ~20 | COVERED |
| test-watcher.js | ~21 | COVERED |
| skill-validator.js | ~15 | COVERED |
| log-skill-usage.js | ~12 | COVERED |
| constitution-validator.js | ~18 | COVERED |
| menu-tracker.js | ~15 | COVERED |
| model-provider-router.js | ~12 | COVERED |
| provider-utils.js | ~15 | COVERED |
| common.js | ~20 | COVERED |

### Coverage Gaps (Prioritized)

| Gap | Risk | AC Reference |
|-----|------|--------------|
| Workflow override deep merging | High | AC-WO-010 |
| ATDD skipped test detection | Medium | AC-IE-015 |
| Provider fallback chain integration | Medium | AC-PR-003 |
| Last workflow phase detection | High | AC-WO-014 |
| Obsolete file cleanup | Medium | AC-IL-009 |
| Environment override injection | Medium | AC-PR-005 |

---

## Reverse-Engineered Acceptance Criteria

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

### Characterization Tests

| Metric | Value |
|--------|-------|
| Test Files Generated | 7 |
| test.skip() Scaffolds | ~100 |
| Framework | node:test (ESM) |
| Location | tests/characterization/ |

### Artifacts

| Artifact | Location |
|----------|----------|
| AC Index | docs/requirements/reverse-engineered/index.md |
| Domain Files (7) | docs/requirements/reverse-engineered/domain-*.md |
| Characterization Tests (7) | tests/characterization/*.test.js |
| Traceability Matrix | docs/isdlc/ac-traceability.csv |
| Reverse-Engineer Report | docs/isdlc/reverse-engineer-report.md |

---

## Summary

| Area | Key Findings |
|------|-------------|
| Tech Stack | JavaScript ES2022+ (ESM + CJS), Node.js >= 18, 4 deps |
| Architecture | Plugin-based agent framework, symlink installation, JSON state |
| Data Model | 4 JSON config stores, 0 databases |
| Features | 6 CLI commands, 8 hooks, 36 agents, 229 skills |
| Test Coverage | 555 tests (302 ESM + 253 CJS), all passing |
| Domains | 7 business domains mapped |
| AC Extracted | 87 Given/When/Then acceptance criteria |
| Characterization Tests | 7 scaffold files with ~100 test.skip() entries |
