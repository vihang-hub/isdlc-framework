# Module Design: Integration

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 04-design
**Date**: 2026-02-19
**Traces**: FR-005, FR-006, FR-009, NFR-003, NFR-005

---

## 1. Overview

This document specifies the exact changes to existing files required to integrate the roundtable analyst agent into the iSDLC framework. Three integration points are involved:

1. `src/claude/commands/isdlc.md` -- analyze verb handler step 7 modification
2. `src/claude/hooks/lib/three-verb-utils.cjs` -- `readMetaJson()` defensive defaults extension
3. `meta.json` schema -- two new optional fields (backward-compatible)

All changes are additive. The existing code paths are preserved as fallback behavior.

---

## 2. isdlc.md Analyze Handler Changes

### 2.1 Current Code (Step 7, Lines 587-596)

The current step 7 of the analyze verb handler:

```markdown
7. For each remaining phase starting from nextPhase:
   a. Display: "Running Phase {NN} ({phase name})..."
   b. Delegate to the standard phase agent via Task tool (in ANALYSIS MODE -- no state.json, no branches)
   c. Append phase key to meta.phases_completed
   d. Update meta.analysis_status using deriveAnalysisStatus()
   e. Update meta.codebase_hash to current git HEAD short SHA
   f. Write meta.json using writeMetaJson()
   g. Update BACKLOG.md marker using updateBacklogMarker() with deriveBacklogMarker()
   h. Offer exit point: "Phase {NN} complete. Continue to Phase {NN+1} ({name})? [Y/n]"
      If user declines: stop. Analysis is resumable from the next phase.
```

### 2.2 New Code (Step 7, Replacement)

The modified step 7 wraps the delegation call (sub-step b) in a conditional check. Sub-steps a, c through h remain unchanged.

```markdown
7. For each remaining phase starting from nextPhase:
   a. Display: "Running Phase {NN} ({phase name})..."
   b. Determine delegation target:
      b1. Check if the file `src/claude/agents/roundtable-analyst.md` exists
          (use the Glob tool with pattern `src/claude/agents/roundtable-analyst.md`)
      b2. IF the file exists:
          Delegate to `roundtable-analyst` via Task tool with the following prompt:

          ```
          Execute Phase {NN} - {Phase Name} for analysis.

          ANALYSIS MODE: Do NOT write to state.json. Do NOT create branches.
          Do NOT invoke the orchestrator.

          Artifact folder: {slug}
          Artifact path: docs/requirements/{slug}/
          Phase key: {phase_key}

          META CONTEXT:
            steps_completed: {JSON.stringify(meta.steps_completed)}
            depth_overrides: {JSON.stringify(meta.depth_overrides)}
            phases_completed: {JSON.stringify(meta.phases_completed)}

          DEPTH CONTEXT:
            quick_scan_scope: {scope from quick-scan.md or "unknown"}
            quick_scan_file_count: {file_count from quick-scan.md or 0}
            quick_scan_complexity: {complexity from quick-scan.md or "unknown"}

          Produce artifacts compatible with existing phase agent outputs.
          Update meta.json steps_completed after each step.
          Present menu at each step boundary.
          ```

      b3. IF the file does NOT exist:
          Delegate to the standard phase agent via Task tool
          (existing behavior, unchanged)
   c. Append phase key to meta.phases_completed
   d. Update meta.analysis_status using deriveAnalysisStatus()
   e. Update meta.codebase_hash to current git HEAD short SHA
   f. Write meta.json using writeMetaJson()
   g. Update BACKLOG.md marker using updateBacklogMarker() with deriveBacklogMarker()
   h. Offer exit point: "Phase {NN} complete. Continue to Phase {NN+1} ({name})? [Y/n]"
      If user declines: stop. Analysis is resumable from the next phase.
```

### 2.3 Change Analysis

| Aspect | Value |
|--------|-------|
| Lines added | ~20 (sub-steps b1, b2, b3 replacing sub-step b) |
| Lines removed | 1 (original sub-step b) |
| Net change | +19 lines |
| Location | Analyze verb handler, step 7, between lines 587-596 |
| Risk | HIGH (isdlc.md is the most critical file) |
| Backward compatible | YES (else branch preserves existing behavior) |

### 2.4 Quick-Scan Context Extraction

The DEPTH CONTEXT fields in the delegation prompt require extracting structured data from `quick-scan.md`. The extraction protocol:

```
Protocol:
1. After Phase 00 (quick-scan) completes, read quick-scan.md from artifact folder
2. Extract scope, file count, and complexity from the quick-scan output
   - Look for "Estimated Scope:" or "Scope:" line -> extract "small", "medium", "large"
   - Look for "File Count:" or "Estimated Files:" line -> extract integer
   - Look for "Complexity:" line -> extract "low", "medium", "high"
3. Store extracted values in local variables for use in subsequent phase delegations
4. If quick-scan.md does not exist or fields are not parseable: use defaults
   - scope = "unknown"
   - file_count = 0
   - complexity = "unknown"

These values are NOT stored in meta.json. They are extracted fresh from the
quick-scan.md artifact each time the analyze verb runs. This avoids schema
bloat and keeps quick-scan data authoritative in one location.
```

### 2.5 Standard Phase Agent Mapping (Unchanged Fallback)

When the roundtable agent does not exist (sub-step b3), the standard phase-to-agent mapping is used. This mapping is unchanged:

| Phase Key | Standard Agent |
|-----------|---------------|
| `00-quick-scan` | `quick-scan/quick-scan-agent` |
| `01-requirements` | `01-requirements-analyst` |
| `02-impact-analysis` | `impact-analysis/impact-analysis-orchestrator` |
| `03-architecture` | `02-solution-architect` |
| `04-design` | `03-system-designer` |

**Traces**: FR-009 AC-009-01, AC-009-04.

---

## 3. three-verb-utils.cjs Changes

### 3.1 readMetaJson() Extension

**Location**: `src/claude/hooks/lib/three-verb-utils.cjs`, function `readMetaJson()`, after the existing defensive defaults block (after line 241, before `return raw;` on line 243).

**Current code** (lines 229-243):

```javascript
    // Defensive defaults for missing fields
    if (!raw.analysis_status) {
        raw.analysis_status = 'raw';
    }
    if (!Array.isArray(raw.phases_completed)) {
        raw.phases_completed = [];
    }
    if (!raw.source) {
        raw.source = 'manual';
    }
    if (!raw.created_at) {
        raw.created_at = new Date().toISOString();
    }

    return raw;
```

**New code** (insert between the `created_at` default and `return raw`):

```javascript
    // Defensive defaults for missing fields
    if (!raw.analysis_status) {
        raw.analysis_status = 'raw';
    }
    if (!Array.isArray(raw.phases_completed)) {
        raw.phases_completed = [];
    }
    if (!raw.source) {
        raw.source = 'manual';
    }
    if (!raw.created_at) {
        raw.created_at = new Date().toISOString();
    }

    // Roundtable step-tracking defaults (REQ-ROUNDTABLE-ANALYST, GH-20)
    // Traces: FR-005 AC-005-04, FR-006 AC-006-06, NFR-005 AC-NFR-005-03
    if (!Array.isArray(raw.steps_completed)) {
        raw.steps_completed = [];
    }
    if (typeof raw.depth_overrides !== 'object' || raw.depth_overrides === null || Array.isArray(raw.depth_overrides)) {
        raw.depth_overrides = {};
    }

    return raw;
```

### 3.2 writeMetaJson() -- No Changes Required

The existing `writeMetaJson()` function (lines 259-275) writes the full meta object to disk using `JSON.stringify(meta, null, 2)`. This means:

1. `steps_completed` is preserved when present (it is a property of the meta object).
2. `depth_overrides` is preserved when present.
3. The `delete meta.phase_a_completed` line (line 263) only removes the legacy field -- it does not affect the new fields.
4. The `analysis_status` derivation logic (lines 266-272) reads only `phases_completed`, not `steps_completed`, so it is unaffected.

**No code changes needed.**

### 3.3 Change Analysis

| Aspect | Value |
|--------|-------|
| Lines added | 7 (2 comment lines, 2 if-blocks with bodies, 1 blank line) |
| Lines removed | 0 |
| Function modified | `readMetaJson()` only |
| Location | After line 241, before `return raw` |
| Risk | MEDIUM (184 existing tests; change is additive defaults only) |
| Backward compatible | YES (new fields default to empty when absent) |

### 3.4 JSDoc Update

Update the JSDoc for `readMetaJson()` to document the new fields:

```javascript
/**
 * Reads and normalizes meta.json from a slug directory.
 * Returns null if file doesn't exist or is corrupted.
 *
 * Defensive defaults applied:
 * - analysis_status: 'raw'
 * - phases_completed: []
 * - source: 'manual'
 * - created_at: current timestamp
 * - steps_completed: []           (REQ-ROUNDTABLE-ANALYST)
 * - depth_overrides: {}           (REQ-ROUNDTABLE-ANALYST)
 *
 * Traces: FR-002 (AC-002-01..04), FR-005, FR-006
 *
 * @param {string} slugDir - Absolute path to the slug directory
 * @returns {object|null} Parsed meta object or null
 */
```

---

## 4. meta.json Schema v3 (Backward Compatible)

### 4.1 Schema Version History

| Version | Feature | New Fields |
|---------|---------|-----------|
| v1 | Three-verb model (REQ-0023) | `description`, `source`, `source_id`, `created_at`, `analysis_status`, `phases_completed`, `codebase_hash` |
| v2 | Build auto-detection (REQ-0026) | No new fields; `computeStartPhase()` added as consumer |
| **v3** | **Roundtable analyst (GH-20)** | **`steps_completed`, `depth_overrides`** |

### 4.2 Complete Schema (v3)

```json
{
  "description": "string (item description from add verb)",
  "source": "string ('manual' | 'github' | 'jira')",
  "source_id": "string (external reference, e.g., 'GH-20')",
  "created_at": "string (ISO 8601 timestamp)",

  "analysis_status": "string ('raw' | 'partial' | 'analyzed')",
  "phases_completed": ["string (phase key, e.g., '00-quick-scan')"],
  "codebase_hash": "string (git short SHA at time of last phase completion)",

  "steps_completed": ["string (step_id, e.g., '01-03')"],
  "depth_overrides": {
    "phase_key": "string ('brief' | 'standard' | 'deep')"
  }
}
```

### 4.3 Field Specifications

#### steps_completed (NEW in v3)

| Property | Value |
|----------|-------|
| Type | `string[]` |
| Default | `[]` |
| Maximum entries | 24 (current step count; unbounded in schema) |
| Entry format | `"{PP}-{NN}"` matching step file step_id |
| Ordering | Append-only during a session; order reflects completion sequence |
| Consumers | Roundtable agent (read for skip logic), isdlc.md (pass-through) |
| Non-consumers | Build verb, orchestrator, hooks (never read this field) |
| Backward compat | Absent in v1/v2 meta.json files; `readMetaJson()` defaults to `[]` |

**Traces**: FR-005 AC-005-01 through AC-005-05.

#### depth_overrides (NEW in v3)

| Property | Value |
|----------|-------|
| Type | `object` (string keys, string values) |
| Default | `{}` |
| Key format | Phase key string (e.g., `"01-requirements"`) |
| Value format | One of `"brief"`, `"standard"`, `"deep"` |
| Maximum entries | 5 (one per analysis phase) |
| Consumers | Roundtable agent (read for depth determination) |
| Non-consumers | Build verb, orchestrator, hooks, isdlc.md analyze handler |
| Backward compat | Absent in v1/v2 meta.json files; `readMetaJson()` defaults to `{}` |

**Traces**: FR-006 AC-006-06.

### 4.4 Backward Compatibility Guarantees

1. **Absent fields default gracefully**: `readMetaJson()` initializes missing `steps_completed` to `[]` and missing `depth_overrides` to `{}`. Existing meta.json files (v1/v2) gain these defaults transparently.

2. **writeMetaJson() preserves all fields**: The function serializes the full object. Fields it does not explicitly touch (`steps_completed`, `depth_overrides`) are written through unchanged.

3. **Existing consumers unaffected**: The build verb reads `analysis_status` and `phases_completed`. The orchestrator reads `analysis_status`. The `computeStartPhase()` function reads `phases_completed`. None of these consumers read `steps_completed` or `depth_overrides`, so the new fields are invisible to them.

4. **analysis_status derivation unchanged**: `writeMetaJson()` derives `analysis_status` from `phases_completed.length`, not from `steps_completed`. Step-level granularity does not affect the phase-level status used by the build verb.

5. **No migration needed**: The new fields are optional. Old meta.json files work without modification. No migration script, no version field, no format negotiation.

**Traces**: NFR-005 AC-NFR-005-01 through AC-NFR-005-04.

### 4.5 Example: meta.json Lifecycle

**After `add` verb** (v1 baseline):
```json
{
  "description": "Roundtable analysis agent with named personas",
  "source": "github",
  "source_id": "GH-20",
  "created_at": "2026-02-19T10:00:00.000Z",
  "analysis_status": "raw",
  "phases_completed": []
}
```

**After `readMetaJson()` with v3 defaults applied** (in-memory):
```json
{
  "description": "Roundtable analysis agent with named personas",
  "source": "github",
  "source_id": "GH-20",
  "created_at": "2026-02-19T10:00:00.000Z",
  "analysis_status": "raw",
  "phases_completed": [],
  "steps_completed": [],
  "depth_overrides": {}
}
```

**After Phase 00 completes (3 steps, standard depth)**:
```json
{
  "description": "Roundtable analysis agent with named personas",
  "source": "github",
  "source_id": "GH-20",
  "created_at": "2026-02-19T10:00:00.000Z",
  "analysis_status": "partial",
  "phases_completed": ["00-quick-scan"],
  "codebase_hash": "abc1234",
  "steps_completed": ["00-01", "00-02", "00-03"],
  "depth_overrides": {}
}
```

**After Phase 01 partial (user overrides to brief, completes 5 of 8 steps, then stops)**:
```json
{
  "description": "Roundtable analysis agent with named personas",
  "source": "github",
  "source_id": "GH-20",
  "created_at": "2026-02-19T10:00:00.000Z",
  "analysis_status": "partial",
  "phases_completed": ["00-quick-scan"],
  "codebase_hash": "abc1234",
  "steps_completed": ["00-01", "00-02", "00-03", "01-01", "01-02", "01-03", "01-04", "01-05"],
  "depth_overrides": {
    "01-requirements": "brief"
  }
}
```

Note: `phases_completed` does not include `"01-requirements"` because the phase is only appended by isdlc.md after the roundtable agent returns (step 7c), which did not happen because the user stopped mid-phase. The `steps_completed` array preserves the partial progress for resumption.

**After all 5 phases complete**:
```json
{
  "description": "Roundtable analysis agent with named personas",
  "source": "github",
  "source_id": "GH-20",
  "created_at": "2026-02-19T10:00:00.000Z",
  "analysis_status": "analyzed",
  "phases_completed": ["00-quick-scan", "01-requirements", "02-impact-analysis", "03-architecture", "04-design"],
  "codebase_hash": "def5678",
  "steps_completed": ["00-01", "00-02", "00-03", "01-01", "01-02", "01-03", "01-04", "01-05", "01-06", "01-07", "01-08", "02-01", "02-02", "02-03", "02-04", "03-01", "03-02", "03-03", "03-04", "04-01", "04-02", "04-03", "04-04", "04-05"],
  "depth_overrides": {
    "01-requirements": "brief",
    "03-architecture": "deep"
  }
}
```

---

## 5. Step Discovery and Loading Protocol

### 5.1 Discovery Flow

The step discovery protocol is executed by the roundtable agent at the start of each phase delegation. This section specifies the exact sequence the agent follows.

```
INPUTS:
  phase_key     -- from Task delegation prompt (e.g., "01-requirements")
  steps_completed -- from META CONTEXT in Task prompt (e.g., ["00-01","00-02","00-03"])

STEP 1: Resolve directory path
  base_path = "src/claude/skills/analysis-steps/" + phase_key + "/"
  Example: "src/claude/skills/analysis-steps/01-requirements/"

STEP 2: List step files
  Use Glob tool with pattern: base_path + "*.md"
  Result: unordered list of file paths

  IF result is empty:
    Log: "No step files found for phase {phase_key}."
    Return to isdlc.md (phase treated as complete with no steps)
    EXIT

STEP 3: Sort by filename
  Sort file paths lexicographically by filename (basename only)
  Lexicographic sort on zero-padded numeric prefixes gives numeric order:
    01-business-context.md < 02-user-needs.md < ... < 08-prioritization.md

STEP 4: Parse frontmatter for each file
  FOR each file in sorted list:
    Read file contents using Read tool
    Extract YAML frontmatter (content between first --- and second ---)
    Parse YAML into structured object
    IF parse fails:
      Log warning: "Step file {filename} has invalid frontmatter. Skipping."
      Remove from execution queue
      CONTINUE
    Validate required fields (step_id, title, persona, depth, outputs)
    IF any required field missing:
      Log warning: "Step file {filename} missing required field '{field}'. Skipping."
      Remove from execution queue
      CONTINUE
    Add to execution queue

STEP 5: Build execution queue
  execution_queue = [
    { step_id, title, persona, depth, outputs, depends_on, skip_if, body_sections, file_path },
    ...
  ]
  Where body_sections = {
    brief: "content of ## Brief Mode section",
    standard: "content of ## Standard Mode section",
    deep: "content of ## Deep Mode section",
    validation: "content of ## Validation section",
    artifacts: "content of ## Artifacts section"
  }

STEP 6: Filter completed steps
  FOR each entry in execution_queue:
    IF entry.step_id IN steps_completed:
      Remove from execution_queue (already done)

STEP 7: Return execution queue
  Result: ordered list of remaining steps to execute
```

### 5.2 Body Section Extraction

The step file body is parsed into sections by heading:

```
Protocol:
1. Split body content (everything after YAML frontmatter closing ---) by ## headings
2. For each heading:
   - "## Brief Mode"    -> body_sections.brief
   - "## Standard Mode" -> body_sections.standard
   - "## Deep Mode"     -> body_sections.deep
   - "## Validation"    -> body_sections.validation
   - "## Artifacts"     -> body_sections.artifacts
3. Content between one heading and the next (or end of file) is that section's content
4. Unknown headings are ignored
5. Missing sections: body_sections.{key} = null (triggers fallback chain at execution time)
```

### 5.3 Depth-Based Section Selection

At execution time, the roundtable agent selects a body section based on active depth:

```
Selection:
  IF active_depth == "brief":
    section = body_sections.brief
  ELIF active_depth == "deep":
    section = body_sections.deep
  ELSE:
    section = body_sections.standard

Fallback chain (if selected section is null):
  1. Try body_sections.standard
  2. Try concatenation of all non-null body sections
  3. Use raw body text (everything after frontmatter)
```

### 5.4 Dependency Resolution

Before executing a step, the agent checks `depends_on`:

```
FOR each dep_id in step.depends_on:
  IF dep_id NOT IN steps_completed:
    Log warning: "Step {step.step_id} depends on {dep_id} which is not complete. Skipping."
    Do NOT add to steps_completed (will retry on next session)
    SKIP this step
    CONTINUE to next step in queue
```

Cross-phase dependencies work automatically because `steps_completed` is a flat array spanning all phases.

### 5.5 Conditional Skip Evaluation

Before executing a step, the agent evaluates `skip_if`:

```
IF step.skip_if is non-empty:
  Evaluate the expression with available context variables:
    scope      = quick_scan_scope from DEPTH CONTEXT
    complexity = quick_scan_complexity from DEPTH CONTEXT
    file_count = quick_scan_file_count from DEPTH CONTEXT
    depth      = currently active depth

  IF expression evaluates to truthy:
    Log: "Step {step.step_id} skipped: condition '{step.skip_if}' is true."
    Do NOT add to steps_completed (condition may change on re-run)
    SKIP this step
```

---

## 6. Test File Specification

### 6.1 New Test File

**File**: `src/claude/hooks/tests/test-three-verb-utils-steps.test.cjs`
**Framework**: `node:test` + `node:assert/strict` (CJS)
**Purpose**: Validate the new `steps_completed` and `depth_overrides` fields in `readMetaJson()` and `writeMetaJson()`.

### 6.2 Test Cases

| # | Test Name | Description | Expected Result |
|---|-----------|-------------|-----------------|
| 1 | `readMetaJson defaults steps_completed to empty array when absent` | Create meta.json without `steps_completed`. Call `readMetaJson()`. | `meta.steps_completed` is `[]` |
| 2 | `readMetaJson defaults depth_overrides to empty object when absent` | Create meta.json without `depth_overrides`. Call `readMetaJson()`. | `meta.depth_overrides` is `{}` |
| 3 | `readMetaJson preserves existing steps_completed array` | Create meta.json with `steps_completed: ["00-01", "00-02"]`. Call `readMetaJson()`. | `meta.steps_completed` is `["00-01", "00-02"]` |
| 4 | `readMetaJson preserves existing depth_overrides object` | Create meta.json with `depth_overrides: {"01-requirements": "brief"}`. Call `readMetaJson()`. | `meta.depth_overrides` is `{"01-requirements": "brief"}` |
| 5 | `readMetaJson corrects invalid steps_completed type` | Create meta.json with `steps_completed: "not-an-array"`. Call `readMetaJson()`. | `meta.steps_completed` is `[]` |
| 6 | `readMetaJson corrects invalid depth_overrides type (array)` | Create meta.json with `depth_overrides: ["not-an-object"]`. Call `readMetaJson()`. | `meta.depth_overrides` is `{}` |
| 7 | `readMetaJson corrects null depth_overrides` | Create meta.json with `depth_overrides: null`. Call `readMetaJson()`. | `meta.depth_overrides` is `{}` |
| 8 | `writeMetaJson preserves steps_completed through write cycle` | Create meta with `steps_completed: ["01-01"]`. Call `writeMetaJson()`. Read back with `readMetaJson()`. | `steps_completed` is `["01-01"]` |
| 9 | `writeMetaJson preserves depth_overrides through write cycle` | Create meta with `depth_overrides: {"02-impact-analysis": "deep"}`. Call `writeMetaJson()`. Read back. | `depth_overrides` is `{"02-impact-analysis": "deep"}` |
| 10 | `writeMetaJson does not break when steps_completed is absent` | Create meta without `steps_completed`. Call `writeMetaJson()`. Read back. | File written successfully; `steps_completed` defaults to `[]` on read |
| 11 | `existing 184 tests still pass` | Run full test suite after changes. | All existing tests pass |

### 6.3 Test Skeleton

```javascript
'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { readMetaJson, writeMetaJson } = require('../lib/three-verb-utils.cjs');

describe('three-verb-utils: steps_completed and depth_overrides (GH-20)', () => {
    let testDir;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'isdlc-steps-test-'));
    });

    afterEach(() => {
        fs.rmSync(testDir, { recursive: true, force: true });
    });

    // Helper to write a meta.json for testing
    function writeMeta(data) {
        fs.writeFileSync(
            path.join(testDir, 'meta.json'),
            JSON.stringify(data, null, 2)
        );
    }

    it('defaults steps_completed to empty array when absent', () => {
        writeMeta({ description: 'test', analysis_status: 'raw', phases_completed: [] });
        const meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.steps_completed, []);
    });

    it('defaults depth_overrides to empty object when absent', () => {
        writeMeta({ description: 'test', analysis_status: 'raw', phases_completed: [] });
        const meta = readMetaJson(testDir);
        assert.deepStrictEqual(meta.depth_overrides, {});
    });

    // ... remaining test cases follow the same pattern
});
```

---

## 7. Runtime Sync Requirement

Per the dogfooding convention, `src/claude/agents/roundtable-analyst.md` must be copied to `.claude/agents/roundtable-analyst.md` for the runtime environment. This is a file copy, not a symlink.

The sync must be performed as the final implementation step (entry point 6 in the implementation order from the impact analysis).

---

## 8. Traceability

| Design Element | Requirements Traced |
|---------------|-------------------|
| isdlc.md step 7 conditional | FR-009 AC-009-01, AC-009-02, AC-009-04 |
| Task prompt content | FR-009 AC-009-02 |
| Fallback to standard agents | FR-009 AC-009-04, NFR-005 AC-NFR-005-01 |
| readMetaJson() defaults | FR-005 AC-005-04, NFR-005 AC-NFR-005-03 |
| writeMetaJson() preservation | FR-005 AC-005-05, NFR-005 AC-NFR-005-02 |
| meta.json v3 schema | FR-005, FR-006 AC-006-06 |
| Backward compatibility | NFR-005 AC-NFR-005-01 through AC-NFR-005-04 |
| Step discovery protocol | FR-004 AC-004-01, AC-004-04, NFR-004 |
| Test cases | NFR-005 (backward compatibility validation) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | System Designer (Phase 04) | Initial integration module design |
