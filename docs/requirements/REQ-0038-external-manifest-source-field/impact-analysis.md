# Impact Analysis: REQ-0038 External Manifest Source Field

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: Sections 1-5 complete

---

## 1. Blast Radius

### Tier 1: Direct Modifications

| File | Module | Change Type | Requirement Traces |
|------|--------|-------------|-------------------|
| `src/claude/hooks/lib/common.cjs` | Hook utilities | Modify | FR-001, FR-002, FR-003, FR-004, FR-008 |
| `src/claude/agents/discover-orchestrator.md` | Agent definition | Modify | FR-006 |
| `src/claude/agents/discover/skills-researcher.md` | Agent definition | Modify | FR-007 |
| `src/claude/commands/isdlc.md` | Command handler | Modify (minor) | FR-001 (verify existing source: "user") |
| `src/claude/hooks/tests/external-skill-management.test.cjs` | Tests | Modify | FR-001 through FR-008 |

### Tier 2: Transitive Impact

| File | Module | Impact Description | Change Needed |
|------|--------|-------------------|---------------|
| `src/claude/hooks/tests/test-session-cache-builder.test.cjs` | Tests | Session cache builder reads `skill.source` -- tests may need updated fixtures | Update test fixtures to include `source` field |
| `src/claude/hooks/tests/skill-injection.test.cjs` | Tests | Skill injection tests use manifest fixtures | Verify fixtures still valid (likely no change -- `source` field is additive) |

### Tier 3: Side Effects

| Area | Potential Impact | Risk Level |
|------|-----------------|------------|
| Session cache output | Cache will now always show accurate `Source:` labels instead of `unknown` for new entries | Low -- improvement, not breakage |
| Existing manifests in user projects | Legacy entries without `source` will be treated as `"user"` -- no behavioral change | Low -- backward compatible by design |
| CI/CD test suite | New tests added, no existing tests should break | Low |

### Blast Radius Summary

| Metric | Count |
|--------|-------|
| Direct modifications | 5 |
| New files | 0 |
| Restructured files | 0 |
| Transitive modifications | 2 |
| **Total affected** | **7** |

---

## 2. Entry Points

**Recommended starting point**: `src/claude/hooks/lib/common.cjs`

**Rationale**: The reconciliation function is the core primitive. All consumers (discover orchestrator, skills-researcher) depend on it. Writing and testing this function first establishes the foundation.

**Secondary entry point**: `src/claude/hooks/tests/external-skill-management.test.cjs`

**Rationale**: TDD approach -- write reconciliation test cases first, then implement the function. The test file already has the infrastructure (fixture factories, module loading helpers) in place.

---

## 3. Implementation Order

| Order | FRs | Description | Risk | Parallel | Depends On |
|-------|-----|-------------|------|----------|------------|
| 1 | FR-008, FR-004 | Define schema fields and ownership rules in code | Low | No | -- |
| 2 | FR-002, FR-003 | Implement `reconcileSkillsBySource()` with detailed return value | Medium | No | Step 1 |
| 3 | FR-001 | Ensure all entry creation paths set `source` field | Low | Yes (with 4) | Step 2 |
| 4 | FR-005 | Add conditional cache rebuild logic | Low | Yes (with 3) | Step 2 |
| 5 | FR-006 | Update discover orchestrator to use reconciliation | Medium | No | Steps 2, 3 |
| 6 | FR-007 | Update skills-researcher to use reconciliation | Low | Yes (with 5 if independent) | Steps 2, 3 |
| 7 | -- | Write/update tests for all FRs | Low | No | Steps 1-6 |

---

## 4. Risk Zones

| ID | Risk | Area | Likelihood | Impact | Mitigation |
|----|------|------|-----------|--------|------------|
| RZ-001 | Reconciliation logic incorrectly matches entries | `common.cjs` | Low | High | Match on `source + name` pair, not name alone. Comprehensive test coverage for edge cases. |
| RZ-002 | Discover orchestrator doesn't pass phasesExecuted correctly | `discover-orchestrator.md` | Medium | Medium | Defensive default: empty phasesExecuted = preserve everything. Add validation in reconciliation function. |
| RZ-003 | Binding preservation fails for complex binding objects | `common.cjs` | Low | High | Treat `bindings` as opaque -- shallow copy from existing entry, no field-level inspection. |
| RZ-004 | Legacy manifest entries cause unexpected behavior | `common.cjs` | Low | Medium | Explicit default: missing `source` = `"user"`, missing `updated_at` = null. Test with legacy fixtures. |
| RZ-005 | Cache rebuild triggered unnecessarily | Cache rebuild path | Low | Low | `changed` boolean in return value gates rebuild. Test that no-change reconciliation returns `changed: false`. |

### Test Coverage Assessment

- **Well-covered**: `writeExternalManifest`, `loadExternalManifest`, `removeSkillFromManifest` -- existing tests in `external-skill-management.test.cjs` (REQ-0022)
- **Needs new coverage**: `reconcileSkillsBySource()` -- all reconciliation paths (add, remove, update, preserve, phase-gated removal, backward compat)
- **Needs fixture updates**: Session cache builder tests -- add `source` field to test manifest fixtures

---

## 5. Summary

### Executive Summary

Medium-scope change affecting 5 files directly and 2 transitively. The core work is a new `reconcileSkillsBySource()` function in `common.cjs` that replaces the current delete-and-recreate pattern with a smart merge. The function is source-aware (only touches entries matching its source), binding-preserving (user customizations survive), and phase-gated (only removes skills whose source phase actually ran). No new dependencies. Backward compatible with existing manifests.

### Decision Log

| Decision | Rationale |
|----------|-----------|
| Source field as string enum (not boolean) | Three distinct sources with different ownership semantics |
| Reconciliation over delete-and-recreate | Preserves user binding customizations on discover-sourced skills |
| Phase-gated removal | Prevents loss of skills when their source phase didn't run in an incremental discovery |
| Conditional cache rebuild | Avoids unnecessary work when reconciliation produces no changes |
| `added_at` + `updated_at` instead of single timestamp | Preserves creation history while tracking last reconciliation |
| `bindings` as user-owned, opaque object | Future-proofs against binding schema changes |

### Go/No-Go

**Go** -- Low overall risk. Well-understood codebase area. Existing test infrastructure supports the new tests. No architectural concerns. Change is additive and backward compatible.
