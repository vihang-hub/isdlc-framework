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
- [x] Research agents for greenfield — dedicated pre-architecture research step (library compatibility, benchmarks, security implications, org standards) before planning begins
  - Already implemented via deep discovery Inception Party (BMAD-inspired): domain-researcher, technical-scout, solution-architect-party, security-advisor, devops-pragmatist + parallel research agents

### Bugs Found During REQ-0009 Workflow (2026-02-11)

- [x] BUG: Redundant state tracking causes stale fields and hook blocks (BUG-0005 — FIXED)
  - 6 hooks fixed to read `active_workflow.current_phase` first with fallback
  - STEP 3e updated to sync `phase_status`, `active_agent`, and mark tasks.md checkboxes on phase completion
- [x] BUG: Phase-loop controller delegates before marking state as in_progress (BUG-0006 — FIXED)
  - Added STEP 3c-prime: pre-delegation state write before STEP 3d
  - Removed redundant next-phase activation from STEP 3e step 6
- [x] BUG: Test watcher circuit breaker trips on unparseable output (BUG-0007 — FIXED)
- [x] BUG: Constitution validator false positive on delegation prompts (BUG-0008 — FIXED)
  - detectPhaseDelegation() guard added to constitution-validator, gate-blocker, iteration-corridor
- [x] BUG: Subagents overwrite state.json with stale/fabricated data (BUG-0009 — FIXED)
  - Optimistic locking via state_version counter in writeState() + V7 block rule in state-write-validator
- [x] BUG: Orchestrator finalize creates tasks but doesn't mark them completed (BUG-0010 — FIXED)
  - Rewrote STEP 4 cleanup: CRITICAL mandatory loop marks ALL non-completed tasks

### Bugs Found During REQ-0011 Workflow (2026-02-13)

- [x] BUG: Git add/commit runs before quality-loop and code-review (BUG-0012 — FIXED)
  - Phase-aware commit blocking in branch-guard.cjs v2.0.0, no-commit instructions in software-developer and quality-loop-engineer agents
  - 17 new tests (T15-T31), 31/31 passing, 98.42% coverage

- [x] BUG: phase-loop-controller false blocks on sub-agent Task calls (BUG-0013 — FIXED)
  - Same-phase bypass in phase-loop-controller.cjs v1.2.0, 11 new tests (T13-T23), 23/23 passing, 93% coverage

### Performance Investigation (2026-02-13)

Findings from 4-agent parallel analysis of workflow speed bottlenecks. T1-T3 already completed (4-6x cumulative speedup). Remaining opportunities:

- [x] T4-B: Parallel test execution — detect framework, apply parallel flags (Jest --workers, pytest -n auto, Vitest --threads, Go -parallel N)
  - **Impact**: 3-5x speedup for test phases (Phase 07, 11, 16)
  - **Complexity**: Low (prompt changes in environment-builder, integration-tester, quality-loop-engineer agents)
  - **Fallback**: If parallel run fails, retry sequential with flakiness warning
- [x] T4-A: Parallel test creation — test design agent spawns parallel sub-agents for large codebases
- [ ] T5: Quality Loop true parallelism — Track A (testing) and Track B (QA) currently run sequentially despite being designed as parallel
  - **Impact**: 2x speedup for Phase 16 (1.5-2 min savings)
  - **Complexity**: Medium (spawn Track A + Track B as separate sub-agents, wait for both)
- [ ] T6: Hook I/O optimization — reduce disk reads in dispatchers
  - T6-A: Config caching — cache skills-manifest.json (50-200KB), iteration-requirements.json, workflows.json with mtime invalidation (saves 30-50ms per invocation)
  - T6-B: writeState() double-read elimination — BUG-0009 optimistic locking reads disk to get version before writing, adds 10-20ms per write; trust in-memory version instead
  - T6-C: getProjectRoot() caching — compute once per dispatcher, not per sub-hook (saves 5-10ms per hook)
  - T6-D: Post-write/edit triple I/O consolidation — dispatcher + validators + workflow-completion-enforcer do 4-5 sequential state reads
- [ ] T7: Agent prompt boilerplate extraction — ROOT RESOLUTION, MONOREPO, ITERATION protocols duplicated across 17 agents (~3,600 lines)
  - Move remaining shared sections to CLAUDE.md (T2 follow-up)
  - **Impact**: 2-3% speedup per agent delegation
  - **Complexity**: Low (mechanical extraction)

### Parallel Workflows (Architecture)

- [ ] Parallel workflow support — per-workflow state isolation enabling concurrent feature/fix sessions
  - **Problem**: `single_active_workflow_per_project` rule blocks parallel work. A developer can't work on BUG-0013 while BUG-0012 is in progress. The constraint exists because `state.json` has a single `active_workflow` field and all hooks assume one active context.
  - **Design**: Split state into per-workflow files with a shared index:
    ```
    .isdlc/
      workflows.index.json          ← lightweight: [{ id, type, branch, status, started }]
      workflows/
        BUG-0012/state.json         ← full workflow state (phases, current_phase, escalations, skill_usage_log)
        BUG-0013/state.json         ← full workflow state
      config/                       ← shared (unchanged)
      state.json                    ← project-level only (counters, project info, workflow_history, constitution)
    ```
  - **Hook resolution**: Dispatchers resolve `git branch → workflow ID → workflow state` once per invocation via `git branch --show-current` (~5ms), pass resolved state to all hooks. Branch name already maps 1:1 to workflow.
  - **Session binding**: At session start, `/isdlc` (no args) presents a picker if multiple workflows are active. Once selected, CLAUDE.md instruction scopes all operations to that workflow. After selection, hooks only read that workflow's state file.
  - **Git parallelism**: Requires `git worktree` for true parallel sessions (two checkouts in different directories) or separate clones. Without worktrees, workflows are still sequential but with better state isolation and no cancellation needed to switch.
  - **Migration scope**: ~20 files reference `readState()` — all dispatchers, standalone hooks, and common.cjs utilities need to resolve workflow-scoped state instead of global state.
  - **Performance impact**: +10-20ms per hook invocation (index read + branch resolution). Mitigated by caching within dispatcher runs.
  - **Complexity**: Medium-large (2-3 sessions through full iSDLC workflow)
  - **Prerequisite**: BUG-0013 (phase-loop-controller same-phase bypass) should be done first to reduce false blocks during parallel work

### Implementation-Review Fusion (Architecture)

- [ ] Multi-agent collaborative implementation — replace sequential Phase 06 → Phase 16 → Phase 08 with a tight write-review-fix loop using a 3-agent team
  - **Problem**: Code is written in Phase 06, then waits for Phase 16 (quality loop) and Phase 08 (code review) to find issues. By then context is cold, fixes require re-reading, and the sequential overhead adds 15-30 minutes per workflow. The quality loop and code review agents also don't check if skills used match the project's tech stack.
  - **Design**: A 3-agent team runs concurrently within a single "implementation" super-phase:
    - **Writer** (software-developer) — writes code following tasks.md, TDD, produces files
    - **Reviewer** (code-reviewer) — reviews each file/function as it's written, flags issues immediately, checks constitutional compliance, validates skill usage matches tech stack from constitution
    - **Updater** (code-updater) — takes reviewer feedback, applies fixes, re-runs tests, confirms resolution
  - **Loop protocol**:
    ```
    Writer produces file A → Reviewer reviews A → issues found?
      YES → Updater fixes A → Reviewer re-reviews → loop until clean
      NO  → Writer moves to file B → Reviewer reviews B → ...
    All files done → Final quality sweep (security scan, full test suite, coverage)
    ```
  - **Skill validation**: Reviewer agent checks that Writer used appropriate skills for the tech stack (e.g., if constitution says TypeScript, reviewer flags plain JS patterns; if React, reviewer flags jQuery-style DOM manipulation). Skills-manifest.json cross-referenced against `constitution.tech_stack`.
  - **Benefits**:
    - Issues caught immediately while context is hot (not 2 phases later)
    - No cold-start re-reading for reviewers
    - Fewer iteration loops — fix happens in the same breath as detection
    - Quality is continuous, not a gate at the end
    - Phase 16 (quality loop) reduced to final sweep only (full test suite + security scan)
    - Phase 08 (code review) becomes human-review-only (automated review already done in-loop)
  - **Phase restructuring**:
    - Current: `06-implementation → 16-quality-loop → 08-code-review`
    - Proposed: `06-implementation-loop (writer+reviewer+updater) → 16-final-sweep (tests+security) → 08-human-review`
  - **Implementation options**:
    - Option A: Single Task call that spawns 3 sub-agents with shared context (simplest, but sub-agents can't easily pass artifacts)
    - Option B: Phase-Loop Controller manages the write-review-fix loop explicitly (more control, more complex isdlc.md changes)
    - Option C: New `collaborative-implementation-engineer` agent that orchestrates the 3 roles internally (cleanest encapsulation)
  - **Quality loop optimisation**: The remaining Phase 16 becomes a thin final sweep — just `npm run test:all` + `npm audit` + coverage check. No redundant code review since that happened in-loop. Target: <2 minutes.
  - **In-loop reviewer checks** (per file, immediate — while context is hot):
    - Logic correctness: algorithm verified, edge cases handled, boundary conditions
    - Error handling: all conditions caught, meaningful messages, no swallowed exceptions
    - Security: injection prevention (SQL/XSS/command), no eval/exec, no hardcoded secrets, input validation at boundaries, output sanitization
    - Code quality: naming clarity, DRY, single responsibility, complexity <20 lines per function, no code smells (feature envy, data clumps, dead code)
    - Test quality: edge cases covered, test actually tests the right thing, mocks appropriate
    - Skill/tech-stack alignment: patterns match constitution's tech stack (e.g., flag jQuery in React project, flag CommonJS in ESM project, flag wrong test framework)
    - Constitutional compliance: spec primacy (Article I), TDD followed (Article II), simplicity (Article V), traceability (Article VII)
    - Comment quality: explains "why" not "what", complex logic documented
  - **Final sweep checks** (batch, after all files complete — stays in Phase 16):
    - Full test suite execution (all tests pass, no regressions)
    - Coverage analysis (≥80% unit, ≥70% integration, 100% critical paths)
    - Mutation testing (≥80% mutation score, Article XI)
    - npm audit / dependency vulnerability scan
    - SAST security scan (automated tooling)
    - Build verification (clean build, no warnings-as-errors)
    - Lint and type check (project-level)
    - Traceability matrix validation (requirements → design → code → tests)
    - Technical debt assessment
  - **Stays in Phase 08** (human review only):
    - Architecture decision review
    - Business logic correctness (domain knowledge)
    - Overall design coherence
    - Non-obvious security implications
    - Merge approval
  - **Complexity**: Large (new agent architecture, loop protocol, skill validation logic)
  - **Precedent**: Deep discovery Inception Party already uses multi-agent debate. This extends the pattern from research to implementation.
  - **Relates to**: Multi-agent debate mode (already in backlog) — this is the implementation-specific version of that broader idea

**Framework Features:**
- [ ] Improve search capabilities to help Claude be more effective
- [ ] Implementation learning capture: if bug fixes were identified during implementation or iteration loops > 1, create a learning for subsequent implementation
- [ ] Add /isdlc refactor command and workflow — pre-requisite: 100% automated E2E testing
- [ ] Separate commands to manage deployments and operations
- [ ] State.json pruning at workflow completion — actively prune stale/transient fields from state.json at the end of every feature or fix workflow
  - After finalize phase, remove accumulated runtime data: iteration logs, hook activity traces, intermediate phase artifacts, resolved escalations
  - Keep only durable state: workflow history summary, project-level config, skill usage stats
  - Prevents state.json from growing unbounded across workflows and avoids stale data bleeding into subsequent runs
  - Audit and restructure state.json schema for human readability — ensure the structure is well-organized, logically grouped, and understandable when inspected manually (not just machine-consumed)
- [x] Blast radius coverage validation (REQ-0010 — DONE)
  - blast-radius-validator.cjs hook in pre-task-dispatcher slot 9, feature-only, Phase 06 activation
  - Parses impact-analysis.md, cross-references git diff, generates blast-radius-coverage.md
  - 66 new tests, 982 CJS tests pass, fail-open on all error paths
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

- [ ] SonarQube integration
- [ ] Multi-agent debate mode for phase execution — replace single-agent phases with agent teams that collaborate via propose-critique-refine cycles
  - **Concept**: Instead of one agent producing a phase artifact solo, a team of 3 agents works together:
    1. **Creator** — produces the initial artifact (architecture, design, test strategy, etc.)
    2. **Critic** — reviews and critiques the artifact, identifies weaknesses, missing edge cases, over-engineering, and gaps
    3. **Refiner** — synthesizes the critique, improves the solution, identifies additional edge cases, proposes alternatives
    4. **Consensus round** — all three discuss and converge on the best approach before finalizing
  - **Applies to all applicable phases**: Architecture (03), Design (04), Test Strategy (05), Implementation (06), Code Review (08) — each phase gets a tailored team composition
  - **Phase-specific team roles**:
    - Phase 03 (Architecture): Architect → Security/Scalability Critic → Systems Refiner
    - Phase 04 (Design): Designer → API/UX Critic → Integration Refiner
    - Phase 05 (Test Strategy): Test Designer → Coverage Critic → Edge Case Refiner
    - Phase 06 (Implementation): Developer → Code Reviewer → Robustness Refiner
    - Phase 08 (Code Review): Quality Analyst → Security Critic → Maintainability Refiner
  - **Debate protocol**: Each round produces a structured artifact with sections: Proposal, Critiques, Improvements, Unresolved Concerns, Final Consensus
  - **Configurable rounds**: Default 2 rounds (propose-critique-refine → consensus), max 4 for complex phases
  - **Opt-in via flag**: `/isdlc feature "desc" --debate` or per-phase in constitution (e.g., `debate_phases: [03, 04, 05]`)
  - **Precedent**: Deep discovery Inception Party already uses this pattern for `/discover --new` — this extends it to all workflow phases
  - **Benefits**: Higher quality artifacts, catch blind spots early, reduce iteration loops in later phases, built-in adversarial testing of designs

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

### 2026-02-13
- [x] BUG-0013: Phase-loop-controller false blocks — same-phase bypass in phase-loop-controller.cjs v1.2.0, 11 new tests, 23/23 passing, 93% coverage
- [x] BUG-0012: Premature git commits — phase-aware commit blocking in branch-guard.cjs v2.0.0, no-commit instructions in agents, 17 new tests
- [x] REQ-0011: Adaptive workflow sizing — 3 intensities (light/standard/epic), `-light` flag, sizing functions in common.cjs, STEP 3e-sizing in isdlc.md
- [x] BUG-0011: Subagent phase state overwrite — V8 checkPhaseFieldProtection() in state-write-validator.cjs, blocks phase index/status regression

### 2026-02-12
- [x] BUG-0010: Orchestrator finalize stale tasks — rewrote STEP 4 cleanup as CRITICAL mandatory loop
- [x] BUG-0009: Subagent state.json drift — optimistic locking via state_version counter, writeState() auto-increment, V7 block rule
- [x] Blast radius coverage validation (REQ-0010) — new blast-radius-validator.cjs hook, pre-task-dispatcher slot 9, 66 tests, 982 CJS pass
- [x] BUG-0008: Constitution validator false positive on delegation prompts — detectPhaseDelegation() guard in 3 hooks
- [x] BUG-0007: Test watcher circuit breaker false positives — inconclusive classification, skip circuit breaker

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
