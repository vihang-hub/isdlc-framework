# Enhanced tasks.md Schema Design

**Version**: 1.0.0
**Date**: 2026-02-11
**Author**: Solution Architect (Agent 02)
**Traces**: FR-06, NFR-02, NFR-04, C-02, ADR-0001, ADR-0004

---

## 1. Overview

This document defines the complete schema for the enhanced tasks.md format. The format extends the existing checkpoint-based plan with inline annotations for traceability, dependencies, and file-level task details while maintaining full backward compatibility with existing `[X]`/`[ ]` checkbox parsers.

### Design Principles

1. **Additive only**: New metadata appears on sub-lines or after a `|` delimiter -- never modifies the checkbox line prefix
2. **Pipe-delimited**: Inline annotations use `| key: value` syntax, extensible to future keys
3. **Indented sub-lines**: Structured metadata uses 2-space indented lines below the task
4. **Sections at bottom**: Summary sections (Dependency Graph, Traceability Matrix) appear after all phase sections
5. **Ignore-safe**: Any parser that only reads `- [X]` or `- [ ]` patterns silently ignores all annotations

---

## 2. Task Line Format

### 2.1 Current Format (Preserved)

```
- [ ] TNNNN Description
- [X] TNNNN Description
- [ ] TNNNN [P] Description
```

This format is unchanged. All existing parsers continue to work.

### 2.2 Enhanced Format (Additive)

```
- [ ] TNNNN Description | traces: REQ-NNN, AC-NNx [, AC-NNy ...]
  blocked_by: [TNNNN, TNNNN]
  blocks: [TNNNN, TNNNN]
  files: path/to/file.ext (CREATE|MODIFY) [, path/to/other.ext (CREATE|MODIFY)]
```

### 2.3 Grammar Specification

```ebnf
task_line     ::= checkbox SPACE task_id SPACE description [SPACE parallel_marker] [SPACE pipe annotations] NEWLINE
                  [sub_lines]

checkbox      ::= "- [ ]" | "- [X]" | "- [BLOCKED]"
task_id       ::= "T" DIGIT{4}                              (* T0001 through T9999 *)
description   ::= TEXT                                       (* Free-form, no pipe characters *)
parallel_marker ::= "[P]"
pipe          ::= "|"
annotations   ::= annotation ("," annotation)*
annotation    ::= SPACE key ":" SPACE value
key           ::= "traces" | "effort" | "priority" | IDENTIFIER   (* extensible *)
value         ::= TEXT                                       (* comma-separated list for multi-value *)

sub_lines     ::= (sub_line NEWLINE)*
sub_line      ::= INDENT structured_annotation
INDENT        ::= "  "                                       (* exactly 2 spaces *)

structured_annotation ::= dependency_annotation | file_annotation | blocked_annotation
dependency_annotation ::= ("blocked_by" | "blocks") ":" SPACE "[" task_id_list "]"
file_annotation       ::= "files:" SPACE file_spec ("," SPACE file_spec)*
blocked_annotation    ::= "reason:" SPACE TEXT

task_id_list  ::= task_id ("," SPACE task_id)*
file_spec     ::= file_path SPACE "(" file_action ")"
file_path     ::= TEXT                                       (* project-relative path *)
file_action   ::= "CREATE" | "MODIFY"
```

### 2.4 BLOCKED Status

When a task cannot be completed as specified (mechanical mode), the checkbox changes to `[BLOCKED]`:

```
- [BLOCKED] T0042 Implement login redirect | traces: FR-01, AC-01a
  reason: Missing OAuth provider configuration -- needs admin setup
```

The `[BLOCKED]` status is only used by the software-developer agent in mechanical mode. It is an additive third state alongside `[ ]` and `[X]`.

---

## 3. Phase Header Format

### 3.1 Current Format (Preserved)

```
## Phase NN: Name -- STATUS
```

Where STATUS is `PENDING`, `IN PROGRESS`, or `COMPLETE`.

### 3.2 Enhanced Format (No Changes)

Phase headers remain unchanged. The enhanced format only adds metadata to task lines and new sections at the bottom.

---

## 4. High-Level vs File-Level Tasks

### 4.1 Distinction

| Phase Range | Task Level | File Annotations | When |
|-------------|------------|-----------------|------|
| 00-05 (pre-implementation) | High-level | NONE | Always |
| 06 (implementation) | File-level | REQUIRED after refinement | After GATE-04 + refinement |
| 07+ (post-implementation) | High-level | NONE | Always |

### 4.2 High-Level Task Example (Phases 01-05, 07+)

```
- [ ] T0008 Analyze requirements and identify architectural drivers | traces: FR-01
```

No file annotations. These tasks describe conceptual actions, not file-level changes.

### 4.3 File-Level Task Example (Phase 06, after refinement)

```
- [ ] T0040 Add traceability tag generation to ORCH-012 generate-plan | traces: FR-02, AC-02a, AC-02c
  blocked_by: [T0039]
  blocks: [T0043]
  files: src/claude/skills/orchestration/generate-plan/SKILL.md (MODIFY)
```

### 4.4 Multi-File Task Example

```
- [ ] T0046 Update PLAN INTEGRATION PROTOCOL across all agents | traces: FR-07, AC-07a, AC-07c, AC-07d
  blocked_by: [T0040, T0041]
  files: src/claude/agents/01-requirements-analyst.md (MODIFY), src/claude/agents/02-solution-architect.md (MODIFY), src/claude/agents/03-system-designer.md (MODIFY), src/claude/agents/04-test-design-engineer.md (MODIFY), src/claude/agents/05-software-developer.md (MODIFY), src/claude/agents/06-integration-tester.md (MODIFY), src/claude/agents/07-qa-engineer.md (MODIFY), src/claude/agents/08-security-compliance-auditor.md (MODIFY), src/claude/agents/09-cicd-engineer.md (MODIFY), src/claude/agents/10-dev-environment-engineer.md (MODIFY), src/claude/agents/11-deployment-engineer-staging.md (MODIFY), src/claude/agents/12-release-manager.md (MODIFY), src/claude/agents/13-site-reliability-engineer.md (MODIFY), src/claude/agents/14-upgrade-engineer.md (MODIFY)
```

Note: Long `files:` lines are acceptable -- they are sub-lines that wrap in the viewer. Agents do not parse these lines; only the software-developer agent in mechanical mode reads them.

---

## 5. New Sections

### 5.1 Dependency Graph Section

Placed after all phase sections, before the Progress Summary:

```markdown
## Dependency Graph

### Critical Path
T0001 -> T0003 -> T0005 -> T0008 -> T0010 -> T0012
Length: 6 tasks | Estimated: all Phase 06 tasks on critical path

### All Dependencies
| Task | Description | Blocked By | Blocks |
|------|-------------|-----------|--------|
| T0040 | Add traceability to ORCH-012 | T0039 | T0043, T0046 |
| T0041 | Implement enhanced format | T0039 | T0046 |
| T0043 | Implement cycle detection | T0040 | T0047 |
| T0044 | Refinement step in orchestrator | T0041 | T0045 |
| T0045 | Mechanical mode in Agent 05 | T0044 | T0047 |
| T0046 | Update PLAN INTEGRATION | T0040, T0041 | T0047 |
| T0047 | Enhance plan-surfacer hook | T0043, T0045, T0046 | -- |
```

### 5.2 Traceability Matrix Section

Placed after the Dependency Graph, before the Progress Summary:

```markdown
## Traceability Matrix

### Requirement Coverage
| Requirement | ACs | Tasks | Coverage |
|-------------|-----|-------|----------|
| FR-01 | AC-01a, AC-01b, AC-01c, AC-01d, AC-01e | T0040, T0041 | 5/5 (100%) |
| FR-02 | AC-02a, AC-02b, AC-02c, AC-02d, AC-02e | T0040, T0042 | 5/5 (100%) |
| FR-03 | AC-03a, AC-03b, AC-03c, AC-03d, AC-03e | T0043 | 5/5 (100%) |
| ... | ... | ... | ... |

### Orphan Tasks (No Traceability)
- None (all tasks have traces)

### Uncovered Requirements
- None (all FRs have at least one task)
```

---

## 6. Progress Summary (Enhanced)

The existing Progress section gains additional counters:

```markdown
## Progress Summary

| Phase | Status | Tasks | Complete | Blocked |
|-------|--------|-------|----------|---------|
| 00 Quick Scan | COMPLETE | 3 | 3 | 0 |
| 01 Requirements | COMPLETE | 7 | 7 | 0 |
| ... | ... | ... | ... | ... |
| **TOTAL** | | **63** | **10** | **0** |

**Progress**: 10 / 63 tasks (16%) | 0 blocked
**Traceability**: 38/38 AC covered (100%)
**Dependencies**: 12 edges, 0 cycles, critical path length 6
```

---

## 7. Backward Compatibility Analysis

### 7.1 What Existing Parsers See

The PLAN INTEGRATION PROTOCOL in 14 agents uses these patterns:
1. `## Phase NN:` -- locate phase section (UNCHANGED)
2. `PENDING` / `IN PROGRESS` / `COMPLETE` -- read/update phase status (UNCHANGED)
3. `- [ ]` / `- [X]` -- read/toggle checkboxes (UNCHANGED)
4. `TNNNN` -- read task IDs for refinement (UNCHANGED)

None of these patterns are affected by:
- Pipe-delimited annotations after the description (parsers stop at checkbox + description)
- Indented sub-lines (parsers match `^- \[` prefix, sub-lines start with `  `)
- New sections at the bottom (parsers locate their phase section, not bottom sections)

### 7.2 What Changes for Agents

Only ONE new rule is added to the PLAN INTEGRATION PROTOCOL:

> When updating checkboxes (`- [ ]` to `- [X]`), agents MUST preserve all sub-lines (indented lines) following the task line until the next task line or section header. Agents MUST NOT remove or modify pipe-delimited annotations on the task line.

This rule is passive -- agents that only toggle `[ ]` to `[X]` already preserve surrounding text. The rule makes it explicit.

### 7.3 Fix Workflow Behavior

Fix workflows skip the design phase and have no refinement step. Their tasks.md will contain:
- High-level tasks for all phases (no file-level annotations)
- Traceability tags (generated from bug-report.md acceptance criteria)
- No dependency annotations (dependencies are implicit in phase order)
- No Dependency Graph or Traceability Matrix sections

This is valid and correct: the enhanced format is additive, and its absence does not break anything.

---

## 8. Schema Versioning

The tasks.md header includes a format version for future migration:

```markdown
# Task Plan: feature REQ-0009-enhanced-plan-to-tasks

Generated: 2026-02-11T20:10:00Z
Workflow: feature
Format: v2.0
Phases: 9
```

`Format: v2.0` signals the enhanced format. Omission implies v1.0 (current format). Parsers check for this field; if missing, they treat the file as legacy format.

---

## 9. Extension Points

The pipe-delimited annotation format supports future keys without schema changes:

| Key | Status | Example |
|-----|--------|---------|
| `traces` | v2.0 (this feature) | `traces: FR-01, AC-01a` |
| `effort` | Future | `effort: 2h` |
| `priority` | Future | `priority: P0` |
| `assignee` | Future | `assignee: agent-05` |
| `labels` | Future | `labels: security, performance` |

Unknown keys are ignored by all parsers. The format is forward-compatible.
