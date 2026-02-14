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
- 7.7 [ ] Backlog management integration — curated local BACKLOG.md backed by Jira, with Confluence as input source
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
- 8.3 [ ] Requirements elicitation interaction pattern redesign — replace the cold, generic 3-question opening ("What problem? Who will use this? How will you measure success?") with a conversational, context-aware interaction
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

### 9. Bugs

- 9.1 [x] BUG-0015: branch-guard false positive after merge — **FIXED** (2026-02-14)
  - Added `branchExistsInGit()` using `git rev-parse --verify refs/heads/{name}` — fail-open if branch deleted
  - 4 new tests (T32-T35), 5 existing updated
- 9.2 [x] BUG-0016: state-file-guard false positive on read-only Bash commands — **FIXED** (2026-02-14)
  - Added `isInlineScriptWrite()` — inspects script body for actual write operations instead of blanket-blocking `node -e`
  - 8 integration tests + 12 unit tests added
- 9.3 [x] BUG-0017: Orchestrator exceeds `init-and-phase-01` scope — **FIXED** (2026-02-14)
  - Added CRITICAL-level MODE ENFORCEMENT block at top of orchestrator prompt (before CORE MISSION)
  - Added mode-aware guard in Section 4a (before automatic transitions)
  - Added step 7.5 in Section 4 advancement algorithm (before delegate to next phase)
  - 20 structural prompt validation tests, regression fix in early-branch-creation.test.js

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
