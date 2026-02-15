# iSDLC Framework - Backlog

> Moved from CLAUDE.md to reduce system prompt context size.
> This file is NOT loaded into every conversation — reference it explicitly when needed.

## Open

### 0. Bugs

#### Batch A — Critical: Gate Bypass Risk (0 remaining, 3 fixed)

- 0.1 [x] ~~**BUG: Dual phase-status tracking causes inconsistent gate decisions**~~ (BUG-0007)

- 0.2 [x] ~~**BUG: Missing PHASE_STATUS_ORDINAL disables phase regression checks**~~ (BUG-0007 — confirmed already fixed, verification test added)

- 0.3 [x] ~~**BUG: Null safety gap in state version lock check**~~ (BUG-0007)

#### Batch B — High: Inconsistent Hook Behavior (0 remaining, 7 fixed)

- 0.4 [x] ~~**BUG: Phase index bounds not validated in gate-blocker**~~ (BUG-0008)

- 0.5 [x] ~~**BUG: Empty workflows object prevents fallback loading**~~ (BUG-0008)

- 0.6 [x] ~~**BUG: Dispatcher passes null context to all hooks**~~ (BUG-0006)

- 0.7 [x] ~~**BUG: test-adequacy-blocker fires on wrong phases**~~ (BUG-0006)

- 0.8 [x] ~~**BUG: Supervised review doesn't coordinate with gate-blocker**~~ (BUG-0008)

#### Batch C — Medium: Correctness & UX (0 remaining, 4 fixed)

- 0.9 [x] ~~**BUG: Misleading artifact error messages**~~ (BUG-0017)

- 0.10 [x] ~~**BUG: Version lock bypass during state migration**~~ (BUG-0017)

- 0.11 [x] ~~**BUG: Menu tracker unsafe nested object initialization**~~ (BUG-0006)

- 0.12 [x] ~~**BUG: Phase timeout advisory only — never enforced**~~ (BUG-0006)

#### Batch D — Low: Maintainability & Tech Debt (5 items)

- 0.13 [ ] **DEBT: Hardcoded phase prefixes in 3+ hook files**
  - Phase strings like `startsWith('15-upgrade')` scattered across `gate-blocker.cjs`, `skill-validator.cjs`, `test-adequacy-blocker.cjs`. Should be centralized in a `PHASE_CATEGORIES` constant.

- 0.14 [ ] **DEBT: Inconsistent null-check patterns across hooks**
  - Mix of optional chaining (`state?.active_workflow?.current_phase`) and explicit checks (`if (state && state.active_workflow)`). Pick one, apply consistently.

- 0.15 [ ] **DEBT: `detectPhaseDelegation()` undocumented**
  - Called by 5+ hooks in `lib/common.cjs` but contract (params, return shape, edge cases) is not documented. Maintenance risk.

- 0.16 [ ] **DEBT: Dead code from BUG-0005 fix**
  - `gate-blocker.cjs:606-607` — redundant fallback branch that never executes after the primary branch (line 577) already resolves `currentPhase`.

### 1. Spec-Kit Learnings (from framework comparison 2026-02-11)

- 1.1 [ ] Spike/explore workflow — parallel implementation branches from a single spec for tech stack comparison or architecture exploration (Spec-Kit's "Creative Exploration")
- 1.2 [ ] `/isdlc validate` command — on-demand artifact quality check (constitutional + completeness) without running a full workflow (Spec-Kit's `/speckit.checklist` + `/speckit.analyze`)
- 1.3 [ ] Progressive disclosure / lite mode — expose only constitution → requirements → implement → quality loop for simple projects, full lifecycle opt-in

### 2. Performance (remaining from 2026-02-13 investigation)

- 2.1 [x] T5: Quality Loop true parallelism — Track A (testing) and Track B (QA) currently run sequentially despite being designed as parallel
  - **Impact**: 2x speedup for Phase 16 (1.5-2 min savings)
  - **Complexity**: Medium (spawn Track A + Track B as separate sub-agents, wait for both)
  - REQ-0018 — DONE: Explicit dual-Task spawning in 16-quality-loop-engineer.md, grouping strategy table (A1/A2/A3 + B1/B2), internal parallelism guidance, consolidated merging, iteration loop, FINAL SWEEP compat, scope detection. 40 tests, zero regressions, light workflow.
- 2.2 [ ] T6: Hook I/O optimization — reduce disk reads in dispatchers
  - T6-A: Config caching — cache skills-manifest.json (50-200KB), iteration-requirements.json, workflows.json with mtime invalidation (saves 30-50ms per invocation)
  - T6-B: writeState() double-read elimination — BUG-0009 optimistic locking reads disk to get version before writing, adds 10-20ms per write; trust in-memory version instead
  - T6-C: getProjectRoot() caching — compute once per dispatcher, not per sub-hook (saves 5-10ms per hook)
  - T6-D: Post-write/edit triple I/O consolidation — dispatcher + validators + workflow-completion-enforcer do 4-5 sequential state reads
- 2.3 [ ] T7: Agent prompt boilerplate extraction — ROOT RESOLUTION, MONOREPO, ITERATION protocols duplicated across 17 agents (~3,600 lines)
  - Move remaining shared sections to CLAUDE.md (T2 follow-up)
  - **Impact**: 2-3% speedup per agent delegation
  - **Complexity**: Low (mechanical extraction)
- 2.4 [ ] Performance budget and guardrail system — enforce per-workflow timing limits and track regression as new features land
  - **Problem**: The framework has been optimised from ~4x to ~1.2-1.5x overhead (T1-T3 done). But upcoming backlog items add significant agent calls — Creator/Critic/Refiner debates across 4 creative phases could add 12+ extra agent runs (~20-40 min worst case), Phase 06 Writer/Reviewer/Updater adds 2N calls for N files, and fan-out spawns multiple parallel agents. Without a performance budget, these features will erode the gains incrementally and nobody will notice until the framework feels slow again.
  - **Design**:
    1. **Per-workflow timing instrumentation**: Record wall-clock time per phase, per agent call, and per hook dispatcher invocation in `state.json` under `phases[phase].timing`. Already have `console.time()` in dispatchers — extend to full phase timing.
    2. **Performance budget per intensity**:
       | Intensity | Target Overhead | Max Agent Calls | Max Debate Rounds |
       |-----------|----------------|-----------------|-------------------|
       | Light | ≤1.2x native | No debates, no fan-out | 0 |
       | Standard | ≤2x native | Debates on creative phases, basic fan-out | 2 per phase |
       | Epic | ≤3x native | Full debates + fan-out + cross-validation | 3 per phase |
    3. **Budget enforcement**: At each phase boundary, the phase-loop-controller checks elapsed time against the budget. If over budget:
       - Log warning with breakdown (which phase/agent consumed the most time)
       - For debate phases: reduce remaining `max_rounds` to 1 (force convergence)
       - For fan-out: reduce parallelism (fewer chunks)
       - Never block — degrade gracefully, don't halt the workflow
    4. **Regression tracking**: At workflow completion, append timing summary to `workflow_history`. Compare against rolling average of last 5 workflows of same intensity. Flag if >20% slower with breakdown of where time went.
    5. **Dashboard at completion**: Show timing summary when workflow finishes:
       ```
       Workflow completed in 47m 12s (standard budget: 60m)
         Phase 01 (Requirements):  8m 32s  [2 debate rounds]
         Phase 02 (Impact):        1m 04s
         Phase 03 (Architecture):  9m 18s  [2 debate rounds]
         Phase 04 (Design):        7m 45s  [1 debate round]
         Phase 05 (Test Strategy): 3m 12s
         Phase 06 (Implementation): 12m 41s [8 files, 3 review cycles]
         Phase 16 (Quality Loop):  2m 48s  [4-way fan-out]
         Phase 08 (Code Review):   1m 52s
       ```
  - **What it protects**: Every new backlog item (~~4.1 debates~~ DONE, 4.2B cross-pollination, 4.3 fan-out, 5.2 collaborative mode) must stay within the intensity budget. If a feature consistently blows the budget, it gets flagged for optimisation before the next release.
  - **Builds on**: T1-T3 dispatcher timing, state.json workflow_history (REQ-0005), sizing intensity system (REQ-0011)
  - **Complexity**: Medium — instrumentation is straightforward, budget enforcement needs careful degradation logic

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
  - **Prerequisite**: ~~BUG-0013 (phase-loop-controller same-phase bypass)~~ DONE

- 3.2 [ ] Pre-analysis pipeline — `/isdlc analyze` command to pre-compute analytical phases for the next task while the current workflow runs
  - **Problem**: During Phase 06 (implementation) the developer waits 10-30 minutes with nothing to do. They know what the next task will be (from BACKLOG.md) but can't start working on it until the current workflow finishes. Today the only option is manual backlog grooming. The framework could use this idle time to pre-compute the non-interactive analytical phases for the next task, so when the developer starts it, the analysis is already done.
  - **Key insight**: Phases 00 (quick-scan) and 02 (impact analysis) are **read-only** — they analyze the codebase and produce documents, never write code. They can safely run alongside an implementation phase with zero file conflict. Phase 01 (requirements) is interactive and cannot be pre-cooked.
  - **Design**:
    1. **New command**: `/isdlc analyze "Add payment processing"` (or natural language: "analyze the next backlog item")
    2. **Runs phases 00 + 02 only** — non-interactive, purely analytical. No state.json workflow creation, no branch, no hooks. Just Task agents producing artifacts.
    3. **Artifacts saved to staging area**:
       ```
       .isdlc/
         pre-analysis/
           add-payment-processing/
             quick-scan.md          ← Phase 00 output
             impact-analysis.md     ← Phase 02 output
             meta.json              ← { description, created_at, source_branch, analyzed_files_hash }
           another-feature/
             ...
       ```
    4. **Consumption at workflow start**: When `/isdlc feature "Add payment processing"` runs, the phase-loop checks `.isdlc/pre-analysis/` for a matching slug. If found:
       - Show summary of what was pre-analyzed
       - Staleness check: compare `analyzed_files_hash` against current codebase state. If files changed significantly since analysis, warn and offer to re-run
       - Offer: "Pre-analysis found (2 hours ago). Use it? [Y] Use pre-analysis / [N] Run fresh / [R] Review first"
       - If accepted: inject artifacts as context for Phase 01 (requirements gets richer starting context) and skip Phase 02 (impact analysis already done)
    5. **Cleanup**: Pre-analysis artifacts deleted after consumption or after 7 days (whichever comes first). `/isdlc analyze --clean` removes all.
  - **UX flow**:
    ```
    Terminal 1: /isdlc feature "user auth"     ← workflow running, currently in Phase 06
    Terminal 2: /isdlc analyze "payment API"    ← pre-analysis for next task

    ... later, after auth workflow completes ...

    Terminal 1: /isdlc feature "payment API"
    > Pre-analysis found for "payment API" (35 min ago)
    >   Quick scan: 12 files in scope, 3 modules affected
    >   Impact analysis: medium blast radius, 2 coupling hotspots
    > Use pre-analysis? [Y/N/R]
    ```
  - **Intent detection in CLAUDE.md.template**: Add patterns like "analyze the next item", "pre-analyze {description}", "start analysis for {description}" → route to `/isdlc analyze`
  - **Files to change**: `src/claude/commands/isdlc.md` (new SCENARIO for analyze command, consumption logic in phase-loop STEP 3), `src/claude/CLAUDE.md.template` (intent detection patterns), `.gitignore` (ensure `.isdlc/pre-analysis/` is ignored)
  - **What it intentionally does NOT do**:
    - No state.json workflow creation — pre-analysis is not a workflow, it's a staging computation
    - No branch creation — analysis runs on whatever branch you're on
    - No hook enforcement — no gates, no iteration requirements. This is draft analysis, not gated output
    - No Phase 01 (requirements) — that's interactive, needs the developer, runs at normal workflow time
    - No Phase 03 (architecture) — depends on requirements output, so can't run before Phase 01
  - **Relationship to other backlog items**:
    - Stepping stone to 3.1 (parallel workflows) — if this proves valuable, 3.1 adds full state isolation for concurrent workflows
    - Complements 5.2 (collaborative mode) — pre-analysis keeps the developer engaged during idle time, similar to collaborative mode's task suggestions
    - Independent of 5.1 (supervised mode) — no dependency
  - **Complexity**: Low-medium — new command scenario in isdlc.md, consumption check in phase-loop, staging directory convention, intent detection. No hook changes, no state schema changes, no new agents.

### 4. Multi-Agent Teams (Architecture)

- 4.2 [~] Impact Analysis cross-validation — improve Phase 02 accuracy by enabling agents to cross-check findings (Approach A DONE — REQ-0015, Approach B still open)
  - **Problem**: M1 (Impact Analyzer), M2 (Entry Point Finder), and M3 (Risk Assessor) run in parallel but in **complete isolation** — no SendMessage, no cross-referencing, no awareness of each other's findings. The orchestrator consolidates after all complete, but nobody verifies consistency. M1 might say 7 files affected while M2 found entry points in 9 files, or M3's risk score might not account for coupling that M1 identified. Inconsistencies flow silently into sizing and downstream phases.
  - **Approach A — Post-hoc Verifier** [x] (DONE — REQ-0015: cross-validation-verifier.md agent, Step 3.5 in orchestrator, IA-401/IA-402 skills, 3-tier fail-open, 33 tests):
    - After M1/M2/M3 complete and before consolidation, spawn a Verifier agent that:
      1. Cross-references file lists (M1 affected files vs M2 entry point chains — files in one but not the other?)
      2. Validates risk scoring (does M3's risk level account for M1's coupling analysis and M2's chain depth?)
      3. Checks completeness (are all M2 entry points covered in M1's blast radius?)
      4. Flags inconsistencies for the orchestrator to resolve or surface to the user
    - **Cost**: +1 Task call after existing parallel phase
    - **Limitation**: Catches inconsistencies after the fact but can't improve what the agents found. If M1 missed a file, the Verifier can flag the gap but can't go analyse it.
  - **Approach B — Cross-pollination during execution** (richer, requires restructuring):
    - M1/M2/M3 still launch in parallel but share interim findings via SendMessage during execution:
      - M2 discovers a call chain through 3 modules → tells M1 to check those modules for coupling
      - M1 finds high coupling in a file → tells M3 to raise the risk score for that area
      - M3 identifies a test coverage gap → tells M2 to trace whether that gap is in a critical path
    - Pattern: **parallel with cross-pollination** — agents run simultaneously but broadcast interim discoveries. Lighter than full propose-critique-converge (no debate rounds, no convergence protocol), heavier than pure isolation.
    - Modeled on discover Phase 3's cross-review pattern (D8/D14/D15 review each other's outputs) but applied during execution, not after.
    - **Cost**: Same 3 Task calls but longer execution (agents wait for messages). Message budget: max 6 cross-messages total (2 per agent) to prevent runaway communication.
    - **Benefit**: Agents can act on each other's findings — M1 can re-analyse modules M2 flagged, M3 can adjust risk based on M1's coupling data. Better results, not just better validation.
  - **Recommendation**: Start with Approach A (low risk, immediate value), evolve to Approach B if inconsistency rate is high.
  - **Impact on sizing**: More accurate file counts and risk scores → more reliable sizing decisions (connects to 8.2)
  - **Complexity**: A = Low-medium (one new agent). B = Medium (SendMessage protocol, message budget, interim finding format)
- 4.3 [ ] Fan-out/fan-in parallelism for execution-heavy phases — split work across N parallel agents for throughput
  - **Problem**: Phases 16 (Quality Loop) and 08 (Code Review) process large volumes of work sequentially or in limited parallelism. For a project with 1000+ tests or 20+ changed files, this is a bottleneck.
  - **Pattern**: Fan-out/fan-in — divide work into N chunks, spawn N agents in parallel, merge results
  - **Phase 16 — Quality Loop fan-out**:
    - Split test suite into N chunks based on total test count (e.g., 1000 tests ÷ 4 agents = 250 each)
    - Each agent runs their chunk independently, reports pass/fail/coverage
    - Orchestrator merges results — any failures bubble up, coverage is aggregated
    - Supersedes backlog 2.1 (true parallelism for Track A + Track B) — this goes further by parallelising within each track
    - **Scaling heuristic**: 1 agent per ~250 tests, max 8 agents (diminishing returns beyond that due to orchestration overhead)
  - **Phase 08 — Code Review fan-out**:
    - Split changed files across multiple reviewer agents (by module, directory, or file count)
    - Each reviewer checks their subset: logic correctness, security, code quality, constitutional compliance
    - Orchestrator merges findings into a single review report, deduplicates, prioritises
    - Especially valuable for large changesets (20+ files) where single-agent review loses context
    - If Phase 06 already has Writer/Reviewer/Updater (4.1), Phase 08 fan-out is for the final human-review preparation — assembling a comprehensive report quickly
  - **Shared infrastructure**: Both use the same fan-out/fan-in orchestration — chunk splitter, parallel Task spawner, result merger. Build once, reuse.
  - **Complexity**: Medium — chunk splitting logic, parallel agent spawning, result merging. Builds on existing Task tool parallelism.

### 5. Developer Engagement Modes (Architecture)

Three modes controlling the developer's role during a workflow, activated via feature toggle:

| Mode | Developer Role | Phases flow | When to use |
|------|---------------|-------------|-------------|
| **Auto** (default) | Minimal input — answer questions, approve final gate | Autonomous, no pause between phases | Routine tasks, high-confidence features, trusted patterns |
| **Supervised** | Reviewer — inspect, edit, and course-correct between phases | Pause at configurable review gates | Existing projects, domain-heavy features, learning the codebase |
| **Collaborative** | Reviewer + contributor — produce artifacts alongside the AI | Pause at review gates + suggest parallel human tasks + consume contributed artifacts | Complex features, developer has domain expertise, "boring AI" problem |

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
- 5.2 [ ] Collaborative mode — developer as co-contributor alongside the AI, with parallel human tasks and artifact drop-in
  - **Problem**: In auto mode the developer sits idle for 15-60 minutes while the framework works. Supervised mode (5.1) keeps them engaged as a reviewer, but the developer still isn't *producing* anything. Developers with domain expertise want to contribute — draft acceptance criteria, research competitors, sketch edge cases, write test scenarios — but there's no mechanism to feed that work back into the active workflow.
  - **Builds on**: Supervised mode (5.1) — collaborative mode is supervised mode + contribution capabilities. 5.1 is a prerequisite.
  - **Design**:
    1. **Parallel task suggestions**: At phase boundaries (and during long phases), the framework suggests concrete tasks the developer can work on while the AI continues. Tasks have clear artifact formats and file paths:
       ```
       Phase 06 (Implementation) starting — estimated 20 min.

       While I work, you could prepare:
         → Edge cases for payment validation    → .isdlc/contributions/edge-cases.md
         → Domain notes on PCI-DSS compliance   → .isdlc/contributions/domain-research.md
         → Draft acceptance criteria for Phase 2 → .isdlc/contributions/acceptance-criteria.md

       Drop files in .isdlc/contributions/ — I'll pick them up at the next review gate.

       [Continue] → I'll work autonomously
       [Skip suggestions] → don't show these
       ```
    2. **Contribution drop-in**: `.isdlc/contributions/` directory watched at review gates. Any files placed there are read by the next phase agent as additional context. Contributions are tagged with the phase they were created during and the phase they're intended for.
    3. **Contribution integration**: At each review gate, the framework lists consumed contributions and shows how they influenced the output:
       ```
       Contributions consumed:
         ✓ edge-cases.md → 3 edge cases added to test-strategy.md
         ✓ domain-research.md → PCI-DSS constraints added to NFR matrix
         ○ acceptance-criteria.md → queued for next requirements phase
       ```
    4. **Task suggestion engine**: Per-phase lookup table of useful parallel human tasks, filtered by what's missing or weak in the current artifacts. Not a static list — contextual based on the feature being built.
    5. **Backlog refinement as a contribution type**: While the AI works on implementation, the developer can refine the project backlog — analysing UX issues from real usage, spotting inconsistencies, capturing developer feedback, refining existing items with fresh context. This is product ownership work that the AI can't do because it requires lived experience with the system. The framework suggests backlog-related tasks when relevant:
       ```
       While I work, you could also:
         → Review and refine upcoming backlog items    → BACKLOG.md
         → Capture UX issues from your recent usage    → .isdlc/contributions/ux-feedback.md
         → Note edge cases you've observed in production → .isdlc/contributions/observed-issues.md
       ```
       Backlog contributions are not consumed by the active workflow but are flagged at workflow completion for the developer to review and merge.
  - **Config**:
    ```json
    {
      "collaborative_mode": {
        "enabled": false,
        "suggest_tasks": true,
        "contributions_dir": ".isdlc/contributions",
        "auto_consume_at_gates": true
      }
    }
    ```
  - **Mode selection UX**: At workflow start, present mode choice (or read from config default):
    ```
    How would you like to work on this?
    [A] Auto — I'll handle it, minimal input needed
    [S] Supervised — pause for your review between phases
    [C] Collaborative — suggest tasks you can work on in parallel
    ```
  - **Key use cases**: developer has domain expertise the AI lacks, long-running workflows where idle time is wasted, team onboarding (developer learns by contributing alongside AI), complex features requiring human judgement on edge cases
  - **Scope**: Medium-large — contribution directory convention, task suggestion engine, gate integration, config. Depends on 5.1 (supervised mode) being complete first.
  - **Complexity**: Medium — builds on supervised mode infrastructure, main new work is task suggestion engine and contribution consumption logic

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
- 6.8 [~] Ollama / local LLM support — enable and test the framework with Ollama-hosted open models (IN PROGRESS — core implementation merged REQ-0007, installer provider selection M2 done, remaining: end-to-end workflow test with local model)
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
- 7.8 [ ] GitHub Issues adapter — second backlog provider alongside Jira, using `gh` CLI instead of Atlassian MCP
  - **Problem**: The backlog adapter pattern (REQ-0008) is currently Jira-only. For GitHub-hosted projects, developers already have `gh` CLI authenticated and don't want to configure Atlassian MCP just for issue tracking. GitHub Issues is the natural home for bugs and features in open-source projects.
  - **Design**: Same pluggable adapter pattern as Jira — BACKLOG.md remains the curated working set, GitHub Issues is the external source. Provider detected from metadata sub-bullet key (`**GitHub:**` vs `**Jira:**`).
  - **UX** (invisible framework — all via natural language):
    | User says | Agent does |
    |-----------|-----------|
    | "Add #42 to the backlog" | `gh issue view 42 --json title,body,labels` → appends to BACKLOG.md with `**GitHub:** #42` |
    | "Refresh the backlog" | `gh issue list --label isdlc-bug,isdlc-feature --json` → updates BACKLOG.md items |
    | "Let's work on #42" | Kicks off fix/feature workflow with issue body as input |
    | *(workflow completes)* | Merge commit includes `Fixes #42` → GitHub auto-closes, BACKLOG.md updated |
    | *(workflow cancelled)* | `gh issue comment 42 --body "Workflow cancelled at Phase {N}"` |
  - **Setup UX — user-confirmed auto-detection** (not silent — always present options and get confirmation):
    1. **Install time** (`npx isdlc`): Detect GitHub remote from `.git/config` + check `gh auth status`. If both present, show:
       ```
       GitHub detected: vihang-hub/isdlc-framework
       gh CLI: authenticated ✓

       Enable GitHub Issues integration?
       [Y] Yes — sync bugs/features to GitHub Issues
       [N] No  — use BACKLOG.md only (can enable later)
       ```
       If user confirms: auto-create labels (`isdlc-bug`, `isdlc-feature`, `severity-critical`, `severity-high`, `severity-medium`, `severity-low`), add `.github/ISSUE_TEMPLATE/bug_report.yml` and `feature_request.yml`, set `github_issues.enabled: true` in state.json.
    2. **Discover time** (`/discover`): If not enabled at install, re-detect and present the same confirmation during project analysis. Constitution generation can include an article about issue tracking policy.
    3. **First workflow** (lazy): If not enabled at install or discover, detect on first `/isdlc fix` or `/isdlc feature` and offer: "This project is on GitHub. Want me to create an Issue for this and track it there? [Y/n]"
    - **All 3 detection points require explicit user confirmation** — never silently enable. User can also enable later with `"enable github issues"` (natural language intent detection in CLAUDE.md).
  - **What syncs where**:
    - **GitHub → BACKLOG.md**: issue title, body, labels, linked PR URLs (on add and refresh)
    - **BACKLOG.md → GitHub**: status only — `gh issue close --reason completed` on workflow completion
    - **Issue body → framework**: pulled as requirements phase input (replaces Confluence context for GitHub projects)
  - **Auto-close via commit message**: Finalize step adds `Fixes #N` to the merge commit message. GitHub auto-closes the Issue — zero extra API calls.
  - **Label auto-creation** (idempotent, on first enable):
    - `isdlc-bug`, `isdlc-feature` — workflow type
    - `severity-critical`, `severity-high`, `severity-medium`, `severity-low` — priority mapping
    - Skip if labels already exist
  - **Issue templates** (optional, on first enable):
    - `.github/ISSUE_TEMPLATE/bug_report.yml` — structured bug template matching iSDLC fields (severity, files affected, repro steps)
    - `.github/ISSUE_TEMPLATE/feature_request.yml` — feature template with description, acceptance criteria
    - External contributors file Issues in the right format → iSDLC can parse them
  - **Milestone mapping** (optional): batch grouping → GitHub milestones (e.g., "Batch A — Gate Bypass Fixes")
  - **Coexistence**: Both Jira and GitHub adapters can be active simultaneously. Provider detected from `**Jira:**` vs `**GitHub:**` metadata sub-bullet in BACKLOG.md. Mixed backlogs supported.
  - **Files to change**: `CLAUDE.md.template` (add GitHub operations to intent table), `00-sdlc-orchestrator.md` (backlog picker: detect `**GitHub:**` metadata, route to `gh` CLI; finalize: `gh issue close` + `Fixes #N` in commit), `01-requirements-analyst.md` (issue body as context, replacing Confluence), `isdlc.md` (command spec updates), hooks/tests (extend VR-003 for `#N` format), installer (`lib/installer.js` or `install.sh` — GitHub detection + confirmation prompt + label creation)
  - **Prerequisites**: `gh` CLI installed and authenticated (`gh auth status`). No MCP server needed.
  - **Advantages over Jira adapter**: no MCP auth headaches (Atlassian re-auth bug), `gh` already installed for most GitHub users, auto-close via commit message (zero API calls), richer label/milestone system, external contributor intake via templates
  - **Builds on**: REQ-0008 (Jira adapter pattern), REQ-0012 (invisible framework — natural language intent detection)
  - **Complexity**: Medium — same adapter pattern as Jira but simpler (gh CLI vs MCP). ~6 files to modify, ~1 new test file. Most work is in orchestrator + installer.
- 7.7 [x] Backlog management integration — curated local BACKLOG.md backed by Jira, with Confluence as input source (REQ-0008 -- DONE)
  - **Problem**: Jira has hundreds of unsorted, unprioritised tickets. Nobody wants to trawl through that from the CLI. But Jira is the canonical source for ticket data in existing teams. BACKLOG.md provides a clean, curated, readable experience — but without Jira sync it's a disconnected island.
  - **Design**: BACKLOG.md is the developer's curated working set. Jira is the canonical source for ticket content. Sync is lightweight — content flows in from Jira, status flows back.
  - **UX** (invisible framework — all via natural language, no explicit commands):
    | User says | Agent does (via CLAUDE.md instructions) |
    |-----------|----------------------------------------|
    | "Add PROJ-1234 to the backlog" | Pulls title, description, priority, linked Confluence pages from Jira via MCP → appends to BACKLOG.md |
    | "Show me the backlog" | Reads BACKLOG.md, presents it |
    | "Move PROJ-1235 above PROJ-1234" | Reorders in BACKLOG.md |
    | "Refresh the backlog" | Re-pulls latest title/description/status from Jira for all tracked items, updates BACKLOG.md |
    | "Let's work on PROJ-1234" | Agent detects intent, kicks off feature/fix workflow with Jira ticket as input |
    | *(workflow completes)* | Agent syncs status back to Jira (e.g., In Progress → Done) |
  - **Confluence as input source**: When a Jira ticket links to a Confluence spec/PRD, the framework pulls it automatically as context for the requirements phase. Instead of asking cold generic questions, the agent reads the linked spec and starts from a position of knowledge ("I've read the spec, here's my understanding, what's missing?"). Connects to 8.3 (requirements elicitation redesign).
  - **What syncs where**:
    - **Jira → BACKLOG.md**: ticket title, description, priority, linked Confluence URLs (on add and refresh)
    - **BACKLOG.md → Jira**: status transitions only (In Progress, Done) — no content pushed back
    - **Confluence → framework**: linked specs/PRDs pulled as requirements phase input — read-only, never written back
  - **What it doesn't do**: full Jira board management, sprint planning, bulk import, two-way content sync, publishing artifacts to Confluence
  - **Prerequisites**: Atlassian Rovo MCP server configured in Claude Code (`claude mcp add --transport sse atlassian https://mcp.atlassian.com/v1/sse`). Known gotcha: re-auth required multiple times per day (Atlassian bug, SSE transport being deprecated).
  - **CLAUDE.md changes**: Add instructions for backlog management conventions — BACKLOG.md location, Jira ticket format in entries, when to sync status, how to handle linked Confluence pages
  - **Pluggable adapter pattern**: Jira + Confluence first via Atlassian MCP. Others (Linear, GitHub Issues, Azure DevOps) via same pattern with different MCP servers.
  - **Complexity**: Medium — MCP integration, BACKLOG.md read/write conventions, status sync logic, CLAUDE.md instructions. No new agents needed.

### 8. Workflow Quality

- 8.1 [ ] Requirements debate before workflow start — for new features and bugs, engage in a structured discussion/debate about the requirement or issue before initiating the iSDLC workflow. Clarify scope, challenge assumptions, explore alternatives, and converge on a shared understanding. Only after the debate concludes should the workflow (feature/fix) be kicked off with a well-refined description.
- 8.2 [ ] Sizing decision must always prompt the user — silent fallback paths bypass user consent
  - **Problem**: The adaptive sizing flow (STEP 3e-sizing in `isdlc.md`) has 3 silent paths that skip the user prompt and auto-default to standard: PATH 1 (sizing disabled), PATH 2 (`-light` flag — this one is intentional), PATH 3 (impact analysis missing or unparseable). PATH 3 is the real issue — when `parseSizingFromImpactAnalysis()` returns null, the system silently defaults to standard and moves on. The user never knows a sizing decision was made for them.
  - **Observed**: Ollama feature (7 files) had a clean impact analysis → PATH 4 → user was prompted. Supervised mode feature (4 files) likely had malformed/missing metadata block → PATH 3 → silently defaulted to standard, no prompt.
  - **Expected**: The user should ALWAYS be asked to confirm the sizing decision, even when impact analysis fails. The only exception is the explicit `-light` flag (PATH 2), which is an intentional user override.
  - **Fix**:
    1. **PATH 3 (IA missing/unparseable)**: Instead of silently defaulting, warn the user that impact analysis couldn't be parsed, show what's known, and still present the Accept/Override/Show menu with a "standard" recommendation
    2. **PATH 1 (sizing disabled)**: Consider whether this should also prompt, or at minimum log visibly that sizing was skipped due to config
    3. **Add fallback metrics**: If `parseSizingFromImpactAnalysis()` fails, try extracting file count from quick-scan or requirements artifacts as a backup data source
  - **Files to change**: `src/claude/commands/isdlc.md` (STEP 3e-sizing, PATHs 1 and 3), possibly `src/claude/hooks/lib/common.cjs` (`parseSizingFromImpactAnalysis` fallback robustness)
  - **Complexity**: Low (control flow changes in 1-2 files, no new agents or infrastructure)
- 8.3 [x] Requirements elicitation interaction pattern redesign — replace the cold, generic 3-question opening ("What problem? Who will use this? How will you measure success?") with a conversational, context-aware interaction (integrated into REQ-0014 as FR-007 -- DONE)
  - **Problem**: When the user runs `/isdlc feature "Add payment processing"`, the agent ignores the description they already provided and dumps 3 generic questions. This feels like filling out a form, not collaborating with an expert. The same rigid pattern repeats at every sub-stage (5 sequential lenses, each with A/R/C menu). The current UX is dry, mechanical, and disengaging.
  - **Root cause**: The 3-question opening is hardcoded in two places — `00-sdlc-orchestrator.md` (line ~909, INTERACTIVE PROTOCOL injection) and `01-requirements-analyst.md` (lines ~27-29 invocation protocol + lines ~513-515 Step 1 first response). The orchestrator explicitly instructs: "Your FIRST response must ONLY contain these 3 questions - nothing else."
  - **Desired UX**:
    1. **Reflect first** — acknowledge and summarize what the user already said in their feature description
    2. **Contextual follow-up** — ask ONE targeted question based on what's actually missing, not 3 generic ones
    3. **Conversational deepening** — use the 5 lenses (Business/User/UX/Tech/Quality) organically as the conversation flows, not as rigid sequential stages
    4. **Multi-perspective challenge** — optionally bring in persona voices (modeled on discover's Vision Council) to debate and surface blind spots, but only after initial context is established
    5. **Lighter-weight gates** — keep A/R/C for major phase transitions, replace per-stage menus with natural conversational confirmation
  - **Scope**: Feature workflow only (bug fix workflow is already lightweight at 2-4 turns with min 1 menu interaction)
  - **Files to change**: `00-sdlc-orchestrator.md` (INTERACTIVE PROTOCOL), `01-requirements-analyst.md` (invocation protocol + Step 1 flow + sub-stage structure)
  - **May include personas**: A "Requirements Council" (PM/UX advocate/Technical realist) could replace the 5 sequential lenses with parallel perspectives, inspired by discover's `party-personas.json` pattern. But personas are a means, not the goal — the goal is a conversational, context-aware interaction.
  - **Prerequisite decision — persona naming consistency**: The framework currently has 3 conflicting conventions: (1) human names for Phase 1-2 discover personas (`FROM NADIA (Product Analyst):`), (2) role-only for Phase 3 discover personas (`D8 (Architecture Designer)`), (3) "lenses" for requirements (`Analyst Lens`, `Product Lens`). Documentation (AGENTS.md, ARCHITECTURE.md) uses roles only, never names. `party-personas.json` Phase 3 entries have `name == title` (e.g., `"name": "Architecture Designer"`, `"title": "Architecture Designer"`). Before adding personas to requirements, decide on one convention and apply it consistently across discover + requirements. Options: (A) names everywhere — give all personas human names, (B) roles everywhere — drop names, use role titles consistently, (C) keep names for interactive/debate phases, roles for artifact-production phases (current hybrid, but make it intentional).
  - **Relationship to other items**: Complements 4.1 (multi-agent teams — provides the persona council), subsumes the Phase 01 aspects of 8.1 (requirements debate). Does not affect bug fix flow.
  - **Complexity**: Medium (2 files to rewrite, possible new persona config, interaction pattern design, naming convention decision)

### 9. Code Quality Gaps

- 9.1 [ ] Coverage threshold discrepancy — Constitution mandates 95% unit coverage but Phase 16 only enforces 80%
  - **Problem**: Article II of the constitution requires ≥95% unit test coverage and ≥85% integration test coverage, with 100% for critical paths. But `iteration-requirements.json` for Phase 16 sets `min_coverage_percent: 80`. The constitutional requirement is aspirational — nothing enforces it. This means code can pass all gates while violating the constitution.
  - **Options**:
    - (A) **Raise the Phase 16 threshold to 95%** to match the constitution — risks blocking workflows on legacy codebases or projects where 95% is impractical
    - (B) **Lower the constitutional requirement to 80%** — honest about what's enforced, but weakens the quality bar
    - (C) **Tiered enforcement by intensity** — light: 60%, standard: 80%, epic: 95%. Constitution states the aspirational target, iteration-requirements enforces the practical one per intensity
    - **Recommendation**: Option C — matches the existing intensity system. Constitution remains the north star, enforcement is pragmatic.
  - **Files to change**: `iteration-requirements.json` (per-intensity thresholds), possibly `constitution.md` (add note about intensity-based enforcement)
  - **Complexity**: Low

- 9.2 [ ] No automated complexity measurement — IC-04 relies on agent judgment, not tooling
  - **Problem**: The Implementation Reviewer's IC-04 check says "cyclomatic complexity >10 = BLOCKING" but this is pure agent judgment. No eslint-plugin-complexity, radon (Python), gocyclo (Go), or similar tool actually measures complexity. The agent estimates by reading the code — it can miss deeply nested logic or undercount decision points.
  - **Design**: Integrate automated complexity measurement into the quality pipeline:
    1. **Phase 16 Track B**: Add complexity analysis as a new check (QL-012). Detect available tool by project type:
       - JavaScript/TypeScript: `eslint-plugin-complexity` or `escomplex`
       - Python: `radon cc` or `flake8 --max-complexity`
       - Go: `gocyclo`
       - Java: PMD or Checkstyle complexity rules
    2. **Feed results into IC-04**: If automated metrics are available, the Implementation Reviewer uses them instead of estimating. If not available, falls back to agent judgment (current behavior).
    3. **Threshold**: Configurable per project in `state.json → project.quality_thresholds.max_cyclomatic_complexity` (default: 10)
  - **Same pattern as existing tool detection**: Phase 16 already detects eslint, tsc, jest, etc. This adds complexity tools to that detection.
  - **Complexity**: Low-medium — new QL skill, tool detection patterns, optional IC-04 data source

- 9.3 [ ] Agent-judgment quality checks lack automated backing — IC-01 through IC-07 have no tooling validation
  - **Problem**: All per-file checks in the Implementation Reviewer are agent judgment. The agent decides if there's a security issue (IC-03), a DRY violation (IC-04), or a missing error handler (IC-02). This is valuable but inconsistent — different agent runs may catch different issues. There's no automated baseline to validate against.
  - **Design**: Where automated tools exist, run them as a validation layer alongside agent judgment:
    | IC Check | Automated Tool Candidate |
    |----------|------------------------|
    | IC-01 (Logic) | No good automation — keep agent-only |
    | IC-02 (Error handling) | eslint no-empty-catch, no-unhandled-rejection rules |
    | IC-03 (Security) | semgrep, eslint-plugin-security, bandit (Python) |
    | IC-04 (Quality) | eslint-plugin-complexity, sonarqube (backlog 6.9) |
    | IC-05 (Tests) | No good automation — keep agent-only |
    | IC-06 (Tech-stack) | Package.json/tsconfig validation — partially automatable |
    | IC-07 (Constitution) | No automation — constitutional compliance is semantic |
  - **Approach**: Don't replace agent judgment — augment it. If an automated tool finds an issue the agent missed, flag it. If the agent finds something the tool missed, that's the value of agent judgment. The combination catches more than either alone.
  - **Prerequisite**: 6.9 (SonarQube integration) would cover IC-02, IC-03, IC-04 in one tool. If SonarQube lands first, this item shrinks significantly.
  - **Complexity**: Medium — tool integration, result merging, fallback-to-agent-only when tools unavailable

### 10. Investigation

- 10.1 [ ] Phase handshake audit — investigate whether the handshake between phases is working correctly (state transitions, artifact passing, gate validation, pre-delegation state writes, post-phase updates). Verify no data loss or stale state between phase boundaries.

### 11. Developer Experience

- 11.1 [ ] Install script landing page and demo GIF — update the install script landing/README with a polished visual experience including an animated GIF demonstrating the framework in action (invisible framework flow, workflow progression, quality gates)

## Completed

### 2026-02-15
- [x] 4.1: Multi-agent debate teams — Creator/Critic/Refiner loops for 5 phases (01 Requirements, 03 Architecture, 04 Design, 05 Test Strategy, 06 Implementation). 10 new agents, 438 tests across REQ-0014/0015/0016/0017. Generalized debate engine with routing table, --debate/--no-debate flags, per-intensity configuration, Phase 16 final sweep + Phase 08 human-review-only restructuring.
- [x] BUG-0017: Batch C hook bugs — 2 fixes across 2 files: misleading artifact error messages in gate-blocker.cjs reporting actual missing variants instead of first variant (0.9), state-write-validator version lock bypass during migration requiring version field on incoming state (0.10). Quality reports updated. 137 new state-write-validator tests.
- [x] BUG-0008: Batch B inconsistent hook behavior — 3 fixes in gate-blocker.cjs: phase index bounds validation with Array.isArray + length + typeof/isFinite checks (0.4), empty workflows object fallback loading via .workflows sub-property check (0.5), supervised review coordination blocking gate advancement when status is 'reviewing' or 'rejected' (0.8). 20 new tests, zero regressions, 1 implementation iteration. 3 bugs, 17 ACs, 4 NFRs.
- [x] BUG-0007: Batch A gate bypass bugs — 2 fixes across 2 files: phase-status early-return bypass removed in gate-blocker.cjs (0.1), null/type guards added to state-write-validator.cjs checkVersionLock() (0.3). Bug 0.2 (PHASE_STATUS_ORDINAL) confirmed already fixed with verification test. 16 new tests, zero regressions, 1 implementation iteration. 3 bugs analyzed, 13 ACs, 3 NFRs.
- [x] BUG-0006: Batch B hook bugs — 4 fixes across 3 files: dispatcher null context defaults (0.6, `pre-task-dispatcher.cjs`), test-adequacy wrong phase detection prefix (0.7, `test-adequacy-blocker.cjs`), menu tracker unsafe nested init (0.11, `menu-tracker.cjs`), phase timeout degradation hints (0.12, `pre-task-dispatcher.cjs`). 48 new tests, zero regressions, 2 implementation iterations. 4 FRs, 3 NFRs, 21 ACs.
- [x] BUG-0004: Orchestrator overrides conversational opening with old 3-question protocol — replaced stale INTERACTIVE PROTOCOL block (lines 1007-1016 of 00-sdlc-orchestrator.md) with CONVERSATIONAL PROTOCOL matching the requirements analyst's REQ-0014 INVOCATION PROTOCOL. 1 file modified, 17 new tests, zero regressions, 1 implementation iteration. 2 FRs, 2 NFRs, 9 ACs (backlog 0.1 original)
- [x] REQ-0018: Quality Loop true parallelism — explicit dual-Task spawning for Track A (testing) + Track B (automated QA) in 16-quality-loop-engineer.md (backlog 2.1). Grouping strategy table (A1 unit, A2 system/integration, A3 E2E; B1 static analysis, B2 constitutional/coverage), internal parallelism guidance, consolidated merging protocol, iteration loop with parallel re-execution, FINAL SWEEP/FULL SCOPE compat, scope detection (50+/10-49/<10 thresholds). 40 new tests, zero regressions, 2 implementation iterations, light workflow. 7 FRs, 4 NFRs, 23 ACs.
- [x] REQ-0015 (local): Impact Analysis cross-validation Verifier (Approach A) — new M4 agent (cross-validation-verifier.md) that cross-checks M1/M2/M3 findings after parallel execution, before consolidation. Pipeline verification pattern with 3-tier fail-open, 5 finding types (MISSING_FROM_BLAST_RADIUS, ORPHAN_IMPACT, RISK_SCORING_GAP, UNDERTESTED_CRITICAL_PATH, INCOMPLETE_ANALYSIS), IA-401/IA-402 skills. 1 new agent, 1 new skill, 3 modified files, 33 new tests, zero regressions, 9/9 gates passed first try. 7 FRs, 3 NFRs, 28 ACs (backlog 4.2 Approach A)
- [x] REQ-0016 (local): Multi-agent Test Strategy Team — Creator/Critic/Refiner debate loop for Phase 05 test strategy (backlog 4.1 Phase 05). 2 new agents (Test Strategy Critic with 8 checks TC-01..TC-08, Test Strategy Refiner with fix strategies), 4 modified files (orchestrator DEBATE_ROUTING +1 row, test-design-engineer Creator awareness, isdlc.md debate phases docs, skills-manifest Phase 05 entries). 88 new tests, zero regressions, 2 implementation iterations. 7 FRs, 4 NFRs, 34 ACs. Completes backlog 4.1 (all 5 debate team phases done).
- [x] REQ-0017: Multi-agent Implementation Team — Writer/Reviewer/Updater per-file debate loop for Phase 06 implementation (backlog 4.1 Phase 06). 2 new agents (Implementation Reviewer with 8 IC checks IC-01..IC-08, Implementation Updater with 6-step fix protocol), 4 modified agents (orchestrator IMPLEMENTATION_ROUTING Section 7.6, software-developer Writer awareness, quality-loop final sweep, qa-engineer human review only). 86 new tests, zero regressions, 1 implementation iteration. 7 FRs, 4 NFRs, 34 ACs.

### 2026-02-14
- [x] REQ-0016: Multi-agent Design Team — Creator/Critic/Refiner debate loop for Phase 04 design specifications (backlog 4.1 Phase 04). 2 new agents (Design Critic with 8 checks DC-01..DC-08, Design Refiner with 9 strategies), 3 modified files (orchestrator +1 DEBATE_ROUTING row, system-designer Creator awareness, command descriptions). 87 new tests, zero regressions, 1 implementation iteration. 7 FRs, 4 NFRs, 34 ACs
- [x] REQ-0015: Multi-agent Architecture Team — Creator/Critic/Refiner debate loop for Phase 03 architecture design (backlog 4.1 Phase 03). 2 new agents (Architecture Critic, Architecture Refiner), 3 modified files (orchestrator generalized debate engine with routing table, solution-architect Creator awareness, command flag descriptions). 87 new tests, zero regressions, 2 implementation iterations. 7 FRs, 4 NFRs, 30 ACs
- [x] REQ-0014: Multi-agent Requirements Team — Creator/Critic/Refiner debate loop for Phase 01 requirements elicitation (backlog 4.1 + 8.3). 2 new agents (Critic, Refiner), 5 modified files, debate loop orchestration, --debate/--no-debate flags, conversational Creator opening. 90 new tests, zero regressions, 2 implementation iterations. 8 FRs, 5 NFRs, 28 ACs
- [x] REQ-0008: Backlog management integration — prompt-driven MCP delegation for Jira + Confluence backed BACKLOG.md. 5 modules (CLAUDE.md template, orchestrator extensions, requirements analyst Confluence context, command spec, hook verification). ~195 lines across 4 production files, 72 new tests, zero regressions, 2 implementation iterations. 9 FRs, 5 NFRs, 22 ACs
- [x] REQ-0013: Supervised mode — per-phase review gates with Continue/Review/Redo menu, parallel change summaries, redo circuit breaker (max 3), session recovery. 4 new common.cjs helpers, STEP 3e-review in phase-loop controller, --supervised flag, 88 new tests (80 supervised + 8 gate-blocker), 1228/1228 CJS passing, 8 FRs, 6 NFRs, 35 ACs
- [x] BUG-0015: branch-guard false positive after merge — added `branchExistsInGit()` using `git rev-parse --verify`, 4 new tests
- [x] BUG-0016: state-file-guard false positive on read-only Bash commands — added `isInlineScriptWrite()` to inspect script body, 20 tests
- [x] BUG-0017: Orchestrator exceeds `init-and-phase-01` scope — MODE ENFORCEMENT block + mode-aware guards in orchestrator, 20 tests

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
