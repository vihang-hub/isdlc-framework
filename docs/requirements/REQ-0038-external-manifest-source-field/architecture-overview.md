# Architecture Overview: REQ-0038 External Manifest Source Field

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: Sections 1-5 complete

---

## 1. Architecture Options

### Decision 1: Reconciliation Strategy

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| **A: Delete-and-Recreate** | Remove all entries for a source, then re-add incoming entries | Simple logic, easy to understand | Destroys user binding customizations, no diff information | Current approach in discover orchestrator | Eliminated |
| **B: Merge Reconciliation** | Match incoming entries against existing by source+name, update source-owned fields, preserve user-owned fields | Preserves bindings, provides detailed change report, phase-gated removal | Slightly more complex logic | Follows update-in-place pattern used by `writeState()` | **Selected** |

### Decision 2: Function Location

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| **A: common.cjs exported function** | Single `reconcileSkillsBySource()` in common.cjs | Central location, shared by all consumers, testable via existing test infrastructure | Adds to already large common.cjs (937+ lines) | Follows `removeSkillFromManifest()`, `writeExternalManifest()` pattern | **Selected** |
| **B: Separate module** | New `manifest-reconciler.cjs` in hooks/lib/ | Separation of concerns, smaller files | New file to maintain, breaks from existing single-module pattern | No precedent in codebase | Eliminated |

### Decision 3: Backward Compatibility Approach

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| **A: Read-time defaults** | Treat missing `source` as `"user"` at read time, no migration | Zero migration cost, existing manifests work immediately | Missing fields persist until an operation touches the entry | Follows defensive coding pattern in session cache builder (line 4051) | **Selected** |
| **B: One-time migration** | Run a migration on first load to add `source: "user"` to all entries | Clean data, no runtime defaults needed | Requires migration code, risk of data loss on failure | No precedent -- framework has no migration system | Eliminated |

---

## 2. Selected Architecture

### ADR-001: Merge Reconciliation Over Delete-and-Recreate

- **Status**: Accepted
- **Context**: Discover and skills-researcher need to update their skills in the manifest on re-runs without destroying user customizations (bindings). The current name-based deletion approach cannot distinguish source ownership.
- **Decision**: Implement a `reconcileSkillsBySource()` function that performs field-level merge: update source-owned fields (file, description, updated_at), preserve user-owned fields (bindings, added_at).
- **Rationale**: User binding customizations represent intentional configuration that should survive automated updates. The merge approach also enables a detailed return value (added/removed/updated lists) that feeds the discover orchestrator's diff summary.
- **Consequences**: Reconciliation is more complex than delete-and-recreate but provides stronger data integrity guarantees. All callers must pass `phasesExecuted` to enable phase-gated removal.

### ADR-002: Single Reconciliation Function in common.cjs

- **Status**: Accepted
- **Context**: Both discover orchestrator and skills-researcher need identical reconciliation logic. The question is where to locate it.
- **Decision**: Export `reconcileSkillsBySource()` from `common.cjs` alongside existing manifest utilities.
- **Rationale**: `common.cjs` already exports `loadExternalManifest()`, `writeExternalManifest()`, and `removeSkillFromManifest()`. Adding the reconciliation function maintains the single-module pattern for manifest operations. The function is pure (operates on manifest object, does not write to disk) following the `removeSkillFromManifest()` pattern.
- **Consequences**: `common.cjs` grows by approximately 60-80 lines. The function is testable via the existing test infrastructure in `external-skill-management.test.cjs`.

### ADR-003: Read-Time Defaults for Backward Compatibility

- **Status**: Accepted
- **Context**: Existing manifests in user projects lack the `source`, `added_at`, and `updated_at` fields. These manifests must continue to work.
- **Decision**: Apply defaults at read time: missing `source` defaults to `"user"`, missing `updated_at` defaults to `null`. No migration step.
- **Rationale**: The framework has no migration system. Read-time defaults are simple, risk-free, and the session cache builder already uses this pattern (`skill.source || 'unknown'`). Entries are gradually enriched as operations touch them.
- **Consequences**: Legacy entries may lack `source` field in the JSON file until explicitly modified. This is acceptable -- the `"user"` default ensures they are never overwritten by automated processes.

---

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|------------|---------|-----------|------------------------|
| Node.js CJS | Existing | Hooks use CJS convention | ESM -- not applicable for hooks |
| node:test | Existing | Built-in test runner, no new deps | None -- already established |
| JSON manifest format | Existing | Schema extends current format with new fields | None -- additive change |

**New Dependencies**: None

---

## 4. Integration Architecture

### Integration Points

| ID | Source | Target | Interface | Data Format | Error Handling |
|----|--------|--------|-----------|-------------|----------------|
| INT-001 | Discover orchestrator (Step 2a) | `reconcileSkillsBySource()` | Function call (via agent instruction) | `{ manifest, source: "discover", incomingSkills[], phasesExecuted[] }` | Defensive: null phasesExecuted = preserve all |
| INT-002 | Skills-researcher (Step D.4) | `reconcileSkillsBySource()` | Function call (via agent instruction) | `{ manifest, source: "skills.sh", incomingSkills[], phasesExecuted[] }` | Same defensive default |
| INT-003 | `isdlc.md` skill add | `writeExternalManifest()` | Function call | Manifest with `source: "user"` on new entry | Existing error handling (write + verify) |
| INT-004 | `reconcileSkillsBySource()` return | Cache rebuild decision | `changed` boolean | `true` / `false` | On rebuild failure: log warning, continue |
| INT-005 | Session cache builder | `loadExternalManifest()` | Function call | Reads `skill.source` for display | Existing fallback: `source || 'unknown'` |

### Data Flow

```
Discover Orchestrator / Skills-Researcher
    |
    | 1. Load existing manifest: loadExternalManifest()
    | 2. Call reconcileSkillsBySource(manifest, source, incoming, phasesExecuted)
    |     |
    |     | Match incoming vs existing by source + name
    |     | Update source-owned fields, preserve user-owned fields
    |     | Remove entries for phases that ran but produced no matching skill
    |     | Preserve entries for phases that didn't run
    |     |
    |     v
    | 3. Receive { manifest, changed, added, removed, updated }
    | 4. If changed: writeExternalManifest(manifest) then rebuildSkillCache()
    | 5. Display diff summary using added/removed/updated lists
    v
Done
```

### Synchronization Model

No concurrency concerns. Discover orchestrator and skills-researcher run sequentially within the discover workflow (skills-researcher runs as a sub-agent after distillation). The `/isdlc skill add` command runs in a separate user session -- no concurrent manifest access.

---

## 5. Summary

### Key Decisions

| Decision | Choice | Risk |
|----------|--------|------|
| Reconciliation strategy | Merge with field ownership | Low |
| Function location | common.cjs | Low |
| Backward compatibility | Read-time defaults | Low |

### Trade-offs

- **Complexity vs. Safety**: Merge reconciliation is more complex than delete-and-recreate, but it's the only approach that preserves user binding customizations. The complexity is contained in a single, well-tested function.
- **Growth of common.cjs vs. New module**: Adding to an already large module, but maintains the single-module pattern for manifest operations. If common.cjs grows further in the future, a manifest-specific module extraction is a reasonable refactor.
