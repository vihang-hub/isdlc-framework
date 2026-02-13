# Technical Debt Inventory: BUG-0011-subagent-phase-state-overwrite

**Date**: 2026-02-13
**Phase**: 08-code-review

---

## Technical Debt Resolved by BUG-0011

### TD-RESOLVED-007: Phase Orchestration Field Regression Vulnerability (was HIGH)

- **Location**: `src/claude/hooks/state-write-validator.cjs`
- **Description**: Subagents could overwrite `active_workflow.current_phase_index` and `phase_status` fields in state.json with stale values, regressing phase orchestration state. This caused `phase-sequence-guard` to block subsequent phase delegations with false "OUT-OF-ORDER PHASE DELEGATION" errors.
- **Resolution**: Added V8 rule `checkPhaseFieldProtection()` that compares incoming orchestration fields against disk state and blocks regressions. Complements V7 (BUG-0009) which handles version staleness but not semantic field regression.
- **Impact**: The Phase-Loop Controller's orchestration fields are now protected against overwrite by subagents that read state before the controller advances it.

---

## New Technical Debt Introduced by BUG-0011

### TD-BUG0011-001: checkPhaseFieldProtection() Cyclomatic Complexity (LOW)

- **Location**: `src/claude/hooks/state-write-validator.cjs`, checkPhaseFieldProtection()
- **Description**: The function has an estimated cyclomatic complexity of ~15 (above the typical threshold of 10). This is driven by the defensive fail-open pattern: 6 early-return guards, 3 catch blocks, 1 loop with 2 continue statements, and multiple type checks.
- **Impact**: LOW -- the function is linear (all branches are early returns or continues), readable, and thoroughly tested with 36 dedicated tests. The CC number is inflated by the fail-open defensive pattern which is a standard convention in the hook codebase (checkVersionLock has CC=13 with the same pattern).
- **Recommendation**: No refactoring needed. If the function grows further (e.g., additional orchestration field checks), consider splitting into `checkPhaseIndexRegression()` and `checkPhaseStatusRegression()` helpers.

### TD-BUG0011-002: Duplicate JSON Parsing in V7 and V8 (VERY LOW)

- **Location**: `src/claude/hooks/state-write-validator.cjs`, checkVersionLock() and checkPhaseFieldProtection()
- **Description**: Both V7 and V8 independently parse `toolInput.content` (JSON.parse) and read the disk state (`fs.readFileSync` + `JSON.parse`). When both rules run on the same Write event, the incoming content is parsed twice and the disk file is read twice.
- **Impact**: VERY LOW -- the overhead is ~0.2ms total for two parses of a <10KB JSON file. Node caches the file in the OS page cache after the first read.
- **Recommendation**: No action needed. Merging the parsing would increase coupling between V7 and V8, break the self-contained fail-open pattern, and make the code harder to reason about. The performance impact is negligible compared to the Node process startup time (~20ms).

---

## Pre-Existing Technical Debt (Carried Forward)

### TD-001: Pre-existing TC-E09 Test Failure (LOW)

- **Location**: `lib/deep-discovery-consistency.test.js:117`
- **Description**: Test expects README.md to reference "40 agents" but the actual agent count has changed.
- **Impact**: LOW -- single cosmetic test failure, 489/490 ESM tests pass.
- **Recommendation**: Update README agent count or test expectation in a future fix workflow.

### TD-002: Node 20 EOL Approaching (INFORMATIONAL)

- **Description**: Node 20 reaches end-of-life on April 30, 2026 (~2.5 months away).
- **Impact**: LOW -- proactive awareness.
- **Recommendation**: Schedule REQ for Node 22 minimum in March 2026.

### TD-004: Template Phase Key Mismatch (LOW)

- **Location**: `src/isdlc/templates/workflow-tasks-template.md`
- **Description**: Template uses `### 02-architecture` but the feature workflow has `02-impact-analysis` and `03-architecture` as separate phases.
- **Impact**: LOW -- template keys used for task descriptions, not phase key matching.

### TD-BUG0005-001: Redundant State Tracking Locations Not Eliminated (INFORMATIONAL)

- **Description**: `state.json` still has 3 redundant locations for phase information: `active_workflow.current_phase`, `active_workflow.phase_status`, and top-level `current_phase`/`phases{}`. Maintained for backward compatibility.

### TD-BUG0005-002: gate-blocker.cjs Else Branch Defensive No-Op (VERY LOW)

- **Location**: `src/claude/hooks/gate-blocker.cjs` line 591
- **Description**: The `else` branch read-priority fix (`state.active_workflow?.current_phase`) is a no-op because `state.active_workflow` is always falsy when the else branch executes.

### TD-BUG0006-OBS01: PHASE_AGENT_MAP vs PHASE->AGENT Table Discrepancy (LOW)

- **Location**: `src/claude/commands/isdlc.md`
- **Description**: Two agent lookup tables contain different agent names for the same phases. No hooks enforce this match.

### TD-BUG0008-001: Triplicated Delegation Guard Pattern (LOW)

- **Location**: `constitution-validator.cjs`, `iteration-corridor.cjs`, `gate-blocker.cjs`
- **Description**: The try/catch delegation guard pattern is copy-pasted identically in 3 hooks.

### TD-BUG0008-002: SETUP_COMMAND_KEYWORDS Quadruplicated (LOW, pre-existing)

- **Location**: `constitution-validator.cjs`, `iteration-corridor.cjs`, `gate-blocker.cjs`, `common.cjs`
- **Description**: The `SETUP_COMMAND_KEYWORDS` array is defined in 4 places.

### TD-BUG0009-001: Shallow Copy in writeState() (VERY LOW)

- **Location**: `src/claude/hooks/lib/common.cjs:677`
- **Description**: `Object.assign({}, state)` creates a shallow copy. Nested objects share references.

### TD-BUG0009-002: checkVersionLock() Cyclomatic Complexity (LOW)

- **Location**: `src/claude/hooks/state-write-validator.cjs:106`
- **Description**: CC of 13, above typical threshold of 10. Driven by fail-open pattern.

### TD-BUG0009-003: STATE_JSON_PATTERN Duplicated (LOW, pre-existing)

- **Location**: `src/claude/hooks/lib/common.cjs:22`, `src/claude/hooks/state-write-validator.cjs:28`
- **Description**: The STATE_JSON_PATTERN regex is defined in both files.

### TD-NEW-001: Stale Header Comment in state-write-validator.cjs (LOW)

- **Location**: `src/claude/hooks/state-write-validator.cjs`, line 8
- **Description**: The file header says "OBSERVATIONAL ONLY: outputs warnings to stderr, never blocks." This was accurate before BUG-0009 (V7) added blocking behavior. V7 and V8 both block writes. The comment is stale and misleading.
- **Impact**: LOW -- documentation-only issue. No functional impact.
- **Recommendation**: Update the header comment to reflect current blocking behavior in a future fix workflow.

---

## Debt Summary

| Category | Resolved (BUG-0011) | New (BUG-0011) | Pre-Existing | Active Total |
|----------|---------------------|----------------|--------------|-------------|
| HIGH | 1 resolved | 0 | 0 | 0 |
| LOW | 0 | 1 (CC) | 8 | 9 |
| VERY LOW | 0 | 1 (duplicate parsing) | 2 | 3 |
| INFORMATIONAL | 0 | 0 | 2 | 2 |
| **Total** | **1 resolved** | **2** | **12** | **14** |

Net debt change: -1 HIGH resolved, +2 LOW/VERY LOW added. Overall debt posture improved (eliminated a high-severity production vulnerability at the cost of 2 trivial code quality observations).
