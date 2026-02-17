# iSDLC Framework - Backlog

> Moved from CLAUDE.md to reduce system prompt context size.
> This file is NOT loaded into every conversation — reference it explicitly when needed.

## Open

### 1. Spec-Kit Learnings (from framework comparison 2026-02-11)

- 1.1 [ ] Spike/explore workflow — parallel implementation branches from a single spec for tech stack comparison or architecture exploration (Spec-Kit's "Creative Exploration")
- 1.2 [ ] `/isdlc validate` command — on-demand artifact quality check (constitutional + completeness) without running a full workflow (Spec-Kit's `/speckit.checklist` + `/speckit.analyze`)
- 1.3 [ ] Progressive disclosure / lite mode — expose only constitution → requirements → implement → quality loop for simple projects, full lifecycle opt-in

### 2. Performance (remaining from 2026-02-13 investigation)

- 2.3 [x] T7: Agent prompt boilerplate extraction — ROOT RESOLUTION, MONOREPO, ITERATION protocols duplicated across 17 agents (~3,600 lines) -> [requirements](docs/requirements/REQ-0021-t7-agent-prompt-boilerplate-extraction/) **Completed: 2026-02-17**
- 2.4 [ ] Performance budget and guardrail system — enforce per-workflow timing limits and track regression as new features land -> [requirements](docs/requirements/REQ-0022-performance-budget-guardrails/)
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
  - **What it protects**: Every new backlog item (~~4.1 debates~~ DONE, 4.2B cross-pollination, ~~4.3 fan-out~~ DONE, 5.2 collaborative mode) must stay within the intensity budget. If a feature consistently blows the budget, it gets flagged for optimisation before the next release.
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

### 5. Developer Engagement Modes (Architecture)

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

- 11.2 [ ] BUG-0022: Phase A Step 8 skips interactive requirements elicitation — generates requirements inline instead of delegating to requirements-analyst agent *(GitHub #6)*
  - **Problem**: Phase A Step 8 says "use the persona-based elicitation flow (same as the requirements-analyst Creator role)" but `isdlc.md` doesn't explicitly instruct a Task delegation. The executor writes `requirements.md` directly without questions, A/R/C menus, or persona identification.
  - **Observed in**: REQ-0021 (T7 boilerplate extraction), REQ-0022 (performance budget guardrails) — both had zero user interaction during requirements capture
  - **Fix**: Make Step 8 explicit — delegate to `requirements-analyst` via Task tool in Phase A mode (no state.json, no hooks, no branches). Agent runs full interactive 5-step flow, returns `requirements.md`.
  - **Severity**: Medium — requirements quality degraded without user validation
  - **Complexity**: Low — control flow change in `isdlc.md` Step 8, no new files

- 11.1 [ ] Install script landing page and demo GIF — update the install script landing/README with a polished visual experience including an animated GIF demonstrating the framework in action (invisible framework flow, workflow progression, quality gates)

### 12. Backlog Management UX (from 2026-02-17 gap analysis)

- 12.1 [ ] BUG-0023: Phase A cannot pull Jira ticket content — `jira_get_issue` MCP not implemented *(GitHub #7)*
  - **Problem**: Phase A Step 1 specifies pulling ticket content via Atlassian MCP but no MCP skill or delegation code exists. Users must manually copy-paste Jira ticket content.
  - **Impact**: Breaks seamless Jira-link-to-analysis flow
  - **Complexity**: Medium — needs MCP skill file + Phase A delegation code

- 12.2 [ ] BUG-0024: Phase A BACKLOG.md append not implemented and format missing Jira metadata *(GitHub #8)*
  - **Problem**: Phase A Step 5 specifies appending to BACKLOG.md but (a) no code does the write, and (b) the entry format lacks `**Jira:**` / `**Confluence:**` sub-bullets that the backlog picker expects.
  - **Impact**: Items analyzed via Phase A are never recorded in BACKLOG.md. Backlog picker can't find them with Jira metadata.
  - **Complexity**: Low — format spec update + write implementation in Phase A executor

- 12.3 [ ] Post-Phase-A picker — offer to implement analyzed item or analyze another *(GitHub #9)*
  - **Problem**: After Phase A deep analysis completes, the system ends silently. No menu offering implementation or further analysis. User must manually know about `/isdlc start`.
  - **Design**: Scan `docs/requirements/*/meta.json` for `phase_a_completed: true` items without matching completed workflows. Present picker with age/staleness. Offer: Implement / Analyze another / Done.
  - **Complexity**: Medium — new post-Phase-A UI, meta.json scan, workflow_history cross-reference

- 12.4 [ ] Parallel analysis vs single implementation UX message *(GitHub #10)*
  - **Problem**: When a workflow is active, starting implementation hard-blocks without explaining that analyses can still run in parallel. Should inform user about the parallel analysis capability and offer to analyze more.
  - **Complexity**: Low — UX message change in workflow start check

- 12.5 [ ] BUG-0025: BACKLOG.md completion marking not implemented — items not marked done after finalize *(GitHub #11)*
  - **Problem**: Orchestrator finalize step 2.5d specifies marking items `[x]`, adding `**Completed:** {date}`, and moving to `## Completed` section. None implemented. BACKLOG.md unchanged after workflow completion.
  - **Complexity**: Medium — BACKLOG.md parsing + rewrite logic in finalize step

- 12.6 [ ] Auto-move completed BACKLOG.md headings when all items are done *(GitHub #12)*
  - **Problem**: When all items under a `###` heading are `[x]`, the entire heading block should move to `## Completed`. Currently not specified or implemented.
  - **Design**: After marking an item `[x]`, check if all siblings under same heading are also `[x]`. If yes, move entire heading block. Append `— COMPLETED {date}` suffix.
  - **Complexity**: Low-medium — extends the completion marking logic from 12.5

- 12.7 [ ] BUG-0026: Jira `updateStatus` at finalize not implemented — tickets not transitioned to Done *(GitHub #13)*
  - **Problem**: Orchestrator finalize specifies calling `updateStatus(jira_ticket_id, "Done")` via Atlassian MCP and setting `jira_sync_status` in workflow_history. Not implemented. Jira tickets stay in original status.
  - **Related**: 12.1 (Jira read) + this (Jira write) together complete the Jira lifecycle
  - **Complexity**: Medium — needs MCP skill file + non-blocking finalize integration

### 13. Skills Extensibility (from 2026-02-17 brainstorm)

- 13.1 [ ] Custom skill management — add, wire, and inject user-provided skills into workflows *(GitHub #14)*
  - **Problem**: Users have no way to add domain-specific skills to the framework. External skills directory and manifest exist but there's no user-facing command, no interactive wiring session, and no runtime injection.
  - **Design**: Unified interactive session for adding and re-wiring skills:
    - **Stage 1 — Acquire**: User drops a `.md` file into `.claude/skills/external/` or provides a path/URL. Framework validates frontmatter.
    - **Stage 2 — Wire**: Interactive session walks user through agent/phase binding. User selects which agents should have access (from grouped list). User selects delivery type (context block / instruction / reference). Injection mode is always-on.
    - **Stage 3 — Confirm**: Summary with [S] Save / [A] Adjust / [X] Cancel. On save, registers in `external-skills-manifest.json` with new `bindings` schema: `{ agents, phases, injection_mode: "always", delivery_type }`.
    - **Runtime**: Phase-loop controller STEP 3d reads external manifest, matches skills to current agent/phase, reads `.md` files, appends formatted blocks to agent Task prompt.
    - **Re-wiring**: "Use X skill during Y phase" triggers same session with current bindings pre-filled.
  - **Entry points**: Natural language ("add a skill", "wire nestjs to implementation") or explicit `/isdlc skill add <path>`, `/isdlc skill wire <name>`
  - **Files**: `isdlc.md` (new actions + STEP 3d injection), `CLAUDE.md` (intent detection), `external-skills-manifest.json` (schema extension), `common.cjs` (skill loading utilities), new `skill-manager.md` agent
  - **Complexity**: Medium

- 13.2 [ ] BUG-0027: Built-in skills (243 SKILL.md files) never injected into agent Task prompts at runtime *(GitHub #15)*
  - **Problem**: 243 SKILL.md files exist across 17 categories. Each agent declares `owned_skills:` in frontmatter. But NO code reads these files and delivers them to agents. The skills manifest is consumed by hooks for observability logging only — not for capability delivery. ~50,000+ lines of domain expertise are dead weight.
  - **Evidence**: Phase-loop controller STEP 3d has zero references to skills/SKILL.md/inject. No `loadSkillContent()` function in common.cjs. Agent files have no instruction to read their owned skills. The entire skills architecture (manifest, ownership, IDs, categories) exists for logging, not delivery.
  - **Recommended fix (Option B — summaries + on-demand)**: Inject a skill index (name + one-line description + file path) into agent Task prompts. Agents read specific SKILL.md files when relevant. Low token overhead (one line per skill), agents that need a skill can Read it.
  - **Shares injection point with 13.1**: Both built-in and custom skills inject at STEP 3d. Implement together or sequentially.
  - **Files**: `isdlc.md` (STEP 3d skill injection), `common.cjs` (`getAgentSkillIndex()` utility), 48 agent files (add "consult your owned skills" instruction — mechanical)
  - **Severity**: Medium-high — entire skills architecture underutilized
  - **Complexity**: Medium

### 14. Gate-Blocker Artifact Validation (from BUG-0022-GH-1 workflow observation)

- 14.1 [ ] BUG: artifact-paths.json has wrong filenames that don't match agent output — gate-blocker blocks valid phases [Gitea: #2] [GitHub: #16]
  - **Problem**: `artifact-paths.json` (gate-blocker's source of truth) contains hand-authored filenames that don't match what phase agents actually produce. Phase 08 expects `review-summary.md` but QA Engineer writes `code-review-report.md`. `review-summary.md` is only created by the orchestrator during finalize (post-gate). Phase 01 also blocked when orchestrator simulated instead of delegating.
  - **Root cause**: `artifact-paths.json` was created in BUG-0020 with assumed filenames. REQ-0021 (output templates) didn't touch artifact-paths.json or iteration-requirements.json.
  - **Severity**: High — blocks every workflow at Phase 01 and Phase 08 with false positives
  - **Suggested fix**: Audit all phases in `artifact-paths.json` against actual agent output. Remove entries for post-gate artifacts. Ideally derive from agent output templates to prevent future drift.
  - **Files**: `src/claude/hooks/config/artifact-paths.json`, `src/claude/hooks/config/iteration-requirements.json`, `src/claude/hooks/gate-blocker.cjs`, `src/claude/agents/07-qa-engineer.md`, `src/claude/agents/00-sdlc-orchestrator.md`

## Completed

### 2026-02-17
- [x] BUG-0022-GH-1: /isdlc test generate declares QA APPROVED while project build is broken *(Gitea #1, GitHub #16, merged 506d4de)*
  - Updated test-generate workflow from legacy pipeline (phases 11+07) to Phase 16 quality-loop. Added Build Integrity Check Protocol to quality-loop-engineer with language-aware build detection, mechanical auto-fix loop (max 3 iterations), honest failure reporting for logical issues. Added GATE-08 build integrity safety net. 39 new tests, zero regressions. 5 files modified + 1 new test file.
- [x] REQ-0021: T7 Agent prompt boilerplate extraction — extracted ROOT RESOLUTION, MONOREPO, SKILL OBSERVABILITY, SUGGESTED PROMPTS, and CONSTITUTIONAL PRINCIPLES protocols from 29 agent files into shared CLAUDE.md subsections. Agents now use 1-line references. ~3,600 lines removed, 113 lines added to CLAUDE.md. 29 agent files modified, 1 test file updated, zero regressions. 12 FRs, 6 NFRs (backlog 2.3).
- [x] BUG-0021: delegation-gate infinite loop on `/isdlc analyze` — missing carve-out for Phase A *(GitHub #5, merged 27ae7cf)*
  - Added `EXEMPT_ACTIONS = new Set(['analyze'])` to `skill-delegation-enforcer.cjs` (primary fix) and `delegation-gate.cjs` (defense-in-depth). 22 new tests, zero regressions.
- [x] BUG-0020: Artifact path mismatch between agents and gate-blocker — no single source of truth *(GitHub #4, merged b777cee)*
  - Created `artifact-paths.json` as single source of truth, corrected 4 mismatched paths in `iteration-requirements.json`, updated `gate-blocker.cjs`. 23 new tests, zero regressions.

### 2026-02-16
- [x] REQ-0020: T6 Hook I/O optimization — config file mtime caching (`_configCache` Map with `_loadConfigWithCache()`), `getProjectRoot()` per-process cache, state-write-validator single-read consolidation (`diskState` parameter to V7/V8), `ctx.manifest` passthrough in gate-blocker `checkAgentDelegationRequirement()`. 3 production files modified (common.cjs, state-write-validator.cjs, gate-blocker.cjs), 46 new tests, zero regressions, 1 implementation iteration. 5 FRs, 4 NFRs, 19 ACs (backlog 2.2).
- [x] REQ-0019: Pre-analysis pipeline — `/isdlc analyze` and `/isdlc start` commands for pre-workflow requirements capture and consumption (backlog 3.2). Phase A Preparation Pipeline runs outside workflow machinery, `/isdlc start` consumes Phase A artifacts from Phase 02.
- [x] BUG-0019: Blast radius response bugs (GitHub #1, Batch E bugs 0.17 + 0.18) — new `blast-radius-step3f-helpers.cjs` with re-implementation targeting for unaddressed files + `tasks.md` cross-referencing for skipped/incomplete tasks. Modified orchestrator STEP 3f and phase-loop integration. 66 new tests, zero regressions, 2 implementation iterations. 5 FRs, 3 NFRs, 19 ACs.
- [x] BUG-0018: Backlog picker pattern mismatch after BACKLOG.md restructure (GitHub #2, REQ-0019 follow-up) — updated orchestrator BACKLOG PICKER to strip `-> [requirements](...)` suffix from item titles in both feature and fix modes. Added `start` action design note in isdlc.md. 26 new tests (`test-backlog-picker-content.test.cjs`), zero regressions, 1 implementation iteration. 5 FRs, 3 NFRs, 19 ACs.
- [x] REQ-0018: Quality Loop true parallelism — explicit dual-Task spawning for Track A (testing) + Track B (automated QA) in 16-quality-loop-engineer.md (backlog 2.1). Grouping strategy table, internal parallelism guidance, consolidated merging protocol. 40 new tests, zero regressions, 2 implementation iterations. 7 FRs, 4 NFRs, 23 ACs.
- [x] REQ-0017: Fan-out/fan-in parallelism — shared fan-out engine (QL-012 skill) with chunk splitter, parallel Task spawner, and result merger. Phase 16 Track A test splitting + Phase 08 code review file splitting. --no-fan-out CLI flag. 46 new tests, zero regressions, 1 implementation iteration. 7 FRs, 4 NFRs, 35 ACs (backlog 4.3).

### 2026-02-15
- [x] BUG-0017: Batch C hook bugs — misleading artifact error messages in gate-blocker.cjs (0.9), state-write-validator version lock bypass during migration (0.10). 137 new state-write-validator tests.
- [x] BUG-0009: Batch D tech debt — centralize phase prefixes (0.13), standardize null checks (0.14), document detectPhaseDelegation() (0.15), remove dead code (0.16). 4 items, zero regressions.
- [x] BUG-0008: Batch B inconsistent hook behavior — phase index bounds validation (0.4), empty workflows object fallback (0.5), supervised review coordination (0.8). 20 new tests, zero regressions. 3 bugs, 17 ACs, 4 NFRs.
- [x] BUG-0007: Batch A gate bypass bugs — phase-status early-return bypass (0.1), null/type guards in checkVersionLock() (0.3). Bug 0.2 confirmed already fixed. 16 new tests, zero regressions. 3 bugs, 13 ACs, 3 NFRs.
- [x] BUG-0006: Batch B hook bugs — dispatcher null context defaults (0.6), test-adequacy wrong phase detection (0.7), menu tracker unsafe nested init (0.11), phase timeout degradation hints (0.12). 48 new tests, zero regressions. 4 FRs, 3 NFRs, 21 ACs.
- [x] BUG-0004: Orchestrator overrides conversational opening — replaced stale 3-question protocol with conversational protocol. 17 new tests, zero regressions. 2 FRs, 2 NFRs, 9 ACs.
- [x] REQ-0016: Multi-agent Design Team (Phase 04) + Multi-agent Test Strategy Team (Phase 05) — Creator/Critic/Refiner debate loops. 175 new tests total, zero regressions.
- [x] REQ-0017: Multi-agent Implementation Team (Phase 06) — Writer/Reviewer/Updater per-file debate loop. 86 new tests, zero regressions. 7 FRs, 4 NFRs, 34 ACs.
- [x] REQ-0015: Multi-agent Architecture Team (Phase 03) + Impact Analysis cross-validation Verifier (Approach A). 120 new tests total, zero regressions.
- [x] REQ-0014: Multi-agent Requirements Team (Phase 01) — Creator/Critic/Refiner debate loop, --debate/--no-debate flags, conversational Creator opening (backlog 4.1 + 8.3). 90 new tests, zero regressions. 8 FRs, 5 NFRs, 28 ACs.
- [x] REQ-0013: Supervised mode — per-phase review gates with Continue/Review/Redo menu, parallel change summaries, redo circuit breaker, session recovery. 88 new tests, zero regressions. 8 FRs, 6 NFRs, 35 ACs (backlog 5.1).
- [x] REQ-0008: Backlog management integration — Jira + Confluence backed BACKLOG.md with prompt-driven MCP delegation. 72 new tests, zero regressions. 9 FRs, 5 NFRs, 22 ACs (backlog 7.7).
- [x] BUG-0015: branch-guard false positive after merge — added `branchExistsInGit()`, 4 new tests.
- [x] BUG-0016: state-file-guard false positive on read-only Bash commands — added `isInlineScriptWrite()`, 20 tests.
- [x] BUG-0017: Orchestrator exceeds `init-and-phase-01` scope — MODE ENFORCEMENT block + mode-aware guards, 20 tests.

### 2026-02-14
- [x] REQ-0016: Multi-agent Design Team — Creator/Critic/Refiner debate loop for Phase 04 design specifications. 87 new tests, zero regressions. 7 FRs, 4 NFRs, 34 ACs.
- [x] REQ-0015: Multi-agent Architecture Team — Creator/Critic/Refiner debate loop for Phase 03 architecture design. 87 new tests, zero regressions. 7 FRs, 4 NFRs, 30 ACs.
- [x] REQ-0014: Multi-agent Requirements Team — Creator/Critic/Refiner debate loop for Phase 01 requirements elicitation (backlog 4.1 + 8.3). 90 new tests, 2 implementation iterations. 8 FRs, 5 NFRs, 28 ACs.
- [x] REQ-0008: Backlog management integration — prompt-driven MCP delegation for Jira + Confluence backed BACKLOG.md. 72 new tests, 2 implementation iterations. 9 FRs, 5 NFRs, 22 ACs.
- [x] REQ-0013: Supervised mode — per-phase review gates, --supervised flag. 88 new tests. 8 FRs, 6 NFRs, 35 ACs.
- [x] BUG-0015: branch-guard false positive after merge — added `branchExistsInGit()`, 4 new tests.
- [x] BUG-0016: state-file-guard false positive on read-only Bash — added `isInlineScriptWrite()`, 20 tests.
- [x] BUG-0017: Orchestrator exceeds `init-and-phase-01` scope — MODE ENFORCEMENT block, 20 tests.

### 2026-02-13
- [x] BUG-0014: Early branch creation — moved branch creation to workflow init time. 22 new tests, 0 regressions.
- [x] REQ-0012: Invisible framework — CLAUDE.md rewrite for auto-intent-detection. 49 tests, 28/28 ACs, light workflow.
- [x] BUG-0013: Phase-loop-controller false blocks — same-phase bypass v1.2.0, 11 new tests.
- [x] BUG-0012: Premature git commits — phase-aware commit blocking v2.0.0, 17 new tests.
- [x] REQ-0011: Adaptive workflow sizing — 3 intensities, `-light` flag, sizing functions, STEP 3e-sizing.
- [x] BUG-0011: Subagent phase state overwrite — V8 checkPhaseFieldProtection().

### 2026-02-12
- [x] BUG-0010: Orchestrator finalize stale tasks — rewrote STEP 4 cleanup as mandatory loop.
- [x] BUG-0009: Subagent state.json drift — optimistic locking via state_version counter, V7 block rule.
- [x] REQ-0010: Blast radius coverage validation — new blast-radius-validator.cjs hook, 66 tests, 982 CJS pass.
- [x] BUG-0008: Constitution validator false positive on delegation prompts — detectPhaseDelegation() guard.
- [x] BUG-0007: Test watcher circuit breaker false positives — inconclusive classification.

### 2026-02-11
- [x] REQ-0009: Enhanced plan-to-tasks pipeline — file-level granularity, traceability, dependency graph.
- [x] Split large files: installer.js (~845 lines) and common.cjs (~1460 lines).
- [x] npx and npm publishing.
- [x] REQ-0008: Update Node version — Node 18→20 minimum, CI matrix [20,22,24].
- [x] Add BMAD party mode for requirements.
- [x] Fix: `/isdlc start` should only be offered for new projects.

### 2026-02-10
- [x] REQ-0010: Performance optimization — T1 dispatcher consolidation, T2 prompt optimization, T3 orchestrator bypass + conditional hooks.
- [x] REQ-0005: Workflow progress snapshots in workflow_history.

### 2026-02-09
- [x] Self-healing hook system — normalizePhaseKey(), diagnoseBlockCause(), outputSelfHealNotification(). 917 total tests.

### 2026-02-08
- [x] Foreground task visibility and hook escalation.
- [x] Skill delegation enforcement hooks.
- [x] Reduce hook noise when no SDLC workflow active.
- [x] Rename hook files .js → .cjs for Node 24 compatibility.
- [x] Claude Code detection and rework provider section.
- [x] Post-install tour → interactive use-case-driven guide.
- [x] Preserve uninstall.sh and update.sh during install.
- [x] Remove stale convert-manifest.sh.
- [x] REQ-0003: Formalize hooks API contract + suggested prompts.
- [x] REQ-0005: Enforce advisory behaviors — 7 hooks + logging.
- [x] REQ-0002: PowerShell scripts for Windows + manual code review break.

### 2026-02-07
- [x] Fix skill count discrepancy and regenerate mapping docs.
- [x] Add in-place update mechanism (update.sh + lib/updater.js).
- [x] Post-discovery walkthrough (DE-002).
- [x] Clean handover from /discover to /sdlc start (DE-003).
- [x] Remove --shallow option from /discover (DE-004).
- [x] Review /discover presentation and UX (DE-005).
- [x] Extend /discover behavior extraction to markdown files (DE-001).

### 2026-02-06
- [x] Agent delegation validation in gate-blocker (#4d).
- [x] Wire discovery context into Phases 01-03.
- [x] Merge reverse-engineer into discover (agent count 37→36).

### 2026-02-05
- [x] Refactor skills model: observability over ownership (v3.0.0).
- [x] Remove duplicate agent files.
- [x] Fix phase numbering consistency.
- [x] Add bug report sufficiency check to requirements analyst.

### 2026-02-04
- [x] Cross-platform npm package distribution.
- [x] Fix skills/agents consistency issues.
- [x] Create missing skill files for QS-*/IA-*.

### 2026-01-22 — 2026-01-23
- [x] Gates validation, test agent implementation, iteration enforcement.
- [x] Article XI: Integration Testing Integrity.
- [x] Phase 5: Testing Infrastructure Setup in /sdlc discover.
- [x] skills.sh integration for Phase 3.
- [x] Cloud config moved to Phase 5.
- [x] Phase 1b: Test Automation Evaluation.
