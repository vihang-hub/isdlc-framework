# iSDLC Framework - Backlog

> GitHub Issue numbers (`#N`) are the canonical identifiers. Say "#17" and it maps to exactly one item in both BACKLOG.md and GitHub.
> BACKLOG.md is the curated working set with detailed specs. GitHub Issues are for tracking.

## Open

### Performance (remaining from 2026-02-13 investigation)

- 2.3 [x] T7: Agent prompt boilerplate extraction — ROOT RESOLUTION, MONOREPO, ITERATION protocols duplicated across 17 agents (~3,600 lines) -> [requirements](docs/requirements/REQ-0021-t7-agent-prompt-boilerplate-extraction/) **Completed: 2026-02-17**
- 2.4 [x] ~~Performance budget and guardrail system — enforce per-workflow timing limits and track regression as new features land~~ -> [requirements](docs/requirements/REQ-0022-performance-budget-guardrails/) **Completed: 2026-02-19**
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
  - **What it protects**: Every new backlog item (~~4.1 debates~~ DONE, #31 cross-pollination, ~~4.3 fan-out~~ DONE, #32 collaborative mode) must stay within the intensity budget. If a feature consistently blows the budget, it gets flagged for optimisation before the next release.
  - **Builds on**: T1-T3 dispatcher timing, state.json workflow_history (REQ-0005), sizing intensity system (REQ-0011)
  - **Complexity**: Medium — instrumentation is straightforward, budget enforcement needs careful degradation logic

### Parallel Workflows (Architecture)

- #30 [ ] Parallel workflow support — per-workflow state isolation enabling concurrent feature/fix sessions
  - **Problem**: `single_active_workflow_per_project` rule blocks parallel work. A developer can't work on one bug while another is in progress. The constraint exists because `state.json` has a single `active_workflow` field and all hooks assume one active context.
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

### Multi-Agent Teams (Architecture)

- #31 [~] Impact Analysis cross-validation — improve Phase 02 accuracy by enabling agents to cross-check findings (Approach A DONE — REQ-0015, Approach B still open)
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
  - **Impact on sizing**: More accurate file counts and risk scores → more reliable sizing decisions (connects to #51)
  - **Complexity**: A = Low-medium (one new agent). B = Medium (SendMessage protocol, message budget, interim finding format)

### Developer Engagement Modes (Architecture)

- #32 [ ] Collaborative mode — developer as co-contributor alongside the AI, with parallel human tasks and artifact drop-in
  - **Problem**: In auto mode the developer sits idle for 15-60 minutes while the framework works. Supervised mode (REQ-0013) keeps them engaged as a reviewer, but the developer still isn't *producing* anything. Developers with domain expertise want to contribute — draft acceptance criteria, research competitors, sketch edge cases, write test scenarios — but there's no mechanism to feed that work back into the active workflow.
  - **Builds on**: Supervised mode (REQ-0013) — collaborative mode is supervised mode + contribution capabilities. REQ-0013 is a prerequisite.
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
  - **Scope**: Medium-large — contribution directory convention, task suggestion engine, gate integration, config. Depends on REQ-0013 (supervised mode) being complete first.
  - **Complexity**: Medium — builds on supervised mode infrastructure, main new work is task suggestion engine and contribution consumption logic

### Framework Features

- #33 [ ] TOON format integration — adopt Token-Oriented Object Notation for agent prompts and state data to reduce token usage
  - TOON (Token-Oriented Object Notation) reduces token consumption by 30-60% vs JSON while maintaining or improving LLM accuracy
  - Sweet spot: uniform arrays (tabular data like skill manifests, phase tables, workflow history) — field names declared once as header, rows follow
  - Less effective for deeply nested/non-uniform structures (keep JSON for those)
  - SDKs available: TypeScript, Python, Go, Rust, .NET ([github.com/toon-format/toon](https://github.com/toon-format/toon))
  - **Candidate areas**: skills-manifest.json, state.json arrays, agent prompt data injection, hook config loading
  - **Not a full JSON replacement** — complement for token-heavy tabular data only
- #34 [ ] Improve search capabilities to help Claude be more effective
- #35 [ ] Implementation learning capture: if bug fixes were identified during implementation or iteration loops > 1, create a learning for subsequent implementation
- #27 [ ] /isdlc validate command — on-demand artifact quality check (constitutional + completeness) without running a full workflow
- #28 [ ] Progressive disclosure / lite mode — expose only constitution → requirements → implement → quality loop for simple projects, full lifecycle opt-in
- #38 [ ] /isdlc refactor command and workflow — pre-requisite: 100% automated E2E testing
- #37 [ ] Separate commands to manage deployments and operations
- #39 [x] ~~State.json pruning at workflow completion~~ -> [requirements](docs/requirements/state-json-pruning-GH-39/) **Completed: 2026-02-21** *(merged f60f1cc)*
- #40 [ ] Epic decomposition for large features (depends on adaptive workflow sizing / REQ-0011)
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
- #41 [~] Ollama / local LLM support — enable and test the framework with Ollama-hosted open models (IN PROGRESS — core implementation merged REQ-0007, installer provider selection M2 done, remaining: end-to-end workflow test with local model)
  - Ollama v0.14+ natively implements the Anthropic Messages API, Claude Code supports it via 3 env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_API_KEY`)
  - Quick start: `ollama launch claude` — or manual config with `claude --model <model>`
  - Recommended models: qwen3-coder, glm-4.7, gpt-oss:20b/120b (minimum 64k context window)
  - Re-enable the existing `/provider` skill (currently disabled) to manage Ollama configuration
  - **Test scope**: run a full iSDLC workflow (feature or fix) end-to-end with a local model — verify hooks, agents, state management, and gate validation all work correctly. Key risk: open models may struggle with iSDLC's complex multi-agent workflows (tool calling, large context, structured output).
  - **Known trade-offs**: quality near-parity with cloud Claude, but ~68x slower in benchmarks; best for privacy, zero-cost usage, demos, and learning
  - **Cloud variants**: Ollama `:cloud` models (e.g., `kimi-k2.5:cloud`) available for faster inference without API keys
  - **Not blocked by Anthropic**: In Jan 2026, Anthropic blocked third-party tools (OpenCode, xAI) from using Claude Pro/Max subscriptions to access proprietary Claude models (anti-arbitrage). Ollama + Claude Code is unaffected — it uses Anthropic's own CLI pointed at local open-source models, no Anthropic subscription or API key needed. Still working as of Feb 2026, though streaming and tool-calling edge cases are still being patched in Ollama.
  - Docs: [docs.ollama.com/integrations/claude-code](https://docs.ollama.com/integrations/claude-code)
- #42 [ ] SonarQube integration
- #66 [ ] Spec reconciliation phase and selective code regeneration — close the spec-code knowledge gap so code becomes regenerable from complete specifications -> [requirements](docs/requirements/spec-reconciliation-and-code-regeneration/)


### Product/Vision

- #43 [ ] Board-driven autonomous development (read from board, develop without intervention when users are away)
- #44 [ ] Design systems using variant.ai
- #45 [ ] Feedback collector, analyser, and roadmap creator
- #46 [ ] Analytics manager (integrated with feedback collector/roadmap)
- #47 [ ] User auth and profile management
- #48 [ ] Marketing integration for SMBs
- #49 [ ] GitHub Issues adapter — second backlog provider alongside Jira, using `gh` CLI instead of Atlassian MCP
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

### Workflow Quality

- #51 [x] ~~Sizing decision must always prompt the user — silent fallback paths bypass user consent~~ *(completed, merged 3de5162)*

- **Feature A: Analyze Decisions** (#57 + #59) [x] ~~Post-Phase-02 tier + sizing in analyze verb~~ **Completed: 2026-02-20**
  - `computeRecommendedTier()` in three-verb-utils.cjs/common.cjs, `parseSizingFromImpactAnalysis()`, `computeStartPhase()`/`deriveAnalysisStatus()` with light-skip awareness, trivial tier execution path in isdlc.md, `-light` flag support, sizing_decision records in meta.json.

- **Feature B: Build Consumption** (#60 + #61) [x] ~~Clean build-side consumption of pre-analyzed items~~ -> [requirements](docs/requirements/gh-60-61-build-consumption-init-split-smart-staleness/) **Completed: 2026-02-20** (REQ-0031, merge 5480c98)
  - **#60**: Split build init from phase execution — `MODE: init-only` implemented, `MODE: init-and-phase-01` deprecated
  - **#61**: Smart staleness check — blast-radius-aware git diff intersection, 3-tier response (silent/info/warning)

### Code Quality Gaps

- #52 [ ] Coverage threshold discrepancy — Constitution mandates 95% unit coverage but Phase 16 only enforces 80%
  - **Problem**: Article II of the constitution requires ≥95% unit test coverage and ≥85% integration test coverage, with 100% for critical paths. But `iteration-requirements.json` for Phase 16 sets `min_coverage_percent: 80`. The constitutional requirement is aspirational — nothing enforces it. This means code can pass all gates while violating the constitution.
  - **Options**:
    - (A) **Raise the Phase 16 threshold to 95%** to match the constitution — risks blocking workflows on legacy codebases or projects where 95% is impractical
    - (B) **Lower the constitutional requirement to 80%** — honest about what's enforced, but weakens the quality bar
    - (C) **Tiered enforcement by intensity** — light: 60%, standard: 80%, epic: 95%. Constitution states the aspirational target, iteration-requirements enforces the practical one per intensity
    - **Recommendation**: Option C — matches the existing intensity system. Constitution remains the north star, enforcement is pragmatic.
  - **Files to change**: `iteration-requirements.json` (per-intensity thresholds), possibly `constitution.md` (add note about intensity-based enforcement)
  - **Complexity**: Low

- #53 [ ] No automated complexity measurement — IC-04 relies on agent judgment, not tooling
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

- #54 [ ] Agent-judgment quality checks lack automated backing — IC-01 through IC-07 have no tooling validation
  - **Problem**: All per-file checks in the Implementation Reviewer are agent judgment. The agent decides if there's a security issue (IC-03), a DRY violation (IC-04), or a missing error handler (IC-02). This is valuable but inconsistent — different agent runs may catch different issues. There's no automated baseline to validate against.
  - **Design**: Where automated tools exist, run them as a validation layer alongside agent judgment:
    | IC Check | Automated Tool Candidate |
    |----------|------------------------|
    | IC-01 (Logic) | No good automation — keep agent-only |
    | IC-02 (Error handling) | eslint no-empty-catch, no-unhandled-rejection rules |
    | IC-03 (Security) | semgrep, eslint-plugin-security, bandit (Python) |
    | IC-04 (Quality) | eslint-plugin-complexity, sonarqube (#42) |
    | IC-05 (Tests) | No good automation — keep agent-only |
    | IC-06 (Tech-stack) | Package.json/tsconfig validation — partially automatable |
    | IC-07 (Constitution) | No automation — constitutional compliance is semantic |
  - **Approach**: Don't replace agent judgment — augment it. If an automated tool finds an issue the agent missed, flag it. If the agent finds something the tool missed, that's the value of agent judgment. The combination catches more than either alone.
  - **Prerequisite**: #42 (SonarQube integration) would cover IC-02, IC-03, IC-04 in one tool. If SonarQube lands first, this item shrinks significantly.
  - **Complexity**: Medium — tool integration, result merging, fallback-to-agent-only when tools unavailable

### Investigation

- #55 [X] Phase handshake audit — investigate whether the handshake between phases is working correctly (state transitions, artifact passing, gate validation, pre-delegation state writes, post-phase updates). Verify no data loss or stale state between phase boundaries. (REQ-0020, b9c5cb2)

### Agent Compliance

- #64 [~] Agents ignore injected gate requirements — wasted iterations on hook-blocked actions -> [requirements](docs/requirements/BUG-0028-agents-ignore-injected-gate-requirements/)
  - **Problem**: Gate requirements pre-injection (REQ-0024, `gate-requirements-injector.cjs`) tells agents what hooks will enforce (e.g., "do not commit during intermediate phases"). But agents sometimes ignore these constraints and attempt the blocked action anyway. The hook safety net catches it, but the iteration is wasted and the agent has to recover.
  - **Observed**: During BUG-0029 Phase 06, the software-developer agent ran `git commit` despite the injected constraint about Git Commit Prohibition. The `branch-guard` hook blocked it correctly, but the commit still partially executed (the commit message appeared in output).
  - **Root causes to investigate**:
    1. Injected gate requirements text gets buried in long agent prompts (context dilution)
    2. Agent's own instructions contain competing patterns (e.g., "save your work" or training-data habits)
    3. Agents don't treat injected constraints as hard rules vs. suggestions
    4. The injection format may not be salient enough (wall of text vs. prominent warning)
  - **Potential solutions**:
    - Strengthen injection format (e.g., `CRITICAL CONSTRAINT:` prefix, shorter text, repeated at end of prompt)
    - Audit agent files for competing instructions that contradict gate requirements
    - Add a "constraint acknowledgment" step where agent echoes back constraints before starting work
    - Post-hook feedback loop: when a hook blocks, inject the block reason into the agent's next turn as a high-priority correction
  - **Impact**: Wasted iterations degrade performance budgets (REQ-0025). Each blocked-then-retried action costs ~1-2 min.
  - **Related**: REQ-0024 (gate requirements pre-injection), REQ-0025 (performance budget), Git Commit Prohibition in CLAUDE.md
  - **Complexity**: Medium — investigation + prompt engineering + possibly agent file updates

### Hook Bugs

- #65 [ ] gate-blocker blocks `/isdlc analyze` and `/isdlc add` during active workflows — inline commands incorrectly blocked by phase gate checks
  - **Problem**: `gate-blocker.cjs` fires on all `/isdlc` Skill invocations during an active workflow. It only exempts `advance` and `gate-check` actions plus setup commands. The `analyze` and `add` verbs — which are explicitly designed to run outside workflow machinery (no state.json writes, no branches) — get blocked if the current phase has unsatisfied gate requirements.
  - **Observed**: `/isdlc analyze "#64 ..."` blocked with `GATE BLOCKED: Iteration requirements not satisfied for phase '16-quality-loop'` while BUG-0029 workflow was active in another session.
  - **Root cause**: `skill-delegation-enforcer.cjs` correctly exempts `analyze`/`add` (line 37: `EXEMPT_ACTIONS`), but `gate-blocker.cjs` in the `pre-skill-dispatcher` runs first and blocks before the delegation enforcer gets a chance to exempt.
  - **Fix**: Add `analyze` and `add` to gate-blocker's Skill exemption check (around line 118-130). When the Skill is `isdlc` and the action is `analyze` or `add`, skip the gate check.
  - **Files**: `src/claude/hooks/gate-blocker.cjs`
  - **Complexity**: Low — 5-10 line change + tests

### Developer Experience

- #62 [x] ~~Stale pending_delegation marker blocks all responses across sessions~~ — delegation-gate.cjs now has `STALENESS_THRESHOLD_MINUTES` expiry check with auto-clearing of stale markers **Completed: 2026-02-20**
- #3 [x] ~~Framework file operations should not require user permission~~ — added `Write(*/.isdlc/*)` and `Edit(*/.isdlc/*)` allow rules to `src/claude/settings.json` **Completed: 2026-02-21** *(trivial, commit 37a1501)*
- #56 [ ] Install script landing page and demo GIF — update the install script landing/README with a polished visual experience including an animated GIF demonstrating the framework in action (invisible framework flow, workflow progression, quality gates)

### Backlog Management UX (from 2026-02-17 gap analysis)

- #7 [ ] Phase A cannot pull Jira ticket content — `jira_get_issue` MCP not implemented
  - **Problem**: Phase A Step 1 specifies pulling ticket content via Atlassian MCP but no MCP skill or delegation code exists. Users must manually copy-paste Jira ticket content.
  - **Impact**: Breaks seamless Jira-link-to-analysis flow
  - **Complexity**: Medium — needs MCP skill file + Phase A delegation code

- #11 [ ] BACKLOG.md completion marking not implemented — items not marked done after finalize
  - **Problem**: Orchestrator finalize step 2.5d specifies marking items `[x]`, adding `**Completed:** {date}`, and moving to `## Completed` section. None implemented. BACKLOG.md unchanged after workflow completion.
  - **Complexity**: Medium — BACKLOG.md parsing + rewrite logic in finalize step

- #12 [ ] Auto-move completed BACKLOG.md headings when all items are done
  - **Problem**: When all items under a `###` heading are `[x]`, the entire heading block should move to `## Completed`. Currently not specified or implemented.
  - **Design**: After marking an item `[x]`, check if all siblings under same heading are also `[x]`. If yes, move entire heading block. Append `— COMPLETED {date}` suffix.
  - **Complexity**: Low-medium — extends the completion marking logic from #11

- #13 [ ] Jira `updateStatus` at finalize not implemented — tickets not transitioned to Done
  - **Problem**: Orchestrator finalize specifies calling `updateStatus(jira_ticket_id, "Done")` via Atlassian MCP and setting `jira_sync_status` in workflow_history. Not implemented. Jira tickets stay in original status.
  - **Related**: #7 (Jira read) + this (Jira write) together complete the Jira lifecycle
  - **Complexity**: Medium — needs MCP skill file + non-blocking finalize integration

- #58 [x] ~~GitHub issue label sync — auto-label GitHub-sourced issues as they progress through the pipeline~~ **Completed: 2026-02-19**
  - Added analyze handler step 9 (`gh issue edit N --add-label ready-to-build` on analysis complete) and GitHub sync block in finalize (`gh issue close N` on build complete). Both non-blocking. 2 edits to `isdlc.md`.

### Backlog & Analysis Redesign (from 2026-02-18 brainstorm)

> **Context**: Phase A/B separation is unintuitive. The user experience between managing backlog items, analyzing them, and building them doesn't flow naturally. This redesign unifies the pipeline around three natural verbs (add/analyze/build) with persona-driven interactive analysis and transparent quality enrichment. Inspired by BMAD party mode pattern.
> **Subsumes**: #50, #6, #8, #9, #10, #17

- #20 [x] ~~Roundtable analysis agent with named personas~~ *(GitHub #20)* -> [requirements](docs/requirements/REQ-0027-gh-20-roundtable-analysis-agent-with-named-personas/) **Completed: 2026-02-20**

- #21 [x] ~~Elaboration mode — multi-persona roundtable discussions~~ -> [requirements](docs/requirements/gh-21-elaboration-mode-multi-persona-roundtable-discussions/) **Completed: 2026-02-20**
  - Multi-persona roundtable discussions in `roundtable-analyst.md`, elaboration records in meta.json, `elaborations[]` + `elaboration_config` in three-verb-utils.cjs. Built as part of #20 roundtable agent.

- #22 [ ] Transparent Critic/Refiner at step boundaries
  - **Problem**: The existing Creator/Critic/Refiner debate loop runs invisibly. Users don't see improvements and can't validate them. This erodes trust and misses opportunities for user input on refinements.
  - **Design**: At each step boundary (after BA finishes requirements, after Architect finishes architecture, after Designer finishes design):
    1. Critic reviews draft artifacts (runs in background)
    2. Refiner improves based on critique (runs in background)
    3. Roundtable agent presents improvements transparently: "My team reviewed this and suggested some improvements:"
    4. Shows what changed, why, and the updated version
    5. User menu: `[A] Accept improvements` / `[M] Modify` / `[R] Reject — keep original` / `[E] Elaboration Mode` / `[C] Continue`
  - **Key principle**: Nothing hidden. The team's work is surfaced as "team feedback" within the persona's natural voice.
  - **Files**: Critic/Refiner integration into roundtable agent step transitions, presentation format
  - **Depends on**: #20 (roundtable agent exists)
  - **Complexity**: Medium

- 16.5 [x] ~~Build auto-detection and seamless handoff~~ *(GitHub #23)* -> [requirements](docs/requirements/REQ-0026-build-auto-detection-seamless-handoff/) **Completed: 2026-02-19**
  - **Problem**: `/isdlc start` requires the user to know the command exists, pass the right slug, and understand that Phase A must be complete. If Phase A is partial, the error messages are cryptic.
  - **Design**: When user says "build X" or "let's implement X":
    1. Find matching item in `docs/requirements/` by slug, ID, or title
    2. Read `meta.json` to determine analysis completion level
    3. Auto-detect: fully analyzed (all phases 00-04 done) → start at Phase 05. Partially analyzed (e.g., requirements done but no architecture) → offer to resume analysis or start from current point. Raw item → run full workflow (Phases 00-08).
    4. Staleness check: if codebase changed significantly since analysis, warn and offer refresh
    5. Present clear summary: "This item has requirements and architecture but no design. Want to complete design first, or skip to implementation?"
  - **Files**: `isdlc.md` (build verb implementation), `meta.json` schema extension (per-phase completion tracking)
  - **Depends on**: #19 (three-verb model exists) — DONE
  - **Complexity**: Low-medium

## Completed

### 2026-02-22
- [x] REQ-0032 (#63): Concurrent phase execution in roundtable analyze flow — replaced monolithic `roundtable-analyst.md` with multi-agent architecture: `roundtable-analyst.md` (lead orchestrator) + 3 persona agents (`persona-business-analyst.md`, `persona-solutions-architect.md`, `persona-system-designer.md`) running Phase 02-04 concurrently. 6 topic files under `analysis-topics/` replace 24 step files. Updated `isdlc.md` dispatch for new agent routing. 50 new tests (33 structural + 17 meta compat), zero regressions. 17 files changed, 1985 insertions, 614 deletions *(merged 1d741d3)*.

### 2026-02-21
- [x] #39: State.json pruning at workflow completion — 4 new pruning functions in `common.cjs` (`pruneSkillUsageLog`, `pruneCompletedPhases`, `pruneHistory`, `pruneWorkflowHistory`) + enforcer integration in `workflow-completion-enforcer.cjs`. Prunes stale/transient fields at workflow end, prevents unbounded state growth. 77 new tests, zero regressions. 2 files changed, 276 insertions *(merged f60f1cc)*.
- [x] #3: Framework file operations should not require user permission — added `Write(*/.isdlc/*)` and `Edit(*/.isdlc/*)` allow rules to `src/claude/settings.json`. Trivial tier, 1 tracked file changed *(commit 37a1501)*.

### 2026-02-20
- [x] #62: Stale pending_delegation marker expiry — added `STALENESS_THRESHOLD_MINUTES` to delegation-gate.cjs with auto-clearing of cross-session stale markers.
- [x] #21: Elaboration mode — multi-persona roundtable discussions in roundtable-analyst.md, elaboration records in meta.json, `elaborations[]` + `elaboration_config` in three-verb-utils.cjs. Built as part of #20 roundtable agent.
- [x] Feature A (#57 + #59): Analyze decisions — post-Phase-02 tier + sizing in analyze verb. `computeRecommendedTier()`, `parseSizingFromImpactAnalysis()`, `computeStartPhase()`/`deriveAnalysisStatus()` with light-skip awareness, trivial tier execution path, `-light` flag, sizing_decision in meta.json.
- [x] REQ-0027 (#20): Roundtable analysis agent with named personas — single-agent roundtable analyst with BA/Architect/Designer persona hats during analyze verb, step-file architecture, adaptive depth, resumable sessions *(GitHub #20, merged c02145b)*.
  - New `roundtable-analyst.md` agent (307 LOC, persona router + step orchestration), 24 step files under `src/claude/skills/analysis-steps/` (5 phases: quick-scan, requirements, impact-analysis, architecture, design), updated `three-verb-utils.cjs` for roundtable integration. 63 new tests, 2836/2840 full suite, zero regressions. 8 FRs, 5 NFRs, ~40 ACs. 35 files changed, 2146 insertions, 385 deletions.
- [x] BUG-0029-GH-18: Framework agents generate multiline Bash commands that bypass permission auto-allow rules — rewrite multiline Bash commands to single-line form across 10 agent files *(GitHub #18, merged 20e2edb)*.

### 2026-02-19
- [x] #51: Sizing decision always prompts the user — no silent fallback paths bypass user consent. Added `extractFallbackSizingMetrics()` + `normalizeRiskLevel()` to `common.cjs`, updated `isdlc.md` S1/S2/S3 paths to warn and prompt instead of silently defaulting, added audit trail fields to `applySizingDecision()`. 17 new tests, 88% coverage of new code, zero regressions. 6 FRs, 4 NFRs, 11 ACs. 7 files changed *(merged 3de5162)*.
- [x] #18: Framework agents generate multiline Bash commands that bypass permission auto-allow rules — rewrite multiline Bash to single-line form across 10 agent files *(merged 20e2edb)*.
- [x] REQ-0025 (backlog 2.4): Performance budget and guardrail system — per-workflow timing limits, intensity-tier budgets, graceful degradation of debate rounds and fan-out parallelism, regression tracking, completion dashboard *(merged 3707b11)*.
  - New `performance-budget.cjs` library (581 LOC, 15 functions), timing instrumentation in 5 dispatchers + common.cjs, budget enforcement in isdlc.md phase-loop, regression tracking in workflow-completion-enforcer.cjs, workflows.json budget config. 38 new tests, zero regressions. 8 FRs, 5 NFRs, 35 ACs. 20 files changed, 1470 insertions, 242 deletions.

### 2026-02-18
- [x] REQ-0024: Gate requirements pre-injection — inject gate pass criteria into phase agent delegation prompts so agents know what hooks will check before they start, enabling first-pass success without retries *(GitHub #25, merged 8ca3d45)*.
  - New `gate-requirements-injector.cjs` utility (369 LOC, 7 internal helpers), STEP 3d GATE REQUIREMENTS INJECTION block in `isdlc.md`. Reads iteration-requirements.json, artifact-paths.json, constitution.md, workflows.json at delegation time. Fail-open on all error paths. 55 new tests, zero regressions. 6 FRs, 5 NFRs, 26 ACs.
- [x] BUG-0030-GH-24: Impact analysis sub-agents perform independent search instead of anchoring on quick scan *(GitHub #24, merged d9a5bd6)* (backlog 14.4).
  - Added independent Glob/Grep search directives to M1 (impact-analyzer), M2 (entry-point-finder), M3 (risk-assessor). Added Step 4c independent completeness verification to M4 (cross-validation-verifier) with `completeness_gap` finding category. 4 agent files modified, 1 new test file (17 tests), zero regressions.
- [x] #19: Three-verb backlog model (add/analyze/build) — unified command surface around three natural verbs, eliminated Phase A/B naming, redesigned intent detection and orchestrator backlog picker *(merged 7673354)*.
  - New `three-verb-utils.cjs` library (8 utility functions, 636 LOC), updated `isdlc.md` (add/analyze/build verb handlers), `00-sdlc-orchestrator.md` (backlog picker removal), `CLAUDE.md.template` (intent detection rewrite), `delegation-gate.cjs` + `skill-delegation-enforcer.cjs` (add/analyze exemptions). 126 new tests, zero regressions. 9 FRs, 6 NFRs, 44 ACs.
- [x] #14: Custom skill management — add, wire, and inject user-provided skills into workflows *(merged 06f6925)*.
  - New `skill-manager.md` agent, 6 utility functions in `common.cjs` (loadExternalSkill, validateSkillFrontmatter, registerExternalSkill, wireSkillToAgents, getExternalSkillsForPhase, formatExternalSkillBlock), STEP 3d injection in `isdlc.md`, intent detection in CLAUDE.md. 111 new tests, zero regressions. 9 FRs, 6 NFRs, 27 ACs.
- [x] #15: Built-in skills never injected into agent Task prompts — added getAgentSkillIndex() + formatSkillIndexBlock() to common.cjs, STEP 3d skill index injection, 52 agent files updated with ## Skills section. 40 new tests, zero regressions. 5 FRs, 5 NFRs, 7 ACs *(merged eeaae30)*.

### 2026-02-17
- [x] #16: artifact-paths.json filename mismatches — Phase 08 `review-summary.md` → `code-review-report.md`, Phase 01 fix workflow artifact validation disabled. 13 new tests, zero regressions. 2 bugs, 6 ACs, 3 NFRs *(merged b25fbdd)*.
- [x] BUG-0022-GH-1: /isdlc test generate declares QA APPROVED while project build is broken *(Gitea #1, merged 506d4de)*
  - Updated test-generate workflow from legacy pipeline (phases 11+07) to Phase 16 quality-loop. Added Build Integrity Check Protocol to quality-loop-engineer with language-aware build detection, mechanical auto-fix loop (max 3 iterations), honest failure reporting for logical issues. Added GATE-08 build integrity safety net. 39 new tests, zero regressions. 5 files modified + 1 new test file.
- [x] REQ-0021: T7 Agent prompt boilerplate extraction — extracted ROOT RESOLUTION, MONOREPO, SKILL OBSERVABILITY, SUGGESTED PROMPTS, and CONSTITUTIONAL PRINCIPLES protocols from 29 agent files into shared CLAUDE.md subsections. Agents now use 1-line references. ~3,600 lines removed, 113 lines added to CLAUDE.md. 29 agent files modified, 1 test file updated, zero regressions. 12 FRs, 6 NFRs.
- [x] #5: delegation-gate infinite loop on `/isdlc analyze` — missing carve-out for Phase A *(merged 27ae7cf)*
  - Added `EXEMPT_ACTIONS = new Set(['analyze'])` to `skill-delegation-enforcer.cjs` (primary fix) and `delegation-gate.cjs` (defense-in-depth). 22 new tests, zero regressions.
- [x] #4: Artifact path mismatch between agents and gate-blocker — no single source of truth *(merged b777cee)*
  - Created `artifact-paths.json` as single source of truth, corrected 4 mismatched paths in `iteration-requirements.json`, updated `gate-blocker.cjs`. 23 new tests, zero regressions.

### 2026-02-16
- [x] REQ-0020: T6 Hook I/O optimization — config file mtime caching, `getProjectRoot()` per-process cache, state-write-validator single-read consolidation, `ctx.manifest` passthrough. 3 production files, 46 new tests, zero regressions. 5 FRs, 4 NFRs, 19 ACs.
- [x] REQ-0019: Pre-analysis pipeline — `/isdlc analyze` and `/isdlc start` commands for pre-workflow requirements capture and consumption. Phase A Preparation Pipeline runs outside workflow machinery.
- [x] #1: Blast radius response bugs (Batch E bugs 0.17 + 0.18) — re-implementation targeting for unaddressed files + `tasks.md` cross-referencing. 66 new tests, zero regressions. 5 FRs, 3 NFRs, 19 ACs.
- [x] #2: Backlog picker pattern mismatch after BACKLOG.md restructure — strip `-> [requirements](...)` suffix. 26 new tests, zero regressions. 5 FRs, 3 NFRs, 19 ACs.
- [x] REQ-0018: Quality Loop true parallelism — explicit dual-Task spawning for Track A + Track B. 40 new tests, zero regressions. 7 FRs, 4 NFRs, 23 ACs.
- [x] REQ-0017: Fan-out/fan-in parallelism — shared fan-out engine (QL-012 skill). 46 new tests, zero regressions. 7 FRs, 4 NFRs, 35 ACs.

### 2026-02-15
- [x] BUG-0017: Batch C hook bugs — misleading artifact errors (0.9), version lock bypass (0.10). 137 new tests.
- [x] BUG-0009: Batch D tech debt — centralize phase prefixes, null checks, document detectPhaseDelegation(), remove dead code. 4 items.
- [x] BUG-0008: Batch B inconsistent hook behavior — phase index bounds, empty workflows fallback, supervised review. 20 new tests. 3 bugs, 17 ACs, 4 NFRs.
- [x] BUG-0007: Batch A gate bypass bugs — phase-status early-return, checkVersionLock() guards. 16 new tests. 3 bugs, 13 ACs, 3 NFRs.
- [x] BUG-0006: Batch B hook bugs — dispatcher null defaults, test-adequacy phase detection, menu tracker init, phase timeout hints. 48 new tests. 4 FRs, 3 NFRs, 21 ACs.
- [x] BUG-0004: Orchestrator overrides conversational opening. 17 new tests. 2 FRs, 2 NFRs, 9 ACs.
- [x] REQ-0016: Multi-agent Design Team (Phase 04) + Test Strategy Team (Phase 05). 175 new tests.
- [x] REQ-0017: Multi-agent Implementation Team (Phase 06). 86 new tests. 7 FRs, 4 NFRs, 34 ACs.
- [x] REQ-0015: Multi-agent Architecture Team (Phase 03) + IA cross-validation Verifier (Approach A). 120 new tests.
- [x] REQ-0014: Multi-agent Requirements Team (Phase 01). 90 new tests. 8 FRs, 5 NFRs, 28 ACs.
- [x] REQ-0013: Supervised mode — per-phase review gates. 88 new tests. 8 FRs, 6 NFRs, 35 ACs.
- [x] REQ-0008: Backlog management integration — Jira + Confluence. 72 new tests. 9 FRs, 5 NFRs, 22 ACs.
- [x] BUG-0015: branch-guard false positive after merge. 4 new tests.
- [x] BUG-0016: state-file-guard false positive on read-only Bash. 20 tests.
- [x] BUG-0017: Orchestrator exceeds `init-and-phase-01` scope. 20 tests.

### 2026-02-14
- [x] REQ-0016: Multi-agent Design Team. 87 new tests. 7 FRs, 4 NFRs, 34 ACs.
- [x] REQ-0015: Multi-agent Architecture Team. 87 new tests. 7 FRs, 4 NFRs, 30 ACs.
- [x] REQ-0014: Multi-agent Requirements Team. 90 new tests. 8 FRs, 5 NFRs, 28 ACs.
- [x] REQ-0008: Backlog management integration. 72 new tests. 9 FRs, 5 NFRs, 22 ACs.
- [x] REQ-0013: Supervised mode. 88 new tests. 8 FRs, 6 NFRs, 35 ACs.
- [x] BUG-0015: branch-guard false positive. 4 new tests.
- [x] BUG-0016: state-file-guard false positive. 20 tests.
- [x] BUG-0017: Orchestrator scope. 20 tests.

### 2026-02-13
- [x] BUG-0014: Early branch creation. 22 new tests.
- [x] REQ-0012: Invisible framework — CLAUDE.md rewrite. 49 tests, 28/28 ACs.
- [x] BUG-0013: Phase-loop-controller false blocks. 11 new tests.
- [x] BUG-0012: Premature git commits. 17 new tests.
- [x] REQ-0011: Adaptive workflow sizing. 3 intensities, `-light` flag.
- [x] BUG-0011: Subagent phase state overwrite — V8.

### 2026-02-12
- [x] BUG-0010: Orchestrator finalize stale tasks.
- [x] BUG-0009: Subagent state.json drift — optimistic locking V7.
- [x] REQ-0010: Blast radius coverage validation. 66 tests.
- [x] BUG-0008: Constitution validator false positive. detectPhaseDelegation() guard.
- [x] BUG-0007: Test watcher circuit breaker false positives.

### 2026-02-11
- [x] REQ-0009: Enhanced plan-to-tasks pipeline.
- [x] Split large files: installer.js + common.cjs.
- [x] npx and npm publishing.
- [x] REQ-0008: Update Node version — 18→20 minimum.
- [x] Add BMAD party mode for requirements.
- [x] Fix: `/isdlc start` only for new projects.

### 2026-02-10
- [x] REQ-0010: Performance optimization — T1/T2/T3.
- [x] REQ-0005: Workflow progress snapshots.

### 2026-02-09
- [x] Self-healing hook system. 917 total tests.

### 2026-02-08
- [x] Foreground task visibility and hook escalation.
- [x] Skill delegation enforcement hooks.
- [x] Reduce hook noise when no SDLC workflow active.
- [x] Rename hook files .js → .cjs for Node 24.
- [x] Claude Code detection and provider section.
- [x] Post-install tour → interactive guide.
- [x] Preserve uninstall.sh and update.sh during install.
- [x] Remove stale convert-manifest.sh.
- [x] REQ-0003: Formalize hooks API contract.
- [x] REQ-0005: Enforce advisory behaviors — 7 hooks.
- [x] REQ-0002: PowerShell scripts for Windows.

### 2026-02-07
- [x] Fix skill count discrepancy.
- [x] In-place update mechanism.
- [x] Post-discovery walkthrough (DE-002).
- [x] Clean handover /discover → /sdlc start (DE-003).
- [x] Remove --shallow from /discover (DE-004).
- [x] Review /discover UX (DE-005).
- [x] Extend /discover to markdown files (DE-001).

### 2026-02-06
- [x] Agent delegation validation in gate-blocker.
- [x] Wire discovery context into Phases 01-03.
- [x] Merge reverse-engineer into discover (37→36 agents).

### 2026-02-05
- [x] Refactor skills model: observability over ownership (v3.0.0).
- [x] Remove duplicate agent files.
- [x] Fix phase numbering consistency.
- [x] Bug report sufficiency check.

### 2026-02-04
- [x] Cross-platform npm package distribution.
- [x] Fix skills/agents consistency.
- [x] Create missing skill files for QS-*/IA-*.

### 2026-01-22 — 2026-01-23
- [x] Gates validation, test agent, iteration enforcement.
- [x] Article XI: Integration Testing Integrity.
- [x] Phase 5: Testing Infrastructure Setup.
- [x] skills.sh integration for Phase 3.
- [x] Cloud config moved to Phase 5.
- [x] Phase 1b: Test Automation Evaluation.
