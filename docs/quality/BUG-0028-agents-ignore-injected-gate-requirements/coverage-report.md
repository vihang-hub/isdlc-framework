# Coverage Report: BUG-0028 Agents Ignore Injected Gate Requirements

**Phase**: 16-quality-loop
**Date**: 2026-02-22

---

## Coverage Tool Status

**NOT CONFIGURED** -- No coverage tool (c8, nyc, istanbul) is installed in this project.

The `node:test` runner does not include built-in coverage reporting.

## Test Execution Summary

| Test Suite | Tests | Pass | Fail | Coverage Tool |
|-----------|-------|------|------|---------------|
| gate-requirements-injector.test.cjs | 73 | 73 | 0 | N/A |
| branch-guard.test.cjs | 35 | 35 | 0 | N/A |
| Full hook suite (82 files) | 1686 | 1618 | 68 (pre-existing) | N/A |

## Changed File Coverage (Qualitative)

Since no line-level coverage tool is available, a qualitative assessment was performed:

### gate-requirements-injector.cjs (474 lines)

| Function | Test Coverage | Suites |
|----------|-------------|--------|
| buildCriticalConstraints() | Tested | Suite 12 (BUG-0028: buildCriticalConstraints) |
| buildConstraintReminder() | Tested | Suite 13 (BUG-0028: buildConstraintReminder) |
| formatBlock() | Tested | Suite 14 (BUG-0028: formatBlock integration) |
| buildGateRequirementsBlock() | Tested | Suite 10 (E2E) |
| loadConfigFile() | Tested | Suite 1 |
| loadIterationRequirements() | Tested | Suite 2 |
| loadArtifactPaths() | Tested | Suite 3 |
| parseConstitutionArticles() | Tested | Suite 4 |
| loadWorkflowModifiers() | Tested | Suite 5 |
| resolveTemplateVars() | Tested | Suite 6 |
| deepMerge() | Tested | Suite 7 |
| PHASE_NAME_MAP | Tested | Suite 8 |

All 10 exported functions have dedicated test suites.

### branch-guard.cjs

| Area | Test Coverage | Suites |
|------|-------------|--------|
| Core blocking logic | Tested | Suite 1 (basic blocking) |
| Agent instructions | Tested | Suite 3 (BUG-0012 agent no-commit) |
| Branch existence check | Tested | Suite 4 (BUG-0015) |
| CRITICAL CONSTRAINTS message | Tested | Verified via grep (line 205) |

## Recommendation

Install `c8` as a dev dependency for line-level coverage:
```
npm install --save-dev c8
```

Then update `package.json` scripts:
```json
"test:hooks:coverage": "c8 node --test src/claude/hooks/tests/*.test.cjs"
```
