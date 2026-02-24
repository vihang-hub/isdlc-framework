# Architecture Overview: Build Consumption -- Init Split & Smart Staleness

**Feature**: GH-60 + GH-61 (Feature B: Build Consumption)
**Artifact Folder**: gh-60-61-build-consumption-init-split-smart-staleness
**Phase**: 03-architecture
**Status**: Draft
**Created**: 2026-02-20

---

## 1. Executive Summary

This document describes the architectural changes required to decouple workflow initialization from first-phase execution (GH-60) and replace naive hash-based staleness detection with a blast-radius-aware algorithm (GH-61). Both changes are internal refactors to the iSDLC orchestration pipeline -- no new technologies are introduced, no external interfaces change, and the existing schema remains stable.

The changes touch three modules within the existing architecture: the command handler (`isdlc.md`), the orchestrator agent (`00-sdlc-orchestrator.md`), and the three-verb utility library (`three-verb-utils.cjs`). The overall architecture pattern remains unchanged (agent-based pipeline with phase-gate advancement).

---

## 2. System Context (C4 Level 1)

No changes to the system context. The iSDLC framework continues to operate as a CLI-embedded agent system within Claude Code. External boundaries remain identical:

- **User** interacts via natural language or slash commands
- **Claude Code** executes the framework
- **Git** provides version control and commit history (used by staleness check)
- **File System** holds state.json, meta.json, BACKLOG.md, and analysis artifacts

The only new interaction is that the staleness check now reads `impact-analysis.md` from the artifact folder and invokes `git diff --name-only` against the repository -- both are existing system boundaries already used by other framework components (blast-radius-validator uses the same impact-analysis.md table; the orchestrator already runs git commands for branching).

---

## 3. Container Diagram (C4 Level 2)

### 3.1 Affected Containers

```
+-------------------------------------------------------------------+
|                     isdlc.md (Command Handler)                     |
|                                                                    |
|  +-----------+  +------------------+  +------------------------+   |
|  | Build     |  | Phase-Loop       |  | Staleness Handler      |   |
|  | Handler   |  | Controller       |  | (Steps 4b-4c)          |   |
|  | (Steps    |  | (STEP 3)         |  |                        |   |
|  |  1-9)     |  |                  |  | NEW: Tiered UX         |   |
|  |           |  | CHANGED: Now     |  | (none/info/warning)    |   |
|  |           |  | handles Phase 01 |  +----------+-------------+   |
|  +-----------+  +--------+---------+             |                 |
|       |                  |                       |                 |
+-------------------------------------------------------------------+
        |                  |                       |
        v                  |                       v
+-------------------+      |          +-----------------------------+
| 00-sdlc-          |      |          | three-verb-utils.cjs        |
| orchestrator.md   |      |          |                             |
|                   |      |          | EXISTING:                   |
| EXISTING:         |      |          |   checkStaleness()          |
|   init-and-       |      |          |   computeStartPhase()       |
|   phase-01        |      |          |                             |
|   (deprecated)    |      |          | NEW:                        |
|                   |      |          |   extractFilesFrom-         |
| NEW:              |      |          |     ImpactAnalysis()        |
|   init-only       |      |          |   checkBlastRadius-         |
|   (returns JSON,  |      |          |     Staleness()             |
|    no phase exec) |      |          +-----------------------------+
+-------------------+      |                       |
                           |                       v
                           |          +-----------------------------+
                           +--------->| Phase Agents (01 thru 08)   |
                                      | (No changes)                |
                                      +-----------------------------+
```

### 3.2 Data Flow Changes

**Before (current):**
```
isdlc.md STEP 1 --[MODE: init-and-phase-01]--> orchestrator
                                                    |
                                                    +--> init workflow
                                                    +--> run Phase 01
                                                    +--> validate GATE-01
                                                    +--> generate plan
                                                    +--> return { next_phase_index: 1 }
isdlc.md STEP 2 --> create tasks, mark Phase 01 as completed
isdlc.md STEP 3 --> loop from index 1 onward
```

**After (proposed):**
```
isdlc.md STEP 1 --[MODE: init-only]--> orchestrator
                                            |
                                            +--> init workflow
                                            +--> create branch
                                            +--> return { status: "init_complete",
                                                          next_phase_index: 0 }
isdlc.md STEP 2 --> create tasks (ALL phases, none pre-marked)
isdlc.md STEP 3 --> loop from index 0 (Phase 01 is first iteration)
```

---

## 4. Architecture Pattern

**Pattern**: No change. The existing Agent Pipeline with Phase-Gate Advancement pattern is preserved. The modification simplifies the pipeline by removing the special-case coupling between initialization and first-phase execution.

**Rationale**: The current architecture already has the Phase-Loop Controller handling phases 02+ uniformly. GH-60 extends this uniformity to Phase 01, eliminating a dual-path execution model. This is a simplification, not a pattern change.

---

## 5. Key Architectural Decisions

### 5.1 MODE: init-only -- Orchestrator Returns Control Before Phase Execution

**Decision**: Add a new `MODE: init-only` to the orchestrator that performs all initialization (state.json setup, branch creation, counter increment, meta.json update, supervised mode flag) but does NOT delegate to any phase agent. After initialization, it returns a JSON result with `next_phase_index: 0` to indicate no phases have been executed.

**Return format**:
```json
{
  "status": "init_complete",
  "phases": ["01-requirements", "02-impact-analysis", ...],
  "artifact_folder": "REQ-0001-feature-name",
  "workflow_type": "feature",
  "next_phase_index": 0
}
```

**Rationale**: Decoupling init from phase execution means the Phase-Loop Controller is the single execution path for all phases. This eliminates the dual-path architecture where Phase 01 was executed inside the orchestrator while phases 02+ were executed by the Phase-Loop Controller.

**Traces**: FR-001, FR-007, NFR-005

### 5.2 init-and-phase-01 Deprecation -- Preserve for Backward Compatibility

**Decision**: Keep `MODE: init-and-phase-01` fully functional. Mark it as deprecated in the orchestrator's mode table. Emit a deprecation notice to stderr when invoked. The primary call path in isdlc.md STEP 1 switches to `MODE: init-only`.

**Rationale**: CON-001 requires backward compatibility for in-flight workflows and any external references. Hard removal risks breaking workflows that may have been started under the old mode.

**Traces**: FR-003, NFR-001, CON-001

### 5.3 Blast-Radius Staleness -- Intersection Algorithm

**Decision**: When `meta.codebase_hash` differs from current HEAD, determine which files changed using `git diff --name-only {originalHash}..HEAD`, then intersect with the "Directly Affected Files" list from `impact-analysis.md`. The severity is determined by overlap count:

| Overlap Count | Severity | UX Behavior |
|---------------|----------|-------------|
| 0 | `none` | Silent proceed, no user interaction |
| 1-3 | `info` | Informational note listing overlapping files, no menu |
| 4+ | `warning` | Full warning menu with [P] Proceed / [Q] Re-scan / [A] Re-analyze |

**Rationale**: The naive hash comparison produces false positives on every unrelated commit. The blast-radius intersection targets only changes that could actually invalidate the analysis. The three-tier UX reduces friction for benign changes while preserving warnings for significant overlap.

**Traces**: FR-004, FR-006, NFR-002

### 5.4 extractFilesFromImpactAnalysis() -- Location in three-verb-utils.cjs

**Decision**: Place `extractFilesFromImpactAnalysis(mdContent)` in `three-verb-utils.cjs` alongside the existing `checkStaleness()` function. Do NOT place it in `common.cjs` or create a new module.

**Rationale**:
1. **Cohesion**: The function is consumed exclusively by the staleness check flow, which already lives in `three-verb-utils.cjs`. Placing it next to `checkStaleness()` keeps related logic together.
2. **Existing precedent**: `three-verb-utils.cjs` already exports pure utility functions (`computeStartPhase`, `checkStaleness`, `generateSlug`) that serve the build handler. This is the natural home.
3. **Why NOT common.cjs**: `common.cjs` contains hook infrastructure (state management, project root resolution, logging). The `extractFilesFromImpactAnalysis` function has no hook dependencies -- it is a pure markdown parser.
4. **Why NOT a new module**: Adding a module for two functions increases import complexity and test file sprawl. The existing module is under 1100 lines with clear section headers. Two more functions (~80 lines total) are well within maintainability bounds.
5. **Consistency with blast-radius-validator.cjs**: The existing `parseImpactAnalysis()` in blast-radius-validator parses the same table but returns `{ filePath, changeType }` pairs for coverage validation. The new `extractFilesFromImpactAnalysis()` returns only file paths (array of strings) for intersection matching. These are distinct purposes. Cross-referencing the regex pattern from blast-radius-validator ensures parsing consistency without coupling the modules.

**Traces**: FR-005, NFR-004

### 5.5 Graceful Degradation -- Fail-Open on Missing Data

**Decision**: When `impact-analysis.md` is missing, unparseable, or `git diff` fails, fall back to the existing naive hash comparison behavior from `checkStaleness()`. Never block the build due to staleness infrastructure failures.

**Degradation chain**:
```
1. impact-analysis.md missing?           --> fallback to checkStaleness()
2. impact-analysis.md has no table?      --> extractFilesFromImpactAnalysis() returns []
                                             --> fallback to checkStaleness()
3. git diff --name-only fails?           --> fallback to checkStaleness()
4. git not available?                    --> skip staleness entirely (existing behavior)
```

**Rationale**: Article X (Fail-Safe Defaults) requires fail-open for non-security infrastructure. The staleness check is an informational quality guard, not a security boundary. Blocking a build because the staleness check itself failed would violate the principle of fail-safe defaults.

**Traces**: FR-004 (AC-004-05, AC-004-06), NFR-003, CON-004

### 5.6 Phase-Loop Controller -- Phase 01 Handling

**Decision**: The Phase-Loop Controller handles Phase 01 identically to all other phases via the existing STEP 3 protocol (3a through 3f). The only change in STEP 2 is removing the "Mark Phase 01's task as completed" logic.

**Rationale**: Phase 01 already uses `MODE: single-phase` delegation when called by the orchestrator. The Phase-Loop Controller's STEP 3d already has `01-requirements` in its PHASE->AGENT table. No special-case logic is needed. The existing STEP 2 line that pre-marks Phase 01 as completed is the only code that assumes Phase 01 ran during init.

**Traces**: FR-002, NFR-005, ASM-001

---

## 6. Component Responsibilities

### 6.1 Orchestrator (00-sdlc-orchestrator.md)

| Responsibility | Before | After |
|---------------|--------|-------|
| `init-and-phase-01` | Init + Phase 01 + GATE-01 + plan | Unchanged (deprecated, functional) |
| `init-only` | N/A | Init only, return JSON with next_phase_index: 0 |
| `single-phase` | Run one phase + gate | Unchanged |
| `finalize` | Merge + cleanup | Unchanged |
| Deprecation notice | N/A | Emit stderr warning when init-and-phase-01 is used |

### 6.2 Phase-Loop Controller (isdlc.md STEP 3)

| Responsibility | Before | After |
|---------------|--------|-------|
| Execute phases | From index 1 (Phase 01 already done) | From index 0 (all phases) |
| STEP 2 task creation | Pre-mark Phase 01 as completed | All tasks start as pending |
| Phase delegation | 3a-3f for phases 02+ | 3a-3f for ALL phases (including 01) |

### 6.3 three-verb-utils.cjs

| Function | Status | Description |
|----------|--------|-------------|
| `checkStaleness()` | PRESERVED | Naive hash comparison -- backward compat |
| `extractFilesFromImpactAnalysis()` | NEW | Pure function: parse impact-analysis.md table, return file paths |
| `checkBlastRadiusStaleness()` | NEW | Enhanced staleness: intersect changed files with blast radius, return tiered severity |

### 6.4 isdlc.md Steps 4b-4c (Staleness Handler)

| Responsibility | Before | After |
|---------------|--------|-------|
| Step 4b | Call checkStaleness() | Read impact-analysis.md, call checkBlastRadiusStaleness() (fallback to checkStaleness()) |
| Step 4c | Single-tier warning menu | Three-tier UX: none (silent), info (note), warning (menu) |

---

## 7. New Function Signatures

### 7.1 extractFilesFromImpactAnalysis(mdContent)

```javascript
/**
 * Parses the "Directly Affected Files" table from impact-analysis.md
 * and returns a normalized array of file paths.
 *
 * @param {string|null|undefined} mdContent - Raw markdown content
 * @returns {string[]} Array of relative file paths (empty on error/no table)
 */
function extractFilesFromImpactAnalysis(mdContent) { ... }
```

**Parsing strategy**:
- Scan for lines matching backtick-wrapped file paths in a markdown table: ``/^\|\s*`([^`]+)`\s*\|/``
- Only extract from the "Directly Affected Files" section (detect section header, stop at next `###` or end of file)
- Normalize paths: strip leading `./` or `/`
- Deduplicate
- Return empty array on null/undefined/empty input or no recognizable table

**Regex compatibility note**: The blast-radius-validator uses ``/^\|\s*`([^`]+)`\s*\|\s*(CREATE|MODIFY|DELETE|NO CHANGE)\s*\|/`` which requires a change type column. The new extractor uses a simpler pattern that only requires the file path column, making it resilient to table format variations where the change type column may be named differently or have different values.

### 7.2 checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles)

```javascript
/**
 * Blast-radius-aware staleness check.
 *
 * @param {object|null} meta - Parsed meta.json
 * @param {string} currentHash - Current git short hash
 * @param {string|null} impactAnalysisContent - Raw impact-analysis.md content (null triggers fallback)
 * @param {string[]|null} changedFiles - Pre-computed changed files (null = compute internally via git)
 *   Accepts pre-computed list for testability (NFR-004).
 * @returns {{
 *   stale: boolean,
 *   severity: 'none'|'info'|'warning'|'fallback',
 *   overlappingFiles: string[],
 *   changedFileCount: number,
 *   blastRadiusFileCount: number,
 *   originalHash: string|null,
 *   currentHash: string,
 *   fallbackReason: string|null
 * }}
 */
function checkBlastRadiusStaleness(meta, currentHash, impactAnalysisContent, changedFiles) { ... }
```

**Testability design (NFR-004)**: The `changedFiles` parameter allows injection of a pre-computed file list, eliminating the need to mock git in unit tests. When `changedFiles` is null, the function executes `git diff --name-only {originalHash}..HEAD` internally. When provided (e.g., in tests), it uses the injected list.

**Fallback behavior**:
- If `impactAnalysisContent` is null/empty: return `{ stale: true, severity: 'fallback', fallbackReason: 'no-impact-analysis' }` (caller uses naive check)
- If `extractFilesFromImpactAnalysis()` returns empty: return `{ stale: true, severity: 'fallback', fallbackReason: 'no-parseable-table' }`
- If `changedFiles` is null and git fails: return `{ stale: true, severity: 'fallback', fallbackReason: 'git-diff-failed' }`

---

## 8. Staleness Check Flow -- Sequence Diagram

```
isdlc.md (Step 4b)              three-verb-utils.cjs              Git             File System
     |                                   |                          |                   |
     |--- read impact-analysis.md ------------------------------------------------->|
     |<-- content (or null) ----------------------------------------------------|
     |                                   |                          |                   |
     |--- checkBlastRadiusStaleness(meta, hash, content, null) -->|                   |
     |                                   |                          |                   |
     |                          [if content is null]                |                   |
     |                          return { severity: 'fallback' }     |                   |
     |                                   |                          |                   |
     |                          [if content present]                |                   |
     |                          extractFilesFromImpactAnalysis() -->|                   |
     |                          blastRadiusFiles = [...]            |                   |
     |                                   |                          |                   |
     |                          [if blastRadiusFiles empty]         |                   |
     |                          return { severity: 'fallback' }     |                   |
     |                                   |                          |                   |
     |                          [if blastRadiusFiles non-empty]     |                   |
     |                          git diff --name-only ------------->|                   |
     |                          changedFiles = [...]   <-----------|                   |
     |                                   |                          |                   |
     |                          [if git fails]                      |                   |
     |                          return { severity: 'fallback' }     |                   |
     |                                   |                          |                   |
     |                          overlap = intersect(changed, blast) |                   |
     |                          severity = tierFromOverlapCount()   |                   |
     |<-- { stale, severity, overlappingFiles, ... } --------------|                   |
     |                                                              |                   |
     |--- (Step 4c) apply tiered UX ----                            |                   |
     |    severity='none'  -> silent proceed                        |                   |
     |    severity='info'  -> note + proceed                        |                   |
     |    severity='warning'-> menu [P]/[Q]/[A]                     |                   |
     |    severity='fallback'-> naive menu (current behavior)       |                   |
```

---

## 9. init-only Mode -- Initialization Sequence

The `MODE: init-only` handler performs the following steps (a strict subset of `init-and-phase-01`):

```
1. Validate prerequisites (constitution exists, no active workflow)
2. Load workflow definition from workflows.json
3. Handle START_PHASE and ARTIFACT_FOLDER parameters (if present)
4. Reset phases for new workflow
5. Write active_workflow to state.json
6. Update top-level current_phase
7. Parse --supervised flag (if present)
8. Check requires_branch: if true, create branch (Section 3a)
9. Update meta.json with build tracking (REQ-0026)
10. Return JSON: { status: "init_complete", phases, artifact_folder,
                   workflow_type, next_phase_index: 0 }

OMITTED (compared to init-and-phase-01):
- Phase agent delegation
- Gate validation (GATE-01 or GATE-{START_PHASE})
- Plan generation (ORCH-012)
```

The plan generation step (3b) moves to after Phase 01 completion. The Phase-Loop Controller's STEP 3e (post-phase state update) already handles gate validation after each phase. Plan generation can be triggered by adding a post-GATE-01 check in the Phase-Loop Controller, or by deferring plan generation to the orchestrator's `single-phase` return handler. The simpler approach is: after the Phase-Loop Controller completes Phase 01 (when Phase 01 is the first phase), it checks whether a plan needs to be generated and delegates to the orchestrator with `MODE: single-phase` which already includes plan generation logic after GATE-01.

**Architectural note on plan generation**: The current `init-and-phase-01` mode generates the plan as its final step (Section 3b). With `init-only`, the plan must be generated after Phase 01 completes in the Phase-Loop Controller. Two options:

1. **Option A (Recommended)**: Add a plan-generation check in STEP 3e (post-phase state update). After Phase 01's gate passes and the Phase-Loop Controller updates state, it checks whether `tasks.md` exists. If not, it delegates to the orchestrator with a new `MODE: generate-plan` (or reuses the existing `single-phase` return path that triggers plan generation).

2. **Option B**: The Phase-Loop Controller generates the plan inline using the same logic as Section 3b (read Phase 01 artifacts, invoke ORCH-012 skill). This keeps plan generation in the foreground but adds Phase-01-specific logic to the otherwise uniform loop.

**Decision**: Option A is preferred because it maintains the Phase-Loop Controller's uniformity. The orchestrator already owns plan generation logic. However, Option B is acceptable if the implementation team prefers fewer inter-agent round-trips. This decision is deferred to the design phase (Phase 04) where the exact code changes are specified.

---

## 10. Backward Compatibility Analysis

| Component | Change | Backward Impact |
|-----------|--------|----------------|
| `MODE: init-and-phase-01` | Deprecated, not removed | Zero -- existing callers work unchanged |
| `checkStaleness()` | Preserved, not modified | Zero -- existing callers work unchanged |
| `isdlc.md STEP 1` | Changed from init-and-phase-01 to init-only | Internal only -- users never see MODE |
| `isdlc.md STEP 2` | Remove Phase 01 pre-mark | Phase 01 task now starts as pending (correct behavior) |
| `isdlc.md Steps 4b-4c` | Enhanced staleness check | Fallback to current behavior when impact-analysis.md missing |
| state.json schema | No changes | Zero -- no migration needed |
| meta.json schema | No changes | Zero -- no migration needed |

---

## 11. Risk Mitigation

### 11.1 isdlc.md is the Critical Execution Path

**Risk**: isdlc.md is ~1800 lines of dense orchestration logic. Any regression in STEP 1 or STEP 3 blocks all workflows.

**Mitigation**:
- Changes are in well-delimited sections (STEP 1 line ~1083, STEP 2 line ~1137, Steps 4b-4c lines ~671-709)
- Backward compatibility constraint (CON-001) means old mode remains functional
- Fallback to naive staleness on any error (NFR-003)
- The Phase-Loop Controller's STEP 3 protocol (3a-3f) is unchanged -- Phase 01 is simply the first iteration now

### 11.2 Plan Generation Timing

**Risk**: Moving plan generation out of init-and-phase-01 could delay or skip plan creation.

**Mitigation**: The plan is generated after GATE-01 passes, regardless of execution path. The Phase-Loop Controller's post-phase processing (STEP 3e) is the natural trigger point. If plan generation fails, it is non-blocking (the plan is informational, not a gate requirement).

### 11.3 Git History Availability

**Risk**: `git diff --name-only {hash}..HEAD` may fail if the original hash was garbage-collected after a force-push or shallow clone.

**Mitigation**: Fallback to naive hash comparison (FR-004 AC-004-06). The function catches git errors and returns `severity: 'fallback'` so the caller applies the existing warning behavior.

---

## 12. Scalability and Performance

### 12.1 Git Diff Performance (NFR-002)

`git diff --name-only` is a lightweight operation that returns only file paths, not content. For a repository with 500+ commits between hashes, it completes in well under 2 seconds (typically <100ms). The operation is O(n) in the number of changed files, not the number of commits.

### 12.2 Impact Analysis Parsing (NFR-002)

`extractFilesFromImpactAnalysis()` performs a single-pass line-by-line scan with regex matching. For a 50-file impact analysis table (~60 lines), parsing completes in under 1ms. The function allocates a single Set for deduplication and returns a flat array.

### 12.3 Intersection Computation

The overlap computation uses a Set-based intersection: build a Set from the blast radius files, iterate changed files, check membership. O(n + m) where n = blast radius size, m = changed file count. Negligible for any realistic input.

---

## 13. Testing Strategy

### 13.1 extractFilesFromImpactAnalysis() (Pure Function)

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| Standard table with backtick-wrapped paths | Markdown with 5 table rows | Array of 5 file paths |
| No "Directly Affected Files" section | Markdown with other tables | Empty array |
| Empty/null/undefined input | null | Empty array |
| Paths with leading `./` | `./src/foo.js` | `src/foo.js` |
| Paths with leading `/` | `/src/foo.js` | `src/foo.js` |
| Duplicate file paths | Same path in two rows | Deduplicated array |
| Only "Indirectly Affected" table | Markdown with indirect table | Empty array |

### 13.2 checkBlastRadiusStaleness() (Injectable I/O)

| Test Case | Input | Expected Output |
|-----------|-------|-----------------|
| 0 overlapping files | 3 changed, 5 in blast radius, 0 overlap | `{ stale: false, severity: 'none' }` |
| 2 overlapping files | 5 changed, 5 in blast radius, 2 overlap | `{ stale: true, severity: 'info' }` |
| 5 overlapping files | 8 changed, 5 in blast radius, 5 overlap | `{ stale: true, severity: 'warning' }` |
| Null impact analysis content | null | `{ severity: 'fallback' }` |
| Empty blast radius | Content with no table | `{ severity: 'fallback' }` |
| Same hash (not stale) | meta.codebase_hash === currentHash | `{ stale: false, severity: 'none' }` |
| Null meta | null | `{ stale: false }` (per checkStaleness behavior) |
| Git diff provided as array | changedFiles = [...] | Uses provided array, no git call |

---

## 14. Deployment Architecture

No changes to deployment. The iSDLC framework is a CLI tool distributed via npm. All changes are to markdown agent files and a single CommonJS utility module. The npm package will include the updated files in the next release.

---

## 15. Traceability Matrix

| Architectural Decision | Requirements Traced | NFRs Addressed |
|----------------------|-------------------|----------------|
| MODE: init-only (Section 5.1) | FR-001, FR-007 | NFR-005 |
| init-and-phase-01 deprecation (Section 5.2) | FR-003 | NFR-001 |
| Blast-radius staleness algorithm (Section 5.3) | FR-004, FR-006 | NFR-002 |
| extractFilesFromImpactAnalysis location (Section 5.4) | FR-005 | NFR-004 |
| Fail-open degradation (Section 5.5) | FR-004 (AC-004-05, AC-004-06) | NFR-003 |
| Phase-Loop Controller handles Phase 01 (Section 5.6) | FR-002 | NFR-005 |

All 7 FRs are addressed. All 5 NFRs are addressed. All 5 constraints (CON-001 through CON-005) are satisfied.

---

## 16. Open Design Questions (Deferred to Phase 04)

1. **Plan generation trigger**: Where exactly in the Phase-Loop Controller does plan generation occur after Phase 01 completes? Option A (delegate to orchestrator) vs Option B (inline in STEP 3e). See Section 9 for analysis.

2. **Section header detection in extractFilesFromImpactAnalysis**: Should the parser strictly require the "### Directly Affected Files" heading, or should it accept any heading containing "Directly Affected" or "Affected Files"? The resilient approach (accept variations per CON-005) is recommended, but the exact regex should be defined during design.

3. **Deprecation removal timeline**: When should `MODE: init-and-phase-01` be fully removed? Suggested: after 2 release cycles (0.2.0) with no usage detected.
