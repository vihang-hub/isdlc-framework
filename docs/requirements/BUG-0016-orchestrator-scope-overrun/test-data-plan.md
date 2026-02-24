# Test Data Plan: BUG-0016 -- Orchestrator Scope Overrun

**Phase**: 05-test-strategy
**Bug ID**: BUG-0016
**Generated**: 2026-02-14

---

## 1. Test Data Overview

Since this is a prompt-only fix, the primary "test data" is the orchestrator markdown file itself. No mock state.json files, databases, or external services are needed.

## 2. Input Data

### 2.1 Primary Input: Orchestrator Agent File

| Data Item | Source | Type |
|-----------|--------|------|
| Orchestrator prompt content | `src/claude/agents/00-sdlc-orchestrator.md` | String (readFileSync) |

The file is read once at test module load time and shared across all test cases (immutable input).

### 2.2 Extracted Sections

The test file extracts the following sections from the orchestrator content:

| Section | Extraction Method | Used By Tests |
|---------|-------------------|---------------|
| MODE enforcement block | Find heading containing "MODE ENFORCEMENT" or "MODE BOUNDARY" before Section 1 | T01, T02, T03, T04, T19, T20 |
| Section 3c (Execution Modes) | Find heading "## 3c. Execution Modes" | T05, T06, T07, T08, T09 |
| Section 4 (Phase Advancement) | Find heading "## 4. Workflow Phase Advancement" | T14 |
| Section 4a (Automatic Transitions) | Find heading "## 4a. Automatic Phase Transitions" | T10, T11, T12, T13, T18 |
| Mode Behavior subsection | Find heading "### Mode Behavior" under Section 3c | T05, T07, T08, T09 |
| Return Format subsection | Find heading "### Return Format" under Section 3c | T15, T16, T17 |

## 3. Expected Patterns (Positive)

These regex patterns represent the expected content after the fix is applied:

| Pattern | Tests | Purpose |
|---------|-------|---------|
| `/MODE\s+ENFORCEMENT\|MODE\s+BOUNDARY/i` | T01, T19 | MODE enforcement heading exists |
| `/CRITICAL/` | T02 | CRITICAL-level language |
| `/STOP\|DO NOT\|MUST NOT\|IMMEDIATELY/` | T02, T20 | Imperative stop language |
| `/init-and-phase-01/` | T02, T04, T05, T11 | Mode name referenced |
| `/JSON\|structured.*result\|return/i` | T03 | JSON return mentioned |
| `/DO NOT delegate\|DO NOT advance\|DO NOT proceed/i` | T04 | Explicit delegation prohibition |
| `/Phase 02\|subsequent\|next phase/i` | T04 | Forbidden target referenced |
| `/MODE\|mode/` in Section 4a | T10 | Mode guard present in transitions |
| `/AUTOMATIC\|automatic/` in Section 4a | T18 | Auto-transitions still active for no-MODE |
| `/FORBIDDEN/` in Section 4a | T18 | Permission patterns still forbidden |
| `/OVERRIDE\|override.*4a\|override.*automatic/i` | T20 | MODE enforcement overrides Section 4a |

## 4. Expected Patterns (Negative -- Must NOT Match)

These patterns represent content that must be absent after the fix:

| Pattern | Tests | Purpose |
|---------|-------|---------|
| Phase 02 included in init-and-phase-01 scope | T05 | Scope must not expand beyond Phase 01 |

## 5. Position Validation Data

| Assertion | Tests | Method |
|-----------|-------|--------|
| MODE enforcement heading position < "## 3c." position | T19 | `indexOf()` comparison |
| MODE enforcement heading position < "## 4." position | T19 | `indexOf()` comparison |
| MODE enforcement heading position < "## 4a." position | T19 | `indexOf()` comparison |

## 6. No External Dependencies

- No network calls
- No database access
- No temp directories needed
- No mocked services
- No environment variable setup

The test is purely a string-analysis test against a file on disk.
