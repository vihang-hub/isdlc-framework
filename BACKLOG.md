# iSDLC Framework - Backlog

> Moved from CLAUDE.md to reduce system prompt context size.
> This file is NOT loaded into every conversation — reference it explicitly when needed.

## Open

### 1. Spec-Kit Learnings (from framework comparison 2026-02-11)

- 1.1 [ ] Spike/explore workflow — parallel implementation branches from a single spec for tech stack comparison or architecture exploration (Spec-Kit's "Creative Exploration")
- 1.2 [ ] `/isdlc validate` command — on-demand artifact quality check (constitutional + completeness) without running a full workflow (Spec-Kit's `/speckit.checklist` + `/speckit.analyze`)
- 1.3 [ ] Progressive disclosure / lite mode — expose only constitution → requirements → implement → quality loop for simple projects, full lifecycle opt-in

### 2. Performance (remaining from 2026-02-13 investigation)

- 2.1 [ ] T5: Quality Loop true parallelism — Track A (testing) and Track B (QA) currently run sequentially despite being designed as parallel
  - **Impact**: 2x speedup for Phase 16 (1.5-2 min savings)
  - **Complexity**: Medium (spawn Track A + Track B as separate sub-agents, wait for both)
- 2.2 [ ] T6: Hook I/O optimization — reduce disk reads in dispatchers
  - T6-A: Config caching — cache skills-manifest.json (50-200KB), iteration-requirements.json, workflows.json with mtime invalidation (saves 30-50ms per invocation)
  - T6-B: writeState() double-read elimination — BUG-0009 optimistic locking reads disk to get version before writing, adds 10-20ms per write; trust in-memory version instead
  - T6-C: getProjectRoot() caching — compute once per dispatcher, not per sub-hook (saves 5-10ms per hook)
  - T6-D: Post-write/edit triple I/O consolidation — dispatcher + validators + workflow-completion-enforcer do 4-5 sequential state reads
- 2.3 [ ] T7: Agent prompt boilerplate extraction — ROOT RESOLUTION, MONOREPO, ITERATION protocols duplicated across 17 agents (~3,600 lines)
  - Move remaining shared sections to CLAUDE.md (T2 follow-up)
  - **Impact**: 2-3% speedup per agent delegation
  - **Complexity**: Low (mechanical extraction)

### 3. Parallel Workflows (Architecture)

- 3.1 [ ] Parallel workflow support — per-workflow state isolation enabling concurrent feature/fix sessions
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

### 4. Multi-Agent Teams for Creative Phases (Architecture)

- 4.1 [ ] Replace single-agent phases with Creator/Critic/Refiner teams that collaborate via propose-critique-refine cycles
  - **Shared pattern**: Each phase runs a 3-agent loop: Creator produces artifact → Critic reviews and challenges → Refiner synthesizes improvements. Max 3 rounds, convergence when Critic has zero blocking findings (warnings allowed). Each round produces a versioned artifact diff so progress is visible.
  - **Configurable**: Off for `-light` workflows (single agent, current behavior). On for `standard` and `epic`. Override with `--no-debate` flag to force single-agent mode. Opt-in via `/isdlc feature "desc" --debate` or per-phase in constitution (e.g., `debate_phases: [01, 03, 04, 06]`).
  - **Precedent**: Deep discovery Inception Party already uses this pattern for `/discover --new` — this extends it to all workflow phases.
  - **Sequencing**: Phase 06 first (prove the pattern with implementation), then extend to 01/03/04.
  - **Complexity**: Large (new agent roles, loop protocol, convergence logic, phase restructuring)
  - **Phase 01 — Requirements Team** (Creator/Critic/Refiner):
    - **Creator** (requirements-analyst): Produces requirements-spec.md, user-stories.json, NFR matrix, traceability matrix.
    - **Critic** catches: vague/untestable ACs, orphan requirements, unmeasured NFRs, scope creep, missing compliance requirements, contradictions, missing edge cases, unstated assumptions
    - **Refiner** produces: testable Given/When/Then for every AC, quantified NFRs, complete traceability, risk mitigation, explicit assumption register
  - **Phase 03 — Architecture Team** (Creator/Critic/Refiner):
    - **Creator** (solution-architect): Produces architecture-overview.md, tech-stack-decision.md, database-design.md, security-architecture.md, ADRs.
    - **Critic** catches: NFR misalignment, incomplete STRIDE threat model, database design flaws, weak tech stack justification, single points of failure, unaddressed cost implications, missing observability, coupling contradictions
    - **Refiner** produces: complete ADRs with trade-offs, security hardening, HA adjustments, cost optimization, observability architecture
  - **Phase 04 — Design Team** (Creator/Critic/Refiner):
    - **Creator** (system-designer): Produces interface-spec.yaml/openapi.yaml, module-designs/, wireframes/, error-taxonomy.md, validation-rules.json.
    - **Critic** catches: incomplete API specs, inconsistent patterns across modules, module overlap, validation gaps, missing idempotency, accessibility issues, error taxonomy holes, data flow bottlenecks
    - **Refiner** produces: OpenAPI 3.x contracts with complete error responses, unified error taxonomy, component variants for all states, validation rules at every boundary, idempotency keys
  - **Phase 06 — Implementation Team** (Writer/Reviewer/Updater — specialized per-file loop):
    - **Problem**: Code is written in Phase 06, then waits for Phase 16 (quality loop) and Phase 08 (code review) to find issues. By then context is cold, fixes require re-reading, and the sequential overhead adds 15-30 minutes per workflow.
    - **Writer** (software-developer) — writes code following tasks.md, TDD, produces files
    - **Reviewer** (code-reviewer) — reviews each file as it's written, flags issues immediately, checks constitutional compliance, validates skill/tech-stack alignment
    - **Updater** (code-updater) — takes reviewer feedback, applies fixes, re-runs tests, confirms resolution
    - **Per-file loop** (unlike other phases which loop per-artifact):
      ```
      Writer produces file A → Reviewer reviews A → issues found?
        YES → Updater fixes A → Reviewer re-reviews → loop until clean
        NO  → Writer moves to file B → Reviewer reviews B → ...
      All files done → Final quality sweep (security scan, full test suite, coverage)
      ```
    - **In-loop reviewer checks** (per file, immediate — while context is hot):
      - Logic correctness, error handling, security (injection prevention, no hardcoded secrets)
      - Code quality (naming, DRY, single responsibility, complexity), test quality
      - Skill/tech-stack alignment (flag wrong patterns for project's stack)
      - Constitutional compliance (spec primacy, TDD, simplicity, traceability)
    - **Phase restructuring**:
      - Current: `06-implementation → 16-quality-loop → 08-code-review`
      - Proposed: `06-implementation-loop (writer+reviewer+updater) → 16-final-sweep → 08-human-review`
    - **Final sweep** (Phase 16, batch): full test suite, coverage (≥80% unit, ≥70% integration), mutation testing (≥80%), npm audit, SAST scan, build verification, lint/type check, traceability matrix, technical debt assessment
    - **Phase 08 becomes human-review only**: architecture decisions, business logic, design coherence, non-obvious security, merge approval
    - **Implementation options**: (A) Single Task with 3 sub-agents, (B) Phase-Loop Controller manages loop explicitly, (C) New `collaborative-implementation-engineer` agent encapsulates all 3 roles

### 5. Supervised Mode (Architecture)

- 5.1 [x] Supervised mode — configurable per-phase review gates with parallel change summaries, giving users control to review, edit, and course-correct between phases (REQ-0013 — DONE)
  - **Problem**: The framework is either fully autonomous (phases flow without pause) or broken (escalation on failure). There's no structured way for users to review phase output before the next phase consumes it. By the time the end-of-workflow Human Review Checkpoint fires, it's too late to fix Phase 03 architecture that Phase 06 already built on. Critical for existing project discovery where the user knows the codebase better than the agent.
  - **Design**: A lightweight gate enhancement (not a new phase) with three components:
    1. **Parallel summary generation**: During phase execution, a background sub-agent generates `.isdlc/reviews/phase-NN-summary.md` — file diffs, artifact list, key decisions made, links to all changed/created files
    2. **Review gate at phase boundary**: Instead of auto-advancing, present summary + menu:
       ```
       Phase 03 (Architecture) complete. Summary: .isdlc/reviews/phase-03-summary.md

       Changed files:
         docs/architecture-overview.md (new)
         docs/tech-stack-decision.md (new)
         docs/database-design.md (new)

       [Continue] → advance to next phase
       [Review]   → pause for manual edits, resume when user says "continue"
       [Redo]     → re-run phase with additional guidance
       ```
    3. **Resume after review**: Framework picks up from where it paused, consuming any user-edited files
  - **Config**:
    ```json
    {
      "supervised_mode": {
        "enabled": false,
        "review_phases": "all",
        "parallel_summary": true,
        "auto_advance_timeout": null
      }
    }
    ```
    - `review_phases`: `"all"` or array of specific phases (e.g., `["03", "04", "06"]`)
    - `auto_advance_timeout`: `null` = wait forever, or minutes before auto-continuing
  - **Builds on existing infrastructure**:
    - Gate-blocker — add `supervised_mode.enabled` + `review_phases` check
    - Phase-loop-controller — trigger parallel summary sub-agent during phase execution
    - Escalation menu pattern — reuse Continue/Skip/Cancel UX
    - Phase snapshots (REQ-0005) — already captures per-phase summaries
    - `review-summary.md` — extend from end-of-workflow to per-phase
    - `code_review.enabled` — precedent for config-driven behaviour change
  - **Key use cases**: existing project discovery (architecture/design review), greenfield projects (requirements validation), any workflow where user domain knowledge exceeds agent's
  - **Scope**: Medium — gate-blocker modification, parallel summary in phase-loop-controller, Continue/Review/Redo menu, config in state.json. No new agents needed.

### 6. Framework Features

- 6.1 [ ] TOON format integration — adopt Token-Oriented Object Notation for agent prompts and state data to reduce token usage
  - TOON (Token-Oriented Object Notation) reduces token consumption by 30-60% vs JSON while maintaining or improving LLM accuracy
  - Sweet spot: uniform arrays (tabular data like skill manifests, phase tables, workflow history) — field names declared once as header, rows follow
  - Less effective for deeply nested/non-uniform structures (keep JSON for those)
  - SDKs available: TypeScript, Python, Go, Rust, .NET ([github.com/toon-format/toon](https://github.com/toon-format/toon))
  - **Candidate areas**: skills-manifest.json, state.json arrays, agent prompt data injection, hook config loading
  - **Not a full JSON replacement** — complement for token-heavy tabular data only
- 6.2 [ ] Improve search capabilities to help Claude be more effective
- 6.3 [ ] Implementation learning capture: if bug fixes were identified during implementation or iteration loops > 1, create a learning for subsequent implementation
- 6.4 [ ] Add /isdlc refactor command and workflow — pre-requisite: 100% automated E2E testing
- 6.5 [ ] Separate commands to manage deployments and operations
- 6.6 [ ] State.json pruning at workflow completion — actively prune stale/transient fields from state.json at the end of every feature or fix workflow
  - After finalize phase, remove accumulated runtime data: iteration logs, hook activity traces, intermediate phase artifacts, resolved escalations
  - Keep only durable state: workflow history summary, project-level config, skill usage stats
  - Prevents state.json from growing unbounded across workflows and avoids stale data bleeding into subsequent runs
  - Audit and restructure state.json schema for human readability — ensure the structure is well-organized, logically grouped, and understandable when inspected manually (not just machine-consumed)
- 6.7 [ ] Epic decomposition for large features (depends on adaptive workflow sizing / REQ-0011)
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
- 6.8 [ ] Ollama / local LLM support — enable and test the framework with Ollama-hosted open models
  - Ollama v0.14+ natively implements the Anthropic Messages API, Claude Code supports it via 3 env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`)
  - Quick start: `ollama launch claude` — or manual config with `claude --model <model>`
  - Recommended models: qwen3-coder, glm-4.7, gpt-oss:20b/120b (minimum 64k context window)
  - Re-enable the existing `/provider` skill (currently disabled) to manage Ollama configuration
  - **Test scope**: run a full iSDLC workflow (feature or fix) end-to-end with a local model — verify hooks, agents, state management, and gate validation all work correctly. Key risk: open models may struggle with iSDLC's complex multi-agent workflows (tool calling, large context, structured output).
  - **Known trade-offs**: quality near-parity with cloud Claude, but ~68x slower in benchmarks; best for privacy, zero-cost usage, demos, and learning
  - **Cloud variants**: Ollama `:cloud` models (e.g., `kimi-k2.5:cloud`) available for faster inference without API keys
  - **Not blocked by Anthropic**: In Jan 2026, Anthropic blocked third-party tools (OpenCode, xAI) from using Claude Pro/Max subscriptions to access proprietary Claude models (anti-arbitrage). Ollama + Claude Code is unaffected — it uses Anthropic's own CLI pointed at local open-source models, no Anthropic subscription or API key needed. Still working as of Feb 2026, though streaming and tool-calling edge cases are still being patched in Ollama.
  - Docs: [docs.ollama.com/integrations/claude-code](https://docs.ollama.com/integrations/claude-code)
- 6.9 [ ] SonarQube integration

### 7. Product/Vision

- 7.1 [ ] Board-driven autonomous development (read from board, develop without intervention when users are away)
- 7.2 [ ] Design systems using variant.ai
- 7.3 [ ] Feedback collector, analyser, and roadmap creator
- 7.4 [ ] Analytics manager (integrated with feedback collector/roadmap)
- 7.5 [ ] User auth and profile management
- 7.6 [ ] Marketing integration for SMBs
- 7.7 [ ] Backlog management integration — connect iSDLC workflows to external project management tools (Jira, Linear, GitHub Issues, Azure DevOps, etc.)
  - Sync workflow status, phase progress, and gate results to board tickets automatically
  - Create/update tickets from iSDLC artifacts (requirements → epics/stories, bugs → issues)
  - Read from board to pick up next work item (feeds into board-driven autonomous development)
  - Pluggable adapter pattern — Jira first (Atlassian MCP already available), others via provider interface

### 8. Workflow Quality

- 8.1 [ ] Requirements debate before workflow start — for new features and bugs, engage in a structured discussion/debate about the requirement or issue before initiating the iSDLC workflow. Clarify scope, challenge assumptions, explore alternatives, and converge on a shared understanding. Only after the debate concludes should the workflow (feature/fix) be kicked off with a well-refined description.

### 9. Bugs

- 9.1 [ ] BUG-0015: branch-guard false positive after merge — blocks commits to main when feature branch was already merged/deleted but state.json not yet finalized
  - **Trigger**: Commit to main in the window between `git merge`/branch deletion and orchestrator finalize (state.json still has `active_workflow.git_branch.status: 'active'`)
  - **Root cause**: Hook trusts state.json's `git_branch.status` without verifying the branch actually exists in git
  - **Fix**: Add `git rev-parse --verify <branch>` check — if branch no longer exists, allow commit (fail-open)
  - **Missing test**: Post-merge scenario where branch is deleted but state not finalized
- 9.2 [ ] BUG-0016: state-file-guard false positive on read-only Bash commands — blocks `node -e` scripts that only read state.json
  - **Trigger**: `node -e "...readFileSync('.isdlc/state.json')..."` blocked as a "write" because hook matches on `/\bnode\s+-e\b/` pattern
  - **Root cause**: Syntactic pattern matching on command signature (`node -e`) instead of semantic analysis — assumes all inline scripts are writes
  - **Fix**: For `node -e` commands, inspect script body for actual write operations (`writeFileSync`, `writeFile`, `appendFile`); if none found, treat as read-only
  - **Missing test**: `node -e` with `readFileSync` only (no write operations)

### 10. Investigation

- 10.1 [ ] Phase handshake audit — investigate whether the handshake between phases is working correctly (state transitions, artifact passing, gate validation, pre-delegation state writes, post-phase updates). Verify no data loss or stale state between phase boundaries.

### 11. Developer Experience

- 11.1 [ ] Install script landing page and demo GIF — update the install script landing/README with a polished visual experience including an animated GIF demonstrating the framework in action (invisible framework flow, workflow progression, quality gates)

## Completed

### 2026-02-14
- [x] REQ-0013: Supervised mode — per-phase review gates with Continue/Review/Redo menu, parallel change summaries, redo circuit breaker (max 3), session recovery. 4 new common.cjs helpers, STEP 3e-review in phase-loop controller, --supervised flag, 88 new tests (80 supervised + 8 gate-blocker), 1228/1228 CJS passing, 8 FRs, 6 NFRs, 35 ACs

### 2026-02-13
- [x] BUG-0014: Early branch creation — moved branch creation from post-GATE-01 to workflow initialization time. All phases now execute on the feature/bugfix branch, keeping main untouched. 3 doc files (14 locations), 22 new tests, 0 regressions
- [x] REQ-0012: Invisible framework — CLAUDE.md rewrite for auto-intent-detection, consent protocol, edge case handling. Users never need to know slash commands exist. 49 tests, 28/28 ACs, 4/4 NFRs, light workflow (93 min)
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
