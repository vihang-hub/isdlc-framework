# Impact Analysis: REQ-0001 Discover Enhancements

**Phase**: 02 - Impact Analysis
**Analyzed**: 2026-02-07
**Analyst**: Impact Analysis Orchestrator

---

## 1. Blast Radius Summary

| Enhancement | Files Modified | Files Created | Lines Changed (est.) | Risk Level |
|-------------|---------------|---------------|---------------------|------------|
| DE-004 | 5 | 0 | ~50 deletions | LOW |
| DE-001 | 3 | 2 | ~200 additions | MEDIUM |
| DE-005 | 2 | 0 | ~150 additions | LOW |
| DE-002 | 4 | 0 | ~300 additions | MEDIUM |
| DE-003 | 2 | 0 | ~100 modifications | MEDIUM |
| **TOTAL** | **9 unique** | **2** | **~800 net** | **MEDIUM** |

Note: discover-orchestrator.md is counted once though touched by all 5.

---

## 2. Per-Enhancement Impact

### DE-004: Remove --shallow

**Risk**: LOW — flag existed for 1 day, no external users.

| File | Change Type | Specific Section | Lines Affected |
|------|------------|-----------------|----------------|
| `src/claude/commands/discover.md` | DELETE | Options table row, 2 examples, "What It Does" note, Output section notes | ~15 lines |
| `src/claude/agents/discover-orchestrator.md` | DELETE | Sub-agents table note, EXISTING PROJECT FLOW conditional logic | ~10 lines |
| `src/claude/agents/discover/feature-mapper.md` | DELETE | "When Invoked" shallow JSON block, Step intro shallow mention | ~15 lines |
| `src/claude/agents/discover/characterization-test-generator.md` | DELETE | Any --shallow conditional | ~5 lines |
| `docs/requirements/reverse-engineered/index.md` | DELETE | "(unless --shallow)" notes | ~5 lines |

**Cross-File Dependencies**: None. Pure deletion — no downstream behavior changes.

### DE-001: Extend Behavior Extraction to Markdown

**Risk**: MEDIUM — new analysis pipeline, but additive (no existing behavior changed).

| File | Change Type | Specific Section | Lines Affected |
|------|------------|-----------------|----------------|
| `src/claude/agents/discover/feature-mapper.md` | ADD | New Step after existing Step 8 — "Analyze Markdown Files" | ~80 lines |
| `src/claude/agents/discover-orchestrator.md` | ADD | D6 invocation now includes "and markdown analysis" in prompt | ~5 lines |
| `docs/requirements/reverse-engineered/index.md` | ADD | Domain 8 row in organization table | ~5 lines |
| `docs/architecture/agent-catalog.md` | CREATE | New output artifact (catalog format) | ~100 lines template |
| `docs/requirements/reverse-engineered/domain-08-agent-orchestration.md` | CREATE | New domain AC file | ~variable |

**Cross-File Dependencies**:
- D6 → D0: Orchestrator must pass markdown file paths to feature mapper
- D6 → index.md: New domain must be registered in index
- D6 → traceability CSV: New AC must use consistent ID format

### DE-005: Presentation & UX

**Risk**: LOW — cosmetic changes to agent prompts, no logic changes.

| File | Change Type | Specific Section | Lines Affected |
|------|------------|-----------------|----------------|
| `src/claude/agents/discover-orchestrator.md` | ADD | Progress indicator format, structured summary template | ~80 lines |
| `src/claude/agents/discover/feature-mapper.md` | ADD | AC quality rules section | ~30 lines |

**Cross-File Dependencies**: None. Presentation changes are self-contained.

### DE-002: Post-Discovery Walkthrough

**Risk**: MEDIUM — new interactive phase, hook modifications.

| File | Change Type | Specific Section | Lines Affected |
|------|------------|-----------------|----------------|
| `src/claude/agents/discover-orchestrator.md` | ADD | New "WALKTHROUGH PHASE" after analysis/extraction phases | ~150 lines |
| `src/claude/commands/discover.md` | ADD | Document walkthrough in "What It Does" | ~10 lines |
| `src/claude/hooks/iteration-corridor.js` | MODIFY | Read `iteration_config` from state.json, fallback to config defaults | ~20 lines |
| `src/claude/hooks/test-watcher.js` | MODIFY | Read `iteration_config` from state.json, fallback to config defaults | ~20 lines |

**Cross-File Dependencies**:
- D0 → hooks: Walkthrough Step 3.5 writes `iteration_config` to state.json; hooks read it
- D0 → settings.json: Step 2.5 reads/modifies `.claude/settings.json` permissions
- D0 → constitution.md: Step 1 may modify constitution in-place

**Hook Modification Detail**:
Both `iteration-corridor.js` and `test-watcher.js` currently read `max_iterations` and `circuit_breaker_threshold` from `iteration-requirements.json` only.

DE-002 requires them to:
1. First check `state.json` → `iteration_config` (user-configured values)
2. Fall back to `iteration-requirements.json` values (phase-specific defaults)
3. Fall back to hardcoded defaults (max: 10, circuit_breaker: 3)

**Priority chain**: state.json > iteration-requirements.json > hardcoded default

The modification is ~20 lines per hook (add a function to read iteration_config, call it before using defaults). Both hooks already call `readState()` from common.js, so the infrastructure exists.

### DE-003: Clean Handover

**Risk**: MEDIUM — upgrades existing mechanism, partial implementation exists.

| File | Change Type | Specific Section | Lines Affected |
|------|------------|-----------------|----------------|
| `src/claude/agents/discover-orchestrator.md` | ADD | Write `discovery_context` envelope to state.json on completion | ~30 lines |
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | Upgrade DISCOVERY CONTEXT blocks from file-scan to envelope read | ~60 lines |

**Existing Partial Implementation**:
The SDLC orchestrator already has DISCOVERY CONTEXT blocks at lines 1106-1128, 1158-1185, 1195-1220. These currently:
- Check `state.json → project.discovery_completed` (boolean)
- Read `docs/project-discovery-report.md` and `docs/isdlc/constitution.md`
- Inject file paths and tech stack into agent prompts

DE-003 upgrades this to:
- Check `state.json → discovery_context` (structured envelope)
- Read structured data from envelope instead of re-scanning files
- Add 24-hour staleness check on `discovery_context.completed_at`
- Maintain existing fail-open behavior when envelope is missing

**The upgrade is backward-compatible**: If `discovery_context` is missing, the existing `project.discovery_completed` check still works as fallback.

---

## 3. State Schema Impact

### New Fields (additive only)

```json
{
  "iteration_config": {
    "implementation_max": 5,
    "testing_max": 5,
    "circuit_breaker_threshold": 3,
    "escalation_behavior": "pause",
    "configured_at": "ISO-8601"
  },
  "discovery_context": {
    "completed_at": "ISO-8601",
    "version": "1.0",
    "tech_stack": { ... },
    "coverage_summary": { ... },
    "architecture_summary": "string",
    "constitution_path": "string",
    "discovery_report_path": "string",
    "re_artifacts": { ... },
    "permissions_reviewed": false,
    "walkthrough_completed": false,
    "user_next_action": "string"
  }
}
```

**Backward Compatibility**: Both fields are NEW top-level keys. No existing fields are modified or removed. All consumers check for existence before reading (fail-open). Article XIV compliance: PASS.

---

## 4. Cross-Enhancement Dependencies

```
DE-004 ─────────> DE-001 ─────────> DE-005 ─────────> DE-002 ─────────> DE-003
(remove shallow)  (MD extraction)   (presentation)    (walkthrough)     (handover)
                       |                                    |
                       └─── catalog feeds into ────────────┘
                                                           |
                                                           └── writes iteration_config
                                                                     |
                                                           hooks read iteration_config
```

**Critical path**: DE-004 must be done first (removes code that other enhancements would otherwise need to work around).

**Parallel opportunity**: After DE-004, DE-001 and DE-005 can be developed in parallel since DE-005's presentation changes don't depend on DE-001's catalog content -- they operate on different sections of the orchestrator.

---

## 5. Risk Register

| # | Risk | Impact | Likelihood | Mitigation |
|---|------|--------|------------|------------|
| R1 | discover-orchestrator.md grows too large (1283 + ~300 = 1583 lines) | Medium | Medium | Keep walkthrough steps well-sectioned; consider future extraction to sub-agent |
| R2 | Hook CJS changes violate Article XIII | High | Low | Test hooks in isolated temp dir; no ESM imports |
| R3 | State schema migration needed for existing users | Medium | Low | Both new fields are optional with graceful degradation |
| R4 | Walkthrough UX too verbose (7 steps) | Medium | Medium | 5 of 7 steps are opt-in; keep each concise |
| R5 | Parallel phase opportunity missed | Low | Low | Flag DE-001/DE-005 as parallel-eligible in implementation |

---

## 6. Test Impact

| Test File | Changes Needed | Enhancement |
|-----------|---------------|-------------|
| `src/claude/hooks/tests/test-iteration-corridor.test.cjs` | Add tests for iteration_config read from state.json | DE-002 |
| `src/claude/hooks/tests/test-test-watcher.test.cjs` | Add tests for iteration_config read from state.json | DE-002 |
| New integration test | Verify discovery_context written to state.json | DE-003 |
| New integration test | Verify staleness warning at 24+ hours | DE-003 |
| Existing test suite | Verify no regressions (>= 555 tests) | All |

**Estimated new tests**: 8-12 additional test cases
**Total after**: ~567 tests (above 555 baseline)
