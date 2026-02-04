# Phase 00: Tracing Gate Checklist

**Phase**: Bug Tracing (Exploration Mode)
**Primary Agent**: Tracing Orchestrator (T0)
**Sub-Agents**: Symptom Analyzer (T1), Execution Path Tracer (T2), Root Cause Identifier (T3)

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Trace Analysis | `trace-analysis.md` | Yes |
| Diagnosis | `diagnosis.json` | Yes |

---

## Validation Criteria

### 1. Sub-Agent Execution
- [ ] T1 (Symptom Analyzer) completed successfully
- [ ] T2 (Execution Path Tracer) completed successfully
- [ ] T3 (Root Cause Identifier) completed successfully
- [ ] All three sub-agents ran in parallel

### 2. Symptom Analysis (T1)
- [ ] Error messages parsed and classified
- [ ] Stack traces analyzed (if available)
- [ ] Reproduction steps extracted and structured
- [ ] Symptom patterns matched against known issues
- [ ] Likely causes listed

### 3. Execution Path Tracing (T2)
- [ ] Call chain reconstructed from entry to failure
- [ ] Data flow traced through execution path
- [ ] State mutations tracked
- [ ] Branch points identified
- [ ] Critical divergence point found

### 4. Root Cause Identification (T3)
- [ ] Hypotheses generated and ranked
- [ ] Evidence correlated to hypotheses
- [ ] Root cause confirmed with confidence level
- [ ] Fix recommendations provided
- [ ] Files to modify identified

### 5. Consolidation
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
- Advance to Phase 1: Requirements Capture (Fix Mode)
- Primary Agent: Requirements Analyst (Agent 01)
- The trace-analysis.md feeds into fix requirements
- Workflow scope should be set to `bug-report`
