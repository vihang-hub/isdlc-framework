---
name: migration-planning
description: Generate step-by-step migration plan ranked by risk
skill_id: UPG-004
owner: upgrade-engineer
collaborators: [solution-architect, software-developer]
project: sdlc-framework
version: 1.0.0
when_to_use: After impact analysis to create the actionable migration plan
dependencies: [UPG-001, UPG-002, UPG-003]
---

# Migration Planning

## Purpose
Generate a detailed, step-by-step migration plan ranked by risk, including the upgrade path decision (direct vs stepwise), specific code changes needed, and a test verification strategy.

## When to Use
- After impact analysis is complete (UPG-003)
- Before presenting the plan for user approval
- When deciding between direct and stepwise upgrade paths

## Prerequisites
- Impact analysis complete with risk assessment
- Breaking changes and affected files identified
- Target version confirmed

## Process

### Step 1: Determine Upgrade Path
```
Auto-decide logic:

SAME major version (e.g., 2.1 → 2.9):
  → DIRECT upgrade
  → Low risk, usually backward-compatible

ONE major version apart (e.g., 2.x → 3.x):
  → DIRECT upgrade
  → Review breaking changes, apply migrations

TWO+ major versions apart (e.g., 2.x → 5.x):
  → STEPWISE upgrade
  → Upgrade one major version at a time
  → Run tests at each step
  → Example: 2.x → 3.latest → 4.latest → 5.target

Override conditions:
- If risk score is CRITICAL on direct → suggest stepwise
- If official migration guide recommends stepwise → follow it
- User can override the decision
```

### Step 2: Order Changes by Risk
```
Sort migration steps:
1. LOW risk first (config changes, version bumps)
2. MEDIUM risk (deprecated API replacements with 1:1 mapping)
3. HIGH risk (behavior changes, significant refactoring)
4. CRITICAL risk (removed APIs, architectural changes)

Rationale: Build confidence with easy wins first,
tackle risky changes with a passing baseline.
```

### Step 3: Generate Migration Steps
```
For each change, generate:
{
  "step": N,
  "risk": "LOW|MEDIUM|HIGH|CRITICAL",
  "description": "What to change and why",
  "files": ["list of affected files"],
  "before": "code snippet showing current usage",
  "after": "code snippet showing migrated usage",
  "automated": true/false,  // can codemod handle this?
  "codemod": "command if available",
  "test_verification": "how to verify this step"
}
```

### Step 4: Plan Test Strategy
```
Test verification approach:
1. Capture baseline: run full test suite, record results
2. After version bump: run tests, expect specific failures
3. After each migration step: run tests, verify fix
4. After all steps: full test suite must pass
5. Manual verification for behavioral changes

Test categories:
- Unit tests: verify API migration correctness
- Integration tests: verify compatibility with other deps
- E2E tests: verify user-facing behavior unchanged
```

### Step 5: Plan Rollback Strategy
```
Rollback approach:
- Git branch provides automatic rollback (discard branch)
- For stepwise: tag each intermediate state
- Document rollback steps for each migration step
- Identify point-of-no-return (if any)
```

### Step 6: Write Migration Plan
```
Write docs/requirements/UPG-NNNN-{name}-v{version}/migration-plan.md:

# Migration Plan: {name} {current} → {target}

## Upgrade Path: [DIRECT / STEPWISE]
[Justification for path decision]

## Steps (ordered by risk)

### Step 1: [LOW] Update version in manifest
- File: package.json
- Change: "name": "^2.1.0" → "^3.2.1"
- Verification: npm install succeeds

### Step 2: [MEDIUM] Replace deprecated API
- Files: src/utils.ts, src/handler.ts
- Before: `oldMethod(arg1, arg2)`
- After: `newMethod({ param1: arg1, param2: arg2 })`
- Verification: Unit tests for utils and handler pass

[...more steps...]

## Test Strategy
1. Baseline capture (pre-upgrade)
2. Per-step verification
3. Full regression after all steps

## Rollback Plan
- Discard upgrade branch: `git checkout main`
- If partially applied: [specific rollback steps]

## Estimated Impact
- Files to modify: N
- Lines changed (est): N
- Steps: N (N low, N medium, N high, N critical)
```

### Step 7: Present for User Approval
```
Present migration plan summary via AskUserQuestion:

Migration Plan for {name} {current} → {target}
Path: [DIRECT/STEPWISE]
Risk: [LOW/MEDIUM/HIGH/CRITICAL]
Steps: N total (N low-risk, N medium, N high, N critical)
Files affected: N

[1] Approve and execute
[2] View full plan details
[3] Modify plan
[4] Cancel upgrade
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| upgrade_analysis | object | Yes | Output from UPG-003 |
| breaking_changes | array | Yes | Categorized breaking changes |
| affected_files | array | Yes | Files needing modification |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| migration-plan.md | Markdown | Full migration plan document |
| upgrade_path | string | DIRECT or STEPWISE |
| steps | array | Ordered migration steps |
| user_approved | boolean | Whether user approved the plan |

## Project-Specific Considerations
- Framework upgrades (React, Next.js, Angular) often have official codemods
- Database driver upgrades may need connection string changes
- Build tool upgrades (webpack, vite) may need config restructuring

## Integration Points
- **Impact Analysis (UPG-003)**: Provides risk data and affected files
- **Upgrade Execution (UPG-005)**: Consumes migration steps
- **Solution Architect**: Consulted for architectural decisions
- **Software Developer**: May need to review complex migration steps

## Validation
- Upgrade path decision is justified
- All breaking changes have corresponding migration steps
- Steps are ordered by ascending risk
- Each step has clear before/after and verification
- User has approved the plan before execution begins
- Rollback strategy is documented
