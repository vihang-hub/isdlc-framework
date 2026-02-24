# Error Taxonomy: Multi-agent Test Strategy Team (REQ-0016)

**Version**: 1.0
**Created**: 2026-02-15
**Phase**: 04-design
**Traces**: FR-02, AC-02.1 through AC-02.8, NFR-02

---

## 1. Finding Classification System

The Test Strategy Critic produces findings classified into two severity levels, consistent with the established debate team pattern (design-critic, architecture-critic, requirements-critic).

### Severity Levels

| Severity | Symbol | Meaning | Effect on Convergence |
|----------|--------|---------|----------------------|
| BLOCKING | B-NNN | Must be fixed before debate loop converges | Loop continues; Refiner must address |
| WARNING | W-NNN | Should be fixed but does not block convergence | Refiner addresses best-effort |

### Finding ID Scheme

| Component | Format | Example | Scope |
|-----------|--------|---------|-------|
| BLOCKING finding | `B-{NNN}` | B-001, B-002, B-015 | Per round; resets each round |
| WARNING finding | `W-{NNN}` | W-001, W-002 | Per round; resets each round |

Finding IDs are sequential within a round, starting at 001. They reset in each new round (Round 2 starts at B-001 again). This matches the pattern used by `03-design-critic.md`.

---

## 2. Mandatory Check Error Categories (TC-01 through TC-08)

Each mandatory check corresponds to a category of test strategy defect. When the check fails, it produces one or more findings.

### TC-01: UNTESTED_ACCEPTANCE_CRITERION

| Property | Value |
|----------|-------|
| Severity | BLOCKING |
| Artifact | traceability-matrix.csv |
| Trigger | Any AC from requirements-spec.md has no test case mapping |
| Finding Count | One B-NNN per untested AC |
| Traces | AC-02.1 |

**Error message template**:
```
AC-{AC_ID} ({AC description}) from requirements-spec.md has no corresponding
test case in the traceability matrix. Every acceptance criterion MUST have at
least one test case to verify it.
```

**Recommendation template**:
```
Add a test case for AC-{AC_ID} in test-cases/ using Given/When/Then format
matching the AC's conditions. Update traceability-matrix.csv to map the new
test case to AC-{AC_ID}.
```

### TC-02: INCOMPLETE_TEST_PYRAMID

| Property | Value |
|----------|-------|
| Severity | BLOCKING |
| Artifact | test-strategy.md |
| Trigger | Test pyramid has fewer than 2 levels |
| Finding Count | One B-NNN (single finding) |
| Traces | AC-02.2 |

**Error message template**:
```
The test pyramid defines only {N} level(s): {list}. A minimum of 2 levels is
required to validate both unit behavior and component interactions. A single-level
pyramid provides no cross-cutting validation.
```

**Recommendation template**:
```
Add at least one additional test level. For most projects: unit + integration.
For user-facing features: unit + integration + E2E. Define proportions
(e.g., 70%/20%/10%) and execution strategy per level.
```

### TC-03: MISSING_NEGATIVE_TESTS

| Property | Value |
|----------|-------|
| Severity | BLOCKING |
| Artifact | test-cases/ |
| Trigger | Any requirement has only positive-path test cases |
| Finding Count | One B-NNN per requirement with missing negative tests |
| Traces | AC-02.3 |

**Error message template**:
```
{Requirement ID} has {N} test case(s) but all are positive-path (happy path).
No negative tests (error handling, invalid input, boundary violations) exist
for this requirement.
```

**Recommendation template**:
```
Add at least 1 negative test case for {Requirement ID} covering: invalid input
rejection, error response verification, or boundary violation handling.
```

### TC-04: TEST_DATA_GAPS

| Property | Value |
|----------|-------|
| Severity | BLOCKING |
| Artifact | test-data-plan.md |
| Trigger | Missing boundary values, empty inputs, invalid types, or max-size inputs |
| Finding Count | One B-NNN per data gap category |
| Traces | AC-02.4 |

**Error message template**:
```
Test data for field "{field_name}" is missing {gap_type}. Specifically:
- Boundary values: {present/missing}
- Empty/null inputs: {present/missing}
- Invalid type inputs: {present/missing}
- Maximum-size inputs: {present/missing}
```

**Recommendation template**:
```
Add test data entries for "{field_name}" covering: min value, max value, min+1,
max-1, empty string/null, wrong data type (string for number, etc.), and
maximum-size input (e.g., 10000 character string).
```

### TC-05: FLAKY_TEST_RISK

| Property | Value |
|----------|-------|
| Severity | BLOCKING |
| Artifact | test-strategy.md, test-cases/ |
| Trigger | Test relies on timing, external services, random data, or shared mutable state without documented mitigation |
| Finding Count | One B-NNN per unmitigated flaky risk |
| Traces | AC-02.5 |

**Error message template**:
```
Test "{test_name}" has flaky risk: {risk_description}. No mitigation strategy
is documented. Unmitigated flaky tests cause false failures and erode trust
in the test suite.
```

**Risk categories**:
| Risk | Examples | Mitigation |
|------|----------|------------|
| Timing | setTimeout, sleep, Date.now() | Use fake timers, deterministic scheduling |
| External services | HTTP calls, DB queries | Mock in unit tests; use test containers in integration |
| Random data | Math.random(), UUID generation | Use seeded random, deterministic generators |
| Shared mutable state | Global variables, shared DB | Test isolation, fresh state per test |

**Recommendation template**:
```
Document a mitigation strategy in test-strategy.md: {specific mitigation}.
Alternatively, restructure the test to eliminate the flaky risk.
```

### TC-06: UNTESTED_ERROR_PATHS

| Property | Value |
|----------|-------|
| Severity | BLOCKING |
| Artifact | test-cases/ |
| Trigger | Error paths in error-taxonomy.md have no test case |
| Finding Count | One B-NNN per untested error path |
| Conditional | Only applies when error-taxonomy.md exists |
| Traces | AC-02.6 |

**Error message template**:
```
Error path "{error_code}: {error_description}" from error-taxonomy.md has no
corresponding test case. Every documented error path should be verified by
at least one test.
```

**Not-applicable message** (when error-taxonomy.md does not exist):
```
TC-06: Not applicable (no error taxonomy present in docs/common/error-taxonomy.md).
No findings produced.
```

### TC-07: MISSING_PERFORMANCE_TESTS

| Property | Value |
|----------|-------|
| Severity | BLOCKING |
| Artifact | test-strategy.md |
| Trigger | NFRs with quantified metrics have no performance/load/benchmark test plan |
| Finding Count | One B-NNN per NFR without performance test |
| Conditional | Only applies when nfr-matrix.md exists and contains quantified NFRs |
| Traces | AC-02.7 |

**Error message template**:
```
NFR "{NFR_ID}: {NFR_description}" has a quantified metric ({metric}) but no
performance, load, or benchmark test plan is defined in test-strategy.md.
```

**Not-applicable message** (when nfr-matrix.md does not exist or has no quantified NFRs):
```
TC-07: Not applicable (no quantified NFRs in nfr-matrix.md). No findings produced.
```

### TC-08: ORPHAN_TEST_CASE

| Property | Value |
|----------|-------|
| Severity | WARNING |
| Artifact | traceability-matrix.csv |
| Trigger | Test case does not trace back to any requirement |
| Finding Count | One W-NNN per orphan test case |
| Traces | AC-02.8 |

**Error message template**:
```
Test case "{test_case_name}" in traceability-matrix.csv has no requirement
mapping (Requirement column is empty, "N/A", or references a non-existent
requirement). Orphan tests indicate suboptimal traceability.
```

**Recommendation template**:
```
Map the test case to its originating requirement. If it is an exploratory or
regression test not tied to a specific requirement, document this in the
traceability matrix with a note (e.g., "Exploratory: covers regression for
previous bug fix").
```

---

## 3. Debate Loop Error Handling

### Convergence Errors

| Condition | Handling | Traces |
|-----------|----------|--------|
| 0 BLOCKING findings | Convergence achieved; produce debate-summary.md | NFR-03 |
| BLOCKING > 0, round < 3 | Continue loop; Refiner addresses findings | NFR-03 |
| BLOCKING > 0, round = 3 | Escalate to human with remaining findings list | NFR-03 |
| Malformed critique (cannot parse BLOCKING count) | Treat as 0 BLOCKING (fail-open per Article X) | Article X |

### Agent Failure Errors

| Condition | Handling | Traces |
|-----------|----------|--------|
| Creator fails to produce critical artifact (test-strategy.md) | Abort debate, fall back to single-agent mode | Article X |
| Creator produces partial artifacts (some missing, but test-strategy.md exists) | Attempt debate with available artifacts; Critic reviews what exists | Article X |
| Critic produces malformed critique | Treat as 0 BLOCKING (fail-open); log warning | Article X |
| Refiner does not address all BLOCKING findings | Next Critic round re-flags them; eventually hits max-rounds | NFR-03 |
| Refiner encounters unresolvable finding | Mark [NEEDS CLARIFICATION]; counts as addressed | Article IV |

### Flag Conflict Errors

| Condition | Handling |
|-----------|----------|
| Both --debate and --no-debate flags | --no-debate wins (conservative per Article X) |
| Phase not in DEBATE_ROUTING | Delegate to phase's standard agent; no debate |

---

## 4. Escalation Protocol

### Level 1: Refiner [NEEDS CLARIFICATION]

When the Refiner cannot resolve a BLOCKING finding without user input:
1. Mark section with `[NEEDS CLARIFICATION]`
2. Document specific question in change log
3. Finding counts as "addressed" for convergence

### Level 2: Max Rounds Exceeded

When 3 rounds pass without convergence (still has BLOCKING findings):
1. Orchestrator produces debate-summary.md with status "ESCALATED"
2. Remaining BLOCKING findings are listed for human review
3. Phase does NOT advance; human must resolve

### Level 3: Agent Failure

When an agent fails to produce any output:
1. Orchestrator logs error to state.json
2. Falls back to single-agent mode (Creator only, no debate)
3. Phase continues in degraded mode

---

## 5. Error Response Format

All errors within the debate loop are communicated through markdown artifacts, not HTTP responses or JSON error objects. The critique report (round-N-critique.md) IS the error report. The change log appended by the Refiner IS the error resolution log. This is consistent with the agent-based architecture where all communication is through markdown files.
