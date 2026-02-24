# Architecture: Complexity-Based Routing (GH-59)

**Phase**: 03-architecture (ANALYSIS MODE -- no state.json, no branches)
**Generated**: 2026-02-19
**Based On**: requirements-spec.md (9 FRs, 5 NFRs, 33 ACs), impact-analysis.md (5 core files, MEDIUM blast radius)
**Traces**: FR-001..FR-009, NFR-001..NFR-005, CON-001..CON-005

---

## Table of Contents

1. [Architecture Decisions Summary](#1-architecture-decisions-summary)
2. [AD-01: Tier Scoring Algorithm Placement](#2-ad-01-tier-scoring-algorithm-placement)
3. [AD-02: Tier Computed from Impact Analysis Metrics](#3-ad-02-tier-computed-from-impact-analysis-metrics)
4. [AD-03: Trivial Tier Execution Path](#4-ad-03-trivial-tier-execution-path)
5. [AD-04: Audit Trail for Trivial Changes](#5-ad-04-audit-trail-for-trivial-changes)
6. [AD-05: Tier vs Sizing Relationship](#6-ad-05-tier-vs-sizing-relationship)
7. [AD-06: State Isolation for Trivial Tier](#7-ad-06-state-isolation-for-trivial-tier)
8. [AD-07: Build Handler Integration Point](#8-ad-07-build-handler-integration-point)
9. [Function Signatures and Contracts](#9-function-signatures-and-contracts)
10. [Tier Scoring Algorithm Specification](#10-tier-scoring-algorithm-specification)
11. [Data Flow Diagrams](#11-data-flow-diagrams)
12. [meta.json Schema Extension](#12-metajson-schema-extension)
13. [change-record.md Schema](#13-change-recordmd-schema)
14. [Trivial Tier Execution Design](#14-trivial-tier-execution-design)
15. [Integration Points with Existing Code](#15-integration-points-with-existing-code)
16. [Test Architecture](#16-test-architecture)

---

## 1. Architecture Decisions Summary

| ID | Decision | Rationale | Traces |
|----|----------|-----------|--------|
| AD-01 | `computeRecommendedTier()` lives in `three-verb-utils.cjs` as a pure function accepting thresholds parameter | Testability; consistency with existing pattern; CON-002 config-not-code | FR-002, CON-002 |
| AD-02 | Phase 02 impact analysis produces tier data; analyze handler computes tier from IA metrics and persists to meta.json | Uses actual blast radius data (file count, risk, coupling) not Phase 00 estimates; more accurate | FR-001, FR-003 |
| AD-03 | Trivial execution is a labeled inline section in isdlc.md build handler | CON-001 (no new agents); minimal indirection; future-extractable | FR-006, CON-001 |
| AD-04 | change-record.md uses append-only markdown with horizontal rule separators | Matches existing requirements folder pattern; human-readable; git-diffable | FR-007, NFR-003 |
| AD-05 | Tier (Phase 02) gates workflow entry at build time; sizing (Phase 02/3e-sizing) gates workflow intensity; complementary, same data source | Both derive from impact analysis metrics but answer different questions (IF workflow vs INTENSITY) | CON-004 |
| AD-06 | Trivial path writes to requirements folder and meta.json only; never touches state.json or invokes hooks | Clean architectural boundary: trivial exists outside workflow machinery | NFR-005 |
| AD-07 | Tier menu inserts between step 4 (readMetaJson) and step 4a (computeStartPhase); trivial short-circuits before staleness | Tier decision logically precedes workflow setup; staleness is irrelevant for trivial | FR-005, SP-002 |

---

## 2. AD-01: Tier Scoring Algorithm Placement

### Decision

`computeRecommendedTier(estimatedFiles, riskLevel, thresholds)` is implemented as a pure function in `three-verb-utils.cjs`. It accepts thresholds as an optional parameter with hardcoded defaults. Callers (the isdlc.md analyze handler, after Phase 02) read thresholds from `workflows.json` and pass them in.

### Rationale

1. **Pure function design**: The function has no side effects, reads no files, writes no state. This makes it trivially testable with the existing `node:test` infrastructure in `test-three-verb-utils.test.cjs`.

2. **Consistent with existing patterns**: `computeStartPhase()`, `checkStaleness()`, `deriveAnalysisStatus()` all follow the same pattern -- pure functions in three-verb-utils.cjs that are called by the isdlc.md handlers.

3. **Config-not-code (CON-002)**: Thresholds come from `workflows.json` but the function does not read the file itself. The caller reads config and passes it in. This keeps the utility layer decoupled from the config layer, matching how `computeStartPhase(meta, workflowPhases)` receives workflow phases rather than reading workflows.json itself.

4. **Testability**: Passing thresholds as a parameter means tests can verify behavior with arbitrary thresholds without mocking file reads.

### Alternatives Considered

- **Function reads workflows.json directly**: Rejected. Would make the function impure, harder to test, and inconsistent with `computeStartPhase()` pattern which receives phases as parameter.
- **Scoring logic inline in an agent prompt (e.g., quick-scan-agent.md)**: Rejected. Not testable with automated tests. Duplicates logic when build handler also needs it.
- **New module `tier-scoring.cjs`**: Rejected. Over-engineering for two functions. Three-verb-utils.cjs already has the right scope (utility functions for the add/analyze/build model).

---

## 3. AD-02: Tier Computed from Impact Analysis Metrics

### Decision

After Phase 02 (impact analysis) completes in the analyze handler, the handler:

1. Reads the impact-analysis.md using `parseSizingFromImpactAnalysis()` (existing function) to extract metrics
2. Calls `computeRecommendedTier(metrics.file_count, metrics.risk_score, thresholds)` to compute the tier
3. Writes the `recommended_tier` to meta.json via `writeMetaJson()`
4. Appends a "Recommended Tier" note to the analyze handler's Phase 02 completion output

### Rationale

1. **Accurate data**: Impact analysis measures actual blast radius (file count, module count, coupling, risk score, coverage gaps) from codebase analysis. Phase 00's quick scan only estimates using keyword matching — too unreliable for routing decisions that skip entire workflows.

2. **Single data source**: Both tier and sizing use the same impact analysis metrics. This eliminates the risk of Phase 00 recommending "trivial" while Phase 02 reveals 15 affected files.

3. **Existing infrastructure**: `parseSizingFromImpactAnalysis()` already extracts the metrics needed for tier scoring. No new parsing code required — just a new consumer of existing data.

4. **Handler-level computation**: The tier is computed in the analyze handler (isdlc.md), not in the impact analysis agent. This keeps the agent focused on analysis and the handler responsible for routing decisions.

### Data Flow

```
Phase 02 agent → impact-analysis.md → parseSizingFromImpactAnalysis() → metrics
                                                                           ↓
                                     computeRecommendedTier(file_count, risk, thresholds) → tier
                                                                           ↓
                                     writeMetaJson(slugDir, { ...meta, recommended_tier: tier })
```

The impact-analysis.md already contains the metrics in its JSON block:
```json
{
  "file_count": 5,
  "module_count": 2,
  "risk_score": "low",
  "coupling": "low",
  "coverage_gaps": 0
}
```

The analyze handler calls `computeRecommendedTier(metrics.file_count, metrics.risk_score, thresholds)` and writes the result to meta.json as `recommended_tier`.

---

## 4. AD-03: Trivial Tier Execution Path

### Decision

The trivial tier execution path is implemented as a labeled inline section within the build handler in isdlc.md (not a new agent, not a new JavaScript module).

### Rationale

1. **CON-001 compliance**: "The trivial tier execution path does not require a new agent. The build handler in isdlc.md orchestrates the trivial path inline."

2. **Minimal indirection**: The trivial path is a short sequence of steps: read requirements, assist with edit, commit, write change-record.md, update meta.json, update BACKLOG.md. This is approximately 80-120 lines of procedural instructions in the build handler -- small enough to be inline without becoming unmanageable.

3. **No new JavaScript module**: The quick-scan initially suggested `lib/trivial-tier-executor.js` but the requirements (CON-001) explicitly decided against this. The trivial path uses existing functions (`readMetaJson`, `writeMetaJson`, `updateBacklogMarker`) and creates a new file (change-record.md) via standard file I/O instructions in the agent prompt.

4. **Future extraction**: The section is clearly labeled ("--- TRIVIAL TIER EXECUTION ---") so it can be extracted to a separate module if the trivial path grows in complexity. But per Article V (Simplicity First), we do not pre-extract.

### Alternatives Considered

- **New `lib/trivial-tier-executor.js` module**: Rejected per CON-001. Over-engineering for a ~100-line procedural path that uses existing utility functions.
- **New agent (trivial-tier-agent)**: Rejected per CON-001. Agents carry overhead (skill loading, phase gates, constitutional validation). Trivial tier must be fast (NFR-004) and skip all of that.
- **Separate handler section in isdlc.md** (like add/analyze/build each have sections): Rejected. The trivial path is not a new verb -- it is a routing outcome within the build verb. It belongs inside the build handler's control flow, not as a peer section.

---

## 5. AD-04: Audit Trail for Trivial Changes

### Decision

Trivial changes are recorded in `docs/requirements/{slug}/change-record.md` using append-only markdown. Each entry is separated by a horizontal rule (`---`). The file is created on first trivial change and appended to on subsequent trivial changes for the same slug.

### Schema

See [Section 13: change-record.md Schema](#13-change-recordmd-schema) for the full specification.

### Rationale

1. **Consistency with requirements folder pattern**: Every slug folder contains markdown artifacts. change-record.md fits this pattern (alongside draft.md, quick-scan.md, requirements-spec.md, etc.).

2. **Human-readable**: Markdown is readable without tooling. A developer can inspect the audit trail 6 months later by opening the file (NFR-003 AC-NFR-003a).

3. **Append-only**: Multiple trivial changes to the same slug append entries rather than overwriting (AC-007b). This preserves the full history without requiring structured data formats.

4. **Git-diffable**: Each new entry shows as a clean diff addition, making code review of trivial changes straightforward.

5. **No structured database**: The audit trail does not require a database or JSON array. Markdown with horizontal rule separators is the simplest format that satisfies the requirements.

### Alternatives Considered

- **JSON array in meta.json**: Rejected. JSON grows unwieldy for multiple entries with diff snippets. Harder to read for humans. meta.json stores summary metadata, not detailed audit records.
- **Structured `change-record.json`**: Rejected. Adds complexity without benefit. The primary consumers are humans reviewing the requirements folder.
- **Append to draft.md**: Rejected. draft.md is the initial intake artifact. Mixing change records into it conflates two purposes.

---

## 6. AD-05: Tier vs Sizing Relationship

### Decision

Tier recommendation and sizing decision both derive from Phase 02 impact analysis data but answer different questions and are consumed at different times.

```
TIER (computed after Phase 02, consumed at build time):
  Question: Should we run a workflow at all?
  trivial  --> NO  (direct edit, exit)
  light    --> YES (workflow with sizing)
  standard --> YES (workflow with sizing)
  epic     --> YES (workflow with sizing)

SIZING (computed during build at 3e-sizing, from same IA data):
  Question: How heavy should the workflow be?
  light    --> skip architecture + design phases
  standard --> full phase sequence
  epic     --> full phases + decomposition (future)
```

### Rationale

1. **CON-004 compliance**: "Tier recommendation and sizing decision are complementary, not competing."

2. **Same data, different questions**: Both use impact analysis metrics (file count, risk, coupling). Tier gates workflow entry (trivial = no workflow). Sizing gates workflow intensity (light = fewer phases). They are consumed at different lifecycle moments: tier at build start, sizing after Phase 02 in the build workflow.

3. **No coupling**: If the user selects "standard" tier at build time (run full workflow), the sizing decision at 3e-sizing may recommend "light" based on the same impact data. This is correct — tier answered "yes, run a workflow", sizing refines "but skip arch+design since it's simple".

4. **Terminology overlap is documented, not eliminated**: Both systems use "light", "standard", "epic". This overlap is acknowledged in the impact analysis (Technical Debt #3). The tier menu labels include context ("direct edit, no workflow" for tier-trivial, "skip architecture and design" for tier-light) that differentiates them from sizing labels.

### Interaction Model

When the user selects a non-trivial tier:
1. Build handler creates workflow normally (steps 5-9)
2. Phases run: 00 -> 01 -> 02 -> (3e-sizing decision) -> ...
3. At 3e-sizing, `applySizingDecision()` runs using the same impact analysis data
4. Sizing may produce a different intensity — this is expected and correct

When the user selects trivial tier:
1. Build handler short-circuits to trivial execution path
2. No workflow created, no phases run, no sizing decision needed
3. 3e-sizing is never reached

---

## 7. AD-06: State Isolation for Trivial Tier

### Decision

The trivial tier execution path operates entirely outside the workflow machinery. It writes to the requirements folder (`docs/requirements/{slug}/`) and meta.json, but never touches `.isdlc/state.json`, never invokes hooks, and never creates `active_workflow`.

### Architectural Boundary

```
WORKFLOW WORLD                           TRIVIAL WORLD
(state.json, hooks, gates,              (requirements folder only)
 branches, phase-loop-controller)

 state.json:                             meta.json:
   active_workflow: {...}                  recommended_tier: "trivial"
   current_phase: "06-impl"               tier_used: "trivial"
   phases.XX.status: ...                   last_trivial_change: {...}

 hooks triggered:                        hooks triggered:
   phase-loop-controller                   NONE
   gate-blocker
   state-write-validator
   phase-sequence-guard

 branches:                               branches:
   feature/{slug}                          NONE (current branch)

 artifacts:                              artifacts:
   requirements-spec.md                    change-record.md
   impact-analysis.md                      meta.json (updated)
   architecture.md                         BACKLOG.md (marker update)
   etc.
```

### Rationale

1. **NFR-005 compliance**: "The trivial tier must not write to `.isdlc/state.json` or interact with the workflow machinery in any way."

2. **Clean boundary**: The trivial path short-circuits BEFORE any workflow initialization (step 8 in the build handler, which delegates to the orchestrator). The orchestrator is never invoked. Since hooks fire on state.json writes and phase transitions, and neither occurs, no hooks fire.

3. **No hook suppression needed**: We do not need to add "trivial bypass" logic to hooks. The hooks simply never trigger because the trivial path never writes to state.json. This is fail-safe by design (Article X).

4. **meta.json is NOT state.json**: meta.json is a requirements-folder artifact (`docs/requirements/{slug}/meta.json`), not workflow state (`.isdlc/state.json`). Writing to meta.json does not violate NFR-005. The distinction is:
   - `state.json`: workflow execution state (branches, phases, gates) -- FORBIDDEN for trivial
   - `meta.json`: item metadata (analysis status, tier info) -- PERMITTED for trivial

### Enforcement

The enforcement is structural, not runtime-checked:
- The trivial path code in isdlc.md never calls `writeState()`, never references `active_workflow`, never delegates to the orchestrator
- No hooks fire because no triggering events occur
- Testing verifies state.json is byte-identical before and after trivial execution (NFR-005 AC-NFR-005a)

---

## 8. AD-07: Build Handler Integration Point

### Decision

The tier menu is inserted as a new "Step 4a-tier" between the existing step 4 (readMetaJson) and step 4a (computeStartPhase). If trivial is selected, the entire 4a-4e flow and steps 5-9 are skipped. If non-trivial is selected, the existing flow continues unchanged.

### Build Handler Flow (with tier integration)

```
Step 1: Validate constitution
Step 2: Check no active workflow
Step 3: Resolve target item (resolveItem)
Step 4: Read meta.json (readMetaJson)

--- NEW: Step 4a-tier (Tier Selection) ---

  4a-tier.1: Read recommended_tier from meta (loaded in step 4)
  4a-tier.2: Present tier menu
             [1] Trivial  [2] Light  [3] Standard  [4] Epic
             Default: recommended_tier (or "standard" if absent)
  4a-tier.3: Handle user selection:
             IF trivial selected:
               GOTO --> TRIVIAL TIER EXECUTION (short-circuit)
             ELSE:
               Record tier selection in meta.json if override
               FALL THROUGH to step 4a

--- END NEW ---

Step 4a: computeStartPhase (unchanged)
Step 4b: checkStaleness (unchanged)
Step 4c: Handle staleness menu (unchanged)
Step 4d: Handle partial analysis menu (unchanged)
Step 4e: BUILD SUMMARY banner (unchanged)
Step 5:  Parse flags (unchanged)
...
Step 9:  Phase-Loop Controller drives phases (unchanged)

--- NEW: TRIVIAL TIER EXECUTION (labeled section) ---

  T1: Read requirements (draft.md / requirements-spec.md / quick-scan.md)
  T2: Display change context to user
  T3: Assist with edit (framework makes the change)
  T4: User confirms change
  T5: Commit to current branch
  T6: Write change-record.md
  T7: Update meta.json (tier_used, last_trivial_change)
  T8: Update BACKLOG.md marker
  T9: Display completion summary
  (Error at any step: report error, do NOT write change record, offer retry/escalate)

--- END TRIVIAL TIER EXECUTION ---
```

### Rationale

1. **Tier decision precedes workflow setup**: The tier determines whether a workflow exists at all. It must be decided before computeStartPhase (which computes workflow phase boundaries) and before staleness checks (which are irrelevant if there is no workflow).

2. **Short-circuit on trivial**: If the user selects trivial, the entire workflow setup (steps 4a-9) is irrelevant. Short-circuiting here avoids executing unnecessary logic and keeps the trivial path fast (NFR-004).

3. **No disruption to existing flow**: For non-trivial selections, the flow falls through to step 4a unchanged. The existing computeStartPhase, staleness, partial analysis, and BUILD SUMMARY logic is not modified.

4. **Step 4 dependency**: The tier menu needs meta.json to read `recommended_tier`. Step 4 already loads meta.json. Placing the tier menu immediately after step 4 uses the already-loaded data.

### Why Not After Staleness Checks?

The staleness check (step 4b) determines whether analysis is outdated relative to codebase changes. For the trivial tier, staleness is irrelevant -- the user is making a direct edit, not running analysis-dependent phases. Checking staleness before presenting the tier menu would add unnecessary delay and present a confusing staleness warning for items that may be routed to trivial.

### Why Not Before Step 4?

Step 4 loads meta.json, which contains `recommended_tier`. The tier menu needs this value to highlight the default. Placing the tier menu before step 4 would require a duplicate meta.json read or restructuring step 4.

---

## 9. Function Signatures and Contracts

### 9.1 computeRecommendedTier(estimatedFiles, riskLevel, thresholds)

**File**: `src/claude/hooks/lib/three-verb-utils.cjs`
**Type**: Pure function (no I/O, no side effects)
**Traces**: FR-002 (AC-002a..AC-002d), CON-002

```javascript
/**
 * Computes a recommended workflow tier based on estimated file count
 * and risk level.
 *
 * GH-59: Complexity-Based Routing
 * Traces: FR-002 (AC-002a, AC-002b, AC-002c, AC-002d), CON-002
 *
 * @param {number|null|undefined} estimatedFiles - Estimated number of affected files
 * @param {string|null|undefined} riskLevel - One of "low", "medium", "high", null, undefined
 * @param {{ trivial_max_files: number, light_max_files: number, standard_max_files: number }} [thresholds]
 *   - Optional thresholds from workflows.json. Defaults to { trivial_max_files: 2, light_max_files: 8, standard_max_files: 20 }
 * @returns {string} One of "trivial", "light", "standard", "epic"
 */
function computeRecommendedTier(estimatedFiles, riskLevel, thresholds) { ... }
```

**Behavior specification**:

| Input | Output | Rule |
|-------|--------|------|
| `estimatedFiles` is null/undefined/NaN/negative | `"standard"` | Safe default (AC-002c), log warning to stderr |
| `estimatedFiles` is 0 | `"trivial"` | Zero files is below threshold |
| `estimatedFiles <= thresholds.trivial_max_files` (default 2) | `"trivial"` | Base threshold (AC-002a) |
| `estimatedFiles <= thresholds.light_max_files` (default 8) | `"light"` | Base threshold (AC-002a) |
| `estimatedFiles <= thresholds.standard_max_files` (default 20) | `"standard"` | Base threshold (AC-002a) |
| `estimatedFiles > thresholds.standard_max_files` | `"epic"` | Base threshold (AC-002a) |
| `riskLevel === "medium"` or `"high"` | Promote tier by one | Risk adjustment (AC-002b) |
| `riskLevel` is unrecognized string | Treat as `"low"` (no promotion) | Defensive (AC-002d), log warning |
| `thresholds` is undefined/null | Use hardcoded defaults | CON-002 fallback |

**Tier promotion logic**:
```
trivial  --promote--> light
light    --promote--> standard
standard --promote--> epic
epic     --promote--> epic (ceiling)
```

Risk level `"medium"` and `"high"` both cause exactly one promotion. There is no double promotion for `"high"` -- the requirements specify "promoted by one level" (AC-002b) for both medium and high.

### 9.2 getTierDescription(tier)

**File**: `src/claude/hooks/lib/three-verb-utils.cjs`
**Type**: Pure function (no I/O, no side effects)
**Traces**: FR-009 (AC-009a, AC-009b)

```javascript
/**
 * Returns a human-readable description object for a workflow tier.
 *
 * GH-59: Complexity-Based Routing
 * Traces: FR-009 (AC-009a, AC-009b)
 *
 * @param {string} tier - One of "trivial", "light", "standard", "epic"
 * @returns {{ label: string, description: string, fileRange: string }}
 */
function getTierDescription(tier) { ... }
```

**Return values**:

| `tier` | `label` | `description` | `fileRange` |
|--------|---------|---------------|-------------|
| `"trivial"` | `"Trivial"` | `"direct edit, no workflow"` | `"1-2 files"` |
| `"light"` | `"Light"` | `"skip architecture and design"` | `"3-8 files"` |
| `"standard"` | `"Standard"` | `"full workflow"` | `"9-20 files"` |
| `"epic"` | `"Epic"` | `"full workflow with decomposition"` | `"20+ files"` |
| anything else | `"Unknown"` | `"unrecognized tier"` | `"unknown"` |

**Implementation note**: This is a lookup table, not a computation. The descriptions are specified in AC-009a and are constant. The function is a map, not a calculator.

### 9.3 TIER_ORDER constant

**File**: `src/claude/hooks/lib/three-verb-utils.cjs`
**Type**: Constant (ordered array)

```javascript
/**
 * Ordered tier sequence for promotion logic.
 * GH-59: Complexity-Based Routing
 */
const TIER_ORDER = ['trivial', 'light', 'standard', 'epic'];
```

Used internally by `computeRecommendedTier()` for the promotion step. Exported for testing.

---

## 10. Tier Scoring Algorithm Specification

### Algorithm (pseudocode)

```
FUNCTION computeRecommendedTier(estimatedFiles, riskLevel, thresholds):
  -- Step 1: Apply default thresholds if not provided
  IF thresholds is null/undefined:
    thresholds = { trivial_max_files: 2, light_max_files: 8, standard_max_files: 20 }

  -- Step 2: Validate estimatedFiles
  IF estimatedFiles is null, undefined, NaN, or not a non-negative integer:
    WARN to stderr: "computeRecommendedTier: invalid estimatedFiles ({value}), defaulting to standard"
    RETURN "standard"

  -- Step 3: Compute base tier from file count
  IF estimatedFiles <= thresholds.trivial_max_files:
    baseTier = "trivial"
  ELSE IF estimatedFiles <= thresholds.light_max_files:
    baseTier = "light"
  ELSE IF estimatedFiles <= thresholds.standard_max_files:
    baseTier = "standard"
  ELSE:
    baseTier = "epic"

  -- Step 4: Validate riskLevel
  IF riskLevel is a string but not one of "low", "medium", "high", null, undefined:
    WARN to stderr: "computeRecommendedTier: unrecognized riskLevel ({value}), treating as low"
    riskLevel = "low"

  -- Step 5: Apply risk-based promotion
  IF riskLevel === "medium" OR riskLevel === "high":
    baseTier = promote(baseTier)  -- shift one position right in TIER_ORDER, capped at "epic"

  RETURN baseTier
```

### Boundary Value Table

| estimatedFiles | riskLevel | thresholds (default) | baseTier | promotion | result |
|---------------|-----------|---------------------|----------|-----------|--------|
| 0 | null | default | trivial | none | **trivial** |
| 1 | "low" | default | trivial | none | **trivial** |
| 2 | "low" | default | trivial | none | **trivial** |
| 2 | "medium" | default | trivial | +1 | **light** |
| 2 | "high" | default | trivial | +1 | **light** |
| 3 | "low" | default | light | none | **light** |
| 8 | "low" | default | light | none | **light** |
| 8 | "medium" | default | light | +1 | **standard** |
| 9 | "low" | default | standard | none | **standard** |
| 20 | "low" | default | standard | none | **standard** |
| 20 | "high" | default | standard | +1 | **epic** |
| 21 | "low" | default | epic | none | **epic** |
| 21 | "high" | default | epic | none (ceiling) | **epic** |
| null | any | default | -- | -- | **standard** (safe default) |
| -1 | "low" | default | -- | -- | **standard** (invalid input) |
| 5 | "low" | {3, 10, 25} | light | none | **light** (custom thresholds) |

### Configuration in workflows.json

```json
{
  "workflows": {
    "feature": {
      "tier_thresholds": {
        "trivial_max_files": 2,
        "light_max_files": 8,
        "standard_max_files": 20
      },
      ...existing fields...
    }
  }
}
```

The `tier_thresholds` block is a sibling to `sizing`, `phases`, `options`, etc. within `workflows.feature`. The naming convention (`_max_files`) matches the existing `sizing.thresholds.light_max_files` pattern.

---

## 11. Data Flow Diagrams

### 11.1 Tier Recommendation Flow (Phase 02 impact analysis through analyze completion)

```
USER: /isdlc analyze {slug}
    |
    v
isdlc.md ANALYZE HANDLER
    |
    |-- Phases 00-01 run (quick scan, requirements)
    |
    |-- Phase 02: Delegate to impact-analysis agent
    |       |
    |       v
    |   IMPACT ANALYSIS AGENT (Phase 02)
    |       |
    |       |-- Analyze blast radius, file count, risk, coupling
    |       |-- Write impact-analysis.md with JSON metrics block:
    |       |     { files_directly_affected, risk_level, modules_affected, ... }
    |       |
    |       v
    |   (impact-analysis.md written to requirements folder)
    |
    |-- After Phase 02 completes: COMPUTE TIER
    |       |
    |       |-- content = Read(impact-analysis.md)
    |       |-- metrics = parseSizingFromImpactAnalysis(content)
    |       |-- thresholds = workflows.json.feature.tier_thresholds || defaults
    |       |-- tier = computeRecommendedTier(metrics.file_count, metrics.risk_score, thresholds)
    |       |-- meta.recommended_tier = tier
    |       |-- writeMetaJson(slugDir, meta)
    |       |-- OUTPUT: "Recommended tier: {tier} -- {desc.description}"
    |
    |   ...phases 03-04 run (tier is preserved in meta.json)...
    |
    |-- Step 8: Display completion
    |       |
    |       |-- Read meta.recommended_tier
    |       |-- IF present:
    |       |     desc = getTierDescription(meta.recommended_tier)
    |       |     OUTPUT: "Recommended tier: {tier} -- {desc.description}"
    |       |-- IF absent:
    |       |     (omit tier line)
    |
    v
USER sees: "Analysis complete. {slug} is ready to build.
            Recommended tier: light -- skip architecture and design"
```

### 11.2 Tier Selection Flow (Build handler)

```
USER: /isdlc build {slug}
    |
    v
isdlc.md BUILD HANDLER
    |
    |-- Step 1-3: Validate, check active workflow, resolve item
    |-- Step 4: Read meta.json
    |       |
    |       meta = readMetaJson(slugDir)
    |       recommended = meta.recommended_tier || null
    |
    |-- Step 4a-tier: TIER SELECTION MENU
    |       |
    |       |-- IF recommended is null:
    |       |     default = "standard"
    |       |     WARN: "No tier recommendation available. Defaulting to standard."
    |       |-- ELSE:
    |       |     default = recommended
    |       |
    |       |-- Display menu (4 options, default highlighted)
    |       |-- Wait for user input
    |       |
    |       |-- IF user selects trivial:
    |       |     GOTO --> TRIVIAL TIER EXECUTION
    |       |
    |       |-- IF user overrides (selection != recommended):
    |       |     meta.tier_override = {
    |       |       recommended: recommended,
    |       |       selected: userChoice,
    |       |       overridden_at: ISO-8601
    |       |     }
    |       |     writeMetaJson(slugDir, meta)
    |       |
    |       |-- FALL THROUGH to step 4a
    |
    |-- Step 4a-4e: existing build auto-detection (unchanged)
    |-- Steps 5-9: existing workflow creation (unchanged)
```

### 11.3 Trivial Tier Execution Flow

```
TRIVIAL TIER EXECUTION (from step 4a-tier)
    |
    |-- T1: Read requirements context
    |       |
    |       |-- Look for files in priority order:
    |       |     1. requirements-spec.md (if full requirements exist)
    |       |     2. quick-scan.md (if only Phase 00 completed)
    |       |     3. draft.md (if only intake completed)
    |       |-- Extract: what to change, why, which files
    |
    |-- T2: Display change context
    |       |
    |       "Trivial change: {slug}
    |        Based on: {source file}
    |        Change: {summary from requirements}
    |        Target files: {list if identified}"
    |
    |-- T3: Assist with edit
    |       |
    |       |-- Framework makes the edit(s) on current branch
    |       |-- Standard Claude Code file editing (Read/Edit tools)
    |       |-- No branch creation, no workflow machinery
    |
    |-- T4: User confirms
    |       |
    |       "Changes made. Review and confirm? [Y/n/retry]"
    |       |-- Y: proceed to commit
    |       |-- n: abort, do NOT write change record
    |       |-- retry: go back to T3
    |
    |-- T5: Commit to current branch
    |       |
    |       git add {modified files}
    |       git commit -m "{type}: {description} ({slug})"
    |       |
    |       |-- IF commit fails (protected branch, etc.):
    |       |     Report error, do NOT write change record (AC-006e)
    |       |     "Error: commit failed. Escalate to higher tier? [Y/n]"
    |       |
    |       capturedSHA = git rev-parse HEAD
    |
    |-- T6: Write change-record.md
    |       |
    |       IF file exists: append with "---" separator
    |       IF new file: create with header
    |       Write entry (see Section 13 for schema)
    |
    |-- T7: Update meta.json
    |       |
    |       meta.tier_used = "trivial"
    |       meta.last_trivial_change = {
    |         completed_at: ISO-8601,
    |         commit_sha: capturedSHA,
    |         files_modified: [file1, file2]
    |       }
    |       writeMetaJson(slugDir, meta)
    |
    |-- T8: Update BACKLOG.md marker
    |       |
    |       updateBacklogMarker(backlogPath, slug, "x")
    |       (mark as completed -- trivial changes are done in one pass)
    |
    |-- T9: Display completion summary
    |       |
    |       "Trivial change completed:
    |          Files modified: {list}
    |          Commit: {short SHA}
    |          Change record: docs/requirements/{slug}/change-record.md"
    |
    v
(Build handler exits -- no further steps)
```

---

## 12. meta.json Schema Extension

### New Fields

All new fields are optional for backward compatibility (NFR-002). Existing meta.json files without these fields continue to work unchanged.

```json
{
  "source": "github",
  "source_id": "GH-59",
  "slug": "complexity-routing-GH-59",
  "created_at": "2026-02-19T22:10:00Z",
  "analysis_status": "partial",
  "phases_completed": ["00-quick-scan", "01-requirements"],
  "codebase_hash": "abc1234",

  "recommended_tier": "light",

  "tier_used": "trivial",

  "tier_override": {
    "recommended": "light",
    "selected": "standard",
    "overridden_at": "2026-02-20T10:15:00Z"
  },

  "last_trivial_change": {
    "completed_at": "2026-02-20T10:20:00Z",
    "commit_sha": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0",
    "files_modified": ["src/utils/helper.js", "src/config/defaults.json"]
  },

  "quick_scan": {
    "completed_at": "2026-02-19T22:34:00Z",
    "estimated_scope": "SMALL",
    "estimated_affected_files": 3,
    "confidence": "high"
  }
}
```

### Field Specifications

| Field | Type | Set By | When | Traces |
|-------|------|--------|------|--------|
| `recommended_tier` | `string` (trivial\|light\|standard\|epic) | Analyze handler (after Phase 02) | After impact analysis completes | AC-003a |
| `tier_used` | `string` (trivial\|light\|standard\|epic) | Build handler (step 4a-tier or T7) | After tier selection | AC-007c |
| `tier_override` | `object \| null` | Build handler (step 4a-tier) | When user selects different tier than recommended | AC-005e |
| `tier_override.recommended` | `string` | Build handler | On override | AC-005e |
| `tier_override.selected` | `string` | Build handler | On override | AC-005e |
| `tier_override.overridden_at` | `string` (ISO-8601) | Build handler | On override | AC-005e |
| `last_trivial_change` | `object \| null` | Trivial execution path (T7) | After trivial change completes | AC-007c |
| `last_trivial_change.completed_at` | `string` (ISO-8601) | Trivial path (T7) | On completion | AC-007c |
| `last_trivial_change.commit_sha` | `string` (40-char hex) | Trivial path (T7) | On completion | AC-007c |
| `last_trivial_change.files_modified` | `string[]` | Trivial path (T7) | On completion | AC-007c |

### Backward Compatibility Rules

1. `readMetaJson()` already handles missing fields gracefully (returns raw object with defensive defaults only for `analysis_status`, `phases_completed`, `source`, `created_at`). New tier fields are simply absent (undefined) in old meta.json files. No migration needed.

2. `writeMetaJson()` writes whatever fields are in the meta object. No changes needed to the write function.

3. Consumers (analyze step 8, build step 4a-tier) check for null/undefined explicitly:
   - `meta.recommended_tier || null` -- if absent, treat as no recommendation
   - `meta.tier_override || null` -- if absent, no override recorded
   - `meta.last_trivial_change || null` -- if absent, no trivial change history

4. No schema validation is added. The meta.json is a loose-schema document. Fields are convention-based, not enforced by a validator.

### `recommended_tier` Placement

Per AC-003a, `recommended_tier` is at the top level of meta.json, NOT nested inside `quick_scan`. This is a deliberate decision:

- **Top level**: `recommended_tier` is consumed by the build handler (step 4a-tier), which operates independently of quick_scan details. Top-level placement makes it a first-class field.
- **Not inside quick_scan**: The `quick_scan` nested object contains scan-time data (completion time, estimated files, confidence). The `recommended_tier` is a derived output that transcends the scan -- it is the input to the build handler's tier decision.

Note: The existing meta.json for this feature (complexity-routing-GH-59) already has `recommended_tier: "standard"` nested inside `quick_scan`. This is a pre-existing artifact that was written before this architecture was defined. The implementation should write `recommended_tier` at the top level per AC-003a. The nested value inside `quick_scan` is informational context, not the authoritative source.

---

## 13. change-record.md Schema

### File Location

`docs/requirements/{slug}/change-record.md`

### Structure

```markdown
# Change Record: {slug}

Audit trail for trivial-tier changes. Each entry below represents
a direct edit made without a full workflow.

---

## Entry: {ISO-8601 datetime}

**Tier**: trivial
**Summary**: {what changed and why -- 1-3 sentences}
**Files Modified**:
- {relative/path/to/file1.js}
- {relative/path/to/file2.json}

**Commit**: {full 40-character SHA}

### Diff Summary

#### {file1.js}
```diff
{first 20 lines of diff for this file}
```
{if truncated: "... (diff truncated, {N} more lines)"}

#### {file2.json}
```diff
{first 20 lines of diff for this file}
```

---

## Entry: {ISO-8601 datetime for second trivial change}

**Tier**: trivial
**Summary**: {what changed and why}
...
```

### Field Details

| Field | Source | Required | Notes |
|-------|--------|----------|-------|
| ISO-8601 datetime | `new Date().toISOString()` | Yes | |
| Tier | Always `"trivial"` for this schema | Yes | Future-proofed: other tiers could use change-record.md |
| Summary | User/framework description of the change | Yes | 1-3 sentences. Answer "what" and "why". |
| Files Modified | List of modified file paths | Yes | Relative to project root |
| Commit SHA | `git rev-parse HEAD` (after commit) | Yes | Full 40-character hash (AC-007a) |
| Diff Summary | `git diff HEAD~1 -- {file}` per file | Yes | First 20 lines per file (AC-007a). Truncate with "..." |

### Append Behavior (AC-007b)

When `change-record.md` already exists:
1. Read existing content
2. Append a horizontal rule (`---`)
3. Append the new entry (starting with `## Entry: {datetime}`)
4. Write back the full file

The file header ("# Change Record: {slug}" and the introductory text) is written only on first creation.

### Creation Behavior (first trivial change)

When `change-record.md` does not exist:
1. Write file header
2. Write first horizontal rule
3. Write the entry

---

## 14. Trivial Tier Execution Design

### Entry Conditions

The trivial tier execution path is entered when ALL of the following are true:
1. Build handler has reached step 4a-tier
2. meta.json has been loaded (step 4)
3. User selects `[1] Trivial` from the tier menu
4. Constitution exists and is not a template (step 1)
5. No active workflow exists (step 2)

### Requirements Source Priority

The trivial path reads requirements context to understand what to change. Files are checked in this priority order (first found wins):

| Priority | File | Implies |
|----------|------|---------|
| 1 | `requirements-spec.md` | Full requirements gathered (Phase 01 complete) |
| 2 | `impact-analysis.md` | Impact analysis complete (Phase 02 complete) |
| 3 | `quick-scan.md` | Only Phase 00 completed |
| 4 | `draft.md` | Only intake completed (no analysis) |

The trivial path uses whichever file provides the best context for understanding the change. If only `draft.md` exists, the framework works with that.

### Edit Execution

The trivial path does NOT automatically generate code. It uses the standard Claude Code editing flow:
1. Read the requirements context
2. Identify the target files and changes needed
3. Use Read/Edit tools to make the changes
4. Present changes to user for review

This is the same editing capability available in any Claude Code session. The framework's contribution is:
- Reading requirements context to understand what to change
- Committing the result
- Recording the change for audit trail

### Error Handling (AC-006e)

| Error | Response | Change Record? |
|-------|----------|----------------|
| Target file not found | Report error, offer retry | NO |
| Edit introduces syntax error | Report error, offer retry | NO |
| Tests fail after edit | Report failure, offer retry or escalate | NO |
| Commit fails (protected branch) | Report error, suggest escalating to higher tier | NO |
| change-record.md write fails | Report error, warn that audit trail is incomplete | YES (commit already made) |
| meta.json write fails | Report error, warn that metadata is incomplete | YES (commit already made) |

The rule: change-record.md is written ONLY after a successful commit. If the commit fails, no change record is written. If the commit succeeds but post-commit recording fails, the commit stands and a warning is issued.

### Escalation Path

If the user encounters issues during trivial execution, they can escalate:
```
Error: {description of error}

Options:
  [R] Retry the edit
  [E] Escalate to light tier (creates workflow)
  [A] Abort (no changes committed)
```

Escalation to a higher tier means:
1. Abort the trivial path
2. Return to the tier menu (step 4a-tier) with the escalated tier pre-selected
3. Continue with the normal build flow

Note: If a commit was already made before the error, the commit remains. The escalation starts a workflow that may make additional changes on top of the existing commit.

### --trivial Flag (AC-NFR-001b)

The `--trivial` flag on the build command pre-selects the trivial tier but does NOT auto-execute:

```
/isdlc build "my-item" --trivial

Output:
"Trivial tier selected via flag. Proceed with direct edit? [Y/n]"
```

If the user confirms, skip the tier menu and go directly to the trivial execution path. If the user declines, show the full tier menu.

---

## 15. Integration Points with Existing Code

### 15.1 three-verb-utils.cjs

**New exports to add**:
```javascript
module.exports = {
    // ...existing exports...

    // Tier recommendation utilities (GH-59)
    TIER_ORDER,
    computeRecommendedTier,
    getTierDescription
};
```

**No changes to existing functions**: `readMetaJson()`, `writeMetaJson()`, `computeStartPhase()`, `checkStaleness()` all remain unchanged. New tier fields in meta.json are handled transparently by the existing read/write functions.

### 15.2 workflows.json

**New configuration block** under `workflows.feature`:
```json
"tier_thresholds": {
  "trivial_max_files": 2,
  "light_max_files": 8,
  "standard_max_files": 20
}
```

**Placement**: Sibling to `sizing`, `phases`, `options`. Sits after `sizing` for logical grouping (both relate to workflow scaling).

**No changes to existing fields**: `sizing.thresholds`, `performance_budgets`, `agent_modifiers` are all unchanged.

### 15.3 quick-scan-agent.md

**No changes required**. The quick scan agent continues to produce scope estimates as before. The tier is now computed from Phase 02 impact analysis metrics in the analyze handler, not from Phase 00 quick scan output.

### 15.4 isdlc.md (analyze handler)

**After Phase 02 completes**: Read impact-analysis.md via `parseSizingFromImpactAnalysis()`, compute `recommended_tier` using `computeRecommendedTier()`, and persist to meta.json top level. See [Section 3 (AD-02)](#3-ad-02-tier-computed-from-impact-analysis-metrics) for the full data flow.

**Step 8 extension**: After "Analysis complete" message, conditionally append tier recommendation line.

### 15.5 isdlc.md (build handler)

**New step 4a-tier**: Inserted between step 4 and step 4a. See [Section 8](#8-ad-07-build-handler-integration-point) for full specification.

**New TRIVIAL TIER EXECUTION section**: Labeled block after the existing build flow. See [Section 14](#14-trivial-tier-execution-design) for full specification.

### 15.6 common.cjs

**No changes required**. `readMetaJson()` defensive defaults do not cover tier fields (by design -- missing tier fields are treated as null/undefined by consumers). `writeMetaJson()` writes whatever fields are in the meta object. `computeStartPhase()` does not reference tier fields (CON-004 -- tier and sizing are independent).

### 15.7 gate-blocker.cjs

**No changes required**. Per NFR-005, the trivial tier never creates `active_workflow` in state.json, so gate-blocker never fires for trivial changes. For non-trivial tiers, the existing gate logic is unchanged.

### 15.8 Hooks (state-write-validator, phase-loop-controller, phase-sequence-guard)

**No changes required**. The trivial tier never triggers any hooks (NFR-005). Non-trivial tiers trigger hooks through the existing unchanged workflow flow.

---

## 16. Test Architecture

### 16.1 New Test Suites in test-three-verb-utils.test.cjs

```
describe('computeRecommendedTier()')
  describe('base thresholds (AC-002a)')
    it('returns trivial for 0 files')
    it('returns trivial for 1 file')
    it('returns trivial for 2 files')
    it('returns light for 3 files')
    it('returns light for 8 files')
    it('returns standard for 9 files')
    it('returns standard for 20 files')
    it('returns epic for 21 files')
    it('returns epic for 100 files')

  describe('risk-based promotion (AC-002b)')
    it('promotes trivial to light for medium risk')
    it('promotes trivial to light for high risk')
    it('promotes light to standard for medium risk')
    it('promotes standard to epic for high risk')
    it('does not promote epic (ceiling)')
    it('does not promote for low risk')
    it('does not promote for null risk')
    it('does not promote for undefined risk')

  describe('invalid input handling (AC-002c)')
    it('returns standard for null estimatedFiles')
    it('returns standard for undefined estimatedFiles')
    it('returns standard for NaN estimatedFiles')
    it('returns standard for negative estimatedFiles')
    it('returns standard for string estimatedFiles')

  describe('unrecognized riskLevel (AC-002d)')
    it('treats "critical" as low (no promotion)')
    it('treats "MEDIUM" (wrong case) as low')
    it('treats empty string as low')

  describe('custom thresholds (CON-002)')
    it('uses custom thresholds when provided')
    it('uses defaults when thresholds is null')
    it('uses defaults when thresholds is undefined')

describe('getTierDescription()')
  it('returns correct object for trivial (AC-009a)')
  it('returns correct object for light (AC-009a)')
  it('returns correct object for standard (AC-009a)')
  it('returns correct object for epic (AC-009a)')
  it('returns Unknown for unrecognized tier (AC-009b)')
  it('returns Unknown for null')
  it('returns Unknown for undefined')
  it('returns Unknown for empty string')

describe('TIER_ORDER')
  it('contains exactly 4 tiers in order')
  it('matches the tiers used by computeRecommendedTier')
```

**Estimated**: 30-35 test cases, ~200 lines

### 16.2 Manual Test Cases (isdlc.md -- not automatable)

| ID | Scenario | Steps | Expected | Traces |
|----|----------|-------|----------|--------|
| MT-01 | Analyze displays tier | Run `/isdlc analyze {item}` through all phases | Step 8 shows "Recommended tier: {tier}" | AC-004a |
| MT-02 | Analyze with no tier | Create legacy meta.json without `recommended_tier`, run analyze step 8 | No tier line displayed | AC-004b |
| MT-03 | Build shows tier menu | Run `/isdlc build {item}` with recommended_tier in meta.json | Menu displays with RECOMMENDED marker | AC-005a |
| MT-04 | Build default selection | Press Enter at tier menu | Recommended tier is used | AC-005b |
| MT-05 | Build no recommendation | Remove `recommended_tier` from meta.json, run build | Default to "standard", show warning | AC-005c |
| MT-06 | Trivial execution happy path | Select trivial, make edit, confirm | Edit committed, change-record.md created, meta.json updated | AC-006a-d, AC-007a,c |
| MT-07 | Trivial state isolation | Capture state.json before, select trivial, capture after | state.json byte-identical | AC-NFR-005a |
| MT-08 | Trivial append to existing | Run two trivial changes for same slug | change-record.md has two entries separated by --- | AC-007b |
| MT-09 | Override tier | Recommended is light, select standard | meta.json has tier_override field | AC-005e |
| MT-10 | --trivial flag | Run `/isdlc build {item} --trivial` | Confirmation prompt, then trivial execution | AC-NFR-001b |
| MT-11 | Epic placeholder | Select epic tier | Standard workflow runs with placeholder message | CON-003 |
| MT-12 | Error during trivial | Introduce error during edit | Error reported, no change record written | AC-006e |

### 16.3 Integration Test Candidates (sizing-consent.test.cjs extension)

| Test | Description | Purpose |
|------|-------------|---------|
| meta.json tier field persistence | Write recommended_tier, read back, verify | Verify readMetaJson/writeMetaJson handle tier fields |
| tier_override structure | Write tier_override object, verify structure | Verify override recording |
| Backward compat: old meta.json | Read meta.json without tier fields | Verify no errors, undefined values |

---

## Phase Gate Validation (GATE-03 -- Architecture, Analysis Mode)

- [x] All 7 architecture decisions documented with rationale
- [x] Function signatures specified for new utility functions
- [x] Data flow diagrams for all major flows (recommendation, selection, execution)
- [x] Tier scoring algorithm fully specified with boundary values
- [x] Trivial tier execution path designed with error handling
- [x] meta.json schema extension defined with backward compatibility
- [x] change-record.md schema defined
- [x] Integration points with all 8 affected/unaffected modules documented
- [x] Test architecture defined (automated + manual)
- [x] Each decision traces to specific requirements (FR/NFR/CON)
- [x] NFR-005 (state isolation) enforcement strategy documented
- [x] CON-001 (no new agents) compliance verified
- [x] CON-002 (config not code) compliance verified
- [x] CON-003 (epic placeholder) compliance verified
- [x] CON-004 (tier != sizing) relationship clarified

---

*Architecture completed in ANALYSIS MODE -- no state.json writes, no branches created.*
