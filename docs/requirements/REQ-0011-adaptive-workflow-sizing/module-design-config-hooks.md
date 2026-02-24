# Module Design: Configuration and Hook Changes

**Version**: 1.0.0
**Phase**: 04-design
**Traces to**: FR-02 (AC-07), FR-04, FR-05, NFR-02, ADR-0004

---

## 1. workflows.json Changes

**File**: `.isdlc/config/workflows.json` (runtime) + `src/claude/hooks/config/workflows.json` (source)
**Change Type**: MODIFY
**Estimated Lines Added**: ~25

### 1.1 Add `sizing` Block to Feature Workflow

Insert after the existing `agent_modifiers` block and before `requires_branch`:

```json
{
  "workflows": {
    "feature": {
      "phases": ["00-quick-scan", "01-requirements", "02-impact-analysis", "03-architecture", "04-design", "05-test-strategy", "06-implementation", "16-quality-loop", "08-code-review"],
      "gate_mode": "strict",
      "options": {
        "atdd_mode": { "..." },
        "skip_exploration": { "..." },
        "light": {
          "description": "Force lightweight workflow (skip architecture and design phases)",
          "default": false,
          "flag": "-light"
        }
      },
      "sizing": {
        "enabled": true,
        "thresholds": {
          "light_max_files": 5,
          "epic_min_files": 20
        },
        "light_skip_phases": ["03-architecture", "04-design"],
        "risk_override": {
          "high_risk_forces_standard_minimum": true
        }
      },
      "agent_modifiers": { "..." },
      "requires_branch": true
    }
  }
}
```

### 1.2 Rename `no_phase_skipping` Rule

In the `rules` block:

**Before:**
```json
{
  "rules": {
    "no_halfway_entry": true,
    "no_phase_skipping": true,
    "single_active_workflow_per_project": true,
    "require_cancellation_reason": true
  }
}
```

**After:**
```json
{
  "rules": {
    "no_halfway_entry": true,
    "no_agent_phase_skipping": true,
    "_comment_phase_skipping": "Agents cannot skip phases at runtime. Framework-level sizing modifications to the phase array (REQ-0011) are permitted before phases are encountered.",
    "single_active_workflow_per_project": true,
    "require_cancellation_reason": true
  }
}
```

### 1.3 Validation Constraints

The following constraints must hold in workflows.json:

| Constraint | Rule |
|-----------|------|
| `thresholds.light_max_files` | Integer >= 1, default 5 |
| `thresholds.epic_min_files` | Integer >= 2, default 20 |
| `light_max_files < epic_min_files` | Ordering constraint |
| `light_skip_phases` entries | Must all exist in `feature.phases` |
| `sizing.enabled` | Boolean, default true |

---

## 2. gate-blocker.cjs Changes

**File**: `src/claude/hooks/gate-blocker.cjs`
**Change Type**: MODIFY (minimal)
**Estimated Lines Changed**: ~2

### 2.1 Rule Reference Update

The gate-blocker reads the `no_phase_skipping` rule from workflows.json. This reference must be updated to `no_agent_phase_skipping`.

**Search for:**
```javascript
rules.no_phase_skipping
```

**Replace with:**
```javascript
rules.no_agent_phase_skipping
```

### 2.2 Behavioral Impact

The gate-blocker validates phase progression against `active_workflow.phases` (the array in state.json). After sizing removes phases from this array, the gate-blocker only validates phases that remain. This is correct by design -- the gate-blocker never sees removed phases.

No additional logic changes are needed. The rename is purely cosmetic/semantic.

---

## 3. state-write-validator.cjs Changes

**File**: `src/claude/hooks/state-write-validator.cjs`
**Change Type**: MODIFY (minimal)
**Estimated Lines Changed**: ~3

### 3.1 Allow `active_workflow.sizing` Field

The state-write-validator checks for suspicious state mutations. The `active_workflow.sizing` field must be recognized as legitimate.

If the validator has a known-fields allowlist, add `sizing` to the `active_workflow` known fields. If it uses a blocklist/suspicious-pattern approach, no change may be needed -- verify during implementation.

### 3.2 Handle Shorter Phase Arrays

After light sizing, `active_workflow.phases` may have 7 entries instead of the expected 9 for a feature workflow. The validator must not flag this as suspicious.

**Check**: Does the validator compare `active_workflow.phases.length` against a hardcoded or workflow-defined expected count? If so, remove or relax that check. The phases array is the source of truth after sizing.

---

## 4. workflow-completion-enforcer.cjs Changes

**File**: `src/claude/hooks/workflow-completion-enforcer.cjs`
**Change Type**: MODIFY (defensive guard)
**Estimated Lines Changed**: ~5

### 4.1 Handle Variable-Length Phase Arrays

The workflow-completion-enforcer compares `active_workflow.phases` against expected workflow phases. After sizing, the phases array may be shorter. The enforcer must iterate `active_workflow.phases` as-is, not compare against the workflow definition's full phase list.

**Pseudo-code change:**

```javascript
// Before: may have compared against workflows.json phases
// After: iterate only the phases in state.active_workflow.phases
const workflowPhases = state.active_workflow.phases;  // Use state, not config
for (const phase of workflowPhases) {
    // ... check completion status
}
```

### 4.2 Phase Snapshot Length Guard

When `collectPhaseSnapshots()` is called, it iterates `active_workflow.phases`. After sizing, this produces fewer snapshots. The completion enforcer must not fail if snapshot count does not match the workflow definition count.

---

## 5. impact-analysis-orchestrator.md Changes

**File**: `src/claude/agents/impact-analysis-orchestrator.md`
**Change Type**: MODIFY (format stabilization)
**Estimated Lines Changed**: ~10

### 5.1 Ensure JSON Metadata Block

The Impact Analysis agent must output a JSON metadata block at the bottom of impact-analysis.md. This block is the primary data source for `parseSizingFromImpactAnalysis`.

**Add to the agent's output format specification:**

```markdown
## Impact Analysis Metadata

The following JSON block is required for automated sizing analysis.
All fields are required.

\`\`\`json
{
  "files_directly_affected": <integer>,
  "modules_affected": <integer>,
  "risk_level": "<low|medium|high>",
  "blast_radius": "<low|medium|high>",
  "coverage_gaps": <integer>
}
\`\`\`
```

### 5.2 `coverage_gaps` Field Addition

The existing JSON metadata block does not include `coverage_gaps`. The IA agent must derive this from the Risk Assessment section's Test Coverage Analysis table.

**Derivation logic:**
- Count the number of files in the "Files Affected" list that appear in the "No Coverage" or "0%" column of the Test Coverage table
- If no Test Coverage table exists, default to 0

---

## 6. 00-sdlc-orchestrator.md Changes

**File**: `src/claude/agents/00-sdlc-orchestrator.md`
**Change Type**: MODIFY
**Estimated Lines Changed**: ~10

### 6.1 Flags Propagation in init-and-phase-01

The orchestrator receives `FLAGS` from the Phase-Loop Controller and must store them in `active_workflow.flags` during initialization.

**Add to the init-and-phase-01 flow:**

```
Step: Initialize active_workflow
  ...existing fields...
  Set active_workflow.flags = FLAGS object from prompt (default: {})
```

### 6.2 Return Flags in Result

The orchestrator's init-and-phase-01 response must include flags:

```json
{
  "status": "phase_01_complete",
  "phases": ["00-quick-scan", "01-requirements", "02-impact-analysis", ...],
  "artifact_folder": "REQ-0011-adaptive-workflow-sizing",
  "workflow_type": "feature",
  "next_phase_index": 1,
  "flags": { "light": true }
}
```

---

## 7. Change Summary Table

| File | Change | Lines | Priority |
|------|--------|-------|----------|
| `workflows.json` | Add sizing block, light option, rename rule | ~25 | P0 |
| `gate-blocker.cjs` | Rename rule reference | ~2 | P0 |
| `state-write-validator.cjs` | Allow sizing field, handle short arrays | ~3 | P1 |
| `workflow-completion-enforcer.cjs` | Defensive guard for variable phases | ~5 | P1 |
| `impact-analysis-orchestrator.md` | Ensure JSON metadata + coverage_gaps | ~10 | P0 |
| `00-sdlc-orchestrator.md` | Flags propagation | ~10 | P0 |

---

## 8. Traceability

| Change | Requirement | AC |
|--------|-------------|-----|
| workflows.json sizing block | FR-02 | AC-07 |
| workflows.json light option | FR-04 | AC-12 |
| workflows.json rule rename | FR-05 (derived), ADR-0004 | AC-15 |
| gate-blocker.cjs rule rename | FR-05 (derived), ADR-0004 | N/A |
| state-write-validator.cjs | FR-07 (derived) | AC-24 |
| workflow-completion-enforcer.cjs | FR-05 (derived) | AC-15 |
| impact-analysis-orchestrator.md | FR-01 | AC-01 |
| orchestrator flags propagation | FR-04 | AC-12, AC-13 |
