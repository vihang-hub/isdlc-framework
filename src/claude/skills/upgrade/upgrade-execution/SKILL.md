---
name: upgrade-execution
description: Execute upgrade with implement-test loop until all tests pass
skill_id: UPG-005
owner: upgrade-engineer
collaborators: [software-developer, integration-tester]
project: sdlc-framework
version: 1.0.0
when_to_use: After migration plan is approved to execute the upgrade
dependencies: [UPG-001, UPG-002, UPG-003, UPG-004]
---

# Upgrade Execution

## Purpose
Execute the approved migration plan step by step, running the implement-test loop after each change until all regression tests pass or the iteration limit is reached.

## When to Use
- After migration plan is approved by user
- During the execution phase of the upgrade workflow
- When applying migration steps and verifying with tests

## Prerequisites
- **Test adequacy validated** — project has runnable tests with adequate coverage (checked during analysis scope). If no tests exist, upgrade MUST be blocked until tests are created via `/isdlc test generate`
- Migration plan approved (UPG-004)
- Git branch created (`upgrade/{name}-v{version}`)
- Baseline test results captured
- All migration steps defined

## Process

### Step 1: Capture Baseline
```
Before any changes:
1. Run full test suite
2. Record results:
   - Total tests: N
   - Passing: N
   - Failing: N (pre-existing failures)
   - Skipped: N
   - Execution time: Xs
3. Store as baseline in state.json:
   {
     "baseline_test_results": {
       "total": N,
       "passing": N,
       "failing": N,
       "skipped": N,
       "timestamp": "<ISO-8601>"
     }
   }
4. Any pre-existing failures are excluded from regression checks
```

### Step 2: Create Upgrade Branch
```
Branch naming: upgrade/{name}-v{version}
Examples:
  upgrade/react-v19.0.0
  upgrade/node-v22
  upgrade/typescript-v5.5

git checkout -b upgrade/{name}-v{version}
```

### Step 3: Execute Migration Steps
```
For each step in the migration plan (ordered by risk):

a. Apply the change:
   - Modify files as specified in the step
   - Run install/build commands if needed
   - For version bump: update manifest + lock file

b. Run tests:
   - Execute full test suite
   - Compare results against baseline
   - Identify new failures (not in baseline)

c. Evaluate results:
   IF no new failures:
     → Mark step as COMPLETE
     → Commit: "upgrade({name}): step N — {description}"
     → Proceed to next step

   IF new failures:
     → Enter fix loop (Step 4)
```

### Step 4: Implement-Test Fix Loop
```
When tests fail after a migration step:

LOOP (max iterations from config, default 10):
  1. Analyze failure:
     - Read test output / stack trace
     - Identify root cause (missing import, changed API, etc.)
     - Map failure to migration step or undocumented change

  2. Apply fix:
     - Modify code to address the failure
     - May involve additional API migrations not in original plan

  3. Re-run tests:
     - Execute full test suite
     - Compare against baseline

  4. Evaluate:
     IF no new failures vs baseline:
       → BREAK loop, step complete
       → Commit: "upgrade({name}): fix — {failure description}"

     IF same failures persist (3 consecutive identical results):
       → CIRCUIT BREAKER: escalate to user
       → Present failure details and ask for guidance

     IF different failures:
       → Continue loop with new failure analysis

  5. Track iteration:
     - Log iteration number, failures found, fixes applied
     - Update state.json iteration counter

END LOOP

IF max iterations reached without all tests passing:
  → Escalate to user with full iteration log
  → Options: [Continue N more] [Skip this step] [Abort upgrade]
```

### Step 5: Commit and Log Progress
```
After each successful step:
1. Stage and commit changes
2. Update execution log:
   docs/requirements/UPG-NNNN-{name}-v{version}/upgrade-execution-log.md

3. Update state.json:
   {
     "phases": {
       "14-upgrade": {
         "execution": {
           "current_step": N,
           "total_steps": M,
           "iterations_used": K,
           "steps_completed": [...],
           "steps_remaining": [...]
         }
       }
     }
   }
```

### Step 6: Final Verification
```
After all migration steps complete:
1. Run full test suite one final time
2. Compare against baseline:
   - All baseline-passing tests must still pass
   - No new failures introduced
3. Run build to verify compilation/bundling
4. Check for deprecation warnings in output
5. Hand off to UPG-006 for final validation
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| migration_steps | array | Yes | Ordered steps from migration plan |
| max_iterations | integer | No | Max fix loop iterations (default: 10) |
| baseline_results | object | Yes | Pre-upgrade test results |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| upgrade-execution-log.md | Markdown | Step-by-step execution record |
| final_test_results | object | Post-upgrade test results |
| iterations_used | integer | Total fix loop iterations consumed |
| steps_completed | array | Successfully applied migration steps |

## Project-Specific Considerations
- TypeScript projects: run `tsc --noEmit` after each step for type checking
- Python projects: run `mypy` or `pyright` if type checking is configured
- Lock file changes should be committed with the version bump step
- Monorepo: may need to run tests across affected workspaces

## Integration Points
- **Migration Planning (UPG-004)**: Provides the ordered steps
- **Regression Validation (UPG-006)**: Receives final test results
- **Software Developer**: Fix loop uses implementation skills
- **Integration Tester**: Test execution and failure analysis

## Validation
- Each migration step either succeeds or is escalated
- No test regressions vs baseline after all steps
- All commits follow upgrade commit convention
- Execution log documents every step and iteration
- Iteration count within configured limit
