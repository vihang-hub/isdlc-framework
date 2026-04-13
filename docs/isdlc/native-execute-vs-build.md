# Native Claude Code Execution vs `/isdlc build`

After Claude Code exits plan mode (or when the user just asks for a change directly), Claude executes the work in the main conversation: Read/Edit/Write/Bash calls, one agent, linear order. This is **native execute**.

iSDLC ships **`/isdlc build`** — a multi-phase workflow with dedicated sub-agents, hook-enforced gates, and branch management. It is structurally different from native execute in almost every dimension that matters for larger work.

This doc explains the difference, when to use which, and how the trivial tier bridges them.

---

## TL;DR

| | **Native Execute** | **`/isdlc build`** |
|---|---|---|
| **Altitude** | Tactical — edits in this session | Workflow — feature-level delivery |
| **Agents** | 1 (main conversation) | 4+ specialized, dispatched via Task tool |
| **Phases** | None | 05 test-strategy → 06 implementation → 16 quality-loop → 08 code-review |
| **Parallelism** | Sequential edits | Task-level dispatch — independent tasks fan out in parallel tiers |
| **Task tracking** | Ephemeral `TaskCreate` | Durable `docs/isdlc/tasks.md` with file-level decomposition, dependencies, AC traces |
| **Test discipline** | Whatever the main agent chooses | Phase 05 writes strategy; Phase 16 quality loop iterates until tests + automated QA both pass |
| **Code review** | None built-in | Phase 08 QA review with per-file writer/reviewer/updater loop |
| **Coverage enforcement** | None | `blast-radius-validator` blocks advance if any file flagged by impact analysis is unaddressed |
| **Retry on failure** | Abort | Hook-block retry protocol — up to 3 retries for gates, test failures, constitutional, task completion |
| **Constitutional check** | None | Per-phase validation against `docs/isdlc/constitution.md` articles |
| **Git** | Manual commits by user | Auto-creates `feature/` or `bugfix/` branch, commit prohibited during phases, finalize merges to main |
| **Budget tracking** | None | Per-tier wall-clock budget; warns at approaching/exceeded; may degrade debate rounds or fan-out |
| **Finalize** | Nothing | `finalize-steps.md` runs: merge branch, close GitHub issue, rebuild indexes, regenerate contracts, refresh embeddings |
| **Produces on disk** | Whatever was edited | Artifacts in `docs/requirements/{slug}/`, updated `tasks.md`, change record, merged branch |

---

## The altitude difference

**Native execute is tactical.** One agent, one conversation, linear edits. The user is the planner (either via plan mode or just by describing the change), the reviewer (inspecting diffs), the test-runner (deciding what to run and when), and the committer (`git commit` on their own cadence). The framework contribution is minimal — standard safety hooks (branch-guard, state-file-guard) protect against obvious foot-guns, but the content of the work is entirely on the user and the main agent.

**`/isdlc build` is a workflow.** It runs a fixed four-phase sequence, each phase dispatched to a dedicated sub-agent via the Task tool, with hook-enforced gates between them:

1. **Phase 05 — Test Strategy** (`test-design-engineer`): designs the test plan from the acceptance criteria produced during analyze. Outputs `test-strategy.md`, test case files, and a traceability matrix.
2. **Phase 06 — Implementation** (`software-developer`): writes production code task-by-task, following the tasks.md plan. Task-level dispatch (REQ-GH-220) fans out independent tasks in parallel tiers. Each task is scoped to specific files and AC traces.
3. **Phase 16 — Quality Loop** (`quality-loop-engineer`): runs tests and automated QA simultaneously and loops until both pass. This is where blast-radius validation fires — every file the impact analysis flagged must show up in the diff or be explicitly deferred in `requirements-spec.md`.
4. **Phase 08 — Code Review** (`qa-engineer`): reviews each changed file against eight mandatory check categories (logic, errors, security, quality, test quality, tech-stack, constitutional, structured output). Uses a writer/reviewer/updater loop for any file that needs fixes.

Each transition is gated. The `gate-blocker` hook will refuse phase advancement unless completion criteria are met (tests passing, constitutional validation recorded, blast radius covered, tasks marked done). Failures trigger the hook-block retry protocol before escalating to the user.

---

## What each produces

### Native execute produces
- Whatever files were edited
- Whatever commits the user decides to make
- Ephemeral `TaskCreate` entries for session visibility
- Nothing else — no specs, no traceability, no review artifacts

If the session ends or the changes are reverted, nothing outside git history remembers the work.

### `/isdlc build` produces

Always written:
- A dedicated branch (`feature/REQ-GH-NNN-slug` or `bugfix/BUG-GH-NNN-slug`) created at init
- `docs/isdlc/tasks.md` — file-level task decomposition with dependencies, traces, and live `[ ]` / `[X]` status
- `docs/requirements/{slug}/test-strategy.md` — Phase 05 output
- `docs/requirements/{slug}/test-cases/` and `traceability-matrix.csv`
- Per-phase timing and retry telemetry in `.isdlc/state.json`
- Phase summaries for supervised review (optional)

After quality loop and review:
- `blast-radius-coverage.md` — which files were touched, which deferred, which missed
- QA review artifacts per file
- Iteration counts and circuit-breaker telemetry

At finalize:
- Branch merged to main with `--no-ff`
- GitHub issue closed with `ready-to-build` label removed
- `BACKLOG.md` marker updated to `[x]`
- Session cache, code index, memory embeddings, and generated contracts all refreshed
- `active_workflow` moved to `workflow_history` with full phase snapshots

All of this is durable, traceable back to the acceptance criteria from analyze, and replayable via git history + artifact folder.

---

## When to use which

### Use native execute when
- You're making small edits that don't warrant branch management or review phases
- You want to iterate fast on exploratory changes the user will review directly
- The change is a quick fix, rename, config tweak, or one-off refactor
- You are the test-runner and code-reviewer and trust yourself for this change
- You don't need traceability back to AC or a durable artifact record

### Use `/isdlc build` when
- You have an analyzed backlog item with requirements and tasks ready
- You want test-first discipline enforced — tests written before implementation passes the gate
- You want automated QA + code review to run before the change merges
- The work touches multiple files and benefits from parallel task dispatch
- You need blast-radius coverage enforcement — every file the impact analysis flagged must be addressed
- You want branch isolation, so nothing touches main until finalize
- You want the constitutional articles validated per phase
- The work is significant enough that a retry protocol is better than aborting on failure

### Stack them sparingly
- Native execute inside a build phase is **prohibited** by design. The Phase-Loop Controller owns workflow execution, and the `skill-delegation-enforcer` hook blocks direct implementation during workflow commands. Sub-agents dispatched by the phase loop do the work; the main conversation orchestrates.
- Plan mode is also prohibited inside workflow commands (see [Plan Mode vs `/isdlc analyze`](plan-mode-vs-analyze.md)).

---

## The trivial-tier bridge

`/isdlc build --trivial` (or the tier menu selection in the build handler when metrics indicate a small change) is the deliberate bridge between the two modes. It:

1. Reads the requirements context from the artifact folder
2. Makes the edits directly on the current branch, like native execute
3. Prompts the user to confirm
4. Commits with a structured message
5. Writes a `change-record.md` entry in the artifact folder capturing the diff, commit SHA, and modified files
6. Updates `meta.json` with `tier_used: "trivial"` and `last_trivial_change`
7. Marks `BACKLOG.md` as `[x]`

**No workflow is created. No branch is created. No state.json is touched. No hooks fire. No gates are checked.** (See `src/claude/commands/isdlc.md` → TRIVIAL TIER EXECUTION.)

The trivial tier is essentially native execute with an audit trail appended to the artifact folder, skipping the four-phase loop entirely. It's the right choice when analyze concluded the scope is trivial but you still want the work recorded against the backlog item.

---

## Why they are kept separate

Same structural reason as plan mode and analyze: the Phase-Loop Controller is its own orchestration system. It dispatches sub-agents, manages per-phase state, runs iteration loops, enforces gates via hooks, tracks per-task status, and finalizes with branch merges and index refreshes.

Running native execute inside a build phase would create two execution systems trying to drive the same work — the main agent editing directly while a dispatched sub-agent also tries to implement the task. The `skill-delegation-enforcer` hook (`src/claude/hooks/skill-delegation-enforcer.cjs:101`) enforces this separation at the tool level:

> *"For workflow commands, begin by delegating to "{requiredAgent}" for initialization (STEP 1 of the Phase-Loop Controller). Do NOT implement the request directly. Do NOT enter plan mode. Do NOT write code yourself."*

In practice:
- **Before a workflow**: native execute and plan mode are the right primitives for ad-hoc work
- **During a workflow**: the framework owns execution end-to-end; the main conversation is an orchestrator that dispatches sub-agents and relays their output
- **Trivial tier**: the intentional escape hatch — native-execute semantics with a lightweight audit trail, for changes that don't warrant the phase loop

The two mechanisms complement each other by scope, not by feature overlap. Native execute is the right tool when the user wants to own the planning, review, and commit decisions directly. `/isdlc build` is the right tool when the framework should enforce test-first, blast-radius coverage, review, and branch isolation before anything merges.
