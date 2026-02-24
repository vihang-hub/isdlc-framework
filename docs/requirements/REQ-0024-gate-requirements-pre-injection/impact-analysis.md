# Impact Analysis: Gate Requirements Pre-Injection

**Generated**: 2026-02-18
**Feature**: REQ-0024 -- Inject gate pass criteria into phase agent delegation prompts so agents know what hooks will check before they start
**Based On**: Phase 01 Requirements (requirements-spec.md)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Inject gate pass criteria into delegation prompts | Utility function reading iteration-requirements.json, artifact-paths.json, constitution.md, and workflows.json; formatted GATE REQUIREMENTS block; integration into STEP 3d |
| Keywords | gate, injection, delegation, prompt | gate-requirements-injector, iteration-requirements, artifact-paths, constitution, workflows, template-resolution, fail-open, CJS |
| Estimated Files | ~3 (create + modify) | 3 affected (1 CREATE new utility, 1 CREATE test, 1 MODIFY isdlc.md) + 5 READ-only data sources |
| Scope Change | - | Refined (same intent, fully specified FRs and NFRs) |

---

## Executive Summary

This feature creates a new CJS utility module (`gate-requirements-injector.cjs`) in `src/claude/hooks/lib/` that reads from four existing configuration data sources (iteration-requirements.json, artifact-paths.json, constitution.md, workflows.json) and produces a formatted text block. This block is then appended to the delegation prompt in STEP 3d of `isdlc.md`. The blast radius is LOW -- only one existing file is modified (isdlc.md), with a small additive change. The new utility is a pure read-only consumer of existing configs, reusing loading patterns already established in gate-blocker.cjs and common.cjs. Risk is LOW due to the fail-open design (NFR-01), additive-only integration (NFR-04), and no changes to enforcement hooks.

**Blast Radius**: LOW (1 existing file modified, 2 new files created)
**Risk Level**: LOW (fail-open, additive-only, no hook enforcement changes)
**Affected Files**: 8 total (2 CREATE, 1 MODIFY, 5 READ-only data sources)
**Affected Modules**: hooks/lib (new file), commands (STEP 3d modification)

---

## Impact Analysis

### M1: File-Level Impact Assessment

#### Files Directly Affected

| # | File Path | Change Type | Rationale |
|---|-----------|-------------|-----------|
| 1 | `src/claude/hooks/lib/gate-requirements-injector.cjs` | CREATE | New utility module implementing FR-01 through FR-05 |
| 2 | `src/claude/hooks/tests/gate-requirements-injector.test.cjs` | CREATE | Unit tests for all FRs, ACs, and NFRs |
| 3 | `src/claude/commands/isdlc.md` | MODIFY | STEP 3d: append GATE REQUIREMENTS injection block (FR-06) |

#### Data Source Files (READ-only, not modified)

| # | File Path | Change Type | How It Is Used |
|---|-----------|-------------|----------------|
| 4 | `src/claude/hooks/config/iteration-requirements.json` | READ | Per-phase requirements: test_iteration, constitutional_validation, artifact_validation, interactive_elicitation, atdd_validation, agent_delegation_validation (FR-01) |
| 5 | `src/claude/hooks/config/artifact-paths.json` | READ | Required artifact file paths per phase with `{artifact_folder}` template variables (FR-01, FR-02) |
| 6 | `docs/isdlc/constitution.md` | READ | Article headers for ID-to-title mapping (FR-03) |
| 7 | `.isdlc/config/workflows.json` | READ | Workflow-specific agent_modifiers per phase (FR-04) |
| 8 | `src/claude/hooks/gate-blocker.cjs` | READ (reference) | Source of truth for how configs are read at enforcement time; new utility must match these patterns (NFR-03) |

#### Outward Dependencies (What depends on changed files)

**`src/claude/commands/isdlc.md`** (MODIFY):
- This is the phase-loop controller. All 18 phase agents receive their delegation prompt from STEP 3d. The change is additive (appending a new block) so all existing consumers continue to work.
- Risk: If the GATE REQUIREMENTS block contains malformed text, agents may misinterpret instructions. Mitigated by: fail-open returns empty string on error (NFR-01).

**`src/claude/hooks/lib/gate-requirements-injector.cjs`** (CREATE):
- Initially consumed only by the isdlc.md STEP 3d logic (which is a markdown instruction, not a code import).
- In the future, other hooks/lib modules could import it, but no current consumer exists.

#### Inward Dependencies (What changed files depend on)

**`gate-requirements-injector.cjs`** depends on:
1. `fs` (Node.js built-in) -- for `readFileSync`, `existsSync`
2. `path` (Node.js built-in) -- for `path.join`
3. `src/claude/hooks/lib/common.cjs` -- for `getProjectRoot()` (project root resolution)
4. Configuration file schemas:
   - `iteration-requirements.json` schema v2.1.0 (ASM-001)
   - `artifact-paths.json` schema v1.0.0 (ASM-002)
   - `constitution.md` header format `### Article {ID}: {Title}` (ASM-003)
   - `workflows.json` schema v1.0.0 (ASM-005)

#### Change Propagation Paths

```
gate-requirements-injector.cjs (NEW)
  |-- reads --> iteration-requirements.json (UNCHANGED)
  |-- reads --> artifact-paths.json (UNCHANGED)
  |-- reads --> constitution.md (UNCHANGED)
  |-- reads --> workflows.json (UNCHANGED)
  |-- uses --> common.cjs::getProjectRoot() (UNCHANGED)
  |
  v
isdlc.md STEP 3d (MODIFIED)
  |-- constructs delegation prompt --> phase agents (18 agents, UNCHANGED)
  |-- appends GATE REQUIREMENTS block --> delegation prompt
  |
  v
Phase agents (UNCHANGED -- agents read the block as natural language context)
```

The propagation terminates at the phase agents. No hooks are modified. No enforcement behavior changes.

### Modules Affected

| Module | Impact Level | Details |
|--------|-------------|---------|
| `hooks/lib/` | LOW (new file added) | One new `.cjs` file; no changes to existing `common.cjs`, `provider-utils.cjs`, `three-verb-utils.cjs`, or `blast-radius-step3f-helpers.cjs` |
| `hooks/tests/` | LOW (new test file) | One new `.test.cjs` file; no changes to existing test files |
| `commands/` | LOW (STEP 3d modification) | Small additive block in isdlc.md; no structural changes to STEP 3a-3c, 3e |
| `hooks/*.cjs` (enforcement) | NONE | gate-blocker.cjs, iteration-corridor.cjs, constitution-validator.cjs, test-watcher.cjs are NOT modified |

---

## Entry Points

### M2: Entry Point Analysis

#### Existing Entry Points (Relevant to This Feature)

| # | Entry Point | File | How It Relates |
|---|------------|------|----------------|
| 1 | STEP 3d delegation | `src/claude/commands/isdlc.md` (line ~1042) | Integration point where GATE REQUIREMENTS block is injected. This is the primary modification point. |
| 2 | `gate-blocker.cjs::check()` | `src/claude/hooks/gate-blocker.cjs` (line 583) | Reference implementation for how configs are read. The new utility must match the config-loading patterns used here. NOT modified, but serves as the source-of-truth reference. |
| 3 | `common.cjs::loadIterationRequirements()` | `src/claude/hooks/lib/common.cjs` (line 2549) | Existing config loader that reads iteration-requirements.json. The new utility should reuse this pattern (or import it directly). |
| 4 | `common.cjs::loadWorkflowDefinitions()` | `src/claude/hooks/lib/common.cjs` (line 2574) | Existing config loader that reads workflows.json. The new utility should reuse this pattern. |
| 5 | `gate-blocker.cjs::loadArtifactPaths()` | `src/claude/hooks/gate-blocker.cjs` (line 444) | Existing config loader that reads artifact-paths.json. The new utility should replicate this pattern. |
| 6 | `gate-blocker.cjs::resolveArtifactPaths()` | `src/claude/hooks/gate-blocker.cjs` (line 492) | Existing template variable resolution for `{artifact_folder}`. The new utility must match this behavior (FR-02). |
| 7 | `gate-blocker.cjs::mergeRequirements()` | `src/claude/hooks/gate-blocker.cjs` (line 81) | Deep merge for workflow-specific overrides. The new utility should include override context (FR-04). |

#### New Entry Points to Create

| # | Entry Point | File | Purpose |
|---|------------|------|---------|
| 1 | `getGateRequirementsBlock(phaseKey, artifactFolder, workflowType, projectRoot)` | `src/claude/hooks/lib/gate-requirements-injector.cjs` | Main exported function. Returns a formatted string or empty string on error. |
| 2 | `mapArticleIdsToTitles(articleIds, projectRoot)` | `src/claude/hooks/lib/gate-requirements-injector.cjs` | Internal helper. Reads constitution.md and maps Roman numeral IDs to titles. |
| 3 | `resolveArtifactPaths(paths, artifactFolder)` | `src/claude/hooks/lib/gate-requirements-injector.cjs` | Internal helper. Substitutes `{artifact_folder}` in path templates. |
| 4 | `formatGateBlock(config)` | `src/claude/hooks/lib/gate-requirements-injector.cjs` | Internal helper. Produces the formatted GATE REQUIREMENTS text block. |

#### Implementation Chain (Entry to Data Layer)

```
isdlc.md STEP 3d (caller)
  |
  |-- calls --> getGateRequirementsBlock(phaseKey, artifactFolder, workflowType)
       |
       |-- reads --> iteration-requirements.json via common.cjs::loadIterationRequirements()
       |             or direct fs.readFileSync (matching gate-blocker pattern)
       |
       |-- reads --> artifact-paths.json via direct fs.readFileSync
       |             (matching gate-blocker.cjs::loadArtifactPaths() pattern)
       |
       |-- reads --> constitution.md via fs.readFileSync + regex parsing
       |             (new; not done by any existing hook at load time)
       |
       |-- reads --> workflows.json via common.cjs::loadWorkflowDefinitions()
       |             or direct fs.readFileSync
       |
       |-- calls --> resolveArtifactPaths() -- substitutes {artifact_folder}
       |-- calls --> mapArticleIdsToTitles() -- regex-parses constitution headers
       |-- calls --> formatGateBlock() -- assembles text output
       |
       v
       Returns: formatted string (or "" on any error)
```

#### Recommended Implementation Order

1. **gate-requirements-injector.cjs** -- Implement the utility module first:
   - Start with config loading functions (reuse patterns from gate-blocker.cjs and common.cjs)
   - Implement `{artifact_folder}` template resolution (FR-02)
   - Implement constitution article ID-to-title mapping (FR-03)
   - Implement workflow override reading (FR-04)
   - Implement formatted block assembly (FR-05)
   - Wrap everything in try/catch with empty string return (NFR-01)

2. **gate-requirements-injector.test.cjs** -- Write tests alongside or immediately after:
   - Test each FR's acceptance criteria
   - Test all fail-open error scenarios (NFR-01)
   - Test template resolution edge cases (FR-02)
   - Test missing/malformed config files

3. **isdlc.md STEP 3d** -- Integration (last):
   - Add a new injection block after existing blocks and before `Validate GATE-{NN} on completion.`
   - Follow the same fail-open pattern as external skill injection
   - Instruction: "Read gate requirements for the current phase using gate-requirements-injector.cjs. If the result is non-empty, append it to the delegation prompt."

---

## Risk Assessment

### M3: Risk Analysis

#### Test Coverage Assessment

| File/Module | Current Coverage | Risk |
|-------------|-----------------|------|
| `gate-requirements-injector.cjs` | N/A (new file) | LOW -- will be created with full test coverage per requirements |
| `gate-requirements-injector.test.cjs` | N/A (new file) | N/A |
| `isdlc.md` | No unit tests (markdown command) | MEDIUM -- STEP 3d is tested indirectly through `phase-loop-controller.test.cjs` and `isdlc-step3-ordering.test.cjs` |
| `gate-blocker.cjs` | HIGH (test-gate-blocker-extended.test.cjs, 26 tests) | NONE -- not modified |
| `common.cjs` | HIGH (common.test.cjs, test-common.test.cjs, 61+ tests) | NONE -- not modified |
| `iteration-requirements.json` | HIGH (artifact-path-consistency.test.cjs, multiple hook tests) | NONE -- not modified |
| `artifact-paths.json` | HIGH (artifact-paths-config-fix.test.cjs) | NONE -- not modified |

#### Complexity Hotspots

| Area | Complexity | Concern |
|------|-----------|---------|
| Constitution article parsing | LOW | Simple regex on `### Article {ID}: {Title}` headers. 14 articles. Well-defined format. |
| Template variable resolution | LOW | Single variable (`{artifact_folder}`), simple string replace. Matches existing `resolveArtifactPaths()` in gate-blocker.cjs. |
| Config loading and path resolution | LOW | Reuses established patterns from common.cjs and gate-blocker.cjs. Two-path fallback (.claude/ then .isdlc/). |
| Workflow override merging | LOW-MEDIUM | Need to read workflows.json and extract agent_modifiers for the given phase. Not a deep merge -- just extract and include as context. |
| Formatted block assembly | LOW | String concatenation of structured sections. No complex logic. |
| STEP 3d integration | LOW | Additive markdown instruction. Same pattern as existing external skill injection block. |

#### Technical Debt Markers

| Marker | Location | Impact on This Feature |
|--------|----------|----------------------|
| `loadArtifactPaths()` duplicated in gate-blocker.cjs | `gate-blocker.cjs` lines 444-462 | The new utility will need to duplicate this pattern (or import from gate-blocker). Ideally, `loadArtifactPaths()` should be extracted to common.cjs, but that is out-of-scope for this feature. |
| `resolveArtifactPaths()` duplicated in gate-blocker.cjs | `gate-blocker.cjs` lines 492-508 | Same concern. The new utility will have its own simpler version (only `{artifact_folder}` substitution per FR-02, CON-005). |
| `mergeRequirements()` in gate-blocker.cjs | `gate-blocker.cjs` lines 81-96 | The new utility does NOT need deep merge -- it reads and includes overrides as supplementary context, not enforcement config. Low risk. |
| No centralized config loading API | Multiple hooks load configs independently | The new utility adds one more consumer of the same files. Long-term, a centralized config service would reduce duplication. |

#### Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Config file schema changes break the utility | LOW | LOW | Fail-open (NFR-01): returns empty string. Hooks remain as enforcement safety net. |
| Constitution header format changes | VERY LOW | LOW | Fallback to raw article IDs (AC-03-03, AC-03-04). |
| Large config files cause performance issues | VERY LOW | LOW | All config files are small (<1KB to ~20KB). Synchronous reads well under 100ms (NFR-02). |
| STEP 3d injection produces malformed prompt | LOW | LOW | Fail-open returns empty string. Agents fall back to discovering requirements via hook errors (status quo). |
| New utility introduces a require() cycle | VERY LOW | MEDIUM | The utility imports only `common.cjs::getProjectRoot()`. No circular dependency risk. |
| Test file naming collision | VERY LOW | LOW | No existing `gate-requirements-injector.test.cjs` in tests directory. |

#### Risk Recommendations

1. **Write tests first** for all acceptance criteria before implementing the utility. The test file structure should mirror existing patterns in `src/claude/hooks/tests/`.
2. **Reuse common.cjs** for `getProjectRoot()` and optionally `loadIterationRequirements()` / `loadWorkflowDefinitions()` to minimize duplication.
3. **Do NOT modify gate-blocker.cjs** or any enforcement hook. The utility is read-only and informational.
4. **Verify backward compatibility** by confirming that when the utility returns empty string, the delegation prompt is byte-identical to the current format.
5. **Add the test file to the CJS test run** (`npm run test:hooks`) to ensure it runs in CI.

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**:
   - (a) Create `gate-requirements-injector.cjs` with all FR implementations
   - (b) Create `gate-requirements-injector.test.cjs` with comprehensive tests
   - (c) Modify `isdlc.md` STEP 3d to add the injection instruction
   - (d) Sync `src/claude/` to `.claude/` (runtime copy)

2. **High-Risk Areas** (add tests first):
   - Constitution article parsing -- test with real constitution.md content and edge cases (missing file, unknown article IDs)
   - Template resolution -- test with `{artifact_folder}` and unrecognized variables
   - Error handling -- test every fail-open path (missing files, invalid JSON, empty files, missing fields)

3. **Dependencies to Resolve**:
   - Decide whether to import `loadIterationRequirements()` from common.cjs (preferred -- avoids duplication) or duplicate the pattern (simpler -- no cross-module coupling)
   - Decide whether to import `loadWorkflowDefinitions()` from common.cjs (preferred) or duplicate
   - `loadArtifactPaths()` is currently private to gate-blocker.cjs -- the new utility must either replicate the pattern or gate-blocker must export it (out of scope per constraints)

4. **Sizing Recommendation**:
   - **Files affected**: 3 (1 modify, 2 create)
   - **Estimated lines of code**: ~200-300 (utility) + ~300-400 (tests) + ~15 (isdlc.md)
   - **Complexity**: LOW -- pattern reuse, no architectural changes
   - **Sizing**: LIGHT to STANDARD (well under the 5-file light threshold, but has enough FRs/ACs to justify standard test coverage)

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-18",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0024-gate-requirements-pre-injection/requirements-spec.md",
  "scope_change_from_original": "refined",
  "blast_radius": "low",
  "risk_level": "low",
  "files_affected": {
    "create": [
      "src/claude/hooks/lib/gate-requirements-injector.cjs",
      "src/claude/hooks/tests/gate-requirements-injector.test.cjs"
    ],
    "modify": [
      "src/claude/commands/isdlc.md"
    ],
    "read_only": [
      "src/claude/hooks/config/iteration-requirements.json",
      "src/claude/hooks/config/artifact-paths.json",
      "docs/isdlc/constitution.md",
      ".isdlc/config/workflows.json",
      "src/claude/hooks/gate-blocker.cjs"
    ]
  },
  "modules_affected": ["hooks/lib", "hooks/tests", "commands"],
  "modules_unchanged": ["hooks (enforcement)", "agents", "skills", "lib (ESM)"],
  "sizing_recommendation": "standard",
  "estimated_loc": "500-700 total (utility + tests + integration)"
}
```
