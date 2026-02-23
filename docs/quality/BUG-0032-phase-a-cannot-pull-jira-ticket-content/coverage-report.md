# Coverage Report -- BUG-0032

**Phase**: 16-quality-loop
**Date**: 2026-02-23

## Coverage Status

**NOT CONFIGURED** -- No coverage instrumentation tool (c8, istanbul, nyc) detected
in the project.

## Test Execution Summary

| Stream | Tests | Pass | Fail |
|--------|-------|------|------|
| BUG-0032 specific | 26 | 26 | 0 |
| ESM (lib/) | 653 | 649 | 4 (pre-existing) |
| CJS (hooks) | 2455 | 2448 | 7 (pre-existing) |
| Characterization | 0 | 0 | 0 |
| E2E | 0 | 0 | 0 |
| **Total** | **3134** | **3123** | **11 (all pre-existing)** |

## BUG-0032 Test Coverage

The BUG-0032 test file (`test-bug-0032-jira-spec.test.cjs`) covers:

- **FR-001** (Add handler Jira fetch): 5 tests -- AC-001-01 through AC-001-05
- **FR-002** (Analyze handler Jira fetch): 4 tests -- AC-002-01 through AC-002-04
- **FR-003** (CloudId resolution): 2 tests -- AC-003-01 through AC-003-03
- **FR-004** (Jira URL parsing): 2 tests -- AC-004-01, AC-004-03
- **Regression tests** (CON-003): 8 tests -- backward compatibility for detectSource(), generateSlug()
- **Structure tests**: 4 tests -- handler structure, error handling parity, regression guard
- **Acceptance criteria coverage**: 13/13 ACs covered (100%)
