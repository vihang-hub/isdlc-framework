# Project Discovery Report

**Generated:** 2026-03-27T12:00:00Z
**Analyzed by:** iSDLC Discover (full re-discovery, existing project flow)
**Project:** iSDLC Framework v0.1.0-alpha
**Previous Discovery:** 2026-02-08

---

## 1. Executive Summary

The iSDLC framework is a Node.js CLI and agent orchestration platform that installs an AI-powered software development lifecycle into any project via Claude Code (and Codex) integration. Since the last discovery (2026-02-08), the codebase has grown substantially: from ~24 production JS files to ~130+ production modules across `src/core/`, `src/providers/`, `src/claude/hooks/`, `lib/`, `bin/`, and `src/antigravity/`. Total production code has expanded from ~8,235 lines to ~60,288 lines. Agent definitions grew from 36 to 70, skills from 229 to 276, hooks from 10 to 30. A full `src/core/` provider-neutral layer and dual-provider support (Claude Code + Codex) were added. Test count tripled from ~555 to 1,600 tests across 365 test files. The top concern is 3 failing tests in the lib prompt-format suite related to stale content expectations.

## 2. Architecture Overview

| Layer | Components | Pattern | Notes |
|-------|------------|---------|-------|
| CLI Entry | `bin/isdlc.js` -> `lib/cli.js` | ESM command router | 8 commands: init, update, version, doctor, uninstall, search-setup, setup-knowledge, memory compact |
| CLI Modules | `lib/*.js` (12 prod modules) | Procedural async/await | installer, updater, uninstaller, doctor, project-detector, monorepo-handler, memory, memory-embedder, memory-search, memory-store-adapter, setup-project-knowledge, setup-search |
| CLI Utilities | `lib/utils/*.js` (4 modules) | Shared helpers | fs-helpers, logger, prompts, test-helpers |
| Embedding Pipeline | `lib/embedding/**/*.js` (28 modules) | Multi-engine pipeline | Chunker, engine (CodeBERT/OpenAI/Voyage), aggregation, distribution, redaction, VCS, registry, knowledge, MCP server, package builder |
| Search Subsystem | `lib/search/**/*.js` (12 modules) | Backend-routed search | Lexical, enhanced-lexical, semantic, structural, indexed backends + config, detection, install, ranker, registry, router |
| Core Layer | `src/core/**/*.js` (112 modules) | Provider-neutral ESM | analyze, backlog, bridge, compliance, config, content, discover, installer, memory, observability, orchestration, providers, search, skills, state, tasks, teams, validators, workflow |
| Bridge Layer | `src/core/bridge/*.cjs` (18 modules) | CJS-ESM bridge | Adapters for each core domain callable from CJS hooks |
| Provider: Claude | `src/providers/claude/*.js` (5 modules) | Claude Code adapter | hooks, installer, projection, runtime, index |
| Provider: Codex | `src/providers/codex/*.js` (6 modules) | Codex adapter | governance, installer, projection, runtime, verb-resolver, index |
| Runtime Hooks | `src/claude/hooks/*.cjs` (30 hooks) | CJS stdin/stdout JSON | Intercept Claude Code tool calls, enforce gates, inject context |
| Hook Dispatchers | `src/claude/hooks/dispatchers/*.cjs` (5) | Event routing | post-bash, post-task, post-write-edit, pre-skill, pre-task |
| Hook Lib | `src/claude/hooks/lib/*.cjs` (14 modules) | Shared CJS utilities | common, gate-logic, state-logic, profile-loader, persona-loader, roundtable-config, performance-budget, three-verb-utils, toon-encoder, user-hooks, provider-utils, gate-requirements-injector, blast-radius-step3f-helpers |
| Agent Definitions | `src/claude/agents/**/*.md` (70 files) | Markdown specification | SDLC phases 00-16, discover (24), impact-analysis (5), tracing (4), quick-scan (1), personas (8), roundtable, skill-manager, bug-gather |
| Skill Definitions | `src/claude/skills/**/*.md` (276 files) | SKILL.md per skill | 19 categories |
| Command Definitions | `src/claude/commands/*.md` (4 files) | Markdown command spec | discover, isdlc, provider, tour |
| Antigravity Scripts | `src/antigravity/*.cjs` (14 files) | CJS workflow scripts | analyze-finalize, analyze-item, analyze-sizing, antigravity-bridge, change-summary-generator, mode-selection, phase-advance, prime-session, validate-gate, validate-state, workflow-finalize, workflow-init, workflow-retry, workflow-rollback |
| Dashboard | `src/dashboard/` (2 files) | HTML + Express | Real-time workflow progress UI |
| Packages | `packages/bulk-fs-mcp/` (8 prod files) | MCP server | Bulk file operations with section parsing and file locking |
| Shell Scripts | `install.sh`, `uninstall.sh`, `update.sh` | Bash (macOS/Linux) | Parallel to Node.js CLI for non-npm users |
| PowerShell Scripts | `install.ps1`, `uninstall.ps1`, `update.ps1` | PowerShell (Windows) | Windows-native installer |
| CI/CD | `.github/workflows/` (2 files) | GitHub Actions | 3-OS x 3-Node matrix (20, 22, 24), integration tests, bash + PowerShell installer validation |

## 3. Tech Stack

| Component | Technology | Version | Notes |
|-----------|------------|---------|-------|
| Language | JavaScript (ESM + CJS) | ES2022+ | Dual module system: ESM for core/lib, CJS for hooks |
| Runtime | Node.js | 20/22/24 | CI tests all three; local dev on v24.10.0 |
| Test Runner | `node --test` | Built-in | No external test framework; native Node.js test runner |
| Assertion | `node:assert` | Built-in | strict mode |
| Dependencies | chalk ^5.3.0, fs-extra ^11.2.0, js-yaml ^4.1.1, onnxruntime-node ^1.24.3, prompts ^2.4.2, semver ^7.6.0 | Production | Minimal dependency footprint (6 packages) |
| Dev Dependencies | None | -- | Zero devDependencies |
| Package Manager | npm | -- | package-lock.json present |
| VCS | Git + GitHub | -- | Main branch, feature branches per workflow |
| CI/CD | GitHub Actions | v4 | ci.yml (lint + test matrix + integration + bash/PowerShell install), publish.yml |
| MCP Servers | code-index-mcp, bulk-fs-mcp | -- | Code search and bulk file ops |
| Embedding Engine | CodeBERT (ONNX) | codebert-base | Local offline embeddings for semantic search |
| State Management | JSON files on filesystem | -- | .isdlc/state.json (main), .isdlc/config.json, .isdlc/roundtable.yaml |
| Configuration | JSON + YAML | -- | skills-manifest.yaml, iteration-requirements.json, phase-topology.json, profiles/*.json, contracts/*.contract.json |

## 4. Test Health Dashboard

| Type | Count | Files | Status |
|------|-------|-------|--------|
| Unit (lib/) | ~600 | 59 | OK |
| Unit (hooks) | ~600 | 171 | OK |
| Unit (core) | ~250 | 89 | OK |
| Unit (providers) | ~100 | 19 | OK |
| Prompt verification | ~30 | 9 | Warning (3 fail) |
| Integration (hooks) | ~10 | 2 | OK |
| E2E | ~10 | 2 | OK |
| Verification/Parity | ~50 | 8 | OK |
| Packages | ~50 | 8 | OK |
| **Total** | **1600** | **365** | **1597 pass / 3 fail** |

**Failing tests (3):**
1. `T46: SUGGESTED PROMPTS content preserved` -- lib/prompt-format.test.js (stale content expectation)
2. `TC-028: README system requirements shows "Node.js 20+"` -- lib/prompt-format.test.js (content mismatch)
3. `TC-09-03: CLAUDE.md contains Fallback with "Start a new workflow"` -- lib/prompt-format.test.js (missing content)

**Test runner:** Node.js built-in `node --test` (no external test framework)

**Test scripts:**
- `npm test` -- lib/ unit tests
- `npm run test:hooks` -- hook CJS tests
- `npm run test:core` -- src/core/ tests
- `npm run test:providers` -- provider adapter tests
- `npm run test:e2e` -- CLI end-to-end tests
- `npm run test:all` -- all suites combined

**Coverage estimate:** No formal coverage tool (no nyc/c8/istanbul configured). Based on file analysis:
- Core modules: ~85% (all major modules have corresponding test files)
- Hooks: ~90% (171 test files for 30 hooks + 14 lib modules)
- Lib: ~80% (59 test files for 12 prod + 4 util + 28 embedding + 12 search modules)
- Providers: ~85% (19 test files for 11 provider modules)
- Critical paths (installer, updater, hook enforcement): ~95%
- Agent/skill markdown: Not unit-testable (behavioral specs, validated by prompt verification tests)

## 5. Behavior Extraction Summary

| Domain | AC Count | Description |
|--------|----------|-------------|
| 01: Workflow Orchestration | 15 | Phase transitions, gate validation, workflow init/finalize |
| 02: Installation Lifecycle | 12 | Install, update, uninstall, doctor, monorepo detection |
| 03: Iteration Enforcement | 10 | Iteration corridors, circuit breakers, test watcher |
| 04: Skill Observability | 8 | Skill logging, manifest management, injection planning |
| 05: Provider Routing | 10 | Dual-provider (Claude/Codex), model selection, runtime |
| 06: Constitution Management | 8 | Validation, article enforcement, constitutional checks |
| 07: Monorepo Detection | 5 | Project detection, path resolution, state scoping |
| 08: Agent Orchestration | 19 | Roundtable, debate teams, impact analysis, tracing |
| **Total** | **87** | Across 8 domains (from previous extraction) |

**Note:** These AC were extracted during the original discovery (2026-02-07). The codebase has grown significantly since then. New domains that should be extracted include:
- Core orchestration (phase-loop, fan-out, dual-track, instruction-generator)
- Content model (agent/skill/command/topic classification)
- Search subsystem (backends, routing, config)
- Embedding pipeline (chunking, engines, aggregation, distribution)
- Backlog management (ops, item resolution, slug, source detection)
- Compliance engine (contract evaluation, enforcement, extractors)
- State management (schema, validation, paths, monorepo)
- Teams (specs, instances, registry, implementation loop)
- Validators (gate logic, checkpoint router, traceability, coverage presence)

**Estimated additional AC if re-extracted:** 120-150 additional AC across 9+ new domains, bringing total to ~220+ AC.

## 6. Action Items

| # | Action | Priority | Effort | Rationale |
|---|--------|----------|--------|-----------|
| 1 | Fix 3 failing prompt-format tests | P0 | S | Tests reference stale content in CLAUDE.md / README; quick fix |
| 2 | Re-extract AC for new domains (core, search, embedding, teams, validators) | P1 | L | 9+ new domains lack behavior specs; needed for test coverage targeting |
| 3 | Add code coverage tooling (c8 or node --test --experimental-test-coverage) | P1 | M | No formal coverage metrics; can't validate constitution thresholds |
| 4 | Create characterization tests for new core modules | P1 | L | src/core/ has 112 modules; test scaffolds would identify gaps |
| 5 | Update constitution baseline (555 -> 1600 tests) | P1 | S | Article II baseline is stale; should reflect current 1600 test count |
| 6 | Add linter (ESLint) | P2 | M | `npm run lint` echoes "No linter configured"; CI lint job is a no-op |
| 7 | Reduce hook test file size (77K lines across 171 files) | P2 | L | Hook tests are 2.5x larger than production code; refactor shared helpers |
| 8 | Add integration tests for embedding pipeline | P2 | M | 28 modules with unit tests but no integration validation |
| 9 | Add E2E tests for workflow lifecycle | P2 | M | Only 2 E2E tests (CLI lifecycle, status command); workflow flows untested |
| 10 | Document API surface for src/core/ modules | P3 | M | 112 modules with JSDoc but no centralized API docs |

## 7. Detailed Findings

### 7.1 Functional Features

**Workflows (4 types):**

| Workflow | Phases | Description |
|----------|--------|-------------|
| Feature | 00-quick-scan -> 01-requirements -> 02-impact-analysis -> 03-architecture -> 04-design -> 05-test-strategy -> 06-implementation -> 16-quality-loop -> 08-code-review | Full SDLC for new features |
| Fix | 01-requirements -> 02-tracing -> 05-test-strategy -> 06-implementation -> 16-quality-loop -> 08-code-review | Bug fix with tracing |
| Upgrade | 01-requirements -> 02-impact-analysis -> 05-test-strategy -> 06-implementation -> 16-quality-loop -> 08-code-review | Dependency/runtime upgrades |
| Test | 05-test-strategy -> 06-implementation -> 16-quality-loop | Test generation only |

**CLI Commands (8):**
init, update, version, doctor, uninstall, search-setup, setup-knowledge, memory compact

**Slash Commands (4):**
/discover, /isdlc, /provider, /tour

**SDLC Phases (17):**
00-quick-scan, 01-requirements, 02-impact-analysis, 03-architecture, 04-design, 05-test-strategy, 06-implementation, 07-qa, 08-code-review, 09-cicd, 10-environment, 11-staging, 12-release, 13-sre, 14-upgrade, 16-quality-loop

**Agent Types:**

| Category | Count | Examples |
|----------|-------|---------|
| Phase agents | 22 | 00-sdlc-orchestrator, 01-requirements-analyst, 05-software-developer |
| Debate agents | 6 | 01-requirements-critic, 02-architecture-refiner, 04-test-strategy-critic |
| Discover agents | 24 | architecture-analyzer, feature-mapper, constitution-generator |
| Impact analysis | 5 | impact-analysis-orchestrator, entry-point-finder, risk-assessor |
| Tracing agents | 4 | tracing-orchestrator, symptom-analyzer, root-cause-identifier |
| Persona agents | 8 | persona-business-analyst, persona-solutions-architect |
| Other | 3 | roundtable-analyst, skill-manager, bug-gather-analyst |

**Skill Categories (19):**

| Category | Count | Primary Agent |
|----------|-------|---------------|
| discover | 40 | discover-orchestrator, architecture-analyzer, feature-mapper |
| analysis-steps | 24 | roundtable-analyst |
| reverse-engineer | 21 | feature-mapper |
| testing | 17 | test-evaluator, test-design-engineer |
| devops | 16 | cicd-engineer, deployment-engineer |
| impact-analysis | 16 | impact-analysis-orchestrator |
| orchestration | 16 | sdlc-orchestrator |
| tracing | 16 | tracing-orchestrator |
| development | 15 | software-developer |
| security | 13 | security-compliance-auditor |
| architecture | 12 | solution-architect |
| operations | 12 | site-reliability-engineer |
| quality-loop | 12 | quality-loop-engineer |
| requirements | 11 | requirements-analyst |
| design | 10 | system-designer |
| documentation | 10 | -- |
| analysis-topics | 6 | roundtable-analyst |
| upgrade | 6 | upgrade-engineer |
| quick-scan | 3 | quick-scan-agent |

### 7.2 Data Model

**Primary State Store:** `.isdlc/state.json` (filesystem JSON)
- Active workflow tracking (type, phases, current phase, gates)
- Phase iteration state (attempts, results, hook blocks)
- Constitutional validation records
- Skill usage log
- Discovery context (audit metadata)
- Agent modifiers and workflow flags

**Configuration Stores:**

| Store | Format | Purpose |
|-------|--------|---------|
| .isdlc/state.json | JSON | Runtime state |
| .isdlc/config.json | JSON | Cache budget, default tier |
| .isdlc/roundtable.yaml | YAML | Roundtable verbosity, personas |
| .isdlc/search-config.json | JSON | Search backend config |
| .isdlc/knowledge-manifest.json | JSON | Embedded knowledge manifest |
| .isdlc/state-archive.json | JSON | Archived workflow states |
| .isdlc/hooks/hook-template.yaml | YAML | User hook template |
| src/claude/hooks/config/iteration-requirements.json | JSON | Iteration limits per phase |
| src/claude/hooks/config/phase-topology.json | JSON | Phase ordering and transitions |
| src/claude/hooks/config/skills-manifest.json | JSON | Skill-to-agent bindings |
| src/claude/hooks/config/skills-manifest.yaml | YAML | Skill manifest (YAML source) |
| src/claude/hooks/config/profiles/*.json | JSON | Gate profiles (rapid/standard/strict) |
| src/claude/hooks/config/contracts/*.contract.json | JSON | Workflow contracts |
| src/claude/hooks/config/schemas/*.schema.json | JSON | State field schemas |
| src/claude/hooks/config/provider-defaults.yaml | YAML | Provider model defaults |
| src/claude/config/tech-stack-skill-mapping.yaml | YAML | Stack-to-skill lookup |
| .mcp.json | JSON | MCP server configuration |
| .claude/settings.json | JSON | Claude Code permissions |

**Embedding Store:**
- `.isdlc/embeddings/isdlc-framework-1.0.0.emb` -- 50MB CodeBERT embedding file
- `.isdlc/models/codebert-base/` -- Local ONNX model

**No database.** All persistence is file-based. No migrations. State schema validated by `src/core/state/validation.js` and `state-write-validator.cjs` hook.

### 7.3 Architecture Patterns

**Dual Module System (ESM + CJS):**
- ESM: `src/core/`, `lib/`, `bin/`, `src/providers/` -- main application code
- CJS: `src/claude/hooks/`, `src/antigravity/`, `src/core/bridge/` -- Claude Code hook protocol requires CJS
- Bridge pattern: `src/core/bridge/*.cjs` wraps ESM core modules for CJS consumers via dynamic `import()`

**Provider Abstraction:**
- Provider-neutral core: `src/core/` -- all business logic
- Provider-specific adapters: `src/providers/claude/`, `src/providers/codex/`
- Runtime routing: `src/core/providers/routing.js` selects provider at runtime

**Hook Architecture (30 hooks):**
- PreToolUse hooks: intercept before tool execution (branch-guard, delegation-gate, phase-sequence-guard, state-file-guard, explore-readonly-enforcer)
- PostToolUse hooks: intercept after tool execution (test-watcher, phase-loop-controller, state-write-validator)
- Stop hooks: intercept at conversation end (inject-session-cache, workflow-completion-enforcer)
- Notification hooks: observe without blocking (log-skill-usage, menu-tracker, walkthrough-tracker)
- Dispatchers: route events to multiple handlers (5 dispatchers)

**Team Patterns:**
- Debate teams: Creator -> Critic -> Refiner (requirements, architecture, design, test strategy)
- Fan-out teams: Parallel analysis agents (impact analysis, discover)
- Dual-track teams: Implementation + review loop (quality loop)
- Implementation-review loop: Writer -> Reviewer -> Updater per file

**Contract Enforcement:**
- Workflow contracts (`.contract.json`) define required phases, artifacts, gates
- Contract evaluator validates compliance at gate boundaries
- Profile loader selects enforcement intensity (rapid/standard/strict)

### 7.4 Integration Points

| Integration | Type | Protocol | Notes |
|-------------|------|----------|-------|
| Claude Code | External | Task tool, hooks (stdin/stdout JSON) | Primary provider |
| Codex | External | codex exec, AGENTS.md projection | Secondary provider |
| GitHub | External | gh CLI, GitHub Actions | CI/CD, issue tracking |
| Gitea | External | git remote | Mirror repository |
| code-index-mcp | MCP Server | MCP protocol | Code search and indexing |
| bulk-fs-mcp | MCP Server (local) | MCP protocol | Bulk file operations with locking |
| CodeBERT ONNX | Local | onnxruntime-node | Offline code embeddings |

### 7.5 Conventions and Patterns

**File Naming:**
- Phase agents: `{NN}-{role}.md` (e.g., `05-software-developer.md`)
- Hooks: `{kebab-case}.cjs` (e.g., `gate-blocker.cjs`)
- Core modules: `{kebab-case}.js` (e.g., `phase-loop.js`)
- Tests: `{module-name}.test.{js|cjs}` (mirror source structure)
- Skills: `{skill-name}/SKILL.md` (directory per skill)
- Contracts: `{workflow-type}.contract.json`

**Error Handling:**
- Hooks: fail-open (log warning, allow operation) unless security-critical
- Gates: fail-closed (block phase advance until criteria met)
- State writes: validated against JSON schemas before persistence
- Agent failures: retry once, then surface to user

**State Management:**
- Single source of truth: `.isdlc/state.json`
- Schema-validated writes via `state-write-validator.cjs`
- Archive on workflow completion to `state-archive.json`
- No optimistic locking (sequential agent access assumed)

**Constitutional Compliance:**
- 14 articles (11 universal + 3 domain-specific)
- Validated by `constitution-validator.cjs` hook
- Article-specific checks in `src/core/validators/constitutional-checks/`
- Gate blocker enforces constitutional validation before phase advance

### 7.6 Production Code Summary

| Area | Files | Lines | Description |
|------|-------|-------|-------------|
| src/core/ | 112 | 16,714 | Provider-neutral business logic |
| src/claude/hooks/ | 49 | 19,866 | Runtime enforcement (30 hooks + 14 lib + 5 dispatchers) |
| lib/ | 56 | 16,375 | CLI modules, embedding, search |
| src/antigravity/ | 14 | 3,197 | Workflow automation scripts |
| src/providers/ | 11 | 2,551 | Claude + Codex adapters |
| bin/ | 5 | 872 | CLI entry points |
| packages/ | 8 | 713 | bulk-fs-mcp |
| **Total prod JS** | **255** | **60,288** | |
| Agent markdown | 70 | ~35,000 | Agent specifications |
| Skill markdown | 276 | ~25,000 | Skill definitions |
| Command markdown | 4 | ~8,000 | Command handlers |
| **Total content** | 350 | ~68,000 | |

### 7.7 Test Code Summary

| Area | Test Files | Test Lines | Subjects |
|------|-----------|------------|----------|
| src/claude/hooks/tests/ | 171 | 77,524 | Hook logic, dispatchers, config |
| tests/ | 127 | 28,200 | Core, providers, e2e, verification, prompt |
| lib/*.test.js | 59 | 25,745 | CLI, embedding, search, utils |
| packages/*.test.js | 8 | 1,642 | bulk-fs-mcp |
| **Total test** | **365** | **133,111** | 1,600 test cases |

**Test-to-code ratio:** 133,111 test lines / 60,288 prod lines = **2.21:1**
