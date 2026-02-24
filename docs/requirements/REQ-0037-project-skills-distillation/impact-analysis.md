# Impact Analysis: Project Skills Distillation

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: 95%
**Source**: GitHub #88
**Slug**: REQ-0037-project-skills-distillation

---

## Blast Radius

### Tier 1: Direct Modifications

| File | Change Type | Description |
|------|-------------|-------------|
| `src/claude/agents/discover-orchestrator.md` | Modify | Add inline distillation step after each source phase (D1, D2, D6) in existing project flow, after D4 in new project flow, and in incremental discovery flow |
| `src/claude/hooks/lib/common.cjs` | Modify | Remove Section 9 (DISCOVERY_CONTEXT) from `rebuildSessionCache()` (~lines 4114-4131) |

### Tier 2: Transitive Impact (Files Affected by Changes)

| File | Impact | Description |
|------|--------|-------------|
| `.claude/skills/external/project-architecture.md` | New (runtime) | Written by distillation step at discovery time |
| `.claude/skills/external/project-conventions.md` | New (runtime) | Written by distillation step at discovery time |
| `.claude/skills/external/project-domain.md` | New (runtime) | Written by distillation step at discovery time |
| `.claude/skills/external/project-test-landscape.md` | New (runtime) | Written by distillation step at discovery time |
| `docs/isdlc/external-skills-manifest.json` | Modify (runtime) | New entries with `source: "discover"` added at discovery time |
| `.isdlc/session-cache.md` | Modified (runtime) | Content changes: loses Section 9 raw reports, gains Section 7 project skill content |
| `src/claude/hooks/tests/test-session-cache-builder.test.cjs` | Modify | Update tests to reflect Section 9 removal |

### Tier 3: Side Effects

| Area | Effect | Description |
|------|--------|-------------|
| All agent sessions | Behavioral | Agents now receive distilled project knowledge in every session via SessionStart cache. Context content changes from raw reports to structured skills. |
| Context budget | Positive | Net reduction: ~22,700 chars (raw reports removed) replaced by up to ~20,000 chars (four skills at max 5,000 each). Likely a larger reduction in practice since skills are concise distillations. |
| Incremental discovery flow | Behavioral | Now includes distillation steps for refreshed phases. Previously skipped skills entirely. |
| Session cache hash | Changed | `rebuildSessionCache()` computes a hash from source mtimes. Removing Section 9 sources and adding skill file sources changes the hash. |

---

## Entry Points

### Recommended Starting Point
**GH-89 first** (dependency): Add `source` field to external-skills-manifest schema. This is a prerequisite for idempotent-by-source behavior in the distillation step.

### Implementation Order

1. **GH-89**: Add `source` field to manifest schema (dependency -- must land first)
2. **Section 9 removal**: Remove DISCOVERY_CONTEXT from `rebuildSessionCache()` in `common.cjs` + update tests
3. **Distillation step (existing project flow)**: Add inline logic to `discover-orchestrator.md` for the four project skills after source phases in the existing project full discovery flow
4. **Distillation step (incremental flow)**: Extend incremental discovery flow to include distillation for refreshed phases
5. **Distillation step (new project flow)**: Add distillation after D4 in the new project flow
6. **Integration testing**: End-to-end validation of discover -> distill -> cache rebuild -> session injection

### Rationale
Start with the Section 9 removal since it's a clean deletion with clear test updates. Then add the distillation step to the main (existing project) flow first, since that's the most commonly exercised path. Incremental and new project flows follow as extensions of the same logic.

---

## Risk Zones

### Risk 1: Distillation Quality Inconsistency
- **Area**: Orchestrator inline LLM summarization
- **Likelihood**: Medium
- **Impact**: Medium
- **Description**: LLM-based distillation may produce inconsistent or verbose output across different codebases. The 5,000 character limit is enforced by instruction, not programmatically.
- **Mitigation**: Provide highly specific structural templates in the orchestrator markdown for each skill. Include explicit section headings, bullet-point format expectations, and character budget guidance. The fixed skill set with fixed structure reduces variability.

### Risk 2: Manifest Format Dependency on GH-89
- **Area**: `external-skills-manifest.json` schema
- **Likelihood**: Medium
- **Impact**: High
- **Description**: The distillation step requires a `source` field on manifest entries to support idempotent-by-source behavior. If GH-89's schema diverges from expectations, the distillation logic may need adjustment.
- **Mitigation**: Document behavioral requirements (idempotent by source) rather than specific data structures. Implementation conforms to whatever schema GH-89 establishes.

### Risk 3: Session Cache Size Validation
- **Area**: `rebuildSessionCache()` in `common.cjs`
- **Likelihood**: Low
- **Impact**: Medium
- **Description**: `rebuildSessionCache()` has a 128,000 character validation limit (line 4138). Adding four project skills while removing Section 9 should be a net decrease, but for large projects the external skills section could grow.
- **Mitigation**: The 5,000 char limit per skill bounds the project skills contribution. The existing truncation at 5,000 chars in Section 7 (line 4058) provides a safety net. Net effect is a reduction in cache size.

### Risk 4: Test Breakage from Section 9 Removal
- **Area**: `test-session-cache-builder.test.cjs`
- **Likelihood**: High
- **Impact**: Low
- **Description**: Existing tests for `rebuildSessionCache()` likely assert the presence of Section 9 (DISCOVERY_CONTEXT). These will fail after removal.
- **Mitigation**: Straightforward test updates -- remove assertions for Section 9, verify it no longer appears in output. Low risk because the change is a deletion, not a behavioral modification.

---

## Test Coverage Assessment

### Existing Test Coverage
- `test-session-cache-builder.test.cjs`: 44 tests covering `rebuildSessionCache()` including section assembly, external skills, truncation, and error handling
- `test-inject-session-cache.test.cjs`: 7 tests covering the SessionStart hook

### Test Changes Required
| Test File | Change | Reason |
|-----------|--------|--------|
| `test-session-cache-builder.test.cjs` | Modify | Remove/update assertions for Section 9 (DISCOVERY_CONTEXT). Verify Section 9 is no longer present in output. |
| (no new test files) | N/A | Distillation logic lives in orchestrator markdown (agent instructions), not in testable code. The skill file output, manifest registration, and cache rebuild are validated by existing infrastructure. |

### Untestable Areas
- LLM summarization quality (the distillation itself is performed by the LLM at orchestrator runtime, not by programmatic code)
- Distillation step execution within the orchestrator (markdown instructions, not executable code)

---

## File Count Summary

| Category | Count | Files |
|----------|-------|-------|
| Direct modifications | 2 | `discover-orchestrator.md`, `common.cjs` |
| New files (runtime) | 4 | Four project skill files in `.claude/skills/external/` |
| Test modifications | 1 | `test-session-cache-builder.test.cjs` |
| Config modifications (runtime) | 1 | `external-skills-manifest.json` |
| **Total affected** | **8** | |

---

## Summary

This is a **medium-scope change** with a narrow blast radius (2 source files modified, 1 test file updated) but broad positive impact (all agent sessions benefit from permanent project knowledge). The infrastructure for delivery (SessionStart cache, external skills manifest, session cache builder) is already in place. The primary work is:

1. Adding the distillation step as inline orchestrator instructions
2. Removing the redundant raw report injection (Section 9)

The net effect on context budget is positive (reduction of ~2,700+ characters), and the quality of injected content improves significantly (structured distillations vs. raw reports).

Key dependency: GH-89 must land first to provide the `source` field in the manifest schema.
