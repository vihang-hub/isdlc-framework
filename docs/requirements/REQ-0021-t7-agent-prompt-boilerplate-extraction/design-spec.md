# Design Specification: T7 Agent Prompt Boilerplate Extraction

**Requirement ID**: REQ-0021
**Phase**: 04-design
**Created**: 2026-02-17
**Status**: Draft

---

## 1. Exact CLAUDE.md Content to Add

All 5 new subsections are appended under the existing `## Agent Framework Context` heading, after the `### CONSTITUTIONAL PRINCIPLES Preamble` section and its trailing `---` separator. The existing `---` separator before `## Project Context` is removed and replaced by the new content, with a new `---` separator placed after the last new subsection (Git Commit Prohibition) and before `## Project Context`.

**Total new content: 113 lines** (within the 120-line budget per NFR-006).
**Post-refactor CLAUDE.md target: 261 lines** (148 current + 113 added).

### 1.1 Root Resolution Protocol (10 lines)

Insert immediately after the `### CONSTITUTIONAL PRINCIPLES Preamble` section's last line (line 108):

```markdown
### Root Resolution Protocol

Resolve the **project root** -- the directory containing `.isdlc/` -- before any other action.

1. Check if `.isdlc/` exists in CWD
2. If **not found**, walk up parent directories (`../`, `../../`, etc.) looking for a directory that contains `.isdlc/state.json` or `.isdlc/monorepo.json`
3. When found, treat that directory as the **project root** for all subsequent `.isdlc/` and `.claude/` path references
4. Record the relative path from that root to the original CWD (e.g., if root is `~/projects/my-app` and CWD is `~/projects/my-app/FE`, the relative path is `FE`). This becomes the **CWD-relative path** used for monorepo project matching.
5. If `.isdlc/` is not found in CWD or any parent, report that the framework is not installed (or fall through to agent-specific error handling)
```

**Line count**: 1 heading + 1 blank + 1 description + 1 blank + 5 steps + 1 blank = **10 lines**

### 1.2 Project Context Resolution -- Monorepo (58 lines)

Insert immediately after Root Resolution Protocol:

```markdown
### Project Context Resolution (Monorepo)

After root resolution, determine if this is a monorepo installation and resolve the active project context.

#### Detection

1. Check if `.isdlc/monorepo.json` exists at the resolved project root
2. If **NO** -- single-project mode. Skip this section entirely. All paths work as before.
3. If **YES** -- monorepo mode. Resolve the active project before proceeding.

#### Project Resolution (Monorepo Mode)

Resolve the active project in this priority order:
1. **`--project {id}` flag** -- if the user passed `--project` on the command, use that project
2. **CWD-based detection** -- use the **CWD-relative path** from ROOT RESOLUTION and match against registered project paths in `monorepo.json` (longest prefix match)
3. **`default_project` in `monorepo.json`** -- use the configured default
4. **Prompt the user** -- if none of the above resolves, present project selection

#### Monorepo Path Routing

Once the active project is resolved, ALL paths are scoped to that project:

| Resource | Single-Project Path | Monorepo Path |
|----------|-------------------|---------------|
| State file | `.isdlc/state.json` | `.isdlc/projects/{project-id}/state.json` |
| Constitution | `docs/isdlc/constitution.md` | `docs/isdlc/projects/{project-id}/constitution.md` (if exists), else `docs/isdlc/constitution.md` |
| External skills | `.claude/skills/external/` | `.isdlc/projects/{project-id}/skills/external/` |
| External manifest | `docs/isdlc/external-skills-manifest.json` | `docs/isdlc/projects/{project-id}/external-skills-manifest.json` |
| Skill report | `docs/isdlc/skill-customization-report.md` | `docs/isdlc/projects/{project-id}/skill-customization-report.md` |
| Requirements docs | `docs/requirements/` | `docs/{project-id}/requirements/` or `{project-path}/docs/requirements/` (depends on `docs_location` in monorepo.json) |
| Architecture docs | `docs/architecture/` | `docs/{project-id}/architecture/` or `{project-path}/docs/architecture/` (depends on `docs_location`) |
| Design docs | `docs/design/` | `docs/{project-id}/design/` or `{project-path}/docs/design/` (depends on `docs_location`) |
| Git branch prefix | `feature/REQ-NNNN-name` | `{project-id}/feature/REQ-NNNN-name` |
| Git branch prefix | `bugfix/BUG-NNNN-id` | `{project-id}/bugfix/BUG-NNNN-id` |

#### Project Context in Delegation

When delegating to any phase agent in monorepo mode, include this context in the Task prompt:
```
MONOREPO CONTEXT:
- Project ID: {project-id}
- Project Name: {project-name}
- Project Path: {project-path}
- State File: .isdlc/projects/{project-id}/state.json
- Docs Base: {resolved docs path}
- Constitution: {resolved constitution path}
- External Skills: .isdlc/projects/{project-id}/skills/external/
- External Manifest: docs/isdlc/projects/{project-id}/external-skills-manifest.json
- Skill Report: docs/isdlc/projects/{project-id}/skill-customization-report.md
```

#### Workflow Independence

In monorepo mode, the `single_active_workflow_per_project` rule applies:
- Each project can have ONE active workflow at a time
- Different projects can have active workflows simultaneously
- Counters (next_req_id, next_bug_id) are per-project in each project's state.json
```

**Line count**: 58 lines (heading through last bullet, including blank lines between sub-sections).

### 1.3 Monorepo Mode Protocol (12 lines)

Insert immediately after Project Context Resolution:

```markdown
### Monorepo Mode Protocol

Agents operating in monorepo mode follow one of two forms based on their role:

**Full delegation form** (phase agents, orchestrator sub-agents): In monorepo mode, all file paths are project-scoped. The orchestrator provides project context (project ID, state file path, docs base path) in the delegation prompt. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.

**Analysis-scoped form** (analysis and tracing sub-agents): In monorepo mode, scope your analysis to the project path provided in the delegation context.

Agent files reference this protocol with:
- Full form: `> See **Monorepo Mode Protocol** in CLAUDE.md.`
- Analysis-scoped: `> See **Monorepo Mode Protocol** in CLAUDE.md (analysis-scoped).`
```

**Line count**: 1 heading + 1 blank + 1 intro + 1 blank + 1 full form + 1 blank + 1 short form + 1 blank + 1 reference intro + 2 reference bullets + 1 blank = **12 lines**

### 1.4 Mandatory Iteration Enforcement Protocol (18 lines)

Insert immediately after Monorepo Mode Protocol:

```markdown
### Mandatory Iteration Enforcement Protocol

Agents with iteration enforcement MUST follow this protocol. Each agent specifies its own **completion criteria** and **max iterations** in its agent file.

**Core rules:**
1. Execute your work loop: produce output, run checks/tests, evaluate results
2. If checks fail: analyze failures, fix issues, and retry from step 1
3. Repeat until your completion criteria are met OR max iterations reached
4. **NEVER** declare "task complete" or "phase complete" while checks are failing

**Hook enforcement**: The `test-watcher` hook monitors test executions. If you attempt to advance the gate while tests are failing, you will be BLOCKED. Do not waste iterations -- fix the failures and keep testing.

**Iteration configuration**: The framework reads `max_iterations` and `circuit_breaker_threshold` from `state.json` (per-workflow overrides) or `iteration-requirements.json` (global defaults). Agent-specified values in agent files take precedence when explicitly stated.

Agent files reference this protocol with:
> Follow the **Mandatory Iteration Enforcement Protocol** in CLAUDE.md.
> **Completion criteria**: {agent-specific criteria}. **Max iterations**: {N}.
```

**Line count**: 1 heading + 1 blank + 1 intro + 1 blank + 1 core rules header + 4 rules + 1 blank + 1 hook paragraph + 1 blank + 1 config paragraph + 1 blank + 1 reference intro + 2 reference lines + 1 blank = **18 lines**

### 1.5 Git Commit Prohibition (8 lines)

Insert immediately after Mandatory Iteration Enforcement Protocol, followed by `---` separator before `## Project Context`:

```markdown
### Git Commit Prohibition

**Do NOT run `git add`, `git commit`, or `git push` during phase work.** All file changes must remain uncommitted on the working tree. The orchestrator handles git add, commit, and merge at workflow finalize.

**Rationale**: Commits represent validated work that has passed quality gates and code review. Committing before those phases creates unvalidated snapshots in version control. The orchestrator manages all git operations at the appropriate time.
```

**Line count**: 1 heading + 1 blank + 1 prohibition + 1 blank + 1 rationale + 1 blank = **6 lines** (+ 1 `---` separator + 1 blank before `## Project Context` = 8 lines total including structural separators).

### 1.6 Cumulative Line Budget

| Section | Lines |
|---------|-------|
| Root Resolution Protocol | 10 |
| Project Context Resolution (Monorepo) | 58 |
| Monorepo Mode Protocol | 12 |
| Mandatory Iteration Enforcement Protocol | 18 |
| Git Commit Prohibition | 8 |
| Structural separators removed/added (net) | +7 |
| **Total addition** | **113** |

**Result**: 148 (current) + 113 = **261 lines**. Within the 280-line ceiling (NFR-006) and within the 120-line budget.

---

## 2. Agent Modification Specifications

For each affected agent file, this section specifies the exact content to remove and the exact replacement text.

### 2.1 Orchestrator Agents (Phase 2 -- 2 files)

#### 2.1.1 `src/claude/agents/00-sdlc-orchestrator.md` (1752 lines)

**Remove**: Lines 45-112 (ROOT RESOLUTION section through end of Workflow Independence in SECTION 0).

Exact text to remove (68 lines):
```
# ROOT RESOLUTION (Before anything else)

Resolve the **project root** — the directory containing `.isdlc/` — before any other action.

1. Check if `.isdlc/` exists in CWD
2. If **not found**, walk up parent directories (`../`, `../../`, etc.) looking for a directory that contains `.isdlc/state.json` or `.isdlc/monorepo.json`
3. When found, treat that directory as the **project root** for all subsequent `.isdlc/` and `.claude/` path references
4. Record the relative path from that root to the original CWD (e.g., if root is `~/projects/my-app` and CWD is `~/projects/my-app/FE`, the relative path is `FE`). This becomes the **CWD-relative path** used for monorepo project matching.
5. If `.isdlc/` is not found in CWD or any parent, report that the framework is not installed

# SECTION 0: PROJECT CONTEXT RESOLUTION (MONOREPO)

After root resolution, determine if this is a monorepo installation and resolve the active project context.

## Detection

1. Check if `.isdlc/monorepo.json` exists at the resolved project root
2. If **NO** → single-project mode. Skip this section entirely. All paths work as before.
3. If **YES** → monorepo mode. Resolve the active project before proceeding.

## Project Resolution (Monorepo Mode)

Resolve the active project in this priority order:
1. **`--project {id}` flag** — if the user passed `--project` on the command, use that project
2. **CWD-based detection** — use the **CWD-relative path** from ROOT RESOLUTION and match against registered project paths in `monorepo.json` (longest prefix match)
3. **`default_project` in `monorepo.json`** — use the configured default
4. **Prompt the user** — if none of the above resolves, present project selection (SCENARIO 0 from the `/isdlc` command)

## Monorepo Path Routing

Once the active project is resolved, ALL paths are scoped to that project:

| Resource | Single-Project Path | Monorepo Path |
|----------|-------------------|---------------|
| State file | `.isdlc/state.json` | `.isdlc/projects/{project-id}/state.json` |
| Constitution | `docs/isdlc/constitution.md` | `docs/isdlc/projects/{project-id}/constitution.md` (if exists), else `docs/isdlc/constitution.md` |
| External skills | `.claude/skills/external/` | `.isdlc/projects/{project-id}/skills/external/` |
| External manifest | `docs/isdlc/external-skills-manifest.json` | `docs/isdlc/projects/{project-id}/external-skills-manifest.json` |
| Skill report | `docs/isdlc/skill-customization-report.md` | `docs/isdlc/projects/{project-id}/skill-customization-report.md` |
| Requirements docs | `docs/requirements/` | `docs/{project-id}/requirements/` or `{project-path}/docs/requirements/` (depends on `docs_location` in monorepo.json) |
| Architecture docs | `docs/architecture/` | `docs/{project-id}/architecture/` or `{project-path}/docs/architecture/` (depends on `docs_location`) |
| Design docs | `docs/design/` | `docs/{project-id}/design/` or `{project-path}/docs/design/` (depends on `docs_location`) |
| Git branch prefix | `feature/REQ-NNNN-name` | `{project-id}/feature/REQ-NNNN-name` |
| Git branch prefix | `bugfix/BUG-NNNN-id` | `{project-id}/bugfix/BUG-NNNN-id` |

## Project Context in Delegation

When delegating to any phase agent in monorepo mode, include this context in the Task prompt:
```
MONOREPO CONTEXT:
- Project ID: {project-id}
- Project Name: {project-name}
- Project Path: {project-path}
- State File: .isdlc/projects/{project-id}/state.json
- Docs Base: {resolved docs path — docs/{project-id}/ if docs_location="root" or absent, {project-path}/docs/ if docs_location="project"}
- Constitution: {resolved constitution path}
- External Skills: .isdlc/projects/{project-id}/skills/external/
- External Manifest: docs/isdlc/projects/{project-id}/external-skills-manifest.json
- Skill Report: docs/isdlc/projects/{project-id}/skill-customization-report.md
```

## Workflow Independence

In monorepo mode, the `single_active_workflow_per_project` rule applies:
- Each project can have ONE active workflow at a time
- Different projects can have active workflows simultaneously
- Counters (next_req_id, next_bug_id) are per-project in each project's state.json
```

**Replace with** (1 line):
```markdown
> See **Root Resolution Protocol** and **Project Context Resolution (Monorepo)** in CLAUDE.md.
```

**Net change**: -67 lines. Post-refactor: ~1685 lines.

#### 2.1.2 `src/claude/agents/discover-orchestrator.md` (2529 lines)

**Remove**: Lines 62-104 (ROOT RESOLUTION section through end of MONOREPO PREAMBLE).

Exact text to remove starts with:
```
### ROOT RESOLUTION (Before anything else)
```
And ends with:
```
If NOT in monorepo mode, skip the preamble entirely and proceed to the no-argument menu check.
```

This is 43 lines total.

**Replace with** (1 line):
```markdown
> See **Root Resolution Protocol** and **Project Context Resolution (Monorepo)** in CLAUDE.md. If NOT in monorepo mode, skip the preamble and proceed to the no-argument menu check.
```

**Net change**: -42 lines. Post-refactor: ~2487 lines.

### 2.2 Multi-Boilerplate Agents (Phase 3 -- 4 files)

#### 2.2.1 `src/claude/agents/05-software-developer.md` (932 lines)

Three sections to remove:

**Section A -- Monorepo blockquote** (line 24):
Remove:
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. The orchestrator provides project context (project ID, state file path, docs base path) in the delegation prompt. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.
```
Replace with:
```
> See **Monorepo Mode Protocol** in CLAUDE.md.
```

**Section B -- Iteration enforcement** (lines 26-36):
Remove:
```
# ⚠️ MANDATORY ITERATION ENFORCEMENT

**YOU MUST NOT COMPLETE YOUR TASK UNTIL ALL UNIT TESTS PASS WITH ≥80% COVERAGE.**

This is a hard requirement enforced by the iSDLC framework:
1. **Write tests** → **Write code** → **Run tests** → If ANY test fails → **Fix and retry**
2. **Repeat** until ALL tests pass AND coverage ≥80% OR max iterations (10) reached
3. **Only then** may you proceed to documentation and phase completion
4. **NEVER** declare "task complete" or "phase complete" while tests are failing

The `test-watcher` hook monitors your test executions. If you attempt to advance the gate while tests are failing, you will be BLOCKED. Do not waste iterations - fix the failures and keep testing.
```
Replace with:
```
> Follow the **Mandatory Iteration Enforcement Protocol** in CLAUDE.md.
> **Completion criteria**: ALL UNIT TESTS PASS WITH >=80% COVERAGE. **Max iterations**: 10.
```

**Section C -- Git commit warning** (lines 38-42):
Remove:
```
# CRITICAL: Do NOT Run Git Commits

**Do NOT run `git add`, `git commit`, or `git push` during implementation.** All file changes must remain uncommitted on the working tree. The orchestrator handles git add, commit, and merge at workflow finalize.

**Why**: Commits should represent validated work that has passed Phase 16 (quality-loop) and Phase 08 (code-review). Committing before those phases creates unvalidated snapshots in version control. The orchestrator manages all git operations at the appropriate time.
```
Replace with:
```
> See **Git Commit Prohibition** in CLAUDE.md.
```

**Net change**: Removed ~21 lines, added ~4 lines = **-17 lines**. Post-refactor: ~915 lines.

#### 2.2.2 `src/claude/agents/06-integration-tester.md` (847 lines)

Two sections to remove:

**Section A -- Monorepo blockquote** (line 18):
Remove:
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. The orchestrator provides project context (project ID, state file path, docs base path) in the delegation prompt. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.
```
Replace with:
```
> See **Monorepo Mode Protocol** in CLAUDE.md.
```

**Section B -- Iteration enforcement** (lines 20-30):
Remove:
```
# ⚠️ MANDATORY ITERATION ENFORCEMENT

**YOU MUST NOT COMPLETE YOUR TASK UNTIL ALL TESTS PASS.**

This is a hard requirement enforced by the iSDLC framework:
1. **Run tests** → If ANY test fails → **You MUST fix and retry**
2. **Repeat** until ALL tests pass OR max iterations (10) reached
3. **Only then** may you proceed to coverage analysis and reporting
4. **NEVER** declare "task complete" or "phase complete" while tests are failing

The `test-watcher` hook monitors your test executions. If you attempt to advance the gate while tests are failing, you will be BLOCKED. Do not waste iterations - fix the failures and keep testing.
```
Replace with:
```
> Follow the **Mandatory Iteration Enforcement Protocol** in CLAUDE.md.
> **Completion criteria**: ALL TESTS PASS. **Max iterations**: 10.
```

**Net change**: Removed ~14 lines, added ~3 lines = **-11 lines**. Post-refactor: ~836 lines.

#### 2.2.3 `src/claude/agents/14-upgrade-engineer.md` (651 lines)

Two sections to remove:

**Section A -- Monorepo blockquote** (line 18):
Remove:
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. The orchestrator provides project context (project ID, state file path, docs base path) in the delegation prompt. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.
```
Replace with:
```
> See **Monorepo Mode Protocol** in CLAUDE.md.
```

**Section B -- Iteration enforcement** (lines 20-29):
Remove:
```
# MANDATORY ITERATION ENFORCEMENT

**HARD REQUIREMENT**: You MUST iterate until ALL regression tests pass or the configured iteration limit is reached. There is NO acceptable state where:
- Tests that passed before the upgrade now fail
- The build is broken after the upgrade
- Migration steps are left incomplete

You will run the implement-test loop as many times as needed (up to `max_iterations`, default 10). Each iteration must make measurable progress toward fixing failures.

**Circuit breaker**: If the same 3 failures repeat identically across 3 consecutive iterations with no progress, escalate to the user rather than consuming remaining iterations.
```
Replace with:
```
> Follow the **Mandatory Iteration Enforcement Protocol** in CLAUDE.md.
> **Completion criteria**: ALL regression tests pass or iteration limit reached. **Max iterations**: 10. **Circuit breaker**: 3.
```

**Net change**: Removed ~13 lines, added ~3 lines = **-10 lines**. Post-refactor: ~641 lines.

#### 2.2.4 `src/claude/agents/16-quality-loop-engineer.md` (508 lines)

Two sections to remove:

**Section A -- Git commit warning** (lines 33-35):
Remove:
```
## CRITICAL: Do NOT Run Git Commits

**Do NOT run `git add`, `git commit`, or `git push` during the quality loop.** Phase 08 (code-review) has not yet run, so changes are not validated for commit. Leave all file changes uncommitted on the working tree. The orchestrator handles git operations at workflow finalize.
```
Replace with:
```
> See **Git Commit Prohibition** in CLAUDE.md.
```

**Section B -- Iteration enforcement** (lines 105-112):
Remove:
```
## MANDATORY ITERATION ENFORCEMENT

**You MUST iterate until BOTH tracks pass.** Do NOT proceed to GATE-16 if any check fails.

1. Run Track A and Track B in parallel
2. If EITHER track has failures: consolidate all failures, delegate fixes to software-developer, re-run BOTH tracks
3. Repeat until both tracks pass completely
4. Only then proceed to GATE-16
```
Replace with:
```
> Follow the **Mandatory Iteration Enforcement Protocol** in CLAUDE.md.
> **Completion criteria**: BOTH tracks pass. Do NOT proceed to GATE-16 if any check fails.
```

**Net change**: Removed ~11 lines, added ~3 lines = **-8 lines**. Post-refactor: ~500 lines.

### 2.3 Discover Sub-Agents (Phase 4 -- 3 files)

#### 2.3.1 `src/claude/agents/discover/characterization-test-generator.md` (477 lines)

Two sections to remove:

**Section A -- Monorepo blockquote** (line 19):
Remove:
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. The orchestrator provides project context (project ID, state file path, docs base path) in the delegation prompt. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.
```
Replace with:
```
> See **Monorepo Mode Protocol** in CLAUDE.md.
```

**Section B -- Iteration enforcement** (lines 21-29):
Remove:
```
# ⚠️ MANDATORY ITERATION ENFORCEMENT

**YOU MUST NOT COMPLETE YOUR TASK UNTIL ALL CHARACTERIZATION TESTS ARE GENERATED AND VALIDATED.**

This is a self-enforced requirement:
1. **Generate tests** → **Execute capture** → **Verify fixtures** → If test scaffold fails → **Fix and retry**
2. **Repeat** until all AC have corresponding tests OR max iterations (10) reached
3. **Only then** may you declare task complete
4. **NEVER** declare "task complete" while test generation is incomplete
```
Replace with:
```
> Follow the **Mandatory Iteration Enforcement Protocol** in CLAUDE.md.
> **Completion criteria**: ALL CHARACTERIZATION TESTS ARE GENERATED AND VALIDATED. **Max iterations**: 10.
```

**Net change**: Removed ~12 lines, added ~3 lines = **-9 lines**. Post-refactor: ~468 lines.

#### 2.3.2 `src/claude/agents/discover/artifact-integration.md` (314 lines)

Two sections to remove:

**Section A -- Monorepo blockquote** (line 15):
Remove:
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. The orchestrator provides project context (project ID, state file path, docs base path) in the delegation prompt. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.
```
Replace with:
```
> See **Monorepo Mode Protocol** in CLAUDE.md.
```

**Section B -- Iteration enforcement** (lines 17-25):
Remove:
```
# ⚠️ MANDATORY ITERATION ENFORCEMENT

**YOU MUST NOT COMPLETE YOUR TASK UNTIL ALL ARTIFACTS ARE PROPERLY LINKED AND TRACEABLE.**

This is a self-enforced requirement:
1. **Link AC** → **Build traceability** → **Generate report** → If traceability incomplete → **Fix and retry**
2. **Repeat** until all AC have feature map links OR max iterations (5) reached
3. **Only then** may you declare task complete
4. **NEVER** declare "task complete" while integration is incomplete
```
Replace with:
```
> Follow the **Mandatory Iteration Enforcement Protocol** in CLAUDE.md.
> **Completion criteria**: ALL ARTIFACTS ARE PROPERLY LINKED AND TRACEABLE. **Max iterations**: 5.
```

**Net change**: Removed ~12 lines, added ~3 lines = **-9 lines**. Post-refactor: ~305 lines.

#### 2.3.3 `src/claude/agents/discover/atdd-bridge.md` (370 lines)

Two sections to remove:

**Section A -- Monorepo blockquote** (line 15):
Remove:
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. The orchestrator provides project context (project ID, state file path, docs base path) in the delegation prompt. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.
```
Replace with:
```
> See **Monorepo Mode Protocol** in CLAUDE.md.
```

**Section B -- Iteration enforcement** (lines 23-30):
Remove:
```
# ⚠️ MANDATORY ITERATION ENFORCEMENT

**YOU MUST NOT COMPLETE YOUR TASK UNTIL ATDD ARTIFACTS ARE PROPERLY GENERATED.**

This is a self-enforced requirement:
1. **Generate checklist** → **Tag AC** → **Validate** → If incomplete → **Fix and retry**
2. **Repeat** until ATDD checklist complete OR max iterations (5) reached
3. **Only then** may you declare task complete
```
Replace with:
```
> Follow the **Mandatory Iteration Enforcement Protocol** in CLAUDE.md.
> **Completion criteria**: ATDD ARTIFACTS ARE PROPERLY GENERATED. **Max iterations**: 5.
```

**Net change**: Removed ~10 lines, added ~3 lines = **-7 lines**. Post-refactor: ~363 lines.

### 2.4 Single-Boilerplate Phase Agents (Phase 5 -- 10 files)

All 10 files receive the identical transformation: remove the full monorepo blockquote line and replace with a reference.

For each file, remove this exact line:
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. The orchestrator provides project context (project ID, state file path, docs base path) in the delegation prompt. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.
```

Replace with:
```
> See **Monorepo Mode Protocol** in CLAUDE.md.
```

| # | File | Monorepo Line # | Current Lines | Post-Refactor |
|---|------|----------------|---------------|---------------|
| 1 | `02-solution-architect.md` | 95 | 744 | 744 (1:1 replace) |
| 2 | `03-system-designer.md` | top area | 419 | 419 |
| 3 | `04-test-design-engineer.md` | top area | 677 | 677 |
| 4 | `07-qa-engineer.md` | 11 | 376 | 376 |
| 5 | `08-security-compliance-auditor.md` | 23 | 240 | 240 |
| 6 | `09-cicd-engineer.md` | 16 | 219 | 219 |
| 7 | `10-dev-environment-engineer.md` | 17 | 331 | 331 |
| 8 | `11-deployment-engineer-staging.md` | 14 | 202 | 202 |
| 9 | `12-release-manager.md` | 15 | 228 | 228 |
| 10 | `13-site-reliability-engineer.md` | 24 | 316 | 316 |

**Net change per file**: 0 lines (1 line removed, 1 line added -- the blockquote is a single wrapped line). The token savings comes from the shorter replacement text.

**Note**: Although the line count difference is zero, the character count reduction is substantial. Each original blockquote is ~244 characters; the replacement is ~48 characters. Per file: -196 characters. Total across 10 files: **-1,960 characters**.

### 2.5 Analysis Sub-Agents (Phase 6 -- 7 files)

All 7 files receive the identical transformation: remove the short-form monorepo blockquote and replace with an analysis-scoped reference.

For each file, remove this exact line:
```
> **Monorepo Mode**: In monorepo mode, scope your analysis to the project path provided in the delegation context.
```

Replace with:
```
> See **Monorepo Mode Protocol** in CLAUDE.md (analysis-scoped).
```

| # | File | Monorepo Line # | Current Lines |
|---|------|----------------|---------------|
| 1 | `impact-analysis/impact-analyzer.md` | 21 | 516 |
| 2 | `impact-analysis/entry-point-finder.md` | 21 | 615 |
| 3 | `impact-analysis/cross-validation-verifier.md` | 19 | 460 |
| 4 | `impact-analysis/risk-assessor.md` | 21 | 644 |
| 5 | `tracing/execution-path-tracer.md` | 15 | 384 |
| 6 | `tracing/root-cause-identifier.md` | 14 | 408 |
| 7 | `tracing/symptom-analyzer.md` | 14 | 326 |

**Net change per file**: 0 lines (1:1 replacement). Character savings: ~52 chars per file. Total: **-364 characters**.

### 2.6 Remaining Agents (Phase 7 -- 3 files)

#### 2.6.1 `src/claude/agents/tracing/tracing-orchestrator.md` (416 lines)

Remove (line 13):
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. The orchestrator provides project context (project ID, state file path, docs base path) in the delegation prompt. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.
```
Replace with:
```
> See **Monorepo Mode Protocol** in CLAUDE.md.
```

**Net change**: 0 lines (1:1 replacement).

#### 2.6.2 `src/claude/agents/quick-scan/quick-scan-agent.md` (314 lines)

Remove (line 15):
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.
```
Replace with:
```
> See **Monorepo Mode Protocol** in CLAUDE.md.
```

**Net change**: 0 lines (1:1 replacement).

#### 2.6.3 `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` (889 lines)

Remove (line 22):
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. The orchestrator provides project context in the delegation prompt. Read state from the project-specific state.json.
```
Replace with:
```
> See **Monorepo Mode Protocol** in CLAUDE.md.
```

**Net change**: 0 lines (1:1 replacement).

---

## 3. Implementation Task Breakdown

The implementation follows the 8-phase dependency chain from the architecture document (Section 6.1). Each phase depends on the previous one completing successfully.

### Phase 1: CLAUDE.md Additions (Foundation)

**File**: `CLAUDE.md`
**Dependency**: None (first phase)
**Goal**: Add all 5 new subsections before modifying any agent files.

**Steps**:
1. Capture baseline: `wc -l CLAUDE.md` (expected: 148)
2. Remove the `---` separator between `### CONSTITUTIONAL PRINCIPLES Preamble` section and `## Project Context` (line 109)
3. Insert the 5 new subsections (from Section 1 of this document) after line 108
4. Add `---` separator after the last new subsection and before `## Project Context`
5. Verify line count: `wc -l CLAUDE.md` (expected: ~261, must be <= 268 = 148 + 120)
6. Verify markdown heading hierarchy is correct

**Acceptance**: CLAUDE.md grows by exactly the expected amount. All 5 new subsections are present under `## Agent Framework Context`.

### Phase 2: Orchestrator Agents (2 files)

**Files**: `00-sdlc-orchestrator.md`, `discover-orchestrator.md`
**Dependency**: Phase 1 complete
**Goal**: Replace the largest inline sections with references.

**Steps**:
1. In `00-sdlc-orchestrator.md`:
   - Remove lines 45-112 (ROOT RESOLUTION through Workflow Independence)
   - Insert reference line (see Section 2.1.1)
   - Verify heading hierarchy remains valid
2. In `discover-orchestrator.md`:
   - Remove lines 62-104 (ROOT RESOLUTION through "skip the preamble")
   - Insert reference line (see Section 2.1.2)
   - Verify heading hierarchy remains valid

**Acceptance**: Both orchestrators reference CLAUDE.md. No inline ROOT RESOLUTION or SECTION 0 / MONOREPO PREAMBLE content remains.

### Phase 3: Multi-Boilerplate Agents (4 files)

**Files**: `05-software-developer.md`, `06-integration-tester.md`, `14-upgrade-engineer.md`, `16-quality-loop-engineer.md`
**Dependency**: Phase 2 complete
**Goal**: Remove 2-3 sections per file and replace with references + iteration customization.

**Steps**:
1. For each file, apply the removals and replacements specified in Section 2.2
2. For iteration agents: verify the completion criteria line contains the exact agent-specific text
3. For git commit agents (05, 16): verify the git prohibition reference is present
4. Verify no heading hierarchy breaks

**Acceptance**: All 4 files have references. Agent-specific iteration criteria and max iterations are preserved.

### Phase 4: Discover Sub-Agents (3 files)

**Files**: `discover/characterization-test-generator.md`, `discover/artifact-integration.md`, `discover/atdd-bridge.md`
**Dependency**: Phase 3 complete
**Goal**: Remove monorepo + iteration sections and replace with references.

**Steps**:
1. For each file, apply the removals and replacements specified in Section 2.3
2. Verify non-default max iterations (5 for artifact-integration and atdd-bridge)
3. Verify the monorepo reference uses the full-form variant

**Acceptance**: All 3 files have references. Max iterations of 5 preserved for artifact-integration and atdd-bridge.

### Phase 5: Single-Boilerplate Phase Agents (10 files)

**Files**: Listed in Section 2.4
**Dependency**: Phase 4 complete
**Goal**: Simple blockquote replacement across 10 files.

**Steps**:
1. For each of the 10 files, replace the monorepo blockquote with the reference (Section 2.4)
2. This is a batch operation -- each replacement is identical

**Acceptance**: All 10 files have the reference. No full blockquote text remains.

### Phase 6: Analysis Sub-Agents (7 files)

**Files**: Listed in Section 2.5
**Dependency**: Phase 5 complete
**Goal**: Replace short-form monorepo blockquote with analysis-scoped reference.

**Steps**:
1. For each of the 7 files, replace the short blockquote with the analysis-scoped reference (Section 2.5)
2. This is a batch operation -- each replacement is identical

**Acceptance**: All 7 files have the analysis-scoped reference. No short blockquote text remains.

### Phase 7: Remaining Agents (3 files)

**Files**: `tracing/tracing-orchestrator.md`, `quick-scan/quick-scan-agent.md`, `impact-analysis/impact-analysis-orchestrator.md`
**Dependency**: Phase 6 complete
**Goal**: Replace remaining monorepo blockquotes.

**Steps**:
1. For each of the 3 files, replace the monorepo blockquote with the full-form reference (Section 2.6)

**Acceptance**: All 3 files have the reference. No inline monorepo blockquote text remains in any agent file.

### Phase 8: Verification

**Dependency**: Phase 7 complete
**Goal**: Execute all 5 verification checks.

**Steps**: Execute V-001 through V-005 (see Section 4 below).

**Acceptance**: All 5 verification checks pass.

---

## 4. Verification Specification

### V-001: Line Count Verification

**Commands**:
```bash
# CLAUDE.md budget check
wc -l CLAUDE.md
# Expected: 261 (148 + 113), must be <= 268 (148 + 120)

# Agent files -- spot check the largest savings
wc -l src/claude/agents/00-sdlc-orchestrator.md
# Expected: ~1685 (was 1752, removed ~67 lines)

wc -l src/claude/agents/discover-orchestrator.md
# Expected: ~2487 (was 2529, removed ~42 lines)

wc -l src/claude/agents/05-software-developer.md
# Expected: ~915 (was 932, removed ~17 lines)

wc -l src/claude/agents/06-integration-tester.md
# Expected: ~836 (was 847, removed ~11 lines)

wc -l src/claude/agents/14-upgrade-engineer.md
# Expected: ~641 (was 651, removed ~10 lines)

wc -l src/claude/agents/16-quality-loop-engineer.md
# Expected: ~500 (was 508, removed ~8 lines)

wc -l src/claude/agents/discover/characterization-test-generator.md
# Expected: ~468 (was 477, removed ~9 lines)

wc -l src/claude/agents/discover/artifact-integration.md
# Expected: ~305 (was 314, removed ~9 lines)

wc -l src/claude/agents/discover/atdd-bridge.md
# Expected: ~363 (was 370, removed ~7 lines)
```

**Pass criteria**:
- CLAUDE.md: 148 < new_count <= 268
- Each agent file: new_count <= original_count
- Net reduction: sum of all agent reductions - CLAUDE.md increase >= 29 lines

### V-002: No Remaining Duplication (Grep Sweep)

**Commands**:
```bash
# Full delegation form -- expect 0 matches in agents
grep -r "all file paths are project-scoped. The orchestrator provides project context (project ID" src/claude/agents/
# Expected: 0 results

# Short analysis form -- expect 0 matches in agents
grep -r "scope your analysis to the project path provided in the delegation context" src/claude/agents/
# Expected: 0 results

# Iteration enforcement full sections -- expect 0 multi-line matches
# Check for the structural content (rules 1-4 pattern)
grep -r "NEVER.*declare.*task complete.*while.*failing" src/claude/agents/
# Expected: 0 results (this phrase was in the full section)

grep -r "NEVER.*declare.*task complete.*while.*incomplete" src/claude/agents/
# Expected: 0 results

# Git commit full sections -- expect 0 matches
grep -r "Do NOT run.*git add.*git commit.*git push.*during" src/claude/agents/
# Expected: 0 results

# Root resolution full section -- expect 0 matches
grep -r "ROOT RESOLUTION (Before anything else)" src/claude/agents/
# Expected: 0 results

# Section 0 full section -- expect 0 matches
grep -r "SECTION 0: PROJECT CONTEXT RESOLUTION" src/claude/agents/
# Expected: 0 results

# Monorepo preamble full section -- expect 0 matches
grep -r "MONOREPO PREAMBLE (Before fast path check)" src/claude/agents/
# Expected: 0 results

# Verify references DO exist (positive check)
grep -r "See \*\*Monorepo Mode Protocol\*\*" src/claude/agents/ | wc -l
# Expected: 20 (10 phase + 3 discover + 3 remaining + 4 multi-boilerplate)

grep -r "Mandatory Iteration Enforcement Protocol" src/claude/agents/ | wc -l
# Expected: 7

grep -r "Git Commit Prohibition" src/claude/agents/ | wc -l
# Expected: 2

grep -r "Root Resolution Protocol" src/claude/agents/ | wc -l
# Expected: 2
```

**Pass criteria**: All negative checks return 0 results. All positive checks return expected counts.

### V-003: Content Equivalence

**Method**: Manual spot checks that agent-specific criteria are preserved.

**Checks**:
```bash
# 05-software-developer still sees >=80% COVERAGE
grep "80%" src/claude/agents/05-software-developer.md
# Expected: 1 match (in the completion criteria line)

# 06-integration-tester still sees ALL TESTS PASS
grep "ALL TESTS PASS" src/claude/agents/06-integration-tester.md
# Expected: 1 match

# 14-upgrade-engineer still sees circuit breaker: 3
grep "Circuit breaker.*3" src/claude/agents/14-upgrade-engineer.md
# Expected: 1 match

# discover/artifact-integration still sees max iterations 5
grep "Max iterations.*5" src/claude/agents/discover/artifact-integration.md
# Expected: 1 match

# discover/atdd-bridge still sees max iterations 5
grep "Max iterations.*5" src/claude/agents/discover/atdd-bridge.md
# Expected: 1 match

# 16-quality-loop-engineer still sees BOTH tracks pass
grep "BOTH tracks pass" src/claude/agents/16-quality-loop-engineer.md
# Expected: 1 match

# CLAUDE.md contains the full root resolution algorithm
grep "Walk up parent directories" CLAUDE.md || grep "walk up parent directories" CLAUDE.md
# Expected: 1 match

# CLAUDE.md contains the path routing table
grep "Monorepo Path Routing" CLAUDE.md
# Expected: 1 match

# CLAUDE.md contains delegation context template
grep "MONOREPO CONTEXT" CLAUDE.md
# Expected: 1 match
```

**Pass criteria**: All checks return expected match counts.

### V-004: Hook Test Suite

**Commands**:
```bash
npm run test:hooks
# Expected: all tests pass, 0 new failures

npm test
# Expected: all ESM tests pass, 0 new failures
```

**Pass criteria**: All tests pass. No new failures or skips compared to pre-refactor baseline.

### V-005: Structural Integrity

**Method**: Manual verification of markdown structure.

**Checks**:
1. CLAUDE.md heading hierarchy:
   - `## Agent Framework Context` (existing H2)
   - `### SKILL OBSERVABILITY Protocol` (existing H3)
   - `### SUGGESTED PROMPTS` (existing H3)
   - `### CONSTITUTIONAL PRINCIPLES Preamble` (existing H3)
   - `### Root Resolution Protocol` (new H3)
   - `### Project Context Resolution (Monorepo)` (new H3)
     - `#### Detection` (H4)
     - `#### Project Resolution (Monorepo Mode)` (H4)
     - `#### Monorepo Path Routing` (H4)
     - `#### Project Context in Delegation` (H4)
     - `#### Workflow Independence` (H4)
   - `### Monorepo Mode Protocol` (new H3)
   - `### Mandatory Iteration Enforcement Protocol` (new H3)
   - `### Git Commit Prohibition` (new H3)
   - `---` separator
   - `## Project Context` (existing H2)

2. Agent files: verify no broken heading hierarchy by checking that no agent file has orphaned sub-headings where parent headings were removed. For orchestrators, ensure the reference line does not break the heading flow.

**Pass criteria**: All headings are properly nested. No orphaned sub-headings.

---

## 5. Pre-Refactor Baselines

Capture these before any changes:

| File | Current Lines |
|------|---------------|
| `CLAUDE.md` | 148 |
| `00-sdlc-orchestrator.md` | 1752 |
| `discover-orchestrator.md` | 2529 |
| `05-software-developer.md` | 932 |
| `06-integration-tester.md` | 847 |
| `14-upgrade-engineer.md` | 651 |
| `16-quality-loop-engineer.md` | 508 |
| `02-solution-architect.md` | 744 |
| `03-system-designer.md` | 419 |
| `04-test-design-engineer.md` | 677 |
| `07-qa-engineer.md` | 376 |
| `08-security-compliance-auditor.md` | 240 |
| `09-cicd-engineer.md` | 219 |
| `10-dev-environment-engineer.md` | 331 |
| `11-deployment-engineer-staging.md` | 202 |
| `12-release-manager.md` | 228 |
| `13-site-reliability-engineer.md` | 316 |
| `discover/characterization-test-generator.md` | 477 |
| `discover/artifact-integration.md` | 314 |
| `discover/atdd-bridge.md` | 370 |
| `tracing/tracing-orchestrator.md` | 416 |
| `tracing/execution-path-tracer.md` | 384 |
| `tracing/root-cause-identifier.md` | 408 |
| `tracing/symptom-analyzer.md` | 326 |
| `impact-analysis/impact-analysis-orchestrator.md` | 889 |
| `impact-analysis/impact-analyzer.md` | 516 |
| `impact-analysis/entry-point-finder.md` | 615 |
| `impact-analysis/cross-validation-verifier.md` | 460 |
| `impact-analysis/risk-assessor.md` | 644 |
| `quick-scan/quick-scan-agent.md` | 314 |

**Hook test baseline**: Run `npm run test:hooks` and `npm test` before any changes. Record pass/fail counts.

---

## 6. Net Savings Summary

| Category | Lines Removed from Agents | Lines Added to Agents | Lines Added to CLAUDE.md | Net Change |
|----------|--------------------------|----------------------|--------------------------|------------|
| Orchestrators (2) | 111 | 2 | 68 (Root Res + Project Context) | -41 |
| Multi-boilerplate (4) | 59 | 13 | 26 (Iteration + Git) | -20 |
| Discover sub-agents (3) | 34 | 9 | 0 (already counted) | -25 |
| Single-boilerplate (10) | 10* | 10* | 12 (Monorepo Mode) | 0** |
| Analysis sub-agents (7) | 7* | 7* | 0 (already counted) | 0** |
| Remaining (3) | 3* | 3* | 0 (already counted) | 0** |
| Structural overhead | 0 | 0 | 7 | -7 |
| **Total** | **224** | **44** | **113** | **-67 net lines** |

*Single-line replacements are character-count savings, not line-count savings.
**Token savings still occur due to shorter replacement text (~196 chars saved per full-form blockquote, ~52 chars per short-form).

**Token savings per delegation**:
- Each orchestrator delegation saves ~110 lines of context tokens
- Each multi-boilerplate agent delegation saves ~10-17 lines
- Each discover sub-agent delegation saves ~9 lines
- Single-boilerplate and analysis agents save ~196 or ~52 characters per delegation (not lines, but token reduction is real)

---

## 7. Traceability Matrix

| Design Element | Requirements Traced | Architecture Traced |
|---------------|--------------------|--------------------|
| CLAUDE.md Root Resolution section content | FR-009, AC-009-01, AC-009-02 | ADR-0001, Section 2.3.1 |
| CLAUDE.md Project Context Resolution content | FR-010, AC-010-01, AC-010-02 | ADR-0004, Section 2.3.2 |
| CLAUDE.md Monorepo Mode Protocol content | FR-001, AC-001-01, AC-001-02, AC-001-03 | ADR-0002, Section 2.3.3 |
| CLAUDE.md Iteration Enforcement content | FR-005, AC-005-01, AC-005-02, AC-005-03 | ADR-0003, Section 2.3.4 |
| CLAUDE.md Git Commit Prohibition content | FR-007, AC-007-01, AC-007-02 | Section 2.3.5 |
| CLAUDE.md section ordering | FR-012, AC-012-01, AC-012-02 | Section 2.1 |
| Orchestrator reference lines | FR-011, AC-011-01 through AC-011-05 | ADR-0004, Section 3 |
| Phase agent monorepo references | FR-002, AC-002-01, AC-002-02 | ADR-0002, Section 3.2 |
| Analysis sub-agent references | FR-003, AC-003-01, AC-003-02 | ADR-0002, Section 5.2 |
| Remaining agent references | FR-004, AC-004-01, AC-004-02 | ADR-0002, Section 5.1 |
| Iteration parameterization lines | FR-006, AC-006-01 through AC-006-05 | ADR-0003, Section 4.2 |
| Git commit reference lines | FR-008, AC-008-01, AC-008-02 | Section 2.3.5 |
| Line budget compliance | NFR-006 | Section 2.2 |
| Reference brevity | NFR-004 | ADR-0005, Section 3 |
| No behavioral regression | NFR-002, SM-001 | V-003, V-004 |
| Single source of truth | NFR-003, SM-003, SM-004 | V-002 |
| Token reduction | NFR-001, SM-002 | V-001 |
| Hook backward compatibility | NFR-005 | V-004 |
| Implementation order | All FRs | Section 6.1 (architecture) |
| Verification checks | All FRs, All NFRs | Section 7 (architecture) |

---

## 8. GATE-03 Validation

### Design Gate Checklist

- [X] Interface specification complete: CLAUDE.md section content fully specified (Section 1). Not an API project -- no OpenAPI needed. The "interface" is the shared markdown protocol sections.
- [X] All modules designed with clear responsibilities: Each agent modification specified with exact remove/replace content (Section 2). 29 file modifications across 8 implementation phases.
- [X] UI wireframes exist for all screens: N/A -- no UI in this refactoring. Pure markdown file changes.
- [X] User flows documented: N/A -- no user-facing flows. The agent delegation flow is unchanged (CLAUDE.md is loaded automatically).
- [X] Error taxonomy complete: N/A -- no error codes. Verification failures are documented as pass/fail criteria in Section 4.
- [X] Validation rules defined: Verification specification (V-001 through V-005) with exact grep commands, expected values, and pass criteria (Section 4).
- [X] Designs cover all requirements: Traceability matrix (Section 7) maps every FR, NFR, and AC to a design element.
- [X] Interface contracts reviewed: Reference format convention (blockquote with bold section name) follows established T2 pattern (ADR-0005).

### Constitutional Compliance

| Article | Status | Evidence |
|---------|--------|----------|
| Article I (Specification Primacy) | Compliant | Design implements requirements.md and architecture.md exactly. All 12 FRs and 6 NFRs have corresponding design elements. |
| Article IV (Explicit Over Implicit) | Compliant | Every agent modification is specified with exact content to remove and exact replacement text. No ambiguities remain. |
| Article V (Simplicity First) | Compliant | Design extends the proven T2 extraction pattern. No new mechanisms, no over-engineering. 1-line references, 2-line parameterized references. |
| Article VII (Artifact Traceability) | Compliant | Traceability matrix in Section 7. Every design element traces to requirements and architecture decisions. |
| Article IX (Quality Gate Integrity) | Compliant | GATE-03 checklist above. All applicable items pass. N/A items documented with justification. |
