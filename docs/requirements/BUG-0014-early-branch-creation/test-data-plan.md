# Test Data Plan: BUG-0014 Early Branch Creation

**Phase**: 05-test-strategy
**Bug**: BUG-0014
**Created**: 2026-02-13
**Author**: test-design-engineer

---

## 1. Overview

This test data plan defines the input data needed for the 22 content verification tests in `lib/early-branch-creation.test.js`. Since this is a documentation-only fix, the "test data" consists of:

1. File paths to the three target markdown files
2. Section markers for extracting relevant content
3. Positive and negative string patterns for assertion
4. Regex patterns for structural verification

---

## 2. File Paths

| Constant | Path | Purpose |
|----------|------|---------|
| `ORCHESTRATOR_PATH` | `src/claude/agents/00-sdlc-orchestrator.md` | Primary target: Section 3a, init-and-phase-01, workflow types |
| `ISDLC_CMD_PATH` | `src/claude/commands/isdlc.md` | STEP 1, feature/fix action docs |
| `GENERATE_PLAN_PATH` | `src/claude/skills/orchestration/generate-plan/SKILL.md` | when_to_use, prerequisites |

All paths are resolved relative to the project root using `path.resolve(__dirname, '..')`.

---

## 3. Section Markers

The following markers are used to extract sections from the markdown files for targeted assertions.

### Orchestrator File

| Section | Start Marker | End Marker | Tests |
|---------|-------------|-----------|-------|
| Section 3a | `## 3a.` or `### Branch Creation` | `## 3b.` | T01, T02, T11, T17, T19, T20 |
| Section 3b | `## 3b.` or `### Plan Generation` | `## 3c.` or next `## ` | T13, T16 |
| Init Step 7 | `7. **Check` or `7. **` | `### ` or next numbered step | T12 |
| Feature workflow | `**feature workflow:**` | `**fix workflow:**` | T09 |
| Fix workflow | `**fix workflow:**` | `**test-run workflow:**` | T10 |
| Mode table | `\| Mode \|` or `init-and-phase-01` | Next empty line after table | T04 |
| Mode behavior | `### Mode Behavior` or `1. **init-and-phase-01**` | `## 4.` | T03 |

### isdlc.md File

| Section | Start Marker | End Marker | Tests |
|---------|-------------|-----------|-------|
| Feature action | `feature` action block | Next action block | T05 |
| Fix action | `fix` action block | Next action block | T06 |
| STEP 1 | `STEP 1` or `## STEP 1` | `STEP 2` or `## STEP 2` | T07, T08 |

### generate-plan SKILL.md

| Section | Start Marker | End Marker | Tests |
|---------|-------------|-----------|-------|
| Full file | N/A | N/A | T21, T22 |

---

## 4. Assertion Patterns

### 4.1 Positive Patterns (Must Be Present After Fix)

| Pattern | Case Sensitive | Used In | Purpose |
|---------|---------------|---------|---------|
| `At Initialization` or `At Init` | Case-insensitive | T01 | Section 3a header |
| `initializing a workflow` or `workflow initialization` | Case-insensitive | T02 | Trigger condition |
| `create branch` before `Phase 01` in mode description | Position-based | T03, T07 | Ordering verification |
| `create branch` before `run Phase 01` in mode table | Position-based | T04 | Table ordering |
| `init` near `branch` in feature action | Proximity-based | T05 | Feature action timing |
| `init` near `branch` in fix action | Proximity-based | T06 | Fix action timing |
| `branch already created` or `branch already exists` | Case-insensitive | T21 | generate-plan skill |

### 4.2 Negative Patterns (Must NOT Be Present After Fix)

| Pattern | Context | Used In | Purpose |
|---------|---------|---------|---------|
| `Branch Creation (Post-GATE-01)` | Section 3a header | T01 | Old header removed |
| `When GATE-01 passes` (in Section 3a) | Section 3a trigger | T02, T11 | Old trigger removed |
| `After GATE-01` near `create branch` (in feature section) | Feature workflow | T09 | Old feature timing |
| `After GATE-01` near `create branch` (in fix section) | Fix workflow | T10 | Old fix timing |
| `after GATE-01` near `creates` and `branch` (in STEP 1) | STEP 1 of isdlc.md | T08 | Old STEP 1 timing |
| `Branch will be created after GATE-01 passes` | Init Step 7 | T12 | Old Step 7 text |
| `proceed to branch creation (3a)` | Section 3b | T13 | Old 3b->3a reference |
| `Before branch creation` | generate-plan SKILL.md | T22 | Old prerequisite |

### 4.3 Preserved Patterns (Must Remain Unchanged)

| Pattern | Used In | Purpose |
|---------|---------|---------|
| `feature/{artifact_folder}` or `feature/` prefix | T14 | Feature naming |
| `bugfix/{artifact_folder}` or `bugfix/` prefix | T15 | Bugfix naming |
| `Plan Generation (Post-GATE-01)` | T16 | Plan section header |
| `git checkout -b` | T17 | Branch creation command |
| `git rev-parse --is-inside-work-tree` | T19 | Pre-flight check |
| `git status --porcelain` or dirty working directory | T19 | Pre-flight check |
| `git_branch` with `name`, `created_from`, `created_at`, `status` | T20 | State recording |

---

## 5. Helper Functions

The test file will use these helper functions (following the pattern from `lib/invisible-framework.test.js`):

### extractSection(content, startMarker, endMarker)
Extracts text between two markers from a markdown file. Returns the text between markers, or null if the start marker is not found.

### containsNear(content, word1, word2, maxDistance)
Checks if two words appear within `maxDistance` characters of each other. Used for proximity-based assertions (e.g., "init" near "branch").

### positionOf(content, text)
Returns the character index of `text` in `content`, or -1 if not found. Used for ordering verification (e.g., "create branch" before "Phase 01").

---

## 6. Edge Cases

| Scenario | Handling |
|----------|----------|
| Section marker not found | Test fails with descriptive message (section must exist) |
| Multiple matches for a pattern | Use context (section extraction) to narrow scope |
| Case sensitivity | Use case-insensitive matching for natural language, case-sensitive for code patterns |
| Whitespace/newline variations | Use `includes()` for phrases, regex with `\s+` for flexible whitespace |
| File encoding | All files are UTF-8 (standard for this project) |

---

## 7. Data Generation

No dynamic test data generation is needed. All test data is:
1. **Static file paths** (resolved at test start)
2. **Static string patterns** (hardcoded in test assertions)
3. **File content** (read fresh from disk at test start using `readFileSync`)

This is appropriate because the test verifies static documentation content, not runtime behavior.
