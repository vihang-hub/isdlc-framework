# Requirements Specification: Codex Adapter for Implementation Loop

**Item**: REQ-0078 | **GitHub**: #142 | **Depends on**: REQ-0076, REQ-0077
**Workstream**: C (Provider Adapters) | **Phase**: 1
**Status**: Analyzed

---

## 1. Business Context

After the core slice is extracted (REQ-0076) and Claude parity is proven (REQ-0077), build the first Codex execution path. This proves the adapter model: same core, different provider, identical loop behavior.

**Success metric**: Codex executes the Writer/Reviewer/Updater loop against the shared core with the same state evolution and artifact outcomes as Claude.

## 2. Technical Context

From the capability audit (REQ-0070):
- Codex spawns named sub-agents ("Hooke [explorer]") with model selection
- Sub-agents return structured JSON
- AGENTS.md instructions are followed
- This maps directly to Writer/Reviewer/Updater as sub-agent roles

## 3. Functional Requirements

### FR-001: Codex Loop Execution
**Confidence**: High

- **AC-001-01**: Given the core ImplementationLoop, then a Codex adapter invokes it to drive the loop.
- **AC-001-02**: Given each loop step, then the Codex adapter spawns the appropriate sub-agent (Writer, Reviewer, or Updater) with the core contract as input.
- **AC-001-03**: Given a sub-agent result, then the adapter feeds it back to processVerdict() and continues.

### FR-002: Same State Evolution
**Confidence**: High

- **AC-002-01**: Given the same file list and verdict sequence, then Codex produces identical loop state to Claude.
- **AC-002-02**: Given state.json, then loop progress fields match between Claude and Codex paths.

### FR-003: Same Artifact Outcomes
**Confidence**: High

- **AC-003-01**: Given a completed loop, then the same files are produced (paths and count match).
- **AC-003-02**: Given review verdicts, then the same cycle counts are recorded.

### FR-004: Codex-Specific Packaging
**Confidence**: High

- **AC-004-01**: Given Codex sub-agents, then Writer/Reviewer/Updater role instructions are adapted for Codex (AGENTS.md style, not Claude Task tool style).
- **AC-004-02**: Given the Codex adapter, then it lives in the isdlc-codex repo (external consumer of the npm package).

## 4. Out of Scope

| Item | Reason |
|------|--------|
| Full Codex adapter | That's Phase 8 (REQ-0114) |
| Codex installation/doctor | That's REQ-0115 |
| Other team types | This spike is implementation loop only |

## 5. MoSCoW Prioritization

| FR | Title | Priority |
|----|-------|----------|
| FR-001 | Codex loop execution | Must Have |
| FR-002 | Same state evolution | Must Have |
| FR-003 | Same artifact outcomes | Must Have |
| FR-004 | Codex-specific packaging | Must Have |
