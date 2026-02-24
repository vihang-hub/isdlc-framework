# Implementation Notes - REQ-0023: Three-Verb Backlog Model

## Summary

Implemented the three-verb backlog model (add/analyze/build) to replace the Phase A/B naming convention. This refactoring unifies backlog management around three natural verbs and redesigns the command surface, intent detection, and hook enforcement.

## Implementation Decisions

### 1. Utility Module Architecture (three-verb-utils.cjs)

**Decision**: Created a single utility module (`src/claude/hooks/lib/three-verb-utils.cjs`) containing all 8 public functions plus internal helpers.

**Rationale**: Centralizing the logic in one testable CJS module follows the existing pattern established by `common.cjs` and `provider-utils.cjs`. This enables the hooks and markdown agents to share the same validation and transformation logic without duplication.

**Key design choices**:
- **Read-time legacy migration** in `readMetaJson()`: When a meta.json file has the old `phase_a_completed` field, the function transparently converts it to the new `analysis_status` + `phases_completed` schema. This provides backward compatibility without requiring a migration script.
- **Write-time derivation** in `writeMetaJson()`: The `analysis_status` field is always derived from `phases_completed` at write time, ensuring consistency. The field is never stale.
- **MARKER_REGEX** is a compiled regex constant for performance (NFR-004: parseBacklogLine must complete in under 5ms).

### 2. BACKLOG.md Marker System

**Decision**: Implemented four markers: `[ ]` (raw), `[~]` (partial), `[A]` (analyzed), `[x]` (completed).

**Derivation logic in `deriveBacklogMarker()`**:
- Raw: no phases completed
- Partial: some but not all analysis phases completed
- Analyzed: all analysis phases (00-04) completed
- Completed: explicitly marked complete

### 3. Item Resolution Priority Chain (ADR-0015)

**Decision**: Implemented a 5-level priority resolution in `resolveItem()`:
1. Exact slug match (highest confidence)
2. Partial slug match (prefix matching)
3. Item number match (BACKLOG.md line number like "3.2")
4. External reference match (#N for GitHub, PROJECT-N for Jira)
5. Fuzzy title match (fallback)

**Rationale**: This order reflects decreasing specificity and increasing ambiguity, matching the design specification in ADR-0015.

### 4. Hook Enforcement Updates

**Decision**: Added `'add'` to EXEMPT_ACTIONS in both `skill-delegation-enforcer.cjs` and `delegation-gate.cjs`.

**Rationale**: The `add` command is inline (no workflow needed), similar to the existing `analyze` exemption. The `build` command requires delegation (creates workflows), so it is NOT exempt.

### 5. Intent Detection Table Redesign

**Decision**: Replaced the single "Feature" row in CLAUDE.md/CLAUDE.md.template intent detection table with three rows (Add, Analyze, Build).

**Signal words**:
- **Add**: add to backlog, track this, log this, remember this, save this idea, note this down
- **Analyze**: analyze, think through, plan this, review requirements, assess impact, design this, prepare
- **Build**: build, implement, create, code, develop, ship, make this, refactor, redesign

**Disambiguation rule**: If intent could match both Add and Analyze, resolve to Analyze (analysis implicitly adds if item does not exist). If intent could match both Analyze and Build, resolve to Build (build encompasses the full workflow).

### 6. Backlog Picker Removal

**Decision**: Removed the entire `# BACKLOG PICKER` section from `00-sdlc-orchestrator.md` (approximately 60 lines).

**Rationale**: The picker concept is replaced by the three-verb command surface. The `build` command now resolves items using `resolveItem()` from three-verb-utils rather than a separate picker UI. The SCENARIO 3 menu was updated from 6 to 8 options to include Add, Analyze, and Build.

### 7. Test File Updates

**Decision**: Rewrote `test-backlog-picker-content.test.cjs` from 14 tests verifying the old BACKLOG PICKER section to 28 tests verifying the new three-verb architecture.

**New test coverage**:
- Architecture change verification (BACKLOG PICKER removed, three-verb commands present)
- Add/Analyze/Build command surface in isdlc.md
- Workflow table consistency
- Cross-reference consistency between orchestrator and isdlc.md

## Files Modified

| File | Change Type | Description |
|------|-------------|-------------|
| `src/claude/hooks/lib/three-verb-utils.cjs` | CREATE | Core utility module with 8 public functions |
| `src/claude/hooks/tests/test-three-verb-utils.test.cjs` | CREATE | 126 unit tests for the utility module |
| `src/claude/hooks/skill-delegation-enforcer.cjs` | MODIFY | Added 'add' to EXEMPT_ACTIONS |
| `src/claude/hooks/delegation-gate.cjs` | MODIFY | Added 'add' to EXEMPT_ACTIONS |
| `src/claude/hooks/tests/test-skill-delegation-enforcer.test.cjs` | MODIFY | Added 3 tests for add/build enforcement |
| `src/claude/hooks/tests/test-delegation-gate.test.cjs` | MODIFY | Added 3 tests for add/build gate behavior |
| `src/claude/hooks/tests/test-backlog-picker-content.test.cjs` | MODIFY | Rewritten: 14 old tests -> 28 new tests |
| `src/claude/hooks/tests/hook-test-utils.cjs` | MODIFY | Added three-verb-utils.cjs to libFiles |
| `CLAUDE.md` | MODIFY | Intent detection table + disambiguation |
| `src/claude/CLAUDE.md.template` | MODIFY | Intent detection table + Phase A removal |
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | SCENARIO 3 menu, removed BACKLOG PICKER, added commands |
| `src/claude/commands/isdlc.md` | MODIFY | add/analyze/build actions, shared utilities, workflow table |

## Test Results

### New Tests (three-verb-utils.cjs)
- **126 tests** across 19 describe blocks
- All PASS on first run

### Updated Tests
- **Skill Delegation Enforcer**: 26 tests, all PASS (3 new)
- **Delegation Gate**: 35 tests, all PASS (3 new)
- **Backlog Content Verification**: 28 tests, all PASS (rewritten from 14)

### Full Suite Results
- **CJS hooks**: 1944 of 1945 pass (1 pre-existing failure: supervised review info logging in gate-blocker-extended)
- **ESM lib**: 630 of 632 pass (2 pre-existing failures: README agent count, agent file count)
- **Zero regressions** introduced by REQ-0023

## Pre-Existing Failures (Not Related to REQ-0023)

| Test | File | Reason |
|------|------|--------|
| `logs info when supervised_review is in reviewing status` | test-gate-blocker-extended.test.cjs | Gate-blocker does not emit supervised review info on stderr as expected |
| `TC-E09: README.md contains updated agent count` | prompt-format.test.js | README says 40 agents but count has grown |
| `TC-13-01: Exactly 48 agent markdown files exist` | prompt-format.test.js | 60 agent files exist, test expects 48 |

All three failures are reproducible on the main branch without our changes.

## Traceability

| Requirement | Implementation |
|------------|----------------|
| AC-001 (Add command) | `add` action in isdlc.md, intent detection in CLAUDE.md |
| AC-002 (Analyze command) | `analyze` action in isdlc.md, intent detection in CLAUDE.md |
| AC-003 (Build command) | `build` action in isdlc.md, intent detection in CLAUDE.md |
| AC-004 (Meta.json v2) | `readMetaJson()`, `writeMetaJson()` with legacy migration |
| AC-005 (Backlog markers) | `deriveBacklogMarker()`, `updateBacklogMarker()`, `parseBacklogLine()` |
| AC-006 (Item resolution) | `resolveItem()` with 5-level priority chain |
| AC-007 (Slug generation) | `generateSlug()` with collision detection |
| AC-008 (Hook enforcement) | EXEMPT_ACTIONS in skill-delegation-enforcer + delegation-gate |
