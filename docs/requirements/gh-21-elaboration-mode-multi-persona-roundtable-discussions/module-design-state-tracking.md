# Module Design: State Tracking (meta.json Extension)

**Feature**: Elaboration Mode -- Multi-Persona Roundtable Discussions
**Feature ID**: REQ-GH21-ELABORATION-MODE
**Source**: GH-21
**Phase**: 04-design
**Module**: meta.json schema + `src/claude/hooks/lib/three-verb-utils.cjs`

---

## 1. Module Overview

This module covers the state tracking design for elaboration mode. All elaboration state is persisted in `meta.json` within the artifact folder (CON-003: No state.json writes). The design extends the existing meta.json schema with two optional fields and adds a defensive default to `readMetaJson()` in `three-verb-utils.cjs`.

**Traces**: FR-009 (all ACs), NFR-005, NFR-006, ADR-0001 (STATE_PERSIST)

---

## 2. Meta.json Schema Extension

### 2.1 Current Schema (REQ-0027 Baseline)

The meta.json schema established by REQ-0027 (GH-20) contains these fields:

```json
{
  "source": "github",
  "source_id": "GH-21",
  "slug": "gh-21-elaboration-mode-multi-persona-roundtable-discussions",
  "created_at": "2026-02-20T12:00:00.000Z",
  "analysis_status": "partial",
  "phases_completed": ["00-quick-scan", "01-requirements"],
  "codebase_hash": "c02145b",
  "steps_completed": ["01-01", "01-02", "01-03"],
  "depth_overrides": {}
}
```

### 2.2 Extended Schema (GH-21 Addition)

Two new optional fields are added:

```json
{
  "source": "github",
  "source_id": "GH-21",
  "slug": "gh-21-elaboration-mode-multi-persona-roundtable-discussions",
  "created_at": "2026-02-20T12:00:00.000Z",
  "analysis_status": "partial",
  "phases_completed": ["00-quick-scan", "01-requirements"],
  "codebase_hash": "c02145b",
  "steps_completed": ["01-01", "01-02", "01-03"],
  "depth_overrides": {},

  "elaborations": [
    {
      "step_id": "01-03",
      "turn_count": 7,
      "personas_active": ["business-analyst", "solutions-architect", "system-designer"],
      "timestamp": "2026-02-20T14:30:00.000Z",
      "synthesis_summary": "Identified 3 additional acceptance criteria for offline sync"
    }
  ],

  "elaboration_config": {
    "max_turns": 10
  }
}
```

### 2.3 Field Specifications

#### `elaborations` (Array, Optional)

**Traces**: FR-009 (AC-009-01, AC-009-02, AC-009-04)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `step_id` | string | Yes | The step_id from the step file frontmatter where [E] was triggered. Format: `{NN}-{NN}` (e.g., "01-03", "02-01"). |
| `turn_count` | integer | Yes | Total discussion turns (all persona contributions + user contributions + framing). Minimum: 1 (framing only). Maximum: max_turns. |
| `personas_active` | string[] | Yes | Persona keys of all participants. Always `["business-analyst", "solutions-architect", "system-designer"]` for this release. |
| `timestamp` | string | Yes | ISO 8601 timestamp of when the elaboration record was written (post-synthesis). |
| `synthesis_summary` | string | Yes | One-sentence summary of what the elaboration produced. Used by session recovery for context. Maximum recommended length: 100 characters. |

**Array behavior**:
- The array is **append-only** (AC-009-04). New elaboration records are appended, never replacing existing records.
- Multiple records with the same `step_id` are valid (user can elaborate on the same step multiple times).
- The array is ordered chronologically (newest last) by append order.
- On first elaboration, if the field does not exist, it is initialized as `[]` (AC-009-02).

**Example with multiple elaborations on the same step**:

```json
{
  "elaborations": [
    {
      "step_id": "01-03",
      "turn_count": 7,
      "personas_active": ["business-analyst", "solutions-architect", "system-designer"],
      "timestamp": "2026-02-20T14:30:00.000Z",
      "synthesis_summary": "Identified 3 additional acceptance criteria for offline sync"
    },
    {
      "step_id": "01-03",
      "turn_count": 4,
      "personas_active": ["business-analyst", "solutions-architect", "system-designer"],
      "timestamp": "2026-02-20T14:45:00.000Z",
      "synthesis_summary": "Resolved caching strategy disagreement between Alex and Jordan"
    },
    {
      "step_id": "01-05",
      "turn_count": 10,
      "personas_active": ["business-analyst", "solutions-architect", "system-designer"],
      "timestamp": "2026-02-20T15:10:00.000Z",
      "synthesis_summary": "Added 2 NFRs for offline data integrity"
    }
  ]
}
```

#### `elaboration_config` (Object, Optional)

**Traces**: FR-007 (AC-007-03)

| Property | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| `max_turns` | integer | No | 10 | Maximum discussion turns per elaboration session. Must be >= 3 (minimum for framing + one exchange + synthesis trigger). |

**Behavior**:
- If `elaboration_config` does not exist in meta.json, use the hardcoded default (`max_turns = 10`)
- If `elaboration_config` exists but `max_turns` is missing, use the hardcoded default
- If `max_turns` is present but not a positive integer >= 3, ignore it and use the default
- This field is user-configurable: a user can manually edit meta.json to set a different turn limit

---

## 3. Defensive Defaults in readMetaJson()

### 3.1 Location

File: `src/claude/hooks/lib/three-verb-utils.cjs`
Function: `readMetaJson(slugDir)` (line 207)
Insert point: After the existing defensive defaults block (after line 258, before `return raw;`)

### 3.2 Existing Pattern

The function already applies defensive defaults for fields introduced by REQ-0027:

```javascript
// Roundtable step-tracking defaults (REQ-ROUNDTABLE-ANALYST, GH-20)
if (!Array.isArray(raw.steps_completed)) {
    raw.steps_completed = [];
}
if (typeof raw.depth_overrides !== 'object' || raw.depth_overrides === null || Array.isArray(raw.depth_overrides)) {
    raw.depth_overrides = {};
}
```

### 3.3 New Defaults (GH-21)

The following code is added immediately after the existing GH-20 defaults:

```javascript
// Elaboration tracking defaults (GH-21)
// Traces: FR-009 AC-009-02, NFR-005 AC-NFR-005-01
if (!Array.isArray(raw.elaborations)) {
    raw.elaborations = [];
}
```

**Design decisions**:
- Only `elaborations` gets a defensive default, not `elaboration_config`. Rationale: `elaboration_config` is read by the agent with a hardcoded fallback. The agent checks `meta.elaboration_config?.max_turns` and falls back to 10 if missing. There is no code path in three-verb-utils.cjs that reads `elaboration_config`, so no defensive default is needed there.
- The `writeMetaJson()` function requires no changes. It already serializes the entire meta object via `JSON.stringify`, which naturally includes any new fields.

### 3.4 Updated Function Docstring

The `readMetaJson()` docstring should be updated to include the new default:

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
 * - steps_completed: []           (REQ-ROUNDTABLE-ANALYST, GH-20)
 * - depth_overrides: {}           (REQ-ROUNDTABLE-ANALYST, GH-20)
 * - elaborations: []              (GH-21, elaboration tracking)
 *
 * ...
 */
```

---

## 4. Session Recovery Design

### 4.1 Current Recovery Flow (Section 5.1 of roundtable-analyst.md)

The current context recovery reads `steps_completed` from the META CONTEXT block in the delegation prompt and determines:
- `is_new_session`: Whether this is the first time in this phase
- `resume_step`: The first step not in steps_completed
- `is_phase_transition`: Whether the persona changed from the previous phase

### 4.2 Extended Recovery Flow (GH-21)

**Traces**: FR-009 (AC-009-03)

The context recovery is extended to also read and use the `elaborations` array:

**New recovery step** (added after existing steps 4-6 in Section 5.1):

```
7. Extract elaboration history: meta.elaborations array
8. Filter to elaborations for the current phase:
   - Match elaborations where step_id starts with the current phase prefix
     (e.g., "01-" for phase 01-requirements)
9. If matching elaborations exist AND this is a resumed session:
   - For each matching elaboration:
     - Include in greeting: "We also had a roundtable discussion on
       step {step_id} where {synthesis_summary}."
   - Limit to the 3 most recent elaborations for the current phase
     to avoid overly long recovery messages.
```

### 4.3 Recovery Greeting Examples

**Resumed session with elaboration history**:
```
Maya Chen: Welcome back. Last time we completed User Experience & Journeys
and Acceptance Criteria. We also had a roundtable discussion on step 01-03
where we identified 3 additional acceptance criteria for offline sync.
Let us pick up from NFR Extraction.
```

**Resumed session with no elaboration history**:
```
Maya Chen: Welcome back. Last time we completed User Experience & Journeys.
Let us pick up from Acceptance Criteria.
```
(Unchanged from current behavior.)

**New session** (no history):
```
Maya Chen: Hi, I'm Maya, your Business Analyst. I'll be guiding you
through Requirements Discovery. Let's get started.
```
(Unchanged from current behavior.)

---

## 5. Data Flow for State Operations

### 5.1 Write Path (During Elaboration)

```
Elaboration Synthesis completes
  |
  v
State Tracker (Section 4.4.8)
  |
  +-- Read meta.json from agent's in-memory state
  |   (already loaded during step execution)
  |
  +-- Construct elaboration record:
  |   {
  |     step_id: current_step.step_id,
  |     turn_count: discussion_turn_counter,
  |     personas_active: ["business-analyst", "solutions-architect", "system-designer"],
  |     timestamp: new Date().toISOString(),
  |     synthesis_summary: generated_one_liner
  |   }
  |
  +-- Append record to meta.elaborations array
  |
  +-- Write meta.json via writeMetaJson()
  |
  v
Re-present step boundary menu
```

### 5.2 Read Path (Session Recovery)

```
isdlc.md reads meta.json for delegation prompt
  |
  +-- readMetaJson() applies defensive defaults:
  |   - elaborations: [] (if missing)
  |
  +-- META CONTEXT block includes elaborations[]
  |
  v
roundtable-analyst.md receives Task delegation
  |
  +-- Section 5.1 Context Recovery
  |   - Parse META CONTEXT for elaborations[]
  |   - Filter to current phase prefix
  |   - Include in greeting if resumed session
  |
  v
Step execution begins from resume_step
```

### 5.3 Read Path (During Step Execution)

```
Step boundary menu presented -> user selects [E]
  |
  v
Section 4.4.1 Entry
  |
  +-- Read elaboration_config.max_turns from meta
  |   (in-memory, no file read needed)
  |   Fallback: 10 if missing
  |
  v
Discussion Loop (uses max_turns for limit enforcement)
```

---

## 6. Backward Compatibility Analysis

### 6.1 Existing Consumers of meta.json

| Consumer | Reads | Impact |
|----------|-------|--------|
| `isdlc.md` analyze handler | phases_completed, analysis_status, steps_completed | NONE -- does not read elaborations |
| `roundtable-analyst.md` step engine | steps_completed, depth_overrides | NONE -- does not read elaborations (until GH-21 is implemented) |
| `readMetaJson()` | All fields | SAFE -- defensive default added for elaborations |
| `writeMetaJson()` | All fields | SAFE -- JSON.stringify handles any fields |
| `computeStartPhase()` | phases_completed | NONE -- does not read elaborations |
| `checkStaleness()` | codebase_hash | NONE -- does not read elaborations |

### 6.2 Meta.json Files Without elaborations Field

All existing meta.json files (from previous analysis sessions or other features) do not contain `elaborations` or `elaboration_config`. This is handled by:

1. `readMetaJson()` defensive default: Returns `elaborations: []` for any meta.json missing the field
2. Agent-side check: Section 4.4.8 initializes the array if absent before appending
3. `elaboration_config` absence: Agent uses hardcoded default (max_turns = 10)

### 6.3 Schema Migration

No migration is needed. The new fields are:
- Optional (never required by existing code paths)
- Additive (do not modify any existing field semantics)
- Defaulted (defensive defaults ensure safe reads)

---

## 7. Testing Considerations

### 7.1 Existing Tests to Verify (Regression)

| Test File | Test Count | What to Verify |
|-----------|-----------|---------------|
| `test-three-verb-utils.test.cjs` | 61+ tests | readMetaJson() still returns correct defaults for all existing fields |
| `test-three-verb-utils-steps.test.cjs` | Step-tracking tests | steps_completed handling unaffected |

### 7.2 New Test Cases for readMetaJson()

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Missing elaborations field | `{ "analysis_status": "raw" }` | `elaborations: []` added to output |
| Null elaborations field | `{ "elaborations": null }` | `elaborations: []` (replaced) |
| String elaborations field | `{ "elaborations": "invalid" }` | `elaborations: []` (replaced) |
| Empty elaborations array | `{ "elaborations": [] }` | `elaborations: []` (preserved) |
| Populated elaborations array | `{ "elaborations": [{"step_id":"01-03"}] }` | Array preserved as-is |

### 7.3 Manual Validation Protocol (Agent Behavior)

Since agent markdown files have no automated test framework, the following manual protocol validates state tracking:

1. Run `/isdlc analyze` on a test item
2. Complete one step, select [E] at the boundary
3. Participate in elaboration, type "done"
4. Verify meta.json contains elaborations[] with one record
5. Re-enter [E] for the same step
6. Verify meta.json contains two records (append, not replace)
7. Continue to next step, resume the session from scratch
8. Verify context recovery mentions the previous elaboration

---

## 8. Traceability

| Design Element | Requirement | Acceptance Criteria |
|---------------|-------------|---------------------|
| elaborations[] array schema | FR-009 | AC-009-01 |
| Defensive default in readMetaJson() | FR-009 | AC-009-02 |
| Session recovery extension | FR-009 | AC-009-03 |
| Append-only array behavior | FR-009 | AC-009-04 |
| elaboration_config.max_turns | FR-007 | AC-007-03 |
| Session resume after elaboration | NFR-005 | -- |
| Turn limit persistence | NFR-006 | -- |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-20 | System Designer (Phase 04) | Initial state tracking design |
