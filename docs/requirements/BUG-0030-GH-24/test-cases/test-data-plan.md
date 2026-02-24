# Test Data Plan: BUG-0030-GH-24

**Bug**: Impact analysis sub-agents anchor on quick scan file list instead of independent search
**Phase**: 05-test-strategy

---

## Overview

This bug fix modifies `.md` agent prompt files (not executable code). The "test data" is the file content itself -- the tests read real source files and validate their textual content. No synthetic test data, mocks, or fixtures are needed.

## Source Files Under Test

| File | Variable | Path |
|------|----------|------|
| M1 Impact Analyzer | `m1Content` | `src/claude/agents/impact-analysis/impact-analyzer.md` |
| M2 Entry Point Finder | `m2Content` | `src/claude/agents/impact-analysis/entry-point-finder.md` |
| M3 Risk Assessor | `m3Content` | `src/claude/agents/impact-analysis/risk-assessor.md` |
| M4 Cross-Validation Verifier | `m4Content` | `src/claude/agents/impact-analysis/cross-validation-verifier.md` |

All files are loaded once via `before()` using `fs.readFileSync()` (synchronous, no async complexity).

## Required Text Patterns

These are the regex patterns used in assertions. The implementation (Phase 06) must ensure each file matches the corresponding patterns.

### Boundary Values

| Pattern | Target Files | Description |
|---------|-------------|-------------|
| `/MUST\s+perform\s+independent/i` | M1, M2, M3 | Core directive text -- must appear at least once |
| `/Glob/` | M1, M2, M3, M4 | Tool name reference (case-sensitive, capital G) |
| `/Grep/` | M1, M2, M3, M4 | Tool name reference (case-sensitive, capital G) |
| `/supplementary/i` | M1, M2, M3 | Quick scan labeling -- case-insensitive |
| `/independen(t\|tly)/i` | M4 | Independent action directive |
| `/completeness_gap/` | M4 | Finding category identifier |

### Invalid Inputs

Not applicable to this test type. The tests validate static file content, not runtime input processing. There are no user inputs, API payloads, or form fields to test with invalid data.

However, the guard test (TC-16) validates an invalid state: if "authoritative" appears in any agent prompt, it must be negated (e.g., "NOT authoritative"). This prevents a regression where someone adds the word "authoritative" in an affirmative context.

### Maximum-Size Inputs

Not applicable. The agent prompt files are moderate-size markdown files (typically 10-30 KB). There are no size constraints to test. The `fs.readFileSync()` call handles files of any size Node.js can manage.

## Data Generation Strategy

No data generation is needed. The tests operate on real production files. This is the established pattern in the project (see `test-build-integrity.test.cjs` and `artifact-path-consistency.test.cjs`).

## Edge Cases

| Edge Case | Handling |
|-----------|----------|
| File does not exist | `fs.readFileSync()` throws -- test suite fails in `before()` with clear error |
| File is empty | Regex `assert.match()` fails -- all content assertions correctly report failure |
| Directive text appears only in upgrade section | Tests match against full file content; if the directive is only in the wrong section, the test still passes (acceptable -- the directive should be in the feature section, but presence anywhere is the minimum bar) |
| Directive appears multiple times | No issue -- `assert.match()` finds the first occurrence |
| "authoritative" appears without negation | TC-16 catches this -- line-by-line check ensures every occurrence is negated |
