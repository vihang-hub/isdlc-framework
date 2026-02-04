# Phase 00: Quick Scan Gate Checklist

**Phase**: Quick Scan (Lightweight Exploration)
**Primary Agent**: Quick Scan Agent
**Model**: haiku (fast, lightweight)

---

## Required Artifacts

| Artifact | Path | Required |
|----------|------|----------|
| Quick Scan Report | `quick-scan.md` | Yes |

---

## Validation Criteria

### 1. Keyword Extraction
- [ ] Domain keywords extracted from feature description
- [ ] Technical keywords extracted
- [ ] Scope hints identified (if any)

### 2. Codebase Search
- [ ] File name glob searches completed
- [ ] Keyword grep searches completed
- [ ] Search completed within time limit (30s max)

### 3. Scope Estimation
- [ ] Scope estimated (small/medium/large)
- [ ] File count estimate provided
- [ ] Confidence level assigned (low/medium/high)

### 4. Report Generation
- [ ] quick-scan.md generated in artifact folder
- [ ] Keyword matches documented
- [ ] Relevant modules identified
- [ ] Notes for requirements included (if applicable)

---

## Gate Decision

| Criteria | Status | Notes |
|----------|--------|-------|
| Keywords extracted | [ ] Pass / [ ] Fail | |
| Codebase search completed | [ ] Pass / [ ] Fail | |
| Scope estimated | [ ] Pass / [ ] Fail | |
| Report generated | [ ] Pass / [ ] Fail | |

**Gate Status**: [ ] PASS / [ ] FAIL

**Reviewer**: _______________
**Date**: _______________

---

## Next Phase

Upon passing this gate:
- Advance to Phase 01: Requirements Capture
- Primary Agent: Requirements Analyst (Agent 01)
- The quick-scan.md provides initial context for requirements gathering
