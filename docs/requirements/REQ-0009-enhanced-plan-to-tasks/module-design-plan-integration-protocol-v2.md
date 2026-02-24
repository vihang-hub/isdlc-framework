# Module Design: PLAN INTEGRATION PROTOCOL v2

**Version**: 1.0.0
**Date**: 2026-02-11
**Author**: System Designer (Agent 03)
**Phase**: 04-design
**Traces**: FR-07, AC-07a through AC-07d

---

## 1. Module Overview

The PLAN INTEGRATION PROTOCOL is a shared text block embedded in 14 agent files. It instructs phase agents how to read and update `docs/isdlc/tasks.md` during their phase execution. Version 2 adds annotation-preservation rules and an Agent 05-specific mechanical mode extension.

### Change Strategy

- **Additive only**: New rules are appended after the existing protocol sections
- **No removals**: All existing protocol text is preserved verbatim
- **Backward compatible**: Agents that only toggle checkboxes are already compliant
- **14 identical copies + 1 extended copy**: The base rules go into all 14 agents; Agent 05 gets an additional mechanical mode block

---

## 2. Files Affected

### Base Protocol Update (14 files)

| File | Agent |
|------|-------|
| `src/claude/agents/01-requirements-analyst.md` | Requirements Analyst |
| `src/claude/agents/02-solution-architect.md` | Solution Architect |
| `src/claude/agents/03-system-designer.md` | System Designer |
| `src/claude/agents/04-test-design-engineer.md` | Test Design Engineer |
| `src/claude/agents/05-software-developer.md` | Software Developer |
| `src/claude/agents/06-integration-tester.md` | Integration Tester |
| `src/claude/agents/07-qa-engineer.md` | QA Engineer |
| `src/claude/agents/08-security-compliance-auditor.md` | Security Auditor |
| `src/claude/agents/09-cicd-engineer.md` | CI/CD Engineer |
| `src/claude/agents/10-dev-environment-engineer.md` | Environment Builder |
| `src/claude/agents/11-deployment-engineer-staging.md` | Deployment Engineer |
| `src/claude/agents/12-release-manager.md` | Release Manager |
| `src/claude/agents/13-site-reliability-engineer.md` | SRE |
| `src/claude/agents/14-upgrade-engineer.md` | Upgrade Engineer |

### Files NOT Updated (3 agents without the protocol)

| File | Reason |
|------|--------|
| `src/claude/agents/00-sdlc-orchestrator.md` | Orchestrator manages plan via ORCH-012 directly |
| `src/claude/agents/16-quality-loop-engineer.md` | No tasks.md interaction |
| `src/claude/agents/discover-orchestrator.md` | Pre-workflow agent, no tasks.md |

---

## 3. Protocol v2 Exact Text

### 3.1 Complete Protocol (for all 14 agents)

This is the exact text that replaces the current PLAN INTEGRATION PROTOCOL section in each agent file. The existing text is preserved in its entirety with new sections appended.

```markdown
# PLAN INTEGRATION PROTOCOL

If `docs/isdlc/tasks.md` exists:

## On Phase Start
1. Read tasks.md, locate your phase section (`## Phase NN:`)
2. Update phase status header from `PENDING` to `IN PROGRESS`
3. Refine template tasks with specifics from input artifacts
   (e.g., "Write failing unit tests" -> "Write failing tests for UserService and AuthController")
4. Preserve TNNNN IDs when refining. Append new tasks at section end if needed.

## During Execution
1. Change `- [ ]` to `- [X]` as each task completes
2. Update after each major step, not just at phase end

## On Phase End
1. Verify all phase tasks are `[X]` or documented as skipped
2. Update phase status header to `COMPLETE`
3. Update Progress section at bottom of tasks.md

## Annotation Preservation (v2.0)
When updating tasks.md (toggling checkboxes, updating status headers, refining tasks):
1. MUST NOT remove or modify pipe-delimited annotations (`| traces: ...`) on task lines
2. MUST NOT remove or modify indented sub-lines (lines starting with 2+ spaces below a task):
   - `blocked_by:`, `blocks:`, `files:`, `reason:` sub-lines
3. MUST NOT remove or modify the Dependency Graph, Traceability Matrix, or Progress Summary sections
4. When refining template tasks with specifics, preserve existing annotations and extend them
5. When adding new tasks at section end, add `| traces:` annotations if the requirement mapping is clear

## If tasks.md Does Not Exist
Skip this protocol entirely. TaskCreate spinners are sufficient.
```

### 3.2 Agent 05 Extension (appended after the base protocol)

This additional block is appended ONLY in `src/claude/agents/05-software-developer.md`, after the base protocol text:

```markdown
## Mechanical Execution Mode (Agent 05 only)
If `active_workflow.mechanical_mode: true` AND Phase 06 tasks have `files:` sub-lines:
1. Read all Phase 06 tasks and parse their file annotations
2. Build dependency graph from blocked_by/blocks sub-lines
3. Execute tasks in topological (dependency) order
4. For each task: implement the specified files, run tests, mark [X] or [BLOCKED]
5. Do NOT add, remove, or reorder tasks without flagging as [DEVIATION]
6. If tasks lack file-level detail, fall back to standard mode with a warning

See the MECHANICAL EXECUTION MODE section (above) for the full execution algorithm.
```

---

## 4. Diff from v1 to v2

### What is preserved (unchanged)

| Section | Status |
|---------|--------|
| `# PLAN INTEGRATION PROTOCOL` header | UNCHANGED |
| `## On Phase Start` (4 rules) | UNCHANGED |
| `## During Execution` (2 rules) | UNCHANGED |
| `## On Phase End` (3 rules) | UNCHANGED |
| `## If tasks.md Does Not Exist` | UNCHANGED |

### What is added

| Addition | Location | Agents |
|----------|----------|--------|
| `## Annotation Preservation (v2.0)` section (5 rules) | After `## On Phase End`, before `## If tasks.md Does Not Exist` | All 14 |
| `## Mechanical Execution Mode` section (6 rules) | After `## If tasks.md Does Not Exist` | Agent 05 only |

### What is NOT changed

- No existing rules are modified or removed
- No existing section headers are renamed
- The protocol remains backward compatible with v1.0 tasks.md files (no annotations = nothing to preserve)

---

## 5. Implementation Instructions

### 5.1 For the software-developer agent (implementer)

To update each of the 14 agent files:

1. **Locate** the `# PLAN INTEGRATION PROTOCOL` section in each file
2. **Find** the `## On Phase End` subsection and its 3 numbered rules
3. **Insert** the `## Annotation Preservation (v2.0)` section (5 rules) AFTER the `## On Phase End` rules and BEFORE `## If tasks.md Does Not Exist`
4. **For Agent 05 only**: Also insert the `## Mechanical Execution Mode` section AFTER `## If tasks.md Does Not Exist`
5. **Verify**: The section ordering should be:
   - `## On Phase Start`
   - `## During Execution`
   - `## On Phase End`
   - `## Annotation Preservation (v2.0)` [NEW]
   - `## If tasks.md Does Not Exist`
   - `## Mechanical Execution Mode` [NEW, Agent 05 only]

### 5.2 Verification Checklist

After updating all 14 files, verify:

- [ ] All 14 files contain the `## Annotation Preservation (v2.0)` section
- [ ] Only `05-software-developer.md` contains the `## Mechanical Execution Mode` section
- [ ] The 5 annotation preservation rules are identical across all 14 files
- [ ] Existing protocol text is unchanged (diff shows additions only)
- [ ] No leading/trailing whitespace differences between files

---

## 6. Annotation Preservation Rules (Detailed)

### Rule 1: Pipe Annotations

```
BEFORE (checkbox toggle):
- [ ] T0040 Add traceability to ORCH-012 | traces: FR-02, AC-02a, AC-02c

AFTER (checkbox toggle):
- [X] T0040 Add traceability to ORCH-012 | traces: FR-02, AC-02a, AC-02c
                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                           MUST be preserved
```

The agent toggles `[ ]` to `[X]` but leaves everything after the task ID and description unchanged.

### Rule 2: Sub-lines

```
BEFORE:
- [ ] T0040 Add traceability to ORCH-012 | traces: FR-02, AC-02a
  blocked_by: [T0039]
  blocks: [T0043]
  files: src/claude/skills/orchestration/generate-plan/SKILL.md (MODIFY)

AFTER (checkbox toggle):
- [X] T0040 Add traceability to ORCH-012 | traces: FR-02, AC-02a
  blocked_by: [T0039]      <-- preserved
  blocks: [T0043]          <-- preserved
  files: src/claude/skills/orchestration/generate-plan/SKILL.md (MODIFY)  <-- preserved
```

Sub-lines are identified by their 2-space indent. They belong to the task line immediately above them. When toggling the checkbox on the task line, all sub-lines below it (until the next task line or section header) MUST be preserved.

### Rule 3: Summary Sections

The `## Dependency Graph`, `## Traceability Matrix`, and `## Progress Summary` sections at the bottom of tasks.md MUST NOT be modified by phase agents except:
- The Progress Summary section MAY be updated to reflect new checkbox counts
- No other modifications to these sections

### Rule 4: Task Refinement

When an agent refines a template task (e.g., making it more specific):

```
BEFORE:
- [ ] T0031 Write failing unit tests | traces: FR-01, FR-02

AFTER (refinement):
- [ ] T0031 Write failing unit tests for ORCH-012 and plan-surfacer | traces: FR-01, FR-02
                                        ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                        Description extended; traces PRESERVED
```

The description may be extended or clarified, but the pipe annotation MUST be preserved.

### Rule 5: New Tasks

When an agent appends new tasks at the end of their phase section:

```
- [ ] T0099 Additional validation step discovered during design | traces: FR-06, AC-06f
```

New tasks SHOULD include a `| traces:` annotation if the requirement mapping is clear. This is a SHOULD (not MUST) because some tasks may not have a direct requirement mapping.

---

## 7. Backward Compatibility Analysis

### v1.0 tasks.md (no annotations)

When an agent encounters a v1.0 tasks.md (no `Format: v2.0` header, no annotations):
- The protocol works identically to before
- Rule 1 (pipe annotations): nothing to preserve (no annotations exist)
- Rule 2 (sub-lines): nothing to preserve (no sub-lines exist)
- Rule 3 (summary sections): only the basic Progress section exists
- The agent experiences zero behavioral change

### v2.0 tasks.md (with annotations)

When an agent encounters a v2.0 tasks.md:
- The 5 new rules activate
- Agents that ONLY toggle `[ ]` to `[X]` are already compliant
  (they never touched sub-lines or pipe content before)
- The rules make implicit behavior explicit, per Article IV

---

## 8. Dependency-Aware Task Ordering

The v2.0 protocol does NOT require non-Agent-05 agents to execute tasks in dependency order. Here is why:

| Agent Type | Phase | Task Dependencies? | Ordering Rule |
|------------|-------|--------------------|---------------|
| Agents 01-04 | Pre-implementation | NO (high-level tasks only) | Execute in listed order |
| Agent 05 | Implementation | YES (file-level tasks) | Topological sort (mechanical mode only) |
| Agents 06-14 | Post-implementation | NO (high-level tasks only) | Execute in listed order |

Only Agent 05 in mechanical mode needs to respect `blocked_by`/`blocks` ordering. All other agents execute their phase's tasks in the order listed in tasks.md, which is sufficient for high-level tasks.

---

## 9. Traces

| Requirement | How Addressed |
|-------------|---------------|
| AC-07a | Agents that only read/update checkboxes are unaffected (backward compatible) |
| AC-07b | Agent 05 protocol section adds mechanical mode instructions |
| AC-07c | Annotation Preservation section documents sub-line format |
| AC-07d | Rule 1, Rule 2 explicitly state MUST NOT remove annotations |
| FR-07 | Complete protocol v2 text provided for all 14 agent files |
