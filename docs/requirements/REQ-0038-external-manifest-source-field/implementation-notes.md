# Implementation Notes: REQ-0038 External Manifest Source Field

**Phase**: 06 - Implementation
**Status**: Complete
**Last Updated**: 2026-02-24
**Iteration Count**: 1 (all tests passed on first iteration)

---

## Summary

Implemented source-aware reconciliation for the external skills manifest. The core change
is a new `reconcileSkillsBySource()` function in `common.cjs` that replaces the previous
delete-by-name approach used by the discover orchestrator.

## Changes Made

### 1. `src/claude/hooks/lib/common.cjs`

**New function: `reconcileSkillsBySource(manifest, source, incomingSkills, phasesExecuted)`**

- Pure function operating on manifest in memory (no disk I/O)
- Validates inputs defensively: rejects `source: "user"`, non-array `incomingSkills`, null manifests
- Normalizes missing `source` fields to `"user"` before processing
- Partitions existing skills by source (same-source vs other-source)
- For each same-source match: updates source-owned fields (`file`, `description`, `updated_at`, `sourcePhase`) while preserving user-owned fields (`bindings`, `added_at`)
- Phase-gated removal: only removes skills whose `sourcePhase` is in `phasesExecuted` and not in incoming
- Returns `{ manifest, changed, added[], removed[], updated[] }` for downstream consumers
- Approximately 85 lines of implementation

**Modified function: `loadExternalManifest(projectId)`**

- Added read-time normalization: entries without `source` field default to `"user"`
- Backward compatible: existing manifests work without migration
- 5 new lines of code

**Exports**: Added `reconcileSkillsBySource` to `module.exports`

### 2. `src/claude/hooks/tests/external-skill-management.test.cjs`

Added 46 new tests in 9 test groups (TC-19 through TC-27):

| Group | Tests | Description |
|-------|-------|-------------|
| TC-19 | 7 | Add new skills |
| TC-20 | 6 | Update existing skills |
| TC-21 | 5 | Remove skills (phase-gated) |
| TC-22 | 4 | Cross-source isolation |
| TC-23 | 6 | Return shape validation |
| TC-24 | 7 | Input validation and edge cases |
| TC-25 | 5 | loadExternalManifest source defaults |
| TC-26 | 4 | Integration pipeline |
| TC-27 | 2 | Performance benchmarks |

Total test count: 157 (111 existing + 46 new), all passing.

### 3. `src/claude/agents/discover-orchestrator.md`

- Updated Step D.2 description: changed from "clean-slate per source phase" (delete-by-name) to "track phases executed" (build phasesExecuted array)
- Updated Step D.5: replaced manual entry creation with `reconcileSkillsBySource()` call
- Updated Step D.6: made cache rebuild conditional on `result.changed === true`
- Updated re-run section reference to describe reconciliation instead of clean-slate pattern

### 4. `src/claude/agents/discover/skills-researcher.md`

- Updated Step 5.5: replaced manual manifest merge with `reconcileSkillsBySource()` call using `source: "skills.sh"`
- Added code example showing proper usage pattern

## Design Decisions

1. **Pure function design**: `reconcileSkillsBySource()` does not perform disk I/O. Callers load the manifest, call reconciliation, then write if changed. This follows the existing pattern of `removeSkillFromManifest()`.

2. **Incoming bindings only for new entries**: When a matching entry exists, the incoming skill's bindings are ignored in favor of the existing (user-owned) bindings. This protects user customizations across re-runs.

3. **No content-aware diff for updates**: The function always marks matched entries as "updated" even if the content is identical. This keeps the implementation simple (Article V) and the `updated_at` timestamp serves as a last-reconciled marker. The `changed` boolean correctly reflects whether any actual modifications occurred.

4. **sourcePhase on entries**: Each manifest entry carries a `sourcePhase` field (e.g., "D1", "D2", "D6") that records which source phase produced it. This decouples common.cjs from discover's naming conventions -- the phase mapping lives with the caller, not in the library.

## Traceability

| FR | Status | Implementation Location |
|----|--------|------------------------|
| FR-001 | Complete | `loadExternalManifest()` source defaults, TC-25 |
| FR-002 | Complete | `reconcileSkillsBySource()`, TC-19 through TC-24 |
| FR-003 | Complete | Return shape, TC-23 |
| FR-004 | Complete | Field ownership rules, TC-20 |
| FR-005 | Complete | Conditional rebuild in agent markdown |
| FR-006 | Complete | discover-orchestrator.md Step D.5 |
| FR-007 | Complete | skills-researcher.md Step 5.5 |
| FR-008 | Complete | Schema fields in reconciliation, TC-19, TC-25 |
