# Data Contracts: REQ-0016 Multi-agent Test Strategy Team

**Version**: 1.0
**Created**: 2026-02-15
**Phase**: 03-architecture
**Note**: This project has no database. This document defines data contracts between agents and the structure of artifacts they produce and consume.

---

## 1. Overview

The debate loop for Phase 05 involves three agents exchanging data via the filesystem and the Task tool prompt. This document defines the structure of all data exchanged between agents.

---

## 2. DEBATE_ROUTING Table Entry

The orchestrator's DEBATE_ROUTING table is a markdown table. The new Phase 05 row has these fields:

| Field | Value | Type |
|-------|-------|------|
| Phase Key | `05-test-strategy` | String (phase identifier) |
| Creator Agent | `04-test-design-engineer.md` | String (filename) |
| Critic Agent | `04-test-strategy-critic.md` | String (filename) |
| Refiner Agent | `04-test-strategy-refiner.md` | String (filename) |
| Phase Artifacts | `test-strategy.md, test-cases/, traceability-matrix.csv, test-data-plan.md` | Comma-separated list |
| Critical Artifact | `test-strategy.md` | String (filename) |

---

## 3. DEBATE_CONTEXT (Task Prompt Envelope)

The orchestrator passes this context block in the Task prompt to Creator, Critic, and Refiner:

```
DEBATE_CONTEXT:
  round: {N}                           # Integer: 1-3
  phase: "05-test-strategy"            # String: phase key
  creator: "04-test-design-engineer.md" # String: Creator agent filename
  critic: "04-test-strategy-critic.md"  # String: Critic agent filename
  refiner: "04-test-strategy-refiner.md"# String: Refiner agent filename
  prior_critique: "round-{N-1}-critique.md"  # String or null (null on Round 1)
  max_rounds: 3                        # Integer: debate round limit
```

---

## 4. Phase 05 Artifacts (Creator Output)

### 4.1 test-strategy.md (Critical Artifact)

Primary test strategy document produced by the Creator. Structure:

```markdown
# Test Strategy: {Feature Name}

## 1. Test Pyramid
- Unit tests: {count, scope, target coverage}
- Integration tests: {count, scope, target coverage}
- E2E tests: {count, scope, target coverage}

## 2. Test Approach
{Strategy description}

## 3. Coverage Targets
{Per-module coverage goals}

## 4. Test Data Strategy
{Data generation approach}

## 5. Risk-Based Prioritization
{High/medium/low risk areas}

## 6. Performance/Load Tests
{Performance test plan, if applicable}
```

### 4.2 test-cases/ (Directory)

One or more markdown files with test case definitions:

```markdown
## TC-{NNNN}: {Test Case Name}

**Requirement**: {FR-NN / AC-NN.N}
**Type**: unit | integration | e2e
**Priority**: high | medium | low

**Given**: {precondition}
**When**: {action}
**Then**: {expected result}

**Negative Paths**:
- Given {edge case}, When {action}, Then {error handling}
```

### 4.3 traceability-matrix.csv

CSV mapping requirements to test cases:

```csv
Requirement,Acceptance_Criterion,Test_Case_ID,Test_Type,Priority,Status
FR-01,AC-01.1,TC-0001,unit,high,designed
FR-01,AC-01.2,TC-0002,integration,high,designed
```

### 4.4 test-data-plan.md

Test data strategy document:

```markdown
# Test Data Plan

## Boundary Values
{Field: min, max, boundary +/- 1}

## Invalid Inputs
{Field: null, empty, wrong type, oversized}

## Test Fixtures
{Fixture definitions}
```

---

## 5. Critique Report (Critic Output)

### 5.1 round-{N}-critique.md

```markdown
# Round {N} Critique Report

**Round:** {N}
**Phase:** 05-test-strategy
**Reviewed At:** {ISO timestamp}
**Artifacts Reviewed:**
- test-strategy.md (Round {N} Draft)
- test-cases/
- traceability-matrix.csv
- test-data-plan.md

## Summary

| Metric | Value |
|--------|-------|
| Total Findings | {X} |
| BLOCKING | {Y} |
| WARNING | {Z} |
| AC Coverage | {covered}/{total} |
| Test Pyramid Levels | {count} |
| Negative Test Coverage | {percentage} |

## BLOCKING Findings

### B-{NNN}: {Short Title}

**Target:** {artifact, section}
**Category:** {TC-01..TC-08}
**Issue:** {Specific description}
**Recommendation:** {Concrete fix}

## WARNING Findings

### W-{NNN}: {Short Title}

**Target:** {artifact, section}
**Category:** {TC-01..TC-08}
**Issue:** {Specific description}
**Recommendation:** {Concrete improvement}
```

### 5.2 Finding ID Format

- `B-NNN`: BLOCKING findings (sequentially numbered from B-001)
- `W-NNN`: WARNING findings (sequentially numbered from W-001)

### 5.3 Category Mapping (TC-01 through TC-08)

| Check ID | Category Name | Severity | Target Artifact |
|----------|--------------|----------|-----------------|
| TC-01 | UNTESTED_ACCEPTANCE_CRITERION | BLOCKING | traceability-matrix.csv |
| TC-02 | INCOMPLETE_TEST_PYRAMID | BLOCKING | test-strategy.md |
| TC-03 | MISSING_NEGATIVE_TESTS | BLOCKING | test-cases/ |
| TC-04 | TEST_DATA_GAPS | BLOCKING | test-data-plan.md |
| TC-05 | FLAKY_TEST_RISK | BLOCKING | test-strategy.md |
| TC-06 | UNTESTED_ERROR_PATHS | BLOCKING | test-cases/ |
| TC-07 | MISSING_PERFORMANCE_TESTS | BLOCKING | test-strategy.md |
| TC-08 | ORPHAN_TEST_CASE | WARNING | traceability-matrix.csv |

---

## 6. Change Log (Refiner Output)

Appended to the primary artifact (test-strategy.md) by the Refiner:

```markdown
## Changes in Round {N}

**Round:** {N}
**Refiner Action:** {ISO timestamp}
**Findings Addressed:** {count} BLOCKING, {count} WARNING

| Finding | Severity | Action | Target | Description |
|---------|----------|--------|--------|-------------|
| B-001 | BLOCKING | Added test cases | test-cases/ | Added 3 negative tests for FR-01 |
| B-002 | BLOCKING | Updated pyramid | test-strategy.md | Added integration test level |
| W-001 | WARNING | Added traceability | traceability-matrix.csv | Linked TC-0005 to FR-02 |
| W-003 | WARNING | Skipped | - | Style preference, no action needed |
```

---

## 7. Skills Manifest Agent Entries

### 7.1 test-strategy-critic Entry

```json
{
  "test-strategy-critic": {
    "agent_id": "04",
    "phase": "05-test-strategy",
    "skill_count": 3,
    "skills": [
      "TEST-002",
      "TEST-004",
      "TEST-005"
    ]
  }
}
```

### 7.2 test-strategy-refiner Entry

```json
{
  "test-strategy-refiner": {
    "agent_id": "04",
    "phase": "05-test-strategy",
    "skill_count": 5,
    "skills": [
      "TEST-001",
      "TEST-002",
      "TEST-003",
      "TEST-004",
      "TEST-005"
    ]
  }
}
```

### 7.3 Manifest Invariants

- `total_skills` remains unchanged (no new skill IDs)
- `total_agents` increases from 20 to 22
- `skill_owners` map unchanged (primary_owner stays `test-design-engineer`)

---

## 8. State.json Debate State Schema

Stored in `active_workflow.debate_state`:

```json
{
  "phase": "05-test-strategy",
  "current_round": 2,
  "max_rounds": 3,
  "status": "converged",
  "rounds": [
    {
      "round": 1,
      "creator_completed": true,
      "critic_completed": true,
      "refiner_completed": true,
      "blocking_count": 3,
      "warning_count": 2,
      "converged": false
    },
    {
      "round": 2,
      "creator_completed": true,
      "critic_completed": true,
      "refiner_completed": false,
      "blocking_count": 0,
      "warning_count": 1,
      "converged": true
    }
  ]
}
```

---

## 9. Agent Frontmatter Schema

Both new agents use YAML frontmatter with this schema:

```yaml
---
name: {agent-name}           # String: unique agent identifier
description: "{multi-line}"  # String: agent purpose and usage
model: opus                  # String: LLM model
owned_skills:                # Array: skill IDs from skills-manifest.json
  - TEST-NNN
---
```

### 9.1 Critic Frontmatter

```yaml
---
name: test-strategy-critic
description: "Use this agent for reviewing Phase 05 test strategy artifacts
  during the debate loop. ..."
model: opus
owned_skills:
  - TEST-002
  - TEST-004
  - TEST-005
---
```

### 9.2 Refiner Frontmatter

```yaml
---
name: test-strategy-refiner
description: "Use this agent for refining Phase 05 test strategy artifacts
  during the debate loop. ..."
model: opus
owned_skills:
  - TEST-001
  - TEST-002
  - TEST-003
  - TEST-004
  - TEST-005
---
```
