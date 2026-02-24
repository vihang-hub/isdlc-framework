# ADR-003: Meta.json Extension for Step-Level Tracking

## Status

Accepted

## Context

The roundtable agent needs to track analysis progress at the step level for session resumability (FR-005, NFR-003). The current meta.json tracks progress at the phase level only (`phases_completed` array). Additionally, adaptive depth overrides per phase need to be persisted so that resumed sessions use the same depth the user selected (FR-006 AC-006-06).

The design question is where and how to persist step-level progress and depth preferences.

Requirements context:
- CON-003 prohibits writing to state.json (analyze verb constraint)
- meta.json is the existing persistence mechanism for analysis progress
- `readMetaJson()` and `writeMetaJson()` in three-verb-utils.cjs are the standard read/write utilities
- 184 existing tests validate three-verb-utils.cjs behavior
- The build verb and orchestrator read meta.json -- backward compatibility is critical (NFR-005)

## Decision

Extend the meta.json schema with two new optional fields:

```json
{
  "steps_completed": ["00-01", "00-02", "00-03", "01-01"],
  "depth_overrides": { "01-requirements": "brief" }
}
```

**`steps_completed`** (string array):
- Flat array of step_id values that have been completed
- Default: `[]` (when field is absent)
- Updated after each step completes
- Used by the roundtable agent to skip completed steps on resume
- Maximum practical size: 24 entries (current step inventory)

**`depth_overrides`** (object):
- Map of phase_key to depth string ("brief", "standard", or "deep")
- Default: `{}` (when field is absent)
- Set when the user overrides depth during a phase
- Used by the roundtable agent on resume to maintain the user's depth preference

Both fields are handled by extending `readMetaJson()` to apply defaults when absent.

## Consequences

**Positive:**
- Backward compatible: absent fields default gracefully, existing consumers are unaffected
- Single source of truth: all analysis progress in one file (meta.json)
- Minimal code change: ~6 lines added to readMetaJson()
- writeMetaJson() needs zero changes (already serializes the full object)
- Resumability works by reading two fields from one file
- Existing 184 tests continue to pass unchanged

**Negative:**
- steps_completed is a flat array, not structured by phase -- the agent must filter by prefix to find steps for a specific phase
- No schema validation at the file level -- malformed values (e.g., steps_completed as a string) are handled by defensive defaults
- Growing steps_completed array is never pruned (all completed steps accumulate)

**Mitigations:**
- Flat array is intentional: it provides a global completion log that is easy to search and does not require nested object traversal. Phase-specific filtering is a simple string prefix operation (e.g., "01-" for Phase 01 steps).
- At 24 maximum entries, the array size is negligible for JSON parsing and serialization.
- Schema validation could be added later as a utility function without breaking existing consumers.

## Implementation Detail

Changes to `readMetaJson()` in three-verb-utils.cjs (after existing defensive defaults, around line 235):

```javascript
// Step-level tracking defaults (GH-20: Roundtable analyst)
if (!Array.isArray(raw.steps_completed)) {
    raw.steps_completed = [];
}
if (typeof raw.depth_overrides !== 'object' ||
    raw.depth_overrides === null ||
    Array.isArray(raw.depth_overrides)) {
    raw.depth_overrides = {};
}
```

No changes needed to `writeMetaJson()` -- it already writes the full meta object.

## Alternatives Considered

### Separate State File (Rejected)
- Create `steps-state.json` alongside meta.json
- **Rejected because**: Splits state across two files; complicates atomicity (meta.json and steps-state.json could be inconsistent); adds a new file for consumers to discover

### state.json Extension (Rejected)
- Add step tracking to `.isdlc/state.json`
- **Rejected because**: CON-003 prohibits analyze verb writes to state.json; state.json is workflow-scoped, not item-scoped

### Phase-Structured Steps Object (Rejected)
- Use `{"steps_completed": {"00-quick-scan": ["00-01", "00-02"], "01-requirements": ["01-01"]}}` instead of flat array
- **Rejected because**: Adds nesting complexity; the flat array is simpler and the step_id prefix already encodes the phase; filtering by phase is trivial with string matching

## Traces

- FR-005 (step-level progress tracking)
- FR-006 (adaptive depth persistence)
- NFR-003 (session resumability)
- NFR-005 (backward compatibility)
- CON-003 (no state.json writes)
- Article V (Simplicity First)
