# Phase 00: Mapping Gate Checklist

**Phase**: Feature Mapping (Exploration Mode)
**Primary Agent**: Mapping Orchestrator (M0)
**Sub-Agents**: Impact Analyzer (M1), Entry Point Finder (M2), Risk Assessor (M3)

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Impact Analysis | `impact-analysis.md` | Yes |
| Feature Map | `feature-map.json` | Yes |

---

## Validation Criteria

### 1. Sub-Agent Execution
- [ ] M1 (Impact Analyzer) completed successfully
- [ ] M2 (Entry Point Finder) completed successfully
- [ ] M3 (Risk Assessor) completed successfully
- [ ] All three sub-agents ran in parallel

### 2. Impact Analysis (M1)
- [ ] Affected files identified
- [ ] Module dependencies mapped
- [ ] Coupling analysis performed
- [ ] Change propagation estimated
- [ ] Blast radius classified (low/medium/high)

### 3. Entry Point Discovery (M2)
- [ ] Relevant API endpoints identified (or N/A documented)
- [ ] Relevant UI components identified (or N/A documented)
- [ ] Background jobs assessed (or N/A documented)
- [ ] Event handlers assessed (or N/A documented)
- [ ] Suggestions for new entry points provided

### 4. Risk Assessment (M3)
- [ ] Complexity score assigned (1-10)
- [ ] Test coverage gaps identified
- [ ] Technical debt items catalogued
- [ ] Risk zones mapped (green/yellow/orange/red)
- [ ] Overall risk level determined

### 5. Consolidation
- [ ] All sub-agent outputs consolidated into impact-analysis.md
- [ ] Executive summary generated
- [ ] Scope boundaries defined
- [ ] Implementation recommendations provided

---

## Gate Decision

| Criteria | Status | Notes |
|----------|--------|-------|
| All sub-agents completed | [ ] Pass / [ ] Fail | |
| Impact analysis complete | [ ] Pass / [ ] Fail | |
| Entry points identified | [ ] Pass / [ ] Fail | |
| Risk assessment complete | [ ] Pass / [ ] Fail | |
| Artifacts generated | [ ] Pass / [ ] Fail | |

**Gate Status**: [ ] PASS / [ ] FAIL

**Reviewer**: _______________
**Date**: _______________

---

## Next Phase

Upon passing this gate:
- Advance to Phase 1: Requirements Capture
- Primary Agent: Requirements Analyst (Agent 01)
- The impact-analysis.md feeds into requirements scoping
