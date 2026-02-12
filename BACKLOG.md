# iSDLC Framework - Backlog

> Moved from CLAUDE.md to reduce system prompt context size.
> This file is NOT loaded into every conversation — reference it explicitly when needed.

## Open

### Spec-Kit Learnings (from framework comparison 2026-02-11)

- [x] Enhanced plan-to-tasks pipeline (REQ-0009 — DONE)
  - [x] File-level task granularity — after design phase, decompose tasks.md into specific files/functions to create/modify (not just "write failing tests")
  - [x] User-story traceability in tasks — tag every task back to a requirement (REQ-001, AC-003), not just group by phase
  - [x] Explicit dependency graph — mark which tasks block which others, not just [P] for parallel
  - [x] Dedicated task refinement step — between design and implementation, a pass that converts high-level design into file-level implementation tasks (enhance ORCH-012)
  - [x] Mechanical execution mode — option for implementation agent to follow tasks literally rather than self-decomposing
- [ ] Spike/explore workflow — parallel implementation branches from a single spec for tech stack comparison or architecture exploration (Spec-Kit's "Creative Exploration")
- [ ] `/isdlc validate` command — on-demand artifact quality check (constitutional + completeness) without running a full workflow (Spec-Kit's `/speckit.checklist` + `/speckit.analyze`)
- [ ] Progressive disclosure / lite mode — expose only constitution → requirements → implement → quality loop for simple projects, full lifecycle opt-in
- [ ] Research agents for greenfield — dedicated pre-architecture research step (library compatibility, benchmarks, security implications, org standards) before planning begins

### Bugs Found During REQ-0009 Workflow (2026-02-11)

- [ ] BUG: Redundant state tracking causes stale fields and hook blocks
  - `state.json` has 3 places tracking phase status: `active_workflow.phase_status`, top-level `current_phase`/`active_agent`, top-level `phases{}`
  - Phase-loop controller (isdlc.md STEP 3e) only updates `active_workflow.*` — top-level fields go stale
  - Hooks (phase-sequence-guard, delegation-gate) read top-level fields → false blocks
  - `tasks.md` never updated after plan generation — phases complete but tasks stay unchecked, giving false "PENDING" status
  - Fix: consolidate to `active_workflow.*` as single source of truth; update hooks to read from there; eliminate redundant top-level fields
  - Fix: phase-loop controller STEP 3e should also mark completed tasks as `[X]` in `tasks.md` and update the Progress Summary table
- [ ] BUG: Phase-loop controller delegates before marking state as in_progress
  - isdlc.md STEP 3d fires Task tool before STEP 3a sets `phases[key].status = "in_progress"` in top-level `phases{}`
  - Hook correctly blocks ("phase task has not been marked as in_progress") but agent may have already completed
  - Fix: set `phases[key].status = "in_progress"` and top-level `current_phase`/`active_agent` BEFORE Task delegation in STEP 3d
- [ ] BUG: Test watcher circuit breaker trips on unparseable output (false positives)
  - test-watcher records "FAILED" with 0 failures and "Unable to determine test result" when it can't parse output (e.g. `npm run test:char`, `npm run test:e2e` which don't exist)
  - Circuit breaker trips after 3 "identical" non-failures
  - Fix: classify unparseable output as `"inconclusive"` (not "FAILED"), don't increment `identical_failure_count` for inconclusive results

**Framework Features:**
- [ ] T4: Test execution parallelism
  - T4-A: Parallel test creation — test design agent assesses workload, spawns parallel sub-agents for large codebases
  - T4-B: Parallel local test execution — detect framework, apply parallel flags (Jest --workers, pytest -n auto, etc.)
- [ ] Improve search capabilities to help Claude be more effective
- [ ] Implementation learning capture: if bug fixes were identified during implementation or iteration loops > 1, create a learning for subsequent implementation
- [ ] Add /isdlc refactor command and workflow — pre-requisite: 100% automated E2E testing
- [ ] Separate commands to manage deployments and operations
- [ ] State.json pruning at workflow completion — actively prune stale/transient fields from state.json at the end of every feature or fix workflow
  - After finalize phase, remove accumulated runtime data: iteration logs, hook activity traces, intermediate phase artifacts, resolved escalations
  - Keep only durable state: workflow history summary, project-level config, skill usage stats
  - Prevents state.json from growing unbounded across workflows and avoids stale data bleeding into subsequent runs
  - Audit and restructure state.json schema for human readability — ensure the structure is well-organized, logically grouped, and understandable when inspected manually (not just machine-consumed)
- [ ] Blast radius coverage validation — enforce that implementation actually covers the affected files identified during Impact Analysis (Phase 02)
  - **Problem**: Impact analysis produces a detailed `impact-analysis.md` with affected files, risk scores, and entry points, but it's purely informational. No downstream agent, gate, or hook validates that implementation touched those files. A developer can implement a subset of affected files and pass all gates if test coverage thresholds are met.
  - **Validation mechanism**: Pre-gate hook or gate check at GATE-05 (implementation) that cross-references affected files from `impact-analysis.md` against `git diff` of the implementation branch
  - **Artifact**: Generate a `blast-radius-coverage.md` checklist — each affected file marked as covered/skipped with justification for skips
  - **Agent update**: Implementation agent (Phase 06) should read `impact-analysis.md` and confirm all affected files are addressed in its implementation plan
  - **Gate update**: Add to GATE-05: "All files from blast radius addressed or explicitly deferred with rationale"
- [ ] Adaptive workflow sizing — framework auto-sizes features after Impact Analysis (Phase 02)
  - **Problem**: The framework runs the same heavyweight process for all features regardless of size. Architecture + Design produce 16+ artifacts (~1-2 hours) even for trivial changes. Conversely, massive features get crammed into a single implementation phase with no decomposition.
  - **Sizing decision point**: After Impact Analysis (Phase 02) completes — this is where the framework has real data (affected files, entry points, risk assessment, blast radius) to make an informed recommendation. Quick Scan (Phase 00) is too rough.
  - **Three workflow intensities**:
    - **`-light`** (small scope, ~1-5 files, low risk): Skip Phase 03 (Architecture) and Phase 04 (Design) — jump from Impact Analysis straight to Test Strategy. User can force with `/isdlc feature -light`.
    - **standard** (medium scope, ~6-20 files): Current full workflow, no changes.
    - **epic** (large scope, 20+ files or high risk): Decompose into sub-features, each getting its own mini-cycle (requirements → design → implement → test), with integration testing across all sub-features at the end.
  - **UX**: After Impact Analysis, present sizing recommendation with rationale:
    > "Impact Analysis complete: 3 files affected, low risk. Recommend lightweight workflow — skip architecture and design. [Accept] [Full workflow]"
    > "Impact Analysis complete: 47 files affected, high risk across 4 modules. Recommend epic decomposition into sub-features. [Accept] [Standard workflow]"
  - **Sizing inputs from Impact Analysis**: file count, module count, risk score, coupling assessment, test coverage gaps
  - **No new flags beyond `-light`** — epic decomposition is always framework-recommended, never user-forced (too risky to skip decomposition)
- [ ] Epic decomposition for large features (depends on adaptive workflow sizing above)
  - **Trigger**: Impact Analysis estimates `large` scope (20+ files) or `high` risk
  - **Process**: After sizing decision, Requirements Analyst re-enters to break the feature into sub-features with clear boundaries
  - **Execution model**: Each sub-feature gets an independent mini-cycle with its own gates:
    ```
    Sub-feature A → design → implement → test → gate
    Sub-feature B → design → implement → test → gate
    Sub-feature C → design → implement → test → gate
    Integration testing across A + B + C → final gate
    ```
  - **Benefits**: Catch problems early per sub-feature, reduce context window pressure, intermediate quality gates, partial progress is usable
  - **State tracking**: `state.json` tracks parent feature + sub-features with individual phase progress

**Product/Vision:**
- [ ] Board-driven autonomous development (read from board, develop without intervention when users are away)
- [ ] Design systems using variant.ai
- [ ] Feedback collector, analyser, and roadmap creator
- [ ] Analytics manager (integrated with feedback collector/roadmap)
- [ ] User auth and profile management
- [ ] Marketing integration for SMBs
- [ ] Backlog management integration — connect iSDLC workflows to external project management tools (Jira, Linear, GitHub Issues, Azure DevOps, etc.)
  - Sync workflow status, phase progress, and gate results to board tickets automatically
  - Create/update tickets from iSDLC artifacts (requirements → epics/stories, bugs → issues)
  - Read from board to pick up next work item (feeds into board-driven autonomous development)
  - Pluggable adapter pattern — Jira first (Atlassian MCP already available), others via provider interface

## Completed

### 2026-02-11
- [x] Enhanced plan-to-tasks pipeline (REQ-0009) — file-level granularity, traceability, dependency graph, refinement step, mechanical mode
- [x] Split large files: installer.js (~845 lines) and common.cjs (~1460 lines)
- [x] npx and npm publishing
- [x] Update Node version (REQ-0008) — Node 18→20 minimum, CI matrix [20,22,24], constitution v1.2.0
- [x] Add BMAD party mode for requirements
- [x] Fix: `/isdlc start` should only be offered for new projects, not existing projects

### 2026-02-10
- [x] Performance optimization (REQ-0010) — see docs/PERFORMANCE-PLAN.md
  - [x] T1: Hook dispatcher consolidation (~2x speedup)
    - 21 hooks refactored to `check(ctx)` pattern, 5 dispatchers created
    - settings.json: 26 hook entries → 10 (5 dispatchers + 5 standalone)
    - 1132 total tests (446 ESM + 686 CJS), all passing
  - [x] T2: Prompt optimization (~1.3-1.5x additional)
    - Extracted 3 shared protocols to CLAUDE.md (~50 lines): SKILL OBSERVABILITY, SUGGESTED PROMPTS, CONSTITUTIONAL PRINCIPLES
    - Created CLAUDE.md.template for installers, updated installer.js/install.sh/install.ps1
    - 21 agents: SKILL OBSERVABILITY → 1-line reference
    - 17 agents: SUGGESTED PROMPTS → 1-line reference + agent-specific [2] option
    - 20 agents: CONSTITUTIONAL PRINCIPLES → 1-line reference + article list
    - Orchestrator: 2,260 → 1,185 lines (47.6% reduction)
  - [x] T3: Orchestrator bypass + conditional hooks (~1.5-2x additional)
    - T3-B: 5 dispatchers gain `shouldActivate` guards
    - T3-A: Phase-loop controller delegates directly to phase agents, bypassing orchestrator
    - PHASE→AGENT table + post-phase state update protocol in isdlc.md STEP 3d-3e
    - Orchestrator only invoked for init-and-phase-01 and finalize
- [x] Workflow progress snapshots in workflow_history (REQ-0005)

### 2026-02-09
- [x] Self-healing hook system
  - Three-layer: pre-validate → diagnose (genuine/infrastructure/stale) → auto-remediate
  - `normalizePhaseKey()`, `diagnoseBlockCause()`, `outputSelfHealNotification()`
  - Canonicalized phase keys across workflows.json, PHASE_AGENT_MAP, orchestrator/command tables
  - 917 total tests (362 ESM + 555 CJS)

### 2026-02-08
- [x] Foreground task visibility and hook escalation
- [x] Skill delegation enforcement hooks (skill-delegation-enforcer.cjs, delegation-gate.cjs)
- [x] Reduce hook noise when no SDLC workflow active
- [x] Rename hook files .js → .cjs for Node 24 compatibility
- [x] Claude Code detection and rework provider section in installers
- [x] Post-install tour with /tour command → replaced with interactive use-case-driven guide
- [x] Preserve uninstall.sh and update.sh during install
- [x] Remove stale convert-manifest.sh
- [x] Formalize hooks API contract (REQ-0003)
- [x] Framework-controlled suggested prompts (REQ-0003)
- [x] Enforce advisory behaviors — Phase 2 — 7 hooks + logging infrastructure (REQ-0005)
- [x] PowerShell scripts for Windows (REQ-0002)
- [x] Manual code review break (REQ-0002)

### 2026-02-07
- [x] Fix skill count discrepancy and regenerate mapping docs
- [x] Add in-place update mechanism (update.sh + lib/updater.js)
- [x] Post-discovery walkthrough (DE-002)
- [x] Clean handover from /discover to /sdlc start (DE-003)
- [x] Remove --shallow option from /discover (DE-004)
- [x] Review /discover presentation and UX (DE-005)
- [x] Extend /discover behavior extraction to markdown files (DE-001)

### 2026-02-06
- [x] Agent delegation validation in gate-blocker (#4d)
- [x] Wire discovery context into Phases 01-03
- [x] Merge reverse-engineer into discover (agent count 37→36)

### 2026-02-05
- [x] Refactor skills model: observability over ownership (v3.0.0)
- [x] Remove duplicate agent files
- [x] Fix phase numbering consistency
- [x] Add bug report sufficiency check to requirements analyst

### 2026-02-04
- [x] Cross-platform npm package distribution
- [x] Fix skills/agents consistency issues
- [x] Create missing skill files for QS-*/IA-*

### 2026-01-22 — 2026-01-23
- [x] Gates validation, test agent implementation, iteration enforcement
- [x] Article XI: Integration Testing Integrity
- [x] Phase 5: Testing Infrastructure Setup in /sdlc discover
- [x] skills.sh integration for Phase 3
- [x] Cloud config moved to Phase 5
- [x] Phase 1b: Test Automation Evaluation
