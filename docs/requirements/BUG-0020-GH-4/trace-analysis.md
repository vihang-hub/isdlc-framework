# Trace Analysis: Artifact path mismatch between agents and gate-blocker

**Generated**: 2026-02-16T23:30:00Z
**Bug**: Artifact path mismatch between agents and gate-blocker -- no single source of truth
**External ID**: GitHub #4
**Bug ID**: BUG-0020
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The gate-blocker hook (`gate-blocker.cjs`) validates artifact presence by reading `artifact_validation.paths` from `iteration-requirements.json` for each phase, then checking whether those files exist on disk. Agent files define their own output paths in their `OUTPUT STRUCTURE` sections independently. These two sources drifted when agents were refactored to consolidate work-item-specific artifacts under `docs/requirements/{artifact_folder}/` instead of scattered per-category directories (`docs/architecture/`, `docs/design/`, `docs/testing/`, `docs/reviews/`). The result is that 4 of 5 phases with artifact validation will fail at gate check because the hook looks for files in directories where agents no longer write.

**Root Cause Confidence**: HIGH
**Severity**: HIGH
**Estimated Complexity**: MEDIUM

---

## Symptom Analysis

### Error Observed

During REQ-0020 Phase 08 execution, gate-blocker produced:

```
GATE BLOCKED: Iteration requirements not satisfied for phase '08-code-review'.

Blocking requirements: artifact_presence
- artifact_presence: Required artifact(s) missing for phase '08-code-review':
  docs/reviews/REQ-0020-t6-hook-io-optimization/review-summary.md
```

The agent (`07-qa-engineer.md`) wrote its artifact to `docs/requirements/REQ-0020-t6-hook-io-optimization/code-review-report.md`, which is a completely different directory AND filename from what the gate expected.

### Symptom Inventory (All 5 Phases)

| Phase | Config Path (iteration-requirements.json) | Agent Output Path (OUTPUT STRUCTURE) | Match? |
|-------|------------------------------------------|--------------------------------------|--------|
| `01-requirements` | `docs/requirements/{artifact_folder}/requirements-spec.md` | `docs/requirements/{artifact_folder}/requirements-spec.md` | **YES** |
| `03-architecture` | `docs/architecture/{artifact_folder}/architecture-overview.md` | `docs/requirements/{artifact_folder}/database-design.md` (+ `docs/common/`) | **NO** -- both directory and filename differ |
| `04-design` | `docs/design/{artifact_folder}/interface-spec.yaml` or `.md` | `docs/requirements/{artifact_folder}/module-design.md` | **NO** -- both directory and filename differ |
| `05-test-strategy` | `docs/testing/{artifact_folder}/test-strategy.md` | `docs/requirements/{artifact_folder}/test-cases.md` | **NO** -- both directory and filename differ |
| `08-code-review` | `docs/reviews/{artifact_folder}/review-summary.md` | `docs/requirements/{artifact_folder}/code-review-report.md` | **NO** -- both directory and filename differ |

### Mismatch Dimensions

For each mismatched phase, there are TWO dimensions of drift:

1. **Directory drift**: Config expects per-category dirs (`docs/architecture/`, `docs/design/`, `docs/testing/`, `docs/reviews/`), agents write to unified `docs/requirements/`.
2. **Filename drift**: Config expects original filenames (`architecture-overview.md`, `interface-spec.yaml`, `test-strategy.md`, `review-summary.md`), agents use refactored names (`database-design.md`, `module-design.md`, `test-cases.md`, `code-review-report.md`).

### Triggering Conditions

- Bug triggers on ANY workflow (feature or fix) that reaches Phase 03, 04, 05, or 08.
- Phase 01 is unaffected because its paths were not changed during the agent refactoring.
- Phase 02 (impact-analysis/tracing) has no artifact_validation, so it is unaffected.
- Phase 06 (implementation) has no artifact_validation, so it is unaffected.
- The bug is deterministic and 100% reproducible.

---

## Execution Path

### Entry Point

Gate validation triggers when the phase-loop controller in `isdlc.md` attempts to advance past a completed phase. The advancement attempt is intercepted by `gate-blocker.cjs` (registered as a PreToolUse hook).

### Call Chain

```
1. Phase agent completes work
   -> Agent writes artifacts to paths defined in its OUTPUT STRUCTURE section
   -> e.g., 07-qa-engineer writes to docs/requirements/{artifact_folder}/code-review-report.md

2. Phase-loop controller invokes gate advancement
   -> Task tool call with "advance" keyword
   -> isGateAdvancementAttempt() returns true (gate-blocker.cjs:120-178)

3. Gate-blocker loads phase requirements
   -> check() function (gate-blocker.cjs:526)
   -> Loads iteration-requirements.json via ctx.requirements or loadIterationRequirements()
   -> Gets phase_requirements[currentPhase] (gate-blocker.cjs:651)
   -> Applies workflow_overrides if applicable (gate-blocker.cjs:661-667)

4. Gate-blocker runs 5 requirement checks (gate-blocker.cjs:700-747)
   -> checkTestIterationRequirement()
   -> checkConstitutionalRequirement()
   -> checkElicitationRequirement()
   -> checkAgentDelegationRequirement()
   -> checkArtifactPresenceRequirement()  <-- THIS IS WHERE THE BUG MANIFESTS

5. checkArtifactPresenceRequirement() (gate-blocker.cjs:465-519)
   -> Reads artifactReq.paths from iteration-requirements.json
      e.g., ["docs/reviews/{artifact_folder}/review-summary.md"]
   -> Calls resolveArtifactPaths() to substitute {artifact_folder}
      e.g., "docs/reviews/REQ-0020-t6-hook-io-optimization/review-summary.md"
   -> Groups resolved paths by directory
   -> Checks fs.existsSync(path.join(projectRoot, p)) for each
   -> FILE NOT FOUND because agent wrote to a DIFFERENT path
   -> Returns { satisfied: false, missing_artifacts: [...] }

6. Gate blocks with stopReason including missing artifact paths
   -> diagnoseBlockCause() classifies this as a GENUINE block (not infrastructure)
   -> Returns { decision: 'block', stopReason: '...' }
```

### Data Flow Diagram

```
iteration-requirements.json                  Agent OUTPUT STRUCTURE
         |                                           |
         v                                           v
  artifact_validation.paths              Agent writes artifact to disk
  ["docs/reviews/{af}/review-summary.md"]   -> docs/requirements/{af}/code-review-report.md
         |
         v
  resolveArtifactPaths()
  -> "docs/reviews/REQ-0020.../review-summary.md"
         |
         v
  fs.existsSync() -> FALSE
         |
         v
  GATE BLOCKED
```

### Key Code Locations

| File | Lines | Function | Role |
|------|-------|----------|------|
| `src/claude/hooks/gate-blocker.cjs` | 442-458 | `resolveArtifactPaths()` | Substitutes `{artifact_folder}` template variable |
| `src/claude/hooks/gate-blocker.cjs` | 465-519 | `checkArtifactPresenceRequirement()` | Checks file existence on disk |
| `src/claude/hooks/gate-blocker.cjs` | 740-741 | (in `check()`) | Calls artifact check as 5th gate requirement |
| `src/claude/hooks/config/iteration-requirements.json` | 116-121 | Phase 03 artifact_validation | `docs/architecture/{artifact_folder}/architecture-overview.md` |
| `src/claude/hooks/config/iteration-requirements.json` | 144-150 | Phase 04 artifact_validation | `docs/design/{artifact_folder}/interface-spec.yaml` or `.md` |
| `src/claude/hooks/config/iteration-requirements.json` | 169-173 | Phase 05 artifact_validation | `docs/testing/{artifact_folder}/test-strategy.md` |
| `src/claude/hooks/config/iteration-requirements.json` | 350-355 | Phase 08 artifact_validation | `docs/reviews/{artifact_folder}/review-summary.md` |
| `src/claude/agents/02-solution-architect.md` | 526-557 | OUTPUT STRUCTURE | Writes to `docs/requirements/{artifact_folder}/database-design.md` |
| `src/claude/agents/03-system-designer.md` | 282-309 | OUTPUT STRUCTURE | Writes to `docs/requirements/{artifact_folder}/module-design.md` |
| `src/claude/agents/04-test-design-engineer.md` | 239-263 | OUTPUT STRUCTURE | Writes to `docs/requirements/{artifact_folder}/test-cases.md` |
| `src/claude/agents/07-qa-engineer.md` | 255-274 | OUTPUT STRUCTURE | Writes to `docs/requirements/{artifact_folder}/code-review-report.md` |

---

## Root Cause Analysis

### Root Cause (Confirmed)

**No single source of truth for artifact output paths.** Agent OUTPUT STRUCTURE sections and `iteration-requirements.json` artifact_validation.paths are defined independently in separate files. When agents were refactored to consolidate work-item artifacts under `docs/requirements/{artifact_folder}/`, the corresponding entries in `iteration-requirements.json` were not updated. This is a classic configuration drift bug caused by duplicate definitions with no enforced synchronization.

### Hypothesis Ranking

| # | Hypothesis | Likelihood | Evidence |
|---|-----------|-----------|---------|
| 1 | Config/agent path definitions are independent and drifted during refactoring | **HIGH (confirmed)** | Direct comparison of paths in iteration-requirements.json vs. agent OUTPUT STRUCTURE sections shows 4/5 mismatches. The directory pattern (per-category vs. unified `docs/requirements/`) and filenames both differ. |
| 2 | Gate-blocker has a path resolution bug | **LOW (ruled out)** | `resolveArtifactPaths()` correctly substitutes `{artifact_folder}`. The BUG-0017 fix and tests confirm the resolution logic works correctly. The paths it resolves are simply wrong in the config. |
| 3 | Agents are writing to wrong paths | **LOW (ruled out)** | Agent OUTPUT STRUCTURE sections are intentional -- they consolidate under `docs/requirements/` for better organization. The agents are correct; the config is stale. |

### Evidence Trail

1. **Phase 01 works**: `iteration-requirements.json` line 47 = `docs/requirements/{artifact_folder}/requirements-spec.md`. Agent `01-requirements-analyst.md` OUTPUT STRUCTURE (line 1610-1616) writes to same path. This proves the mechanism works when paths are aligned.

2. **Phase 08 failed during REQ-0020**: Gate expected `docs/reviews/{artifact_folder}/review-summary.md` (iteration-requirements.json line 353), but agent 07-qa-engineer.md OUTPUT STRUCTURE (line 269-270) writes `docs/requirements/{artifact_folder}/code-review-report.md`. Both directory AND filename differ.

3. **Agent refactoring pattern**: All agents (02, 03, 04, 07) show the same pattern -- work-item artifacts go to `docs/requirements/{artifact_folder}/` with a domain-specific filename. This was an intentional consolidation. Only `iteration-requirements.json` was left behind.

4. **Existing tests use stale paths**: The BUG-0017 test suite in `test-gate-blocker-extended.test.cjs` (lines 1516-1518, 1559-1560, 1641-1642, 1685-1686) uses the old `docs/design/{artifact_folder}/interface-spec.yaml` paths, further confirming the config was never updated.

5. **No shared artifact-paths.json exists**: `Glob` search for `**/artifact-paths*` returns no results. There is no centralized path definition file.

### Suggested Fix

**Primary fix**: Update `iteration-requirements.json` artifact_validation.paths to match what agents actually write:

| Phase | Current (broken) | Corrected |
|-------|-----------------|-----------|
| `03-architecture` | `docs/architecture/{artifact_folder}/architecture-overview.md` | `docs/requirements/{artifact_folder}/database-design.md` |
| `04-design` | `docs/design/{artifact_folder}/interface-spec.yaml` + `.md` | `docs/requirements/{artifact_folder}/module-design.md` |
| `05-test-strategy` | `docs/testing/{artifact_folder}/test-strategy.md` | `docs/requirements/{artifact_folder}/test-cases.md` |
| `08-code-review` | `docs/reviews/{artifact_folder}/review-summary.md` | `docs/requirements/{artifact_folder}/code-review-report.md` |

**Structural fix** (prevents recurrence): Create `src/claude/hooks/config/artifact-paths.json` as the single source of truth. Have `gate-blocker.cjs` read from it (with fallback to inline `iteration-requirements.json` paths). Update agent OUTPUT STRUCTURE sections to reference `artifact-paths.json`. Add `artifact-path-consistency.test.cjs` to catch future drift.

**Complexity**: MEDIUM -- config changes are straightforward, but the structural fix (shared config, hook update, agent doc updates, new test) touches multiple files.

**Files to modify**:
- `src/claude/hooks/config/iteration-requirements.json` -- update 4 artifact_validation.paths entries
- `src/claude/hooks/config/artifact-paths.json` -- NEW: single source of truth
- `src/claude/hooks/gate-blocker.cjs` -- read from artifact-paths.json with fallback
- `src/claude/agents/02-solution-architect.md` -- reference artifact-paths.json in OUTPUT STRUCTURE
- `src/claude/agents/03-system-designer.md` -- reference artifact-paths.json in OUTPUT STRUCTURE
- `src/claude/agents/04-test-design-engineer.md` -- reference artifact-paths.json in OUTPUT STRUCTURE
- `src/claude/agents/07-qa-engineer.md` -- reference artifact-paths.json in OUTPUT STRUCTURE
- `src/claude/hooks/tests/artifact-path-consistency.test.cjs` -- NEW: drift detection test

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-16T23:30:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["GATE BLOCKED", "artifact_presence", "missing artifact", "Required artifact(s) missing"],
  "files_traced": [
    "src/claude/hooks/gate-blocker.cjs",
    "src/claude/hooks/config/iteration-requirements.json",
    "src/claude/hooks/lib/common.cjs",
    "src/claude/agents/01-requirements-analyst.md",
    "src/claude/agents/02-solution-architect.md",
    "src/claude/agents/03-system-designer.md",
    "src/claude/agents/04-test-design-engineer.md",
    "src/claude/agents/07-qa-engineer.md",
    "src/claude/hooks/tests/test-gate-blocker-extended.test.cjs"
  ],
  "phases_affected": ["03-architecture", "04-design", "05-test-strategy", "08-code-review"],
  "phases_unaffected": ["01-requirements"],
  "root_cause_type": "configuration-drift",
  "fix_complexity": "medium"
}
```
