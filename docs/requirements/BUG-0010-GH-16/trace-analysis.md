# Trace Analysis: Fix artifact-paths.json Filename Mismatches

**Generated**: 2026-02-17
**Bug**: BUG-0010-GH-16 -- artifact-paths.json filename mismatches cause false gate blocks
**External ID**: [GitHub Issue #16](https://github.com/vihang-hub/isdlc-framework/issues/16)
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

Two configuration-only bugs in `artifact-paths.json` and `iteration-requirements.json` cause the gate-blocker hook to produce false `artifact_presence` failures. Bug 1: Phase 08 (code-review) config expects `review-summary.md` but the QA Engineer agent produces `code-review-report.md`; the `review-summary.md` file is only created during orchestrator finalize AFTER GATE-08. Bug 2: Phase 01 artifact validation is enabled globally but fix workflows may not write `requirements-spec.md` to disk before GATE-01 fires, and no workflow override disables it. Both bugs are confirmed as config-only fixes -- no changes to `gate-blocker.cjs` are needed.

**Root Cause Confidence**: High
**Severity**: High
**Estimated Complexity**: Low (config-only, 3 lines changed across 2 files)

---

## Symptom Analysis

### Bug 1: Phase 08 Filename Mismatch

**Symptom**: Gate-blocker blocks Phase 08 completion with error:
```
Required artifact(s) missing for phase '08-code-review': docs/requirements/{artifact_folder}/review-summary.md
```

**Error Origin**: `gate-blocker.cjs` line 569, inside `checkArtifactPresenceRequirement()`:
```javascript
reason: `Required artifact(s) missing for phase '${currentPhase}': ${missingArtifacts.join(', ')}`
```

**Triggering Condition**: Every Phase 08 completion attempt. The expected file `review-summary.md` never exists at gate-check time because:
- QA Engineer agent (`07-qa-engineer.md`) produces `code-review-report.md` (confirmed at lines 176, 238, 271, 279, 300 of the agent prompt)
- `review-summary.md` is only created by the orchestrator (`00-sdlc-orchestrator.md` line 605) during finalize, which runs AFTER GATE-08

### Bug 2: Phase 01 Artifact Validation in Fix Workflows

**Symptom**: Gate-blocker blocks Phase 01 completion in fix workflows with error:
```
Required artifact(s) missing for phase '01-requirements': docs/requirements/{artifact_folder}/requirements-spec.md
```

**Triggering Condition**: Fix workflows where the orchestrator captures requirements internally (e.g., from pre-analyzed GitHub Issues) without writing `requirements-spec.md` to disk before the gate fires.

---

## Execution Path

### Gate-Blocker Artifact Check Flow

The artifact validation code path for both bugs follows the same chain:

1. **Entry**: `check(ctx)` function at line 583
2. **Phase requirements loaded**: `requirements.phase_requirements[currentPhase]` (line ~700)
3. **Workflow overrides applied**: `mergeRequirements(phaseReq, overrides)` at line 722
   - Uses deep merge via `mergeRequirements()` (lines 81-96)
   - For fix workflows, reads `requirements.workflow_overrides.fix[currentPhase]` (line 719)
4. **Artifact check dispatched**: `checkArtifactPresenceRequirement(phaseState, phaseReq, state, currentPhase)` at line 798
5. **Early exit check**: Line 521-523 -- if `artifact_validation.enabled` is falsy, returns `{ satisfied: true }`
6. **Path resolution**: Line 527 -- `getArtifactPathsForPhase(currentPhase)` reads `artifact-paths.json`
   - `loadArtifactPaths()` (line 444) reads from `src/claude/hooks/config/artifact-paths.json`
   - `getArtifactPathsForPhase()` (line 473) returns the phase's `paths` array, or `null` if phase not in file
7. **Path preference**: Line 528 -- `artifact-paths.json` paths override `iteration-requirements.json` inline paths
8. **Template resolution**: `resolveArtifactPaths()` (line 492) substitutes `{artifact_folder}` from `state.active_workflow.artifact_folder`
9. **File existence check**: Lines 552-564 -- `fs.existsSync()` on each resolved path
10. **Block or allow**: Lines 566-575 -- missing files produce `{ satisfied: false }` with error message

### Bug 1 Path (Phase 08)

```
check() -> phaseReq for "08-code-review"
  -> artifact_validation.enabled = true (from iteration-requirements.json line 349-353)
  -> checkArtifactPresenceRequirement()
    -> getArtifactPathsForPhase("08-code-review")
      -> artifact-paths.json line 25-28: ["docs/requirements/{artifact_folder}/review-summary.md"]
    -> paths = ["docs/requirements/{artifact_folder}/review-summary.md"]  (from artifact-paths.json, overrides inline)
    -> resolveArtifactPaths() -> "docs/requirements/BUG-NNNN/review-summary.md"
    -> fs.existsSync() -> FALSE (QA Engineer wrote code-review-report.md, not review-summary.md)
    -> returns { satisfied: false, missing_artifacts: [...] }
```

### Bug 2 Path (Phase 01, fix workflow)

```
check() -> phaseReq for "01-requirements"
  -> base artifact_validation.enabled = true (from iteration-requirements.json line 44-48)
  -> workflow overrides: fix["01-requirements"] = { interactive_elicitation: { min_menu_interactions: 1, scope: "bug-report" } }
    -> mergeRequirements() deep-merges, but artifact_validation is NOT in override -> stays enabled
  -> checkArtifactPresenceRequirement()
    -> getArtifactPathsForPhase("01-requirements")
      -> artifact-paths.json line 5-8: ["docs/requirements/{artifact_folder}/requirements-spec.md"]
    -> resolveArtifactPaths() -> "docs/requirements/BUG-NNNN/requirements-spec.md"
    -> fs.existsSync() -> FALSE (orchestrator handled requirements internally)
    -> returns { satisfied: false, missing_artifacts: [...] }
```

---

## Root Cause Analysis

### Hypothesis 1 (CONFIRMED -- Bug 1): artifact-paths.json references wrong filename for Phase 08

**Evidence**:
- `artifact-paths.json` line 27: `"docs/requirements/{artifact_folder}/review-summary.md"`
- `iteration-requirements.json` line 352: same path
- QA Engineer agent (`07-qa-engineer.md`) produces `code-review-report.md` (5 references in agent prompt)
- `review-summary.md` is only created during orchestrator finalize (AFTER GATE-08) at `00-sdlc-orchestrator.md` line 605

**Root Cause**: `artifact-paths.json` was hand-authored during BUG-0020 with the orchestrator's finalize filename (`review-summary.md`) instead of the QA Engineer's actual output filename (`code-review-report.md`).

**Fix**: Change `review-summary.md` to `code-review-report.md` in both config files:
- `src/claude/hooks/config/artifact-paths.json` line 27
- `src/claude/hooks/config/iteration-requirements.json` line 352

### Hypothesis 2 (CONFIRMED -- Bug 2): Missing workflow override for fix workflow Phase 01 artifact validation

**Evidence**:
- `iteration-requirements.json` lines 44-48: `artifact_validation.enabled: true` for Phase 01 globally
- `iteration-requirements.json` lines 713-719: fix workflow override for `01-requirements` only overrides `interactive_elicitation`, not `artifact_validation`
- `mergeRequirements()` (line 81-96) performs deep merge -- missing keys in override are preserved from base
- Therefore `artifact_validation.enabled` remains `true` in fix workflows
- Fix workflows may capture requirements internally without writing `requirements-spec.md` to disk

**Root Cause**: When artifact validation was added for Phase 01, no corresponding workflow override was added for fix workflows where the orchestrator handles requirements differently.

**Fix**: Add `artifact_validation: { enabled: false }` to `workflow_overrides.fix["01-requirements"]` in `iteration-requirements.json`.

### Confirmation: Config-Only Fix (No gate-blocker.cjs Changes)

The gate-blocker code correctly:
- Reads artifact-paths.json and falls back to iteration-requirements.json inline paths (lines 527-528)
- Respects `artifact_validation.enabled: false` early exit (lines 521-523)
- Deep-merges workflow overrides onto base requirements (lines 718-723, 81-96)

All three code paths work as designed. The bugs are purely in the configuration data, not in the logic.

---

## Suggested Fixes

### Fix 1: artifact-paths.json (1 line)

**File**: `src/claude/hooks/config/artifact-paths.json` line 27
```json
// BEFORE:
"docs/requirements/{artifact_folder}/review-summary.md"

// AFTER:
"docs/requirements/{artifact_folder}/code-review-report.md"
```

### Fix 2: iteration-requirements.json Phase 08 inline path (1 line)

**File**: `src/claude/hooks/config/iteration-requirements.json` line 352
```json
// BEFORE:
"docs/requirements/{artifact_folder}/review-summary.md"

// AFTER:
"docs/requirements/{artifact_folder}/code-review-report.md"
```

### Fix 3: iteration-requirements.json fix workflow override (add block)

**File**: `src/claude/hooks/config/iteration-requirements.json` lines 713-719
```json
// BEFORE:
"fix": {
  "01-requirements": {
    "interactive_elicitation": {
      "min_menu_interactions": 1,
      "scope": "bug-report"
    }
  },

// AFTER:
"fix": {
  "01-requirements": {
    "interactive_elicitation": {
      "min_menu_interactions": 1,
      "scope": "bug-report"
    },
    "artifact_validation": {
      "enabled": false
    }
  },
```

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-17",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["artifact_presence", "review-summary.md", "requirements-spec.md", "missing artifact"],
  "files_traced": [
    "src/claude/hooks/gate-blocker.cjs (lines 81-96, 444-576, 718-798)",
    "src/claude/hooks/config/artifact-paths.json (line 27)",
    "src/claude/hooks/config/iteration-requirements.json (lines 44-48, 349-353, 713-719)",
    "src/claude/agents/07-qa-engineer.md (lines 176, 238, 271, 279, 300)",
    "src/claude/agents/00-sdlc-orchestrator.md (line 605)"
  ],
  "code_changes_required": "config-only",
  "gate_blocker_changes_required": false
}
```
