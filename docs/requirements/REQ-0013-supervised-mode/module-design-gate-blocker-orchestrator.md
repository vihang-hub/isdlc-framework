# Module Design: Gate-Blocker, Orchestrator, and Config

**Version**: 1.0.0
**Phase**: 04-design
**Traces to**: FR-01 (AC-01a, AC-01b), FR-06 (AC-06a through AC-06c), FR-07, FR-08 (AC-08b, AC-08c)
**ADRs**: ADR-0003, ADR-0005

---

## 1. Gate-Blocker Integration (gate-blocker.cjs)

### 1.1 Module Overview

**File**: `src/claude/hooks/gate-blocker.cjs`
**Change Type**: MODIFY (documentation + minimal logic)
**Estimated Lines Added**: ~25 (comments + 1 small function)

Per the architecture decision (Section 7 of architecture-overview.md), the gate-blocker operates at a different layer than the review gate. The gate-blocker validates iteration requirements (tests, constitutional validation, elicitation, delegation, artifacts) before allowing gate advancement. The review gate operates in the phase-loop controller's inline flow AFTER the gate has already been passed.

The primary modification is documentation and a small supervisor-awareness addition.

### 1.2 Modification: Comment Block

Add a comment block at the top of the `check()` function body, after the "Only check gate advancement attempts" guard:

```javascript
    // =====================================================================
    // Supervised Mode Note (REQ-0013):
    // The supervised review gate (STEP 3e-review in isdlc.md) runs AFTER
    // a phase completes and its gate requirements are satisfied. It operates
    // at the phase-loop controller level, not at the hook level.
    //
    // Gate-blocker does NOT need to block for supervised mode -- it only
    // validates iteration requirements (tests, constitutional, elicitation,
    // delegation, artifacts). The review gate handles the user-facing
    // pause/review/redo flow independently.
    //
    // When supervised_mode is active, the gate-blocker allows gate
    // advancement as normal. The phase-loop controller's STEP 3e-review
    // intercepts after advancement to present the review menu.
    // =====================================================================
```

### 1.3 Modification: Supervised Mode State Awareness

Add a small check to the self-heal diagnostics section. When the gate-blocker encounters a blocking condition while `supervised_review.status === "reviewing"`, it should log this context for debugging but NOT change its behavior:

```javascript
// After the genuineChecks loop (line ~720), add:
// Log supervised review context for debugging
if (state.active_workflow?.supervised_review?.status === 'reviewing') {
    const msg = `[INFO] gate-blocker: supervised review in progress for phase '${state.active_workflow.supervised_review.phase}'. Gate check unaffected.`;
    stderrMessages += msg + '\n';
}
```

### 1.4 No Behavioral Change

The gate-blocker's `check()` function signature and return type are unchanged. The hook continues to:
- Return `{ decision: 'allow' }` when all requirements pass
- Return `{ decision: 'block', stopReason }` when requirements fail
- Have no knowledge of or dependency on the review gate flow

This ensures backward compatibility (NFR-013-01) and fail-open behavior (NFR-013-02).

### 1.5 Test Impact

Existing gate-blocker tests remain unchanged. New tests (in Phase 05) should verify:
- Gate-blocker allows advancement when supervised_mode.enabled = true and all requirements pass (AC-06a)
- Gate-blocker blocks advancement when requirements fail, regardless of supervised_mode (AC-06b verification)
- Gate-blocker does not crash when supervised_mode config is corrupt (AC-06c)
- The info log line appears when supervised_review.status === "reviewing"

---

## 2. Orchestrator Integration (sdlc-orchestrator.md)

### 2.1 Module Overview

**File**: `src/claude/agents/00-sdlc-orchestrator.md`
**Change Type**: MODIFY (additive)
**Estimated Lines Added**: ~20

Two modifications to the orchestrator agent instructions:

1. **Init mode**: Parse `--supervised` flag and initialize `supervised_mode` config in state.json
2. **Finalize mode**: Ensure `review_history` is preserved in `workflow_history` entry

### 2.2 Init Mode: --supervised Flag Parsing

#### 2.2.1 Location

In the init-and-phase-01 mode section, after the existing flag parsing for `-light` (which sets `active_workflow.flags.light`).

#### 2.2.2 Specification

```markdown
**Supervised mode flag parsing** (after -light flag parsing):

1. Check if the command arguments contain `--supervised`
2. If `--supervised` is present:
   a. Remove `--supervised` from the description text
   b. Set `supervised_mode` in state.json:
      ```json
      {
        "supervised_mode": {
          "enabled": true,
          "review_phases": "all",
          "parallel_summary": true,
          "auto_advance_timeout": null
        }
      }
      ```
   c. Write state.json
   d. Display confirmation:
      ```
      Supervised mode: ENABLED (review gates after every phase)
      ```
3. If `--supervised` is NOT present:
   - Do NOT create or modify the `supervised_mode` block
   - Any existing `supervised_mode` block is preserved as-is (idempotent)
```

#### 2.2.3 Interaction with -light Flag

The `--supervised` and `-light` flags are independent and can be combined:
- `-light --supervised`: Light workflow with review gates on non-skipped phases
- `--supervised` alone: Standard workflow with review gates on all phases
- `-light` alone: Light workflow without review gates
- Neither: Standard workflow without review gates (current behavior)

### 2.3 Finalize Mode: review_history Preservation

#### 2.3.1 Location

In the finalize mode section, where `active_workflow` fields are copied to the `workflow_history` entry.

#### 2.3.2 Specification

The orchestrator's finalize mode already copies `active_workflow` fields to `workflow_history`. Verify that the following fields are included in the copy:

```markdown
**Review history preservation** (in finalize mode):

1. When constructing the `workflow_history` entry from `active_workflow`:
   - Include `review_history` array if it exists (AC-08b)
   - If `review_history` does not exist or is empty:
     - For supervised workflows: include `review_history: []` (AC-08c)
     - For non-supervised workflows: omit `review_history` entirely
2. If `supervised_review` still exists in `active_workflow` (cleanup):
   - Delete it before archiving (it is transient state, not historical)
3. Include `supervised_mode.enabled` in the workflow_history metrics for audit trail
```

#### 2.3.3 Expected workflow_history Entry

```json
{
    "type": "feature",
    "description": "...",
    "started_at": "...",
    "completed_at": "...",
    "status": "completed",
    "artifact_folder": "REQ-0013-supervised-mode",
    "review_history": [
        { "phase": "03-architecture", "action": "continue", "timestamp": "..." },
        { "phase": "04-design", "action": "review", "paused_at": "...", "resumed_at": "..." },
        { "phase": "06-implementation", "action": "redo", "redo_count": 1, "guidance": "..." }
    ],
    "supervised_mode_enabled": true,
    "phases": ["..."],
    "phase_snapshots": ["..."],
    "metrics": { "..." }
}
```

---

## 3. isdlc.md Feature/Fix Command Flag Parsing

### 3.1 Module Overview

**File**: `src/claude/commands/isdlc.md`
**Change Type**: MODIFY (additive)
**Estimated Lines Added**: ~10

The feature and fix command sections need a `--supervised` flag documented.

### 3.2 Feature Command Enhancement

In the feature command section, after the existing `-light` flag documentation:

```markdown
/isdlc feature "Feature description" --supervised
/isdlc feature -light "Feature description" --supervised
```

In the flag parsing section:
```markdown
   - If args contain "--supervised": set flags.supervised = true, remove "--supervised" from description
```

In the init step:
```markdown
   - If flags.supervised: pass `--supervised` flag to orchestrator init
```

### 3.3 Fix Command Enhancement

In the fix command section:

```markdown
/isdlc fix "Bug description" --supervised
```

Same flag parsing and init passing as feature command.

---

## 4. Workflows.json Configuration

### 4.1 Module Overview

**Files**:
- `src/claude/hooks/config/workflows.json` (source of truth)
- `.isdlc/config/workflows.json` (runtime copy, synced by installer)

**Change Type**: MODIFY (additive)
**Estimated Lines Added**: ~10 per file

### 4.2 Modification

Add a `supervised` option to the feature and fix workflow definitions. This documents the flag's availability for CLI help and tooling introspection.

#### 4.2.1 Feature Workflow

Under `workflows.feature.options` (or create the `options` block if it does not exist):

```json
{
    "workflows": {
        "feature": {
            "phases": ["00-quick-scan", "01-requirements", "02-impact-analysis", "03-architecture", "04-design", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"],
            "options": {
                "light": {
                    "description": "Lightweight workflow (skip architecture and design phases)",
                    "flag": "-light"
                },
                "supervised": {
                    "description": "Enable supervised mode with review gates between phases",
                    "default": false,
                    "flag": "--supervised"
                }
            }
        }
    }
}
```

#### 4.2.2 Fix Workflow

Same `supervised` option block added to `workflows.fix.options`:

```json
{
    "workflows": {
        "fix": {
            "phases": ["01-requirements", "02-tracing", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"],
            "options": {
                "supervised": {
                    "description": "Enable supervised mode with review gates between phases",
                    "default": false,
                    "flag": "--supervised"
                }
            }
        }
    }
}
```

### 4.3 No Changes to Other Workflows

The `test-run`, `test-generate`, and `upgrade` workflows do NOT receive the supervised option in v1. These are shorter, more focused workflows where per-phase review adds less value. This can be extended in a future release if needed.

---

## 5. State Schema Specification

### 5.1 supervised_mode (Top-Level Config Block)

```json
{
    "supervised_mode": {
        "enabled": false,
        "review_phases": "all",
        "parallel_summary": true,
        "auto_advance_timeout": null
    }
}
```

| Field | Type | Default | Mutable By | Traces |
|-------|------|---------|-----------|--------|
| `enabled` | `boolean` | `false` | Orchestrator init (`--supervised` flag) | AC-01a, AC-01b, AC-01c |
| `review_phases` | `"all" \| string[]` | `"all"` | User (manual state.json edit) | AC-01d, AC-01e |
| `parallel_summary` | `boolean` | `true` | User (manual state.json edit) | AC-01g, AC-01h |
| `auto_advance_timeout` | `number \| null` | `null` | Reserved (CON-013-05) | -- |

### 5.2 supervised_review (Transient Active Review State)

```json
{
    "active_workflow": {
        "supervised_review": {
            "phase": "03-architecture",
            "status": "reviewing",
            "paused_at": "2026-02-14T10:45:00Z",
            "resumed_at": null,
            "redo_count": 0,
            "redo_guidance_history": []
        }
    }
}
```

| Field | Type | Lifecycle | Traces |
|-------|------|----------|--------|
| `phase` | `string` | Set when gate fires, cleared on continue | AC-04b |
| `status` | `"gate_presented" \| "reviewing" \| "completed" \| "redo_pending"` | Transitions through states | AC-04b, AC-04e, AC-05e |
| `paused_at` | `ISO-8601 \| null` | Set when user selects [R] | AC-04b |
| `resumed_at` | `ISO-8601 \| null` | Set when user says "continue" after review | AC-04e |
| `redo_count` | `number` | Incremented on each redo (max 3) | AC-05d, AC-05f |
| `redo_guidance_history` | `string[]` | Appended with guidance text on each redo | AC-05b |

### 5.3 review_history (Persistent Audit Log)

```json
{
    "active_workflow": {
        "review_history": [
            { "phase": "03-architecture", "action": "continue", "timestamp": "..." },
            { "phase": "04-design", "action": "review", "paused_at": "...", "resumed_at": "...", "timestamp": "..." },
            { "phase": "06-implementation", "action": "redo", "redo_count": 1, "guidance": "...", "timestamp": "..." }
        ]
    }
}
```

| Entry Type | Required Fields | Optional Fields |
|-----------|----------------|-----------------|
| `continue` | `phase`, `action`, `timestamp` | -- |
| `review` | `phase`, `action`, `timestamp` | `paused_at`, `resumed_at` |
| `redo` | `phase`, `action`, `timestamp` | `redo_count`, `guidance` |

---

## 6. Traceability Matrix

| Component | Requirements | ACs Covered |
|-----------|-------------|-------------|
| gate-blocker.cjs comment block | FR-06 | AC-06a (documentation) |
| gate-blocker.cjs info logging | FR-06 | AC-06a, AC-06c |
| gate-blocker.cjs no behavioral change | FR-06 | AC-06b |
| orchestrator init: --supervised parsing | FR-01 | AC-01a, AC-01b |
| orchestrator finalize: review_history | FR-08 | AC-08b, AC-08c |
| isdlc.md: --supervised flag | FR-01 | AC-01a |
| workflows.json: supervised option | FR-01 | AC-01a |
| State: supervised_mode block | FR-01 | AC-01a through AC-01h |
| State: supervised_review block | FR-04, FR-05 | AC-04b, AC-05d, AC-05f |
| State: review_history array | FR-08 | AC-08a, AC-08b, AC-08c |

---

## 7. Backward Compatibility (NFR-013-01)

| Change | Backward Compatible? | Reason |
|--------|---------------------|--------|
| gate-blocker.cjs: comments only | Yes | No logic change |
| gate-blocker.cjs: info log line | Yes | stderr only, no functional change |
| orchestrator init: --supervised parsing | Yes | Only activates with explicit flag |
| orchestrator finalize: review_history | Yes | Only includes field if present |
| isdlc.md: --supervised flag parsing | Yes | Only activates with explicit flag |
| workflows.json: supervised option | Yes | Additive; existing options unchanged |
| State: supervised_mode block | Yes | Missing block = autonomous mode (fail-open) |
| State: supervised_review block | Yes | Only created during supervised review |
| State: review_history array | Yes | Only created during supervised review |
