# Phase 02: Tracing Gate Checklist

**Phase**: Bug Tracing (after Requirements)
**Primary Agent**: Tracing Orchestrator (T0)
**Sub-Agents**: Symptom Analyzer (T1), Execution Path Tracer (T2), Root Cause Identifier (T3)
**Previous Phase**: 01 - Requirements (bug report captured)

---

## Prerequisites from Phase 01

| Artifact | Path | Required |
|----------|------|----------|
| Bug Report | `docs/requirements/BUG-NNNN-{id}/bug-report.md` | Yes |
| Requirements Spec | `docs/requirements/BUG-NNNN-{id}/requirements-spec.md` | Yes |

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Trace Analysis | `docs/requirements/BUG-NNNN-{id}/trace-analysis.md` | Yes |
| Diagnosis | `docs/requirements/BUG-NNNN-{id}/diagnosis.json` | Yes |

---

## Validation Criteria

### 1. Pre-Requisite Check
- [ ] Bug report from Phase 01 exists and is complete
- [ ] Expected vs actual behavior documented
- [ ] Reproduction steps available
- [ ] Discovery artifacts available

### 2. Sub-Agent Execution
- [ ] T1 (Symptom Analyzer) completed successfully
- [ ] T2 (Execution Path Tracer) completed successfully
- [ ] T3 (Root Cause Identifier) completed successfully
- [ ] All three sub-agents ran in parallel

### 3. Symptom Analysis (T1)
- [ ] Error messages parsed and classified
- [ ] Stack traces analyzed (if available)
- [ ] Reproduction steps validated against codebase
- [ ] Symptom patterns matched against known issues
- [ ] Likely causes listed

### 4. Execution Path Tracing (T2)
- [ ] Call chain reconstructed from entry to failure
- [ ] Data flow traced through execution path
- [ ] State mutations tracked
- [ ] Branch points identified
- [ ] Critical divergence point found

### 5. Root Cause Identification (T3)
- [ ] Hypotheses generated and ranked
- [ ] Evidence correlated to hypotheses
- [ ] Root cause confirmed with confidence level
- [ ] Fix recommendations provided
- [ ] Files to modify identified

### 6. Consolidation
- [ ] All sub-agent outputs consolidated into trace-analysis.md
- [ ] Executive summary generated
- [ ] Root cause clearly stated
- [ ] Fix scope defined
- [ ] Acceptance criteria for fix documented

---

## Root Cause Confidence

| Confidence Level | Criteria |
|-----------------|----------|
| High | Multiple evidence sources, reproducible, code location verified |
| Medium | Some evidence, plausible mechanism, location identified |
| Low | Hypothesis fits symptoms but not fully confirmed |

**Minimum Required**: Medium (Low requires additional investigation)

---

## Gate Decision

| Criteria | Status | Notes |
|----------|--------|-------|
| Bug report from Phase 01 exists | [ ] Pass / [ ] Fail | |
| All sub-agents completed | [ ] Pass / [ ] Fail | |
| Symptom analysis complete | [ ] Pass / [ ] Fail | |
| Execution path traced | [ ] Pass / [ ] Fail | |
| Root cause identified | [ ] Pass / [ ] Fail | |
| Confidence >= Medium | [ ] Pass / [ ] Fail | |
| Artifacts generated | [ ] Pass / [ ] Fail | |

**Gate Status**: [ ] PASS / [ ] FAIL

**Reviewer**: _______________
**Date**: _______________

---

## Next Phase

Upon passing this gate:
- Advance to Phase 04: Test Strategy
- Primary Agent: Test Design Engineer (Agent 04)
- The trace-analysis.md informs targeted failing test design
- Root cause hypothesis guides test case creation
