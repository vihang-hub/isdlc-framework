# Trace Analysis: Batch C Hook Bugs (Gate Blocker Misleading Errors + State Write Validator Version Lock Bypass)

**Generated**: 2026-02-15T15:00:00Z
**Bug**: Batch C bugs: (0.9) Misleading artifact error messages in gate-blocker.cjs; (0.10) Version lock bypass during state migration in state-write-validator.cjs
**External ID**: None (internal dogfooding)
**Workflow**: fix
**Phase**: 02-tracing
**Artifact Folder**: BUG-0017-batch-c-hooks

---

## Executive Summary

Two bugs were traced through the hook subsystem. Bug 0.9 is a **presentation/reporting defect** in `gate-blocker.cjs` where the `checkArtifactPresenceRequirement()` function groups file paths by directory to check variant alternatives, but when no variant satisfies the requirement, it pushes only `dirPaths[0]` (the first variant) to the missing artifacts list, discarding all other valid variants from both the error message and the `missing_artifacts` return array. Bug 0.10 is a **security/integrity defect** in `state-write-validator.cjs` where the `checkVersionLock()` function's backward-compatibility guard for unversioned incoming state exits early (returns `null`) without reading the disk state, allowing unversioned writes to silently overwrite versioned disk state. Both bugs have clear, localized root causes with low-complexity fixes.

**Root Cause Confidence**: High (both bugs have exact line-level root causes identified)
**Severity**: Bug 0.9 = Medium (misleading UX), Bug 0.10 = High (data integrity bypass)
**Estimated Complexity**: Low (both fixes are 5-15 lines of code)

---

## Symptom Analysis

### Bug 0.9: Misleading Artifact Error Messages

**Observed Symptom**:
When a gate phase requires alternative artifact formats (e.g., `interface-spec.yaml` OR `interface-spec.md`) and neither variant exists, the gate blocker reports only the first variant as missing. The error message reads:

```
Required artifact(s) missing for phase '04-design': docs/design/REQ-XXXX/interface-spec.yaml
```

This is misleading because:
1. The developer may think only `.yaml` format is accepted
2. Creating `interface-spec.md` would also satisfy the requirement, but the error does not say so
3. The `missing_artifacts` array in the return value contains only the first variant, so downstream consumers (e.g., phase-loop controller, escalation messages) also display incomplete information

**Error Source Location**:
- File: `src/claude/hooks/gate-blocker.cjs`
- Function: `checkArtifactPresenceRequirement()`
- Line 497: `missingArtifacts.push(dirPaths[0]);`
- Line 504: `reason: \`Required artifact(s) missing for phase '${currentPhase}': ${missingArtifacts.join(', ')}\``

**Triggering Conditions**:
- The `iteration-requirements.json` config for a phase has `artifact_validation.paths` with 2+ entries sharing the same directory (e.g., `docs/design/{artifact_folder}/interface-spec.yaml` and `docs/design/{artifact_folder}/interface-spec.md`)
- None of the variant files exist on disk
- A gate advancement attempt is made for that phase

**Affected Phases** (from iteration-requirements.json analysis):
- `04-design`: has `interface-spec.yaml` and `interface-spec.md` as variants -- this is the only phase currently configured with multi-variant artifact paths

**Non-affected scenarios** (existing behavior preserved):
- Phases with a single artifact path (e.g., `01-requirements` with only `requirements-spec.md`)
- Phases where at least one variant exists (the `anyExists` check correctly short-circuits)

### Bug 0.10: Version Lock Bypass During State Migration

**Observed Symptom**:
A write to `.isdlc/state.json` with no `state_version` field succeeds even when the disk state already has a `state_version` (e.g., `state_version: 50`). The V7 optimistic locking mechanism is completely bypassed.

**Error Source Location**:
- File: `src/claude/hooks/state-write-validator.cjs`
- Function: `checkVersionLock()`
- Lines 131-133: Early return for unversioned incoming state

```javascript
if (incomingVersion === undefined || incomingVersion === null) {
    return null;  // Bypasses ALL subsequent disk checks
}
```

**Triggering Conditions**:
- Disk has `.isdlc/state.json` with a valid `state_version` field (any positive integer)
- An agent or process writes state.json content that does NOT include a `state_version` field
- The V7 check exits at line 131-133 without ever reading the disk state
- The write proceeds to V8 (phase field protection) and V1-V3 (content validation) but version integrity is already lost

**Existing Test Gap** (T19 and T20):
- Test T19 (`allows write when incoming state_version is missing`) explicitly asserts that unversioned incoming writes are allowed when disk has `state_version: 5`
- Test T20 (`allows write when incoming state_version is null`) similarly allows null incoming against versioned disk
- These tests encode the BUGGY behavior as expected -- they will need to be updated as part of the fix

---

## Execution Path

### Bug 0.9: Execution Path Through gate-blocker.cjs

```
Entry: check(ctx) [line 518]
  |
  +--> isGateAdvancementAttempt(input) [pre-filter]
  |
  +--> Determine currentPhase from active_workflow [lines 570-608]
  |
  +--> Load phaseReq from iteration-requirements.json [line 627]
  |
  +--> Apply workflow overrides if active [line 637]
  |
  +--> CHECK 5: checkArtifactPresenceRequirement() [line 694]
  |      |
  |      +--> Read artifactReq.paths from config [line 470]
  |      |    e.g., ["docs/design/{artifact_folder}/interface-spec.yaml",
  |      |           "docs/design/{artifact_folder}/interface-spec.md"]
  |      |
  |      +--> resolveArtifactPaths(paths, state) [line 475]
  |      |    Replaces {artifact_folder} with actual folder name
  |      |    Result: ["docs/design/REQ-XXX/interface-spec.yaml",
  |      |             "docs/design/REQ-XXX/interface-spec.md"]
  |      |
  |      +--> Group by directory [lines 487-492]
  |      |    pathsByDir = {
  |      |      "docs/design/REQ-XXX": [
  |      |        "docs/design/REQ-XXX/interface-spec.yaml",
  |      |        "docs/design/REQ-XXX/interface-spec.md"
  |      |      ]
  |      |    }
  |      |
  |      +--> For each directory group [lines 494-498]
  |      |    anyExists = dirPaths.some(p => fs.existsSync(...))
  |      |    if (!anyExists) {
  |      |        missingArtifacts.push(dirPaths[0])  // BUG: only first variant
  |      |    }                                        // dirPaths[1..n] discarded
  |      |
  |      +--> Return { satisfied: false, missing_artifacts: [...], reason: "..." }
  |
  +--> Block gate advancement with incomplete error message [line 754]
  |    The stopReason and missing_artifacts both omit valid alternatives
  |
  +--> Write escalation to state.pending_escalations [line 768]
       (escalation also carries the incomplete message)
```

**Key Data Flow Issue**:
The `pathsByDir` grouping at lines 487-492 correctly identifies that multiple paths share the same directory (i.e., they are variant alternatives). The `anyExists` check at line 495 correctly treats the group as an OR -- any one file satisfying the requirement. But at line 497, when none exist, only `dirPaths[0]` is pushed, losing the variant information that was correctly maintained up to that point.

### Bug 0.10: Execution Path Through state-write-validator.cjs

```
Entry: check(ctx) [line 333]
  |
  +--> Verify input is Write or Edit tool [line 341]
  |
  +--> Extract filePath from tool_input [line 346]
  |
  +--> Match STATE_JSON_PATTERN [line 349]
  |
  +--> checkVersionLock(filePath, toolInput, toolName) [line 356]
  |      |
  |      +--> Guard: toolName !== 'Write' -> return null [line 109]
  |      |
  |      +--> Parse incoming JSON content [lines 115-126]
  |      |
  |      +--> Extract incomingVersion = incomingState.state_version [line 128]
  |      |
  |      +--> GUARD (BUGGY): if incomingVersion is undefined/null [lines 131-133]
  |      |    return null  <-- EXITS HERE WITHOUT READING DISK
  |      |
  |      |    The following code NEVER executes for unversioned incoming:
  |      |
  |      |    +--> Read disk state [lines 136-147]  (SKIPPED)
  |      |    +--> Migration check [lines 149-152]  (SKIPPED)
  |      |    +--> Version comparison [lines 154-165] (SKIPPED)
  |      |
  |      +--> Returns null (allow) without any disk comparison
  |
  +--> checkPhaseFieldProtection() [line 362] -- runs normally
  |
  +--> V1-V3 content validation [lines 367+] -- runs normally
  |
  +--> Return result (write allowed, version lock bypassed)
```

**Critical Gap in the Guard Sequence**:

The function has three sequential guards:
1. Lines 131-133: "Incoming has no version" -> allow (BUGGY: should check disk first)
2. Lines 149-152: "Disk has no version" -> allow (CORRECT: genuine migration)
3. Lines 154-165: "Incoming < disk" -> block (CORRECT: stale write prevention)

The problem is guard #1 exits before guard #2 or #3 can run. The intended design was backward compatibility for projects that never adopted state_version. But the guard fails to distinguish between:
- **Legitimate case**: Both incoming AND disk lack state_version (legacy project)
- **Bypass case**: Incoming lacks state_version BUT disk has one (regression/clobbering)

---

## Root Cause Analysis

### Bug 0.9: Root Cause

**Root Cause**: Line 497 of `gate-blocker.cjs` discards variant information when building the missing artifacts list.

```javascript
// Line 497 (current - buggy):
missingArtifacts.push(dirPaths[0]); // Only pushes first variant
```

**Why It Exists**: The original implementation likely assumed a simple path-per-requirement model. When variant support was added (grouping by directory), the "report missing" code was not updated to reflect that a group can have multiple acceptable alternatives.

**Hypothesis Ranking**:
1. **[HIGH CONFIDENCE] Array index oversight**: Developer grouped paths by directory to enable OR-semantics for existence checking, but forgot to update the error reporting to include all variants. Evidence: The `anyExists` check correctly uses `dirPaths.some()` (treating all paths as alternatives), but the reporting uses `dirPaths[0]` (treating only the first as relevant).
2. **[LOW CONFIDENCE] Intentional simplification**: The developer may have deliberately chosen to show only one variant to avoid overly complex error messages. Counter-evidence: The code comment on line 485-486 explicitly says "group by directory and check if ANY variant exists", implying awareness of the variant concept.

**Suggested Fix**:

```javascript
// Option A: Composite string representation
if (!anyExists) {
    if (dirPaths.length === 1) {
        missingArtifacts.push(dirPaths[0]);
    } else {
        // Show all variants: "interface-spec.yaml (or interface-spec.md)"
        const basePath = dirPaths[0];
        const altNames = dirPaths.slice(1).map(p => path.basename(p));
        missingArtifacts.push(`${basePath} (or ${altNames.join(', ')})`);
    }
}
```

**Affected Return Fields**:
- `reason` string (line 504): Will now include variant alternatives
- `missing_artifacts` array (line 506): Will contain composite representations
- Downstream consumers: `stopReason` in gate block (line 754), `pending_escalations` (line 768)

**Complexity**: Low. Single-point change at line 497. No structural refactoring needed.

---

### Bug 0.10: Root Cause

**Root Cause**: Lines 131-133 of `state-write-validator.cjs` exit the version check early without consulting the disk state when the incoming write lacks a `state_version` field.

```javascript
// Lines 131-133 (current - buggy):
if (incomingVersion === undefined || incomingVersion === null) {
    return null;  // Allows write regardless of disk state
}
```

**Why It Exists**: This guard was added as part of BUG-0009 (V7 optimistic locking) for backward compatibility. The intent was: "If the incoming state does not use versioning, do not enforce version checks." However, it failed to account for the scenario where the disk state HAS already adopted versioning -- meaning the project is no longer in legacy mode, and unversioned writes should be rejected.

**Hypothesis Ranking**:
1. **[HIGH CONFIDENCE] Incomplete backward-compat guard**: The developer correctly identified that legacy unversioned projects should not be blocked by V7, but implemented the check as a one-sided test (only checking incoming) instead of a two-sided test (checking both incoming AND disk). Evidence: The migration case at lines 149-152 correctly handles the inverse scenario (versioned incoming + unversioned disk), suggesting the developer understood the need for both sides but missed the symmetric case in the earlier guard.
2. **[MEDIUM CONFIDENCE] Performance optimization gone wrong**: The early return may have been placed before the disk read (lines 136-147) to avoid unnecessary I/O for unversioned states. The optimization is correct in principle but creates a security gap. Evidence: The comment says "Backward compat" not "Performance".

**Suggested Fix**:

```javascript
const incomingVersion = incomingState.state_version;

// If incoming has no state_version, check if disk is versioned
if (incomingVersion === undefined || incomingVersion === null) {
    // Read disk to determine if versioning is in use
    try {
        if (!fs.existsSync(filePath)) {
            return null; // No disk file -- allow (first write)
        }
        const diskContent = fs.readFileSync(filePath, 'utf8');
        const diskState = JSON.parse(diskContent);
        const diskVersion = diskState.state_version;

        if (diskVersion !== undefined && diskVersion !== null) {
            // Disk is versioned but incoming is not -- block
            const reason = `State version missing: disk has state_version ${diskVersion} but incoming write has no state_version. Include state_version >= ${diskVersion} in your write.`;
            console.error(`[state-write-validator] V7 BLOCK: ${reason}`);
            logHookEvent('state-write-validator', 'block', {
                reason: `V7: incoming has no state_version, disk has ${diskVersion}`
            });
            return {
                decision: 'block',
                stopReason: reason
            };
        }
        // Both unversioned -- allow (legacy project)
        return null;
    } catch (e) {
        // Fail-open on disk read error
        return null;
    }
}
```

**Test Impact**:
- T19 (`allows write when incoming state_version is missing`): Currently passes with buggy behavior. Must be updated to expect BLOCK when disk has `state_version: 5`.
- T20 (`allows write when incoming state_version is null`): Same -- must be updated to expect BLOCK.
- T28 (`allows when both disk and incoming lack state_version`): Already covers the legitimate legacy case. Should continue to pass.
- New tests needed: Unversioned incoming + versioned disk = BLOCK; Unversioned incoming + unversioned disk = ALLOW; Unversioned incoming + no disk file = ALLOW.

**Complexity**: Low-Medium. The fix requires reordering the guard logic so disk state is read before making the allow/block decision for unversioned incoming writes. The disk I/O code already exists at lines 136-147 and can be factored to avoid duplication.

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-15T15:00:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "bugs_traced": 2,
  "bug_0_9": {
    "file": "src/claude/hooks/gate-blocker.cjs",
    "function": "checkArtifactPresenceRequirement",
    "root_cause_line": 497,
    "root_cause_type": "reporting_defect",
    "confidence": "high",
    "complexity": "low",
    "affected_lines": "486-507"
  },
  "bug_0_10": {
    "file": "src/claude/hooks/state-write-validator.cjs",
    "function": "checkVersionLock",
    "root_cause_line": "131-133",
    "root_cause_type": "security_bypass",
    "confidence": "high",
    "complexity": "low-medium",
    "affected_lines": "128-152",
    "test_impact": ["T19", "T20"]
  },
  "error_keywords": ["missingArtifacts", "dirPaths[0]", "state_version", "backward compat", "incomingVersion", "checkVersionLock", "checkArtifactPresenceRequirement"]
}
```
