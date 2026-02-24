# Implementation Notes: BUG-0030-GH-24

## Summary

Added explicit independent search directives to all four impact analysis sub-agent prompt files (M1-M4) to prevent anchoring on quick scan file lists.

## Changes Made

### M1: impact-analyzer.md (AC-001, AC-005)

**Location**: Step 3 -- Identify Directly Affected Areas

Added an "Independent Search Requirement" paragraph instructing M1 to:
- MUST perform independent Glob/Grep search of the codebase
- Treat quick scan output as supplementary context only
- Use Glob patterns for file extension and path pattern search
- Use Grep for keyword, function name, import, and pattern search

### M2: entry-point-finder.md (AC-002, AC-005)

**Location**: Step 3 -- Search for Existing Entry Points

Added an "Independent Search Requirement" paragraph instructing M2 to:
- MUST perform independent Glob/Grep search of the codebase
- Treat quick scan output as supplementary context only
- Search for route definitions, API endpoints, CLI command handlers, event listeners using Glob and Grep

### M3: risk-assessor.md (AC-003, AC-005)

**Location**: Step 3 -- Detect Coverage Gaps Per Acceptance Criterion

Added an "Independent Search Requirement" paragraph instructing M3 to:
- MUST perform independent Glob/Grep search of the codebase
- Treat quick scan output as supplementary context only
- Search for test files, configuration files, dependency declarations, coupling points using Glob and Grep

### M4: cross-validation-verifier.md (AC-004)

**Location**: New Step 4c -- Independent Completeness Verification (between Steps 4 and 5)

Added a new verification step instructing M4 to:
- Perform independent Glob/Grep search to verify file list completeness
- Search for file patterns relevant to requirements that may have been missed
- Report discovered gaps as `completeness_gap` findings
- NOT simply cross-reference outputs of other agents

## Design Decisions

1. **Placement**: Directives were placed at the beginning of the step where the relevant search activity occurs, ensuring the instruction is encountered before any analysis begins.

2. **Wording**: Used "MUST" (RFC 2119) to make the requirement unambiguous. "Independent" and "supplementary" are the key words that break the anchoring pattern.

3. **M4 as new step**: Rather than modifying an existing step, M4 got a new step (4c) because independent codebase verification is a fundamentally different activity from cross-referencing agent outputs.

4. **Tool names capitalized**: "Glob" and "Grep" are capitalized to match the Claude Code tool names exactly, ensuring the agent recognizes them as available tools.

## Test Results

- 17/17 tests passing
- Test file: `src/claude/hooks/tests/test-impact-search-directives.test.cjs`
- All acceptance criteria (AC-001 through AC-005) validated

## Files Modified

| File | Type | Change |
|------|------|--------|
| `src/claude/agents/impact-analysis/impact-analyzer.md` | Agent prompt | Added search directive in Step 3 |
| `src/claude/agents/impact-analysis/entry-point-finder.md` | Agent prompt | Added search directive in Step 3 |
| `src/claude/agents/impact-analysis/risk-assessor.md` | Agent prompt | Added search directive in Step 3 |
| `src/claude/agents/impact-analysis/cross-validation-verifier.md` | Agent prompt | Added Step 4c (completeness verification) |

## Traceability

| Requirement | AC | Files | Status |
|-------------|-----|-------|--------|
| FR-001 | AC-001 | impact-analyzer.md | Implemented |
| FR-001 | AC-002 | entry-point-finder.md | Implemented |
| FR-001 | AC-003 | risk-assessor.md | Implemented |
| FR-002 | AC-004 | cross-validation-verifier.md | Implemented |
| -- | AC-005 | All four files | Implemented |
