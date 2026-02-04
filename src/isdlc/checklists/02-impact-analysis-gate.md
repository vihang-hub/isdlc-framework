# Phase 02: Impact Analysis Gate Checklist

**Phase**: Impact Analysis (Full Exploration Mode)
**Primary Agent**: Impact Analysis Orchestrator
**Sub-Agents**: Impact Analyzer (M1), Entry Point Finder (M2), Risk Assessor (M3)
**Prerequisite**: Phase 01 (Requirements) must be complete

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Impact Analysis | `impact-analysis.md` | Yes |
| Requirements Document | `requirements.md` | Yes (from Phase 01) |
| Quick Scan Report | `quick-scan.md` | Optional (from Phase 00) |

---

## Validation Criteria

### 1. Prerequisites Check
- [ ] Phase 01 (Requirements) completed
- [ ] Requirements document loaded and parsed
- [ ] Scope comparison with original feature description completed

### 2. Sub-Agent Execution
- [ ] M1 (Impact Analyzer) completed successfully
- [ ] M2 (Entry Point Finder) completed successfully
- [ ] M3 (Risk Assessor) completed successfully
- [ ] All three sub-agents ran in parallel

### 3. Impact Analysis (M1) - Based on Finalized Requirements
- [ ] Affected files identified per acceptance criterion
- [ ] Module dependencies mapped
- [ ] Coupling analysis performed
- [ ] Change propagation estimated
- [ ] Blast radius classified (low/medium/high)

### 4. Entry Point Discovery (M2) - Based on Finalized Requirements
- [ ] Entry points mapped to specific acceptance criteria
- [ ] Relevant API endpoints identified (or N/A documented)
- [ ] Relevant UI components identified (or N/A documented)
- [ ] Background jobs assessed (or N/A documented)
- [ ] Event handlers assessed (or N/A documented)
- [ ] Suggestions for new entry points provided per AC
- [ ] Implementation order recommended

### 5. Risk Assessment (M3) - Based on Finalized Requirements
- [ ] Risk assessed per acceptance criterion
- [ ] Test coverage gaps identified per AC
- [ ] Technical debt items catalogued
- [ ] Risk zones mapped (low/medium/high/critical)
- [ ] Blocking risks identified
- [ ] Overall risk level determined

### 6. Consolidation
- [ ] All sub-agent outputs consolidated into impact-analysis.md
- [ ] Scope comparison included (original vs clarified)
- [ ] Executive summary generated
- [ ] Implementation recommendations provided
- [ ] Blocking risks documented

---

## Gate Decision

| Criteria | Status | Notes |
|----------|--------|-------|
| Requirements loaded | [ ] Pass / [ ] Fail | |
| All sub-agents completed | [ ] Pass / [ ] Fail | |
| Impact analysis complete | [ ] Pass / [ ] Fail | |
| Entry points identified per AC | [ ] Pass / [ ] Fail | |
| Risk assessment complete per AC | [ ] Pass / [ ] Fail | |
| Artifacts generated | [ ] Pass / [ ] Fail | |

**Gate Status**: [ ] PASS / [ ] FAIL

**Reviewer**: _______________
**Date**: _______________

---

## Next Phase

Upon passing this gate:
- Advance to Phase 03: Architecture & Blueprint
- Primary Agent: Solution Architect (Agent 03)
- The impact-analysis.md informs architectural decisions
