# Coverage Report - REQ-0009 Enhanced Plan-to-Tasks Pipeline

| Field | Value |
|-------|-------|
| Date | 2026-02-12 |
| Coverage Tool | NOT CONFIGURED (qualitative analysis below) |
| Quantitative Coverage | N/A |

## Coverage Tool Status

No code coverage tool is configured in this project. The `package.json` does not include `c8`, `istanbul`, `nyc`, or any other coverage framework. This is noted as an infrastructure gap, not a failure.

## Qualitative Coverage Analysis

### New Code: plan-surfacer.cjs v2 format validation

| Function | Lines | Test Coverage | Test File |
|----------|-------|---------------|-----------|
| `validateTasksFormat()` | 47-116 | Full | plan-surfacer.test.cjs (TC-PS-11 through TC-PS-17) |
| `detectCyclesInDependencyGraph()` | 130-202 | Full | plan-surfacer.test.cjs (TC-PS-15), tasks-format-validation.test.cjs (VR-DEP-001) |
| `check()` (v2 integration path) | 267-283 | Full | plan-surfacer.test.cjs (TC-PS-11 through TC-PS-17) |

### Test-to-Code Mapping

| Code Module | New Lines | New Tests | Test-to-Code Ratio |
|-------------|-----------|-----------|---------------------|
| plan-surfacer.cjs (format validation) | ~90 | 17 | 5.3 LOC/test |
| tasks-format-validation fixtures | ~200 | 46 | 4.3 LOC/test |
| **Total** | **~290** | **63** | **4.6 LOC/test** |

### Coverage by Requirement

| Requirement | AC | Tests Covering | Status |
|-------------|-----|---------------|--------|
| FR-01 | AC-01a,b,c | VR-FMT-003 through VR-FMT-009 | Covered |
| FR-02 | AC-02a,b,c | TC-PS-11, TC-PS-12, TC-PS-13 | Covered |
| FR-03 | AC-03a,b,c | VR-DEP-001 through VR-DEP-004, TC-PS-15 | Covered |
| FR-04 | AC-04a,b,c | VR-TRACE-001 through VR-TRACE-003 | Covered |
| FR-05 | AC-05a,b,c | VR-MECH-001 through VR-MECH-004 | Covered |
| FR-08 | AC-08a,b,c | TC-PS-14, TC-PS-16, TC-PS-17 | Covered |
| NFR-01 | - | Performance budget in hook header (< 100ms) | Design-covered |
| NFR-02 | - | VR-COMPAT-001 through VR-COMPAT-004 | Covered |

### Edge Cases Covered

1. v1.0 format backward compatibility (no warnings emitted)
2. Missing Phase 06 section in tasks.md
3. Malformed tasks.md content (fail-open)
4. Dependency cycles (Kahn's algorithm)
5. Empty tasks files
6. Non-implementation phase (format validation skipped)
7. Missing state.json (fail-open)
8. Invalid JSON stdin (fail-open)

## Recommendation

Install `c8` (Node.js built-in V8 coverage) for quantitative coverage measurement in future quality loops:
```
npm install --save-dev c8
# Update package.json test script: "c8 node --test lib/*.test.js lib/utils/*.test.js"
```
