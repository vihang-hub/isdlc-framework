# Test Data Plan: BUG-0022-GH-1

**Bug ID:** BUG-0022-GH-1
**Title:** Build Integrity Check Missing from test-generate Workflow
**Phase:** 05-test-strategy
**Date:** 2026-02-17

---

## 1. Overview

All tests for this fix are **structural verification tests** that read source files and assert content presence. The "test data" is the actual source files being modified as part of the fix. No synthetic test data generation, mock objects, or fixture files are needed.

This is consistent with the existing pattern in `test-quality-loop.test.cjs` sections 4-6, which read `workflows.json`, `skills-manifest.json`, and `iteration-requirements.json` directly.

---

## 2. Source Files as Test Data

| Source File (Test Data) | Path | Format |
|------------------------|------|--------|
| workflows.json | `src/isdlc/config/workflows.json` | JSON |
| isdlc.md | `src/claude/commands/isdlc.md` | Markdown |
| 16-quality-loop-engineer.md | `src/claude/agents/16-quality-loop-engineer.md` | Markdown |
| SKILL.md (QL-007) | `src/claude/skills/quality-loop/build-verification/SKILL.md` | Markdown |
| 07-qa-engineer.md | `src/claude/agents/07-qa-engineer.md` | Markdown |

---

## 3. Boundary Values

### Phase Array Boundaries

| Boundary | Value | Test Case |
|----------|-------|-----------|
| Expected phase count for test-generate | 4 | TC-04 |
| Minimum phase count (valid workflow) | 2 (test-run has 2 phases) | TC-04 (implicit) |
| Phase index of 16-quality-loop relative to 06-implementation | Exactly +1 | TC-06 |

### Auto-Fix Iteration Boundaries

| Boundary | Value | Test Case |
|----------|-------|-----------|
| Maximum auto-fix iterations | 3 | TC-20 |
| Iteration count = 0 (build passes first time) | 0 | TC-39 (AC-07) |
| Iteration count = 3 (exhausted, still failing) | 3 | TC-24, TC-26 |

### Build Command Detection Boundaries

| Boundary | Value | Test Case |
|----------|-------|-----------|
| Minimum build file set | 4 languages (pom.xml, package.json, Cargo.toml, go.mod) | TC-15 through TC-19 |
| No build file detected | Skip with WARNING | TC-27, TC-32 |
| Multiple build files present | Priority/precedence handling | (documented in agent, not separately tested) |

---

## 4. Invalid Inputs

### Invalid Build Scenarios (Agent Must Handle)

| Invalid Input | Expected Behavior | Test Case |
|---------------|-------------------|-----------|
| No recognized build system | Skip with WARNING, proceed normally | TC-27, TC-32 |
| Build command not installed | Skip with WARNING (NFR-03) | TC-27 |
| Build fails with MECHANICAL errors only | Auto-fix loop (max 3 iterations) | TC-20 |
| Build fails with LOGICAL errors only | Report failure, NO QA APPROVED | TC-24, TC-25 |
| Build fails with MIXED errors (mechanical + logical) | Auto-fix mechanical, report remaining logical | TC-21, TC-24 |

### Invalid Configuration States

| Invalid State | Expected Behavior | Test Case |
|---------------|-------------------|-----------|
| test-generate still has legacy phases (11+07) | Test FAILS (detects unfixed config) | TC-02, TC-03 |
| isdlc.md still references legacy phases for test-generate | Test FAILS (documentation drift) | TC-10 |
| workflows.json and isdlc.md are inconsistent | Test FAILS (drift detected) | TC-12 |
| QA APPROVED granted despite broken build | Test FAILS (gate violation) | TC-28, TC-34 |

---

## 5. Maximum-Size Inputs

### Maximum-Size Considerations

This fix does not introduce any variable-size data processing. The files being modified are static configuration and agent prompts with fixed content. Maximum-size testing is not applicable.

For completeness, the following limits exist in the modified files:

| File | Approximate Size | Growth Expectation |
|------|-----------------|-------------------|
| workflows.json | ~350 lines | Grows slowly (new workflows) |
| isdlc.md | ~1400 lines | Grows moderately (new commands) |
| 16-quality-loop-engineer.md | ~200 lines | Grows moderately (new checks) |
| SKILL.md (QL-007) | ~15 lines | Small file, limited growth |
| 07-qa-engineer.md | ~250 lines | Grows slowly (new gate checks) |

No stress testing or large-input testing is warranted for this fix.

---

## 6. Test Data Generation Strategy

**No generation required.** Tests read the actual source files being modified. This approach:

1. Ensures tests validate the real artifacts (not synthetic copies)
2. Catches regressions if someone modifies the files later
3. Matches the established pattern in the codebase
4. Requires zero test data maintenance

---

## 7. Error Classification Reference Data

For test cases that verify error classification (TC-21 through TC-23), the following reference data defines what the agent must distinguish:

### Mechanical Errors (Auto-Fixable)

| Error Type | Example |
|-----------|---------|
| Missing import | `import { Foo } from './foo'` not present |
| Wrong import path | `import { Foo } from '../wrong/path'` |
| Wrong package name | `package com.wrong.name;` |
| Missing test dependency | `junit` not in pom.xml `<dependencies>` |
| Wrong file location | Test file in `src/main/` instead of `src/test/` |

### Logical Errors (Not Auto-Fixable)

| Error Type | Example |
|-----------|---------|
| Type mismatch | `String` used where `int` expected |
| Missing method | Calling `user.getFullName()` when method does not exist |
| Wrong API usage | `service.save(user)` when API expects `service.create(user, context)` |
| Structural error | Test references a class hierarchy that does not exist |
