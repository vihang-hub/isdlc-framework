---
name: regression-validation
description: Final validation that full test suite passes after upgrade
skill_id: UPG-006
owner: upgrade-engineer
collaborators: [integration-tester, qa-engineer]
project: sdlc-framework
version: 1.0.0
when_to_use: Final step of upgrade workflow to confirm no regressions
dependencies: [UPG-005]
---

# Regression Validation

## Purpose
Perform final, comprehensive validation that the full test suite passes after the upgrade, comparing results against the pre-upgrade baseline to confirm zero regressions.

## When to Use
- After all migration steps are executed (UPG-005)
- As the final validation before upgrade completion
- When confirming the upgrade is safe to merge

## Prerequisites
- All migration steps completed (UPG-005)
- Baseline test results available
- Upgrade branch has all changes committed

## Process

### Step 1: Clean Environment Test
```
Ensure clean test environment:
1. Clean build artifacts:
   - npm: rm -rf node_modules && npm ci
   - Python: pip install -r requirements.txt (fresh venv)
   - Maven: mvn clean
   - Go: go clean -cache
   - Rust: cargo clean

2. Rebuild from scratch:
   - Full compilation/build
   - Verify no build errors or warnings related to upgrade

3. Run full test suite from clean state
```

### Step 2: Compare Against Baseline
```
Comparison criteria:

PASS conditions (ALL must be true):
- All tests that passed in baseline still pass
- No new test failures introduced
- No new test errors (compilation, timeout, etc.)
- Build succeeds without errors

ACCEPTABLE conditions:
- Previously failing tests now pass (improvement)
- Previously skipped tests now run (improvement)
- New deprecation warnings (document, don't block)

FAIL conditions (ANY triggers failure):
- Any baseline-passing test now fails
- Build fails
- New runtime errors or crashes
- Test count decreased without explanation
```

### Step 3: Validate Test Coverage
```
Coverage check:
1. Run coverage report
2. Compare against baseline coverage:
   - Coverage should not decrease
   - Any decrease must be justified (removed code paths)
3. Verify critical paths still covered
```

### Step 4: Check for Regressions in Behavior
```
Behavioral validation:
1. Review test output for new warnings
2. Check for performance regressions:
   - Test execution time should not increase >20%
   - If significant increase, document cause
3. Verify no new deprecation warnings from the upgrade target itself
4. Check application logs for new error patterns
```

### Step 5: Generate Validation Report
```
Write docs/requirements/UPG-NNNN-{name}-v{version}/upgrade-summary.md:

# Upgrade Summary: {name} {current} → {target}

## Status: [PASS / FAIL]

## Test Results Comparison
| Metric | Baseline | Post-Upgrade | Delta |
|--------|----------|--------------|-------|
| Total Tests | N | N | +/-N |
| Passing | N | N | +/-N |
| Failing | N | N | +/-N |
| Skipped | N | N | +/-N |
| Coverage | X% | X% | +/-X% |
| Execution Time | Xs | Xs | +/-Xs |

## Migration Steps Executed
| Step | Risk | Description | Status | Iterations |
|------|------|-------------|--------|------------|
| 1 | LOW | Version bump | PASS | 0 |
| 2 | MEDIUM | API migration | PASS | 2 |
[...]

## Total Iterations Used: N / M max

## Files Modified
[List of all files changed]

## Commit History
[List of upgrade commits on branch]

## Notes
[Any observations, warnings, or recommendations]
```

### Step 6: Gate Readiness
```
Prepare for GATE-14:
1. All required artifacts exist
2. Test results documented
3. Migration complete and verified
4. Branch ready for code review
5. Update state.json:
   {
     "phases": {
       "14-upgrade": {
         "status": "gate_ready",
         "validation": {
           "passed": true/false,
           "baseline_comparison": "no_regressions",
           "coverage_delta": "+/-N%",
           "validated_at": "<ISO-8601>"
         }
       }
     }
   }
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| baseline_results | object | Yes | Pre-upgrade test results |
| post_upgrade_results | object | Yes | Post-upgrade test results from UPG-005 |
| execution_log | string | Yes | Path to execution log |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| upgrade-summary.md | Markdown | Final upgrade summary report |
| validation_passed | boolean | Whether validation passed |
| regression_count | integer | Number of regressions found (should be 0) |
| coverage_delta | string | Coverage change percentage |

## Project-Specific Considerations
- E2E tests may need running application server
- Integration tests may need external service availability
- Performance-sensitive projects should include benchmark comparisons
- CI pipeline tests should be verified if applicable

## Integration Points
- **Upgrade Execution (UPG-005)**: Provides execution results
- **Integration Tester**: Test execution support
- **QA Engineer**: Code review of upgrade changes
- **Orchestrator**: Gate validation for GATE-14

## Validation
- Full test suite executed from clean environment
- Zero regressions vs baseline
- Coverage not decreased
- All artifacts written to output path
- Gate readiness confirmed in state.json
- Summary report is complete and accurate
