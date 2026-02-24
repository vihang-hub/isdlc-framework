# Non-Functional Requirements Matrix: REQ-0023

**Feature:** Three-Verb Backlog Model (add/analyze/build)
**Version:** 1.0.0

---

## NFR Summary

| ID | Category | Requirement | Validation Method | Priority |
|----|----------|-------------|-------------------|----------|
| NFR-001 | Compatibility | All existing tests pass; existing workflows unchanged | Test suite execution | Must Have |
| NFR-002 | Data Integrity | Add/analyze do not write to state.json | Code review + test assertion | Must Have |
| NFR-003 | Resilience | Analysis resumable at phase boundaries | Integration test: exit/resume | Must Have |
| NFR-004 | Performance | Add < 5s, analyze phase transition < 2s | Manual timing | Should Have |
| NFR-005 | Portability | Cross-platform (macOS, Linux, Windows) | CI matrix | Must Have |
| NFR-006 | Scalability | Monorepo path scoping | Monorepo test suite | Must Have |

---

## Detailed NFR Specifications

### NFR-001: Backward Compatibility

**Description**: All existing tests must pass without modification. New behavior is additive. Existing workflows (feature, fix, test-run, test-generate, upgrade) continue to work exactly as before.

**Validation**:
- Run `npm run test:all` -- zero regressions
- Run each workflow type once -- identical behavior to pre-change

**Constitutional Article**: IX (Quality Gate Integrity)

### NFR-002: Zero State Corruption

**Description**: The `add` and `analyze` verbs must not write to `.isdlc/state.json`. Only `build` initializes `active_workflow`. Add/analyze can run safely in parallel with an active build workflow.

**Validation**:
- Test: invoke `add` and verify state.json unchanged (checksum comparison)
- Test: invoke `analyze` and verify state.json unchanged
- Test: invoke `add` while a build workflow is active -- no conflict

**Constitutional Articles**: X (Fail-Safe Defaults), XIV (State Management Integrity)

### NFR-003: Resumable Analysis

**Description**: Analysis is resumable at any phase boundary. `meta.json.phases_completed[]` tracks completed phases. Re-invoking `analyze` continues from the next incomplete phase.

**Validation**:
- Test: complete Phase 00 + 01, exit, re-invoke analyze -- starts at Phase 02
- Test: complete all 5 phases -- status transitions to "analyzed"

**Constitutional Article**: V (Simplicity First)

### NFR-004: Performance

**Description**: `add` completes in under 5 seconds (filesystem writes only). `analyze` phase transition overhead under 2 seconds between phases.

**Validation**: Manual timing during integration testing

### NFR-005: Cross-Platform Compatibility

**Description**: All file operations use `path.join()`/`path.resolve()`. BACKLOG.md parsing handles both LF and CRLF.

**Validation**: CI matrix (macOS, Linux, Windows)

**Constitutional Article**: XII (Cross-Platform Compatibility)

### NFR-006: Monorepo Support

**Description**: In monorepo mode, all paths scoped to project per monorepo path routing table.

**Validation**: Monorepo-specific unit tests

---

## Constitutional Compliance Map

| Article | NFR | Requirement |
|---------|-----|-------------|
| I (Spec Primacy) | All FRs | Code implements specs exactly |
| IV (Explicit > Implicit) | NFR-002 | No hidden state writes |
| V (Simplicity) | NFR-003 | Simple resume model via phases_completed array |
| VII (Traceability) | All FRs | Each FR traces to user stories and ACs |
| VIII (Documentation Currency) | FR-004, FR-005, FR-006 | Docs updated with code |
| IX (Gate Integrity) | NFR-001 | All gates enforced on new verbs |
| X (Fail-Safe) | NFR-002 | Fail-open on missing meta.json |
| XII (Cross-Platform) | NFR-005 | Path operations use path module |
| XIV (State Integrity) | NFR-002 | No state corruption from add/analyze |
