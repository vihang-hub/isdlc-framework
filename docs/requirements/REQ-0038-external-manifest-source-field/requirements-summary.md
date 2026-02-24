# Requirements Summary: REQ-0038 External Manifest Source Field

**Accepted**: 2026-02-24
**Domain**: Requirements
**Owner**: Maya Chen (Business Analyst)

---

## Problem

The external skills manifest has no way to distinguish who registered a skill, leading to unsafe overwrites when discover re-runs and no way to preserve user binding customizations.

## Stakeholders

- Framework user (primary): developer using iSDLC who adds custom skills and runs discover
- Discover orchestrator (automated): distills project skills from codebase analysis
- Skills-researcher (automated): fetches and installs skills from skills.sh

## Functional Requirements

| FR | Title | Priority | Confidence |
|----|-------|----------|------------|
| FR-001 | Source Field in Manifest Entries | Must Have | High |
| FR-002 | Reconciliation Function | Must Have | High |
| FR-003 | Reconciliation Return Value | Must Have | High |
| FR-004 | Field Ownership Rules | Must Have | High |
| FR-005 | Conditional Cache Rebuild | Should Have | High |
| FR-006 | Discover Orchestrator Integration | Must Have | High |
| FR-007 | Skills Researcher Integration | Must Have | High |
| FR-008 | Updated Manifest Schema | Must Have | High |

## Key Acceptance Criteria

- Three source types: "discover", "skills.sh", "user" (closed set)
- Reconciliation matches by source + name, updates source-owned fields, preserves user-owned fields (bindings, added_at)
- Phase-gated removal: only removes skills whose source phase actually executed
- Defensive default: null/empty phasesExecuted means no removals
- Conditional cache rebuild gated by changed boolean
- Backward compatible: missing source defaults to "user"

## Detailed Artifacts

- requirements-spec.md (8 sections)
- user-stories.json (7 stories)
- traceability-matrix.csv (35 mappings)
