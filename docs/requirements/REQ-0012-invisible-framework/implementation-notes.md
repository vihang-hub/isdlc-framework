# Implementation Notes: REQ-0012 Invisible Framework

**Phase**: 06-implementation
**Feature**: CLAUDE.md rewrite for auto-intent-detection
**Date**: 2026-02-13
**Agent**: software-developer

---

## Summary

Rewrote the `## Workflow-First Development` section in both `CLAUDE.md` (project root) and `src/claude/CLAUDE.md.template` (source of truth for new installations) to enable invisible framework behavior. The framework now auto-detects user intent from natural conversation, presents a brief consent message, and invokes the appropriate iSDLC command automatically -- users never need to know slash commands exist.

## Files Changed

| File | Action | Lines Changed |
|------|--------|---------------|
| `CLAUDE.md` | MODIFIED | Lines 9-56 (was 9-19) -- Workflow-First section rewritten |
| `src/claude/CLAUDE.md.template` | MODIFIED | Lines 2-50 (was 2-13) -- Workflow-First section rewritten |
| `lib/invisible-framework.test.js` | CREATED | 49 test cases validating content structure |

## Design Decisions

### 1. Structured mapping table (NFR-03)

Used a markdown table for the intent-to-command mapping instead of prose paragraphs. This ensures:
- All 6 commands appear in a single consolidated location
- New workflow types can be added by editing one table row
- Signal words are clearly associated with their commands
- Easy to scan and maintain

### 2. Three-step protocol (FR-01 through FR-04)

Organized the section into three numbered steps:
1. **Detect Intent** -- signal word matching with exclusion rules
2. **Get Consent** -- brief confirmation in user terms
3. **Edge Cases** -- ambiguity, active workflows, non-dev requests

This provides Claude with a clear decision tree to follow.

### 3. Good/Bad examples (FR-05)

Included explicit "Good example" and "Bad example" consent messages to illustrate the invisible framework principle. The bad example shows what NOT to say (`/isdlc feature`, `Phase 01`), while the good example uses natural user-friendly language.

### 4. Backward compatibility section (AC-03.7)

Preserved explicit slash command passthrough: `If the user has already invoked a slash command directly... execute it immediately without re-asking.`

### 5. Visibility section (AC-05.4)

Added a dedicated subsection clarifying that progress updates, phase transitions, and quality checks remain visible -- only the invocation mechanism becomes invisible.

## Test Results

- **49/49 tests passing** (0 failures)
- **538/539 ESM suite passing** (1 pre-existing failure: TC-E09)
- **Zero regressions** introduced
- All 14 test groups pass:
  - Group 1: Section Structure (5 tests)
  - Groups 2-7: Intent Detection per category (12 tests)
  - Group 8: Consent Protocol (7 tests)
  - Group 9: Command Mapping Table (7 tests)
  - Group 10: Edge Cases (5 tests)
  - Group 11: Invisible Framework Principle (4 tests)
  - Group 12: Template Consistency (3 tests)
  - Group 13: Regression Guards (3 tests)
  - Group 14: NFR Validation (3 tests)

## Acceptance Criteria Coverage

All 27 ACs satisfied:
- FR-01 (AC-01.1 through AC-01.6): 6 intent categories with signal words
- FR-02 (AC-02.1 through AC-02.5): Consent protocol with inform/confirm/decline
- FR-03 (AC-03.1 through AC-03.7): Mapping table + slash command passthrough
- FR-04 (AC-04.1 through AC-04.5): Edge cases (ambiguity, active workflow, refactor, non-dev)
- FR-05 (AC-05.1 through AC-05.5): Invisible framework principle

## NFR Coverage

- NFR-01 (Reliability): Consent step acts as safety net; non-dev exclusions reduce false positives
- NFR-02 (Backward Compatibility): Unchanged sections verified byte-identical by regression tests
- NFR-03 (Maintainability): Single mapping table for all workflow types
- NFR-04 (Template Consistency): Both files updated with identical Workflow-First content

## Constraints Verified

- No changes to hooks, agents, skills, or runtime code
- No changes to `isdlc.md` command file
- No changes to `lib/installer.js`
- Agent Framework Context, SKILL OBSERVABILITY, SUGGESTED PROMPTS, and CONSTITUTIONAL PRINCIPLES sections unchanged
