# Requirements Specification: REQ-0039

**Title**: Replace 24h staleness discovery context injection with project skills
**Source**: GitHub Issue #90 (GH-90)
**Type**: Enhancement (Refactoring)
**Priority**: Must Have
**Scope**: Medium (~11 files, removals and documentation updates only)

---

## 1. Project Overview

### 1.1 Problem Statement

The current discovery context injection mechanism in `isdlc.md` STEP 3d uses a legacy approach that reads `discovery_context` from `state.json` and injects it as a raw block into phase delegation prompts. This approach has four structural deficiencies:

1. **Limited reach**: Only phases 02 (Architecture) and 03 (Design) receive discovery context. All other phases -- including the Analyze phase -- receive no project knowledge from discovery.
2. **Arbitrary expiry**: A 24-hour staleness window determines whether the context is "fresh" or "stale". Project knowledge does not expire on a 24-hour cycle; this is an arbitrary heuristic.
3. **Unstructured format**: The injected block is a JSON blob, not structured actionable knowledge that agents can efficiently consume.
4. **Redundancy**: Project skills (#88) now provide the same knowledge -- in a structured, skill-based format -- to all phases via the AVAILABLE SKILLS injection mechanism (#84).

### 1.2 Solution Summary

Remove the legacy discovery context injection block from STEP 3d. Deprecate the `discovery_context` envelope in `state.json` to audit-only metadata. All phases now receive project knowledge through project skills in the AVAILABLE SKILLS block, which is already wired and operational.

### 1.3 Dependencies (All Completed)

| Dependency | Description | Status |
|------------|-------------|--------|
| #88 / REQ-0037 | Project skills distillation | DONE |
| #89 / REQ-0038 | External manifest source field | DONE |
| #84 / REQ-0033 | Skill index injection wired | DONE |

### 1.4 Success Metrics

- Zero discovery context injection logic remains in STEP 3d
- All 13 phase agents receive project knowledge uniformly via AVAILABLE SKILLS
- No regression in projects that have not re-run discover (fail-open)

---

## 2. Stakeholders and Personas

### 2.1 Framework Developer

- **Role**: Developer working on the iSDLC framework itself (dogfooding)
- **Goal**: Simplify the phase delegation pipeline by removing redundant injection logic
- **Pain Point**: Discovery context injection is a special-case code path that complicates the orchestrator

### 2.2 Framework User (Target Project Developer)

- **Role**: Developer using iSDLC in their project
- **Goal**: Receive consistent project knowledge across all workflow phases
- **Pain Point**: Currently only phases 02-03 receive discovery context; the analyze phase and phases 04+ are blind to project knowledge

---

## 3. Functional Requirements

### FR-001: Remove Discovery Context Injection Block

**Description**: Remove the discovery context injection block from `src/claude/commands/isdlc.md` STEP 3d.

**Current behavior** (line ~1566):
- Check if session context contains `<!-- SECTION: DISCOVERY_CONTEXT -->`
- If found, extract and include as `DISCOVERY CONTEXT` block
- If not found, fall back to reading `state.json` -> `discovery_context`
- If exists, include as `DISCOVERY CONTEXT` block regardless of age
- Otherwise omit

**New behavior**: This entire block is removed. No `DISCOVERY CONTEXT` block is injected during phase delegation. Project knowledge is delivered exclusively through the AVAILABLE SKILLS mechanism.

**Acceptance Criteria**:

- AC-001-01: Given the isdlc.md STEP 3d delegation logic, when a phase agent is delegated to, then no `DISCOVERY CONTEXT` block is included in the delegation prompt.
- AC-001-02: Given the isdlc.md STEP 3d delegation logic, when the discovery context injection block is searched for, then no code referencing `discovery_context` injection, `<!-- SECTION: DISCOVERY_CONTEXT -->` extraction, or staleness/24h logic exists.
- AC-001-03: Given the skill injection step in STEP 3d, when assembling the delegation prompt, then the `SKILL INJECTION STEP C` comment referencing "after DISCOVERY CONTEXT" is updated to remove the DISCOVERY CONTEXT reference.

### FR-002: Update Delegation Prompt Template

**Description**: Update the delegation prompt template in `isdlc.md` to remove the `{DISCOVERY CONTEXT: ... -- if phase 02 or 03}` placeholder.

**Acceptance Criteria**:

- AC-002-01: Given the delegation prompt template (line ~1794), when the template is rendered, then no `DISCOVERY CONTEXT` placeholder or conditional appears.
- AC-002-02: Given the skill injection assembly step (STEP C), when the prompt is assembled, then skill blocks are positioned after WORKFLOW MODIFIERS (not after a non-existent DISCOVERY CONTEXT block).

### FR-003: Deprecate discovery_context Envelope to Audit-Only

**Description**: Update `src/claude/agents/discover-orchestrator.md` to document that `discovery_context` in `state.json` is retained solely as audit/provenance metadata. The envelope is still written by the discover orchestrator (recording `completed_at` timestamp), but it is no longer read during phase delegation.

**Acceptance Criteria**:

- AC-003-01: Given the discover orchestrator's envelope documentation, when the discovery_context envelope section is read, then it clearly states the envelope is audit-only metadata and is not consumed during phase delegation.
- AC-003-02: Given the discover orchestrator's envelope writing logic, when discover completes, then `discovery_context.completed_at` is still written to `state.json` for provenance tracking.
- AC-003-03: Given the discover orchestrator's envelope documentation, when expiry or staleness semantics are searched for, then no 24-hour expiry, staleness warnings, or freshness checks are documented.

### FR-004: Update Phase Agent Documentation

**Description**: Update references in phase agent files (00-sdlc-orchestrator, 01-requirements-analyst, 02-solution-architect, 03-system-designer) to clarify that discovery context is delivered via project skills, not the legacy `discovery_context` block.

**Acceptance Criteria**:

- AC-004-01: Given the phase agent files that reference discovery context consumption, when the documentation is read, then it describes project skills as the delivery mechanism for project knowledge (not discovery_context block injection).

### FR-005: Maintain Fail-Open Backward Compatibility

**Description**: Existing projects that have not re-run discover (and therefore have no project skills) must continue to function without errors. The removal of discovery context injection must not cause failures -- it must fail open.

**Acceptance Criteria**:

- AC-005-01: Given a project that has never run discover, when a phase agent is delegated to, then no error occurs due to missing discovery context or project skills.
- AC-005-02: Given a project that has run discover but has no project skills (pre-#88 discover run), when a phase agent is delegated to, then no error occurs and the agent proceeds without project knowledge.

### FR-006: Update Hook/Infrastructure Files

**Description**: Review and update hook files (`walkthrough-tracker.cjs`, `test-adequacy-blocker.cjs`) to ensure they only write/read `discovery_context` for audit purposes, not for staleness checking or injection decisions.

**Acceptance Criteria**:

- AC-006-01: Given the walkthrough-tracker hook, when it writes `discovery_context` to state.json, then it writes for audit/provenance only (no staleness semantics).
- AC-006-02: Given the test-adequacy-blocker hook, when it reads `discovery_context`, then it does not use the data for staleness decisions or injection gating.
- AC-006-03: Given the hook test fixtures in `walkthrough-tracker.test.cjs`, when tests reference `discovery_context`, then they validate audit/provenance behavior only (no staleness assertions).

---

## 4. Non-Functional Requirements

### NFR-001: No New Functionality

**Category**: Simplicity
**Requirement**: This change introduces zero new features. All changes are removals or documentation clarifications.
**Metric**: Net line count change is negative (more lines removed than added).
**Priority**: Must Have

### NFR-002: Backward Compatibility

**Category**: Reliability
**Requirement**: Existing projects must not break regardless of their discovery state (never discovered, discovered without project skills, discovered with project skills).
**Metric**: Zero errors in all three project states when running any workflow phase.
**Priority**: Must Have

### NFR-003: Test Regression

**Category**: Quality
**Requirement**: Existing hook tests must continue to pass after changes. Test count must not decrease without justification per Article II of the constitution.
**Metric**: All tests in `walkthrough-tracker.test.cjs` pass. Total test count >= baseline (555).
**Priority**: Must Have

---

## 5. Constraints

### CON-001: No State Schema Breaking Changes

The `discovery_context` field in `state.json` must be retained (not deleted). It becomes audit-only metadata. Deleting it could break external tooling or scripts that read `state.json`.

### CON-002: Discover Orchestrator Continues Writing

The discover orchestrator must continue writing `discovery_context.completed_at` on discover completion. This timestamp is used for audit trails and provenance (e.g., "when was the last discover run?").

---

## 6. Assumptions

- ASM-001: Project skills (#88) are already functional and delivering project knowledge through the AVAILABLE SKILLS mechanism.
- ASM-002: Skill index injection (#84) is already wired and operational in all phase delegations.
- ASM-003: The external manifest source field (#89) is already in place for skill provenance tracking.
- ASM-004: No external tooling beyond the iSDLC framework itself reads `discovery_context` from `state.json` for injection purposes.

---

## 7. Out of Scope

- **OS-001**: Removing the `discovery_context` field entirely from `state.json` -- it is retained as audit metadata.
- **OS-002**: Modifying the discover orchestrator's knowledge extraction logic -- project skills distillation (#88) is already complete.
- **OS-003**: Adding new skill types or modifying the AVAILABLE SKILLS injection mechanism.
- **OS-004**: Modifying any phase agent's internal logic for consuming project knowledge -- agents already consume skills via the existing mechanism.

---

## 8. Glossary

| Term | Definition |
|------|------------|
| Discovery context | A JSON envelope in `state.json` containing project metadata written by the discover orchestrator |
| Project skills | Structured skill files distilled from project discovery, delivered to agents via the AVAILABLE SKILLS block |
| AVAILABLE SKILLS | The injection mechanism in STEP 3d that assembles built-in and external skill blocks into the delegation prompt |
| Fail-open | Design pattern where missing or unavailable data does not cause errors -- the system proceeds without it |
| STEP 3d | The delegation step in `isdlc.md` where the orchestrator constructs and sends the prompt to a phase agent |
| Staleness | The legacy 24-hour expiry heuristic that marked discovery context as "stale" after 24 hours |

---

## 9. Files Affected

| File | Impact | Action |
|------|--------|--------|
| `src/claude/commands/isdlc.md` | HIGH | Remove discovery context injection block from STEP 3d; update prompt template |
| `src/claude/agents/discover-orchestrator.md` | HIGH | Update envelope documentation to audit-only semantics |
| `src/claude/agents/00-sdlc-orchestrator.md` | LOW | Update documentation references |
| `src/claude/agents/01-requirements-analyst.md` | LOW | Update documentation references |
| `src/claude/agents/02-solution-architect.md` | LOW | Update documentation references |
| `src/claude/agents/03-system-designer.md` | LOW | Update documentation references |
| `src/claude/hooks/walkthrough-tracker.cjs` | MEDIUM | Verify envelope writing is audit-only |
| `src/claude/hooks/test-adequacy-blocker.cjs` | MEDIUM | Verify no staleness logic |
| `src/claude/hooks/tests/walkthrough-tracker.test.cjs` | MEDIUM | Update test fixtures if needed |
| `src/claude/commands/discover.md` | LOW | Update documentation reference |
| `src/claude/commands/tour.md` | LOW | Update documentation reference |

---

## 10. Traceability

| Requirement | User Story | Source |
|-------------|-----------|--------|
| FR-001 | As a framework developer, I want the discovery context injection block removed from STEP 3d, so that the delegation pipeline is simpler and has one knowledge delivery mechanism. | GH-90 AC-1 |
| FR-002 | As a framework developer, I want the delegation prompt template updated, so that it does not reference a non-existent DISCOVERY CONTEXT block. | GH-90 AC-1 |
| FR-003 | As a framework developer, I want the discovery_context envelope documented as audit-only, so that future contributors understand its purpose. | GH-90 AC-4 |
| FR-004 | As a framework user, I want all phases to receive project knowledge via AVAILABLE SKILLS, so that I get consistent context regardless of which phase is running. | GH-90 AC-2, AC-3 |
| FR-005 | As a framework user, I want existing projects without project skills to work without errors, so that the upgrade path is non-breaking. | GH-90 AC-5 |
| FR-006 | As a framework developer, I want hook files to use discovery_context for audit only, so that no staleness logic remains in infrastructure code. | GH-90 AC-4 |

---

## GATE-01 Validation

### Requirements Completeness
- [x] All functional requirements documented (FR-001 through FR-006)
- [x] All non-functional requirements documented (NFR-001 through NFR-003)
- [x] All constraints identified (CON-001, CON-002)
- [x] All assumptions documented (ASM-001 through ASM-004)

### Requirements Quality
- [x] Each requirement has a unique ID
- [x] Each requirement has a clear description
- [x] Each requirement has a priority (all Must Have for this focused change)
- [x] No ambiguous requirements
- [x] No conflicting requirements

### Acceptance Criteria
- [x] All functional requirements have acceptance criteria
- [x] Acceptance criteria use Given/When/Then format
- [x] Each AC has a unique ID (AC-NNN-NN)

### Non-Functional Requirements
- [x] Simplicity requirement has metric (NFR-001)
- [x] Backward compatibility requirement has metric (NFR-002)
- [x] Test regression requirement has metric (NFR-003)

### Traceability
- [x] Requirements linked to source issue (GH-90)
- [x] Requirements linked to user stories
- [x] No orphan requirements
- [x] Dependencies documented and all completed
