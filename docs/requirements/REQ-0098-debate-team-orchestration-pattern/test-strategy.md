# Test Strategy: REQ-0098 — Debate Team Orchestration Pattern

## 1. Scope

Unit tests for 4 debate team instance configs and their registration in the shared instance registry. Follows the frozen-config testing pattern established by REQ-0095/0096/0097.

## 2. Test Framework

- **Runner**: `node:test` (built-in Node.js test runner)
- **Assertions**: `node:assert/strict`
- **Command**: `npm run test:core` (runs `node --test tests/core/**/*.test.js`)
- **Pattern**: Same as `tests/core/teams/instances.test.js`

## 3. Test Files

| File | Purpose | Est. Tests |
|------|---------|------------|
| `tests/core/teams/debate-instances.test.js` | Instance config correctness + immutability for all 4 debate instances | ~16 |
| `tests/core/teams/instance-registry.test.js` | Updated: 7-total count, phase queries for debate phases | ~4 added |

## 4. Test Cases — debate-instances.test.js

### 4.1 Per-Instance Config (Positive)

For each of the 4 instances (debate_requirements, debate_architecture, debate_design, debate_test_strategy):

| Test ID | Requirement | What It Verifies |
|---------|-------------|------------------|
| DI-01..04 | FR-001 AC-001-01..04 | `instance_id` matches expected value |
| DI-05..08 | FR-002 AC-002-01 | `team_type` is `'debate'` |
| DI-09..12 | FR-001 AC-001-01..04 | `members` array has 3 entries with correct role/agent pairs |
| DI-13..16 | FR-003 AC-003-01..02 | `output_artifact`, `input_dependency`, `max_rounds: 3` correct |

### 4.2 Immutability (Negative)

| Test ID | Requirement | What It Verifies |
|---------|-------------|------------------|
| DI-17..20 | FR-005 AC-005-01 | `Object.isFrozen()` returns true for each instance |

### 4.3 Mutation Rejection (Negative)

| Test ID | Requirement | What It Verifies |
|---------|-------------|------------------|
| DI-21 | FR-005 AC-005-01 | Mutating a frozen property throws TypeError |

## 5. Test Cases — instance-registry.test.js (Updates)

| Test ID | Requirement | What It Verifies |
|---------|-------------|------------------|
| IR-12 | FR-004 AC-004-02 | `listTeamInstances()` returns 7 IDs |
| IR-13 | FR-004 AC-004-01 | `getTeamInstance('debate_requirements')` returns correct config |
| IR-14 | FR-004 AC-004-03 | `getTeamInstancesByPhase('01-requirements')` includes debate_requirements |
| IR-15 | FR-004 AC-004-03 | `getTeamInstancesByPhase('03-architecture')` includes debate_architecture |
| IR-16 | FR-004 AC-004-03 | `getTeamInstancesByPhase('04-design')` includes debate_design |
| IR-17 | FR-004 AC-004-03 | `getTeamInstancesByPhase('05-test-strategy')` includes debate_test_strategy |

## 6. Coverage Target

- **Target**: >= 80% line coverage for new files
- **Approach**: All branches covered (the instance configs are pure data with no branching; registry changes add phase-field indexing which is covered by new phase queries)

## 7. Regression

All 30 existing instance tests (TI-01..TI-30) and 11 existing registry tests (IR-01..IR-11) must continue to pass unchanged. The existing `getTeamInstancesByPhase('01-requirements')` test (IR-08) will now return 3 instances instead of 2 — this test must be updated to expect the additional debate_requirements instance.

## 8. Risks

- **Low**: Registry phaseIndex currently indexes only by `input_dependency`. Debate instances also have a `phase` field. The registry must be updated to index by both fields to satisfy AC-004-03.
