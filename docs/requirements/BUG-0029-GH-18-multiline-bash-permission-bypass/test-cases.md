# Test Cases: BUG-0029-GH-18 Multiline Bash Permission Bypass

**Bug ID:** BUG-0029-GH-18
**Phase:** 05-test-strategy
**Date:** 2026-02-20 (updated from 2026-02-19)
**Test File:** `src/claude/hooks/tests/multiline-bash-validation.test.cjs`
**Total Test Cases:** 38

---

## Test Detection Algorithm

The core of this test suite is a pair of functions that parse Markdown file content
and identify multiline Bash code blocks. A "multiline Bash code block" is defined as:

1. A fenced code block that opens with `` ```bash `` or `` ```sh ``
2. Where the content between the opening and closing `` ``` `` fences contains
   more than one non-empty line

The algorithm:
- Read the file content as a string
- Use regex `/```(?:bash|sh)\n([\s\S]*?)```/g` to extract all fenced code blocks tagged `bash` or `sh`
- For each matched block, count non-empty lines in the body
- If count > 1, the block is multiline (violation)

Single-line blocks (exactly one non-empty line of content) are SAFE.
Blocks with zero non-empty lines (empty blocks) are SAFE.

---

## Group 1: Content Validation -- Per-File Checks (TC-MLB-01 to TC-MLB-10)

These tests verify that each known-affected agent/command prompt file contains zero
multiline Bash code blocks. The first 8 files were fixed in prior commits (regression guards).
The last 2 files are the active TDD targets that FAIL before the fix.

### TC-MLB-01: 05-software-developer.md has no multiline Bash blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-01 |
| **Requirement** | FR-001 (AC-001-01, AC-001-04) |
| **Test Type** | positive (regression guard) |
| **Priority** | P0 |
| **Current State** | PASSING (fixed in prior commits) |
| **Test Name** | `src/claude/agents/05-software-developer.md should have no multiline Bash blocks` |

### TC-MLB-02: 06-integration-tester.md has no multiline Bash blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-02 |
| **Requirement** | FR-001 (AC-001-01, AC-001-03) |
| **Test Type** | positive (regression guard) |
| **Priority** | P0 |
| **Current State** | PASSING (fixed in prior commits) |
| **Test Name** | `src/claude/agents/06-integration-tester.md should have no multiline Bash blocks` |

### TC-MLB-03: discover.md has no multiline Bash blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-03 |
| **Requirement** | FR-001 (AC-001-01) |
| **Test Type** | positive (regression guard) |
| **Priority** | P0 |
| **Current State** | PASSING (fixed in prior commits) |
| **Test Name** | `src/claude/commands/discover.md should have no multiline Bash blocks` |

### TC-MLB-04: provider.md has no multiline Bash blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-04 |
| **Requirement** | FR-001 (AC-001-01, AC-001-03, AC-001-04) |
| **Test Type** | positive (regression guard) |
| **Priority** | P0 |
| **Current State** | PASSING (fixed in prior commits) |
| **Test Name** | `src/claude/commands/provider.md should have no multiline Bash blocks` |

### TC-MLB-05: isdlc.md has no multiline Bash blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-05 |
| **Requirement** | FR-001 (AC-001-01) |
| **Test Type** | positive (regression guard) |
| **Priority** | P0 |
| **Current State** | PASSING (fixed in prior commits) |
| **Test Name** | `src/claude/commands/isdlc.md should have no multiline Bash blocks` |

### TC-MLB-06: data-model-analyzer.md has no multiline Bash blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-06 |
| **Requirement** | FR-001 (AC-001-01, AC-001-04) |
| **Test Type** | positive (regression guard) |
| **Priority** | P0 |
| **Current State** | PASSING (fixed in prior commits) |
| **Test Name** | `src/claude/agents/discover/data-model-analyzer.md should have no multiline Bash blocks` |

### TC-MLB-07: skills-researcher.md has no multiline Bash blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-07 |
| **Requirement** | FR-001 (AC-001-01, AC-001-03) |
| **Test Type** | positive (regression guard) |
| **Priority** | P0 |
| **Current State** | PASSING (fixed in prior commits) |
| **Test Name** | `src/claude/agents/discover/skills-researcher.md should have no multiline Bash blocks` |

### TC-MLB-08: test-evaluator.md has no multiline Bash blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-08 |
| **Requirement** | FR-001 (AC-001-01) |
| **Test Type** | positive (regression guard) |
| **Priority** | P0 |
| **Current State** | PASSING (fixed in prior commits) |
| **Test Name** | `src/claude/agents/discover/test-evaluator.md should have no multiline Bash blocks` |

### TC-MLB-09: architecture-analyzer.md has no multiline Bash blocks (TDD TARGET)

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-09 |
| **Requirement** | FR-001 (AC-001-01, AC-001-03) |
| **Test Type** | positive (TDD: currently FAILING) |
| **Priority** | P0 |
| **Current State** | **FAILING** -- 1 multiline block at line 46 (find with `\` line continuations, 11 lines) |
| **Test Name** | `src/claude/agents/discover/architecture-analyzer.md should have no multiline Bash blocks` |
| **Fix Required** | Join the find command to a single line: `find . -type d -not -path '*/node_modules/*' ... | head -100` |

### TC-MLB-10: quick-scan-agent.md has no multiline Bash blocks (TDD TARGET)

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-10 |
| **Requirement** | FR-001 (AC-001-01, AC-001-04) |
| **Test Type** | positive (TDD: currently FAILING) |
| **Priority** | P0 |
| **Current State** | **FAILING** -- 1 multiline block at line 113 (4 commands with interleaved comments, 9 lines) |
| **Test Name** | `src/claude/agents/quick-scan/quick-scan-agent.md should have no multiline Bash blocks` |
| **Fix Required** | Split into individual single-line fences or convert to prose description |

---

## Group 2: Convention Section Verification (TC-MLB-11 to TC-MLB-20)

### TC-MLB-11: CLAUDE.md exists

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-11 |
| **Requirement** | FR-002 (AC-002-01) |
| **Test Type** | positive |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `CLAUDE.md should exist` |

### TC-MLB-12: CLAUDE.md contains convention heading

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-12 |
| **Requirement** | FR-002 (AC-002-01) |
| **Test Type** | positive |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `should contain "### Single-Line Bash Convention" heading` |

### TC-MLB-13: CLAUDE.md explains glob limitation

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-13 |
| **Requirement** | FR-002 (AC-002-01) |
| **Test Type** | positive |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should explain the glob newline limitation` |

### TC-MLB-14: CLAUDE.md provides transformation examples

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-14 |
| **Requirement** | FR-002 (AC-002-03) |
| **Test Type** | positive |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should provide transformation examples` |

### TC-MLB-15: CLAUDE.md mentions bin/ escape hatch

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-15 |
| **Requirement** | FR-002 (AC-002-01) |
| **Test Type** | positive |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should mention the bin/ escape hatch` |

### TC-MLB-16: CLAUDE.md includes reference format

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-16 |
| **Requirement** | FR-002 (AC-002-02) |
| **Test Type** | positive |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should include the reference format` |

### TC-MLB-17: CLAUDE.md.template exists

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-17 |
| **Requirement** | FR-004 (AC-004-01) |
| **Test Type** | positive |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `CLAUDE.md.template should exist` |

### TC-MLB-18: CLAUDE.md.template contains convention heading

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-18 |
| **Requirement** | FR-004 (AC-004-01) |
| **Test Type** | positive |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `should contain "### Single-Line Bash Convention" heading` (template) |

### TC-MLB-19: CLAUDE.md.template explains glob limitation

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-19 |
| **Requirement** | FR-004 (AC-004-02) |
| **Test Type** | positive |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should explain the glob newline limitation` (template) |

### TC-MLB-20: CLAUDE.md.template provides transformation examples

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-20 |
| **Requirement** | FR-004 (AC-004-02) |
| **Test Type** | positive |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should provide transformation examples` (template) |

---

## Group 3: Negative Tests -- Detection Algorithm (TC-MLB-21 to TC-MLB-28)

These tests use synthetic markdown content to verify the detection algorithm
correctly identifies all known multiline pattern types.

### TC-MLB-21: Detects for-loop spread across lines

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-21 |
| **Requirement** | FR-001 (AC-001-03) |
| **Test Type** | negative (scanner verification) |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `should detect for-loop spread across lines` |

### TC-MLB-22: Detects commands separated by newlines

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-22 |
| **Requirement** | FR-001 (AC-001-01) |
| **Test Type** | negative (scanner verification) |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `should detect commands separated by newlines` |

### TC-MLB-23: Detects comment-interleaved commands

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-23 |
| **Requirement** | FR-001 (AC-001-04) |
| **Test Type** | negative (scanner verification) |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `should detect comment-interleaved commands` |

### TC-MLB-24: Detects pipe chains split across lines

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-24 |
| **Requirement** | FR-001 (AC-001-01) |
| **Test Type** | negative (scanner verification) |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `should detect pipe chains split across lines` |

### TC-MLB-25: Detects multiline node -e

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-25 |
| **Requirement** | FR-003 (AC-003-01) |
| **Test Type** | negative (scanner verification) |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `should detect multiline node -e` |

### TC-MLB-26: Detects sh code blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-26 |
| **Requirement** | FR-001 (AC-001-01) |
| **Test Type** | negative (scanner verification) |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should detect sh code blocks too` |

### TC-MLB-27: Detects backslash line-continuation patterns

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-27 |
| **Requirement** | FR-001 (AC-001-03) |
| **Test Type** | negative (scanner verification) |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `should detect backslash line-continuation patterns` |
| **Notes** | Tests the exact pattern found in architecture-analyzer.md line 46 |

### TC-MLB-28: Detects multi-example blocks with interleaved comments

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-28 |
| **Requirement** | FR-001 (AC-001-04) |
| **Test Type** | negative (scanner verification) |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `should detect multi-example blocks with interleaved comments` |
| **Notes** | Tests the exact pattern found in quick-scan-agent.md line 113 |

---

## Group 4: Regression Tests -- Non-Bash Code Blocks (TC-MLB-29 to TC-MLB-36)

These tests verify the detection algorithm does NOT flag non-Bash code blocks
(JSON, TypeScript, YAML, etc.) as violations.

### TC-MLB-29: Does NOT flag JSON code blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-29 |
| **Requirement** | NFR-004 |
| **Test Type** | regression |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should NOT flag JSON code blocks` |

### TC-MLB-30: Does NOT flag TypeScript code blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-30 |
| **Requirement** | NFR-004 |
| **Test Type** | regression |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should NOT flag TypeScript code blocks` |

### TC-MLB-31: Does NOT flag YAML code blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-31 |
| **Requirement** | NFR-004 |
| **Test Type** | regression |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should NOT flag YAML code blocks` |

### TC-MLB-32: Does NOT flag plain code blocks (no language)

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-32 |
| **Requirement** | NFR-004 |
| **Test Type** | regression |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should NOT flag plain code blocks (no language)` |

### TC-MLB-33: Does NOT flag JavaScript code blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-33 |
| **Requirement** | NFR-004 |
| **Test Type** | regression |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should NOT flag JavaScript code blocks` |

### TC-MLB-34: Does NOT flag single-line Bash blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-34 |
| **Requirement** | FR-001 (AC-001-01) |
| **Test Type** | regression |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `should NOT flag single-line Bash blocks` |

### TC-MLB-35: Does NOT flag Bash blocks with blank padding

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-35 |
| **Requirement** | FR-001 (AC-001-01) |
| **Test Type** | regression |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should NOT flag Bash blocks with only empty lines besides one command` |

### TC-MLB-36: Does NOT flag markdown code blocks

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-36 |
| **Requirement** | NFR-004 |
| **Test Type** | regression |
| **Priority** | P1 |
| **Current State** | PASSING |
| **Test Name** | `should NOT flag markdown code blocks` |

---

## Group 5: Codebase-Wide Sweep (TC-MLB-37 to TC-MLB-38)

### TC-MLB-37: Finds at least 10 agent/command .md files to scan

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-37 |
| **Requirement** | FR-001 (completeness) |
| **Test Type** | positive (sanity check) |
| **Priority** | P0 |
| **Current State** | PASSING |
| **Test Name** | `should find at least 10 agent/command .md files to scan` |
| **Notes** | Ensures the sweep is not vacuously passing on an empty directory |

### TC-MLB-38: Zero multiline Bash blocks across ALL agent/command files (TDD TARGET)

| Field | Value |
|-------|-------|
| **ID** | TC-MLB-38 |
| **Requirement** | FR-001 (AC-001-01), NFR-003 |
| **Test Type** | positive (TDD: currently FAILING) |
| **Priority** | P0 |
| **Current State** | **FAILING** -- 2 violations (architecture-analyzer.md:46, quick-scan-agent.md:113) |
| **Test Name** | `should have zero multiline Bash blocks across ALL agent/command files` |
| **Notes** | This test scans ALL .md files under `src/claude/agents/` and `src/claude/commands/` recursively. It provides codebase-wide regression protection beyond the 10 known files. |

---

## Summary by Requirement

| Requirement | Test Cases | Count |
|-------------|-----------|-------|
| FR-001 | TC-MLB-01 to TC-MLB-10, TC-MLB-21 to TC-MLB-28, TC-MLB-34, TC-MLB-35, TC-MLB-37, TC-MLB-38 | 22 |
| FR-002 | TC-MLB-11 to TC-MLB-16 | 6 |
| FR-003 | TC-MLB-25 | 1 |
| FR-004 | TC-MLB-17 to TC-MLB-20 | 4 |
| NFR-003 | TC-MLB-38 | 1 (shared with FR-001) |
| NFR-004 | TC-MLB-29 to TC-MLB-33, TC-MLB-36 | 6 |
| **Total unique test cases** | | **38** |

## Summary by Test Type

| Type | Count | Test Cases |
|------|-------|-----------|
| positive (regression guard) | 8 | TC-MLB-01 to TC-MLB-08 |
| positive (TDD target - FAILING) | 3 | TC-MLB-09, TC-MLB-10, TC-MLB-38 |
| positive (convention) | 10 | TC-MLB-11 to TC-MLB-20 |
| positive (sanity) | 1 | TC-MLB-37 |
| negative (scanner verification) | 8 | TC-MLB-21 to TC-MLB-28 |
| regression (non-Bash safe) | 8 | TC-MLB-29 to TC-MLB-36 |
| **Total** | **38** | |

## Summary by Current State

| State | Count | Test Cases |
|-------|-------|-----------|
| **PASSING** | 35 | TC-MLB-01 to TC-MLB-08, TC-MLB-11 to TC-MLB-37 |
| **FAILING** (TDD targets) | 3 | TC-MLB-09, TC-MLB-10, TC-MLB-38 |
| **Total** | **38** | |
