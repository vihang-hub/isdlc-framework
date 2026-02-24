# Module Design: Three-Verb Backlog Model (REQ-0023)

**Phase**: 04-design
**Feature**: Three-verb backlog model (add/analyze/build)
**Version**: 1.0.0
**Created**: 2026-02-18
**Author**: System Designer (Agent 04)
**Traces**: FR-001 through FR-009, ADR-0012 through ADR-0015

---

## 1. Module Overview

This feature modifies 4 modules spanning 12 files. No new files are created -- all changes are modifications to existing files. The modules are:

| Module | Files | Execution Mode | Primary FRs |
|--------|-------|---------------|-------------|
| M1: Command Surface | `isdlc.md` | Inline (add, analyze) / Orchestrated (build) | FR-001, FR-002, FR-003, FR-005 |
| M2: Intent Detection | `CLAUDE.md`, `CLAUDE.md.template` | N/A (prompt-level) | FR-004 |
| M3: Orchestrator | `00-sdlc-orchestrator.md` | Orchestrated (build) | FR-006 |
| M4: Hook Enforcement | `skill-delegation-enforcer.cjs`, `delegation-gate.cjs` + 2 test files | Hook dispatch | FR-008 |

Cross-cutting concerns (meta.json schema FR-009, BACKLOG.md markers FR-007) are implemented within M1 as utility functions.

---

## 2. Module M1: Command Surface (isdlc.md)

### 2.1 Responsibilities

The command surface module is the central dispatch point. It:
1. Defines the `add`, `analyze`, and `build` action handlers
2. Contains shared utility functions (item resolution, BACKLOG marker update, meta.json read/write)
3. Routes actions to inline execution or orchestrator delegation
4. Replaces SCENARIO 5 (Phase A Pipeline) and the `start`/`analyze` (old) action definitions

### 2.2 Sections to Remove

These sections are completely eliminated from `isdlc.md`:

| Section | Line Range (approx) | Reason |
|---------|---------------------|--------|
| SCENARIO 5: Phase A -- Preparation Pipeline | Lines 232-289 | Replaced by add + analyze handlers |
| `analyze` action definition (old) | Lines 576-587 | Replaced by new `analyze` action |
| `start` action definition | Lines 591-619 | Replaced by `build` action |
| Phase B consumption block in Phase-Loop Controller | Lines 923-929 | Build always starts from Phase 00 |
| Flow Summary references to Phase A/start | Lines 1455-1456 | Updated to new verbs |

### 2.3 Sections to Add

#### 2.3.1 Shared Utility: `readMetaJson(slugDir)`

**Location**: New subsection after SCENARIO 4, before Actions section. Title: "Shared Utilities".

**Pseudocode**:
```
function readMetaJson(slugDir):
    metaPath = path.join(slugDir, 'meta.json')

    IF metaPath does not exist:
        return null

    TRY:
        raw = JSON.parse(readFile(metaPath))
    CATCH:
        ERROR "Corrupted meta.json in {slugDir}/. Cannot parse metadata."
        return null

    // Legacy migration: phase_a_completed -> analysis_status + phases_completed
    IF 'phase_a_completed' IN raw AND 'analysis_status' NOT IN raw:
        IF raw.phase_a_completed === true:
            raw.analysis_status = 'analyzed'
            raw.phases_completed = [
                '00-quick-scan', '01-requirements',
                '02-impact-analysis', '03-architecture', '04-design'
            ]
        ELSE:
            raw.analysis_status = 'raw'
            raw.phases_completed = []

    // Defensive defaults for missing fields
    IF NOT raw.analysis_status:
        raw.analysis_status = 'raw'
    IF NOT Array.isArray(raw.phases_completed):
        raw.phases_completed = []
    IF NOT raw.source:
        raw.source = 'manual'
    IF NOT raw.created_at:
        raw.created_at = new Date().toISOString()

    return raw
```

**Traces**: FR-009 (AC-009-01 through AC-009-05)

#### 2.3.2 Shared Utility: `writeMetaJson(slugDir, meta)`

**Pseudocode**:
```
function writeMetaJson(slugDir, meta):
    metaPath = path.join(slugDir, 'meta.json')

    // Never write legacy field
    delete meta.phase_a_completed

    // Derive analysis_status from phases_completed for consistency
    ANALYSIS_PHASES = ['00-quick-scan', '01-requirements', '02-impact-analysis',
                       '03-architecture', '04-design']
    completedCount = count of meta.phases_completed entries that are in ANALYSIS_PHASES

    IF completedCount == 0: meta.analysis_status = 'raw'
    ELSE IF completedCount < 5: meta.analysis_status = 'partial'
    ELSE IF completedCount >= 5: meta.analysis_status = 'analyzed'

    writeFile(metaPath, JSON.stringify(meta, null, 2))
```

**Traces**: FR-009 (AC-009-01, AC-009-02)

#### 2.3.3 Shared Utility: `generateSlug(description)`

**Pseudocode**:
```
function generateSlug(description):
    slug = description
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')  // Remove non-alphanumeric
        .replace(/\s+/g, '-')           // Spaces to hyphens
        .replace(/-+/g, '-')            // Collapse multiple hyphens
        .replace(/^-|-$/g, '')          // Trim leading/trailing hyphens
        .substring(0, 50)               // Max 50 chars

    IF slug is empty: slug = 'untitled-item'

    return slug
```

**Traces**: FR-001 (AC-001-01)

#### 2.3.4 Shared Utility: `resolveItem(input)`

Implements ADR-0015 priority chain resolution.

**Pseudocode**:
```
function resolveItem(input):
    input = input.trim()

    // Strategy 1: Exact slug match
    slugDir = path.join('docs/requirements', input)
    IF exists(path.join(slugDir, 'meta.json')):
        return { slug: input, dir: slugDir, meta: readMetaJson(slugDir) }

    // Also try with common prefixes
    FOR each dir IN listDirectories('docs/requirements/'):
        IF dir ends with '-' + input:
            return { slug: dir, dir: path.join('docs/requirements', dir),
                     meta: readMetaJson(path.join('docs/requirements', dir)) }

    // Strategy 2: BACKLOG.md item number (N.N pattern)
    IF input matches /^\d+\.\d+$/:
        item = findBacklogItemByNumber(input)
        IF item:
            return item

    // Strategy 3: External reference (#N or PROJECT-N)
    IF input matches /^#\d+$/ OR input matches /^[A-Z]+-\d+$/i:
        item = findByExternalRef(input)
        IF item:
            return item

    // Strategy 4: Fuzzy description match
    matches = searchBacklogTitles(input)
    IF matches.length == 1:
        return matches[0]
    IF matches.length > 1:
        // Present disambiguation menu
        choice = askUser("Multiple matches found:", matches.map(m => m.title))
        return matches[choice]

    // No match
    return null
```

**Traces**: FR-002 (step 1), FR-003 (step 1), ADR-0015

#### 2.3.5 Shared Utility: `updateBacklogMarker(slug, newMarker)`

Implements ADR-0014 marker system.

**Pseudocode**:
```
MARKER_REGEX = /^(\s*-\s+)(\d+\.\d+)\s+\[([ ~Ax])\]\s+(.+)$/

function updateBacklogMarker(slug, newMarker):
    // newMarker is one of: ' ', '~', 'A', 'x'
    backlogPath = 'BACKLOG.md'
    IF NOT exists(backlogPath): return  // Nothing to update

    lines = readFile(backlogPath).split('\n')
    updated = false

    FOR i = 0 TO lines.length - 1:
        match = lines[i].match(MARKER_REGEX)
        IF match:
            // Check if this line references our slug
            lineText = match[4]  // description text
            IF lineText contains slug OR lineText contains slug's description:
                lines[i] = match[1] + match[2] + ' [' + newMarker + '] ' + match[4]
                updated = true
                BREAK

    IF updated:
        writeFile(backlogPath, lines.join('\n'))
```

**Traces**: FR-007 (AC-007-01 through AC-007-06)

#### 2.3.6 Shared Utility: `appendToBacklog(itemNumber, description, marker)`

**Pseudocode**:
```
function appendToBacklog(itemNumber, description, marker = ' '):
    backlogPath = 'BACKLOG.md'

    IF NOT exists(backlogPath):
        // Create with standard structure
        content = "# Backlog\n\n## Open\n\n## Completed\n"
        writeFile(backlogPath, content)

    lines = readFile(backlogPath).split('\n')

    // Find the ## Open section
    openIndex = lines.findIndex(l => l.match(/^##\s+Open/))
    IF openIndex == -1:
        // Append ## Open section
        lines.push('', '## Open', '')
        openIndex = lines.length - 2

    // Find the end of the Open section (next ## heading or EOF)
    insertIndex = openIndex + 1
    WHILE insertIndex < lines.length AND NOT lines[insertIndex].match(/^##\s/):
        insertIndex++

    // Insert new item before the next section
    newLine = '- ' + itemNumber + ' [' + marker + '] ' + description
    lines.splice(insertIndex, 0, newLine)

    writeFile(backlogPath, lines.join('\n'))
```

**Traces**: FR-001 (AC-001-04), FR-007 (AC-007-01)

#### 2.3.7 Shared Utility: `deriveAnalysisStatus(phasesCompleted)`

**Pseudocode**:
```
ANALYSIS_PHASES = ['00-quick-scan', '01-requirements', '02-impact-analysis',
                   '03-architecture', '04-design']

function deriveAnalysisStatus(phasesCompleted):
    completedCount = phasesCompleted.filter(p => ANALYSIS_PHASES.includes(p)).length

    IF completedCount == 0: return 'raw'
    IF completedCount < 5:  return 'partial'
    IF completedCount >= 5: return 'analyzed'
```

**Traces**: FR-009 (AC-009-01), Architecture Section 4.2

#### 2.3.8 Shared Utility: `deriveBacklogMarker(analysisStatus)`

**Pseudocode**:
```
function deriveBacklogMarker(analysisStatus):
    SWITCH analysisStatus:
        CASE 'raw':      return ' '
        CASE 'partial':  return '~'
        CASE 'analyzed': return 'A'
        DEFAULT:         return ' '
```

**Traces**: FR-007 (AC-007-01 through AC-007-03)

### 2.4 Action Handler: `add`

**Location**: New action definition after the existing `upgrade` action, before the `discover` redirect.

**Markdown Specification for isdlc.md**:

```markdown
**add** - Add a new item to the backlog
\```
/isdlc add "Add payment processing"
/isdlc add "#42"
/isdlc add "JIRA-1250"
\```
1. Does NOT require an active workflow -- runs inline
2. Does NOT write to state.json, does NOT create branches, does NOT invoke hooks
3. Parse input to identify source type:
   a. GitHub issue (`#N` pattern): source = "github", source_id = "GH-N"
   b. Jira ticket (`PROJECT-N` pattern): source = "jira", source_id = input
   c. All other input: source = "manual", source_id = null
4. Generate slug from description using `generateSlug()`
5. Peek at `.isdlc/state.json` -> `counters.next_req_id` (READ-ONLY, do NOT increment)
   - If state.json unreadable: scan `docs/requirements/` for highest REQ-NNNN, use NNNN+1
6. Compose full directory name: use description-based slug only (no REQ-NNNN prefix at add time;
   prefix is assigned when build creates the workflow)
7. Check for slug collision in `docs/requirements/`:
   - If exists: warn "This item already has a folder. Update it or choose a different name?"
   - Options: [U] Update draft | [R] Rename | [C] Cancel
8. Create `docs/requirements/{slug}/draft.md` with source content and metadata header
9. Create `docs/requirements/{slug}/meta.json` with new v2 schema:
   {
     "source": "{source}",
     "source_id": "{source_id}",
     "slug": "{slug}",
     "created_at": "{ISO-8601}",
     "analysis_status": "raw",
     "phases_completed": [],
     "codebase_hash": "{git rev-parse --short HEAD}"
   }
10. Append to BACKLOG.md Open section using `appendToBacklog()` with `[ ]` marker
11. Confirm: "Added '{description}' to the backlog. You can analyze it now or come back later."
```

**Constraints** (rendered as a callout in isdlc.md):
- No state.json writes (NFR-002)
- No workflow creation (NFR-002)
- No branch creation
- Performance target: under 5 seconds (NFR-004)
- No orchestrator delegation (ADR-0012)

**Traces**: FR-001 (all ACs), FR-005 (AC-005-02)

### 2.5 Action Handler: `analyze`

**Location**: Replaces the old `analyze` action definition.

**Markdown Specification for isdlc.md**:

```markdown
**analyze** - Run interactive analysis on a backlog item
\```
/isdlc analyze "payment-processing"
/isdlc analyze "3.2"
/isdlc analyze "#42"
/isdlc analyze "JIRA-1250"
\```
1. Does NOT require an active workflow -- runs inline (no orchestrator)
2. Does NOT write to state.json, does NOT create branches
3. Resolve target item using `resolveItem(input)`:
   - If no match: "No matching item found. Would you like to add it to the backlog first?"
     If user confirms: run `add` handler with the input, then continue with analysis
4. Read meta.json using `readMetaJson()`:
   - If meta.json missing (folder exists but no meta): create default meta.json with
     analysis_status: "raw", phases_completed: [], then continue
5. Determine next analysis phase:
   ANALYSIS_PHASE_SEQUENCE = [
     "00-quick-scan", "01-requirements", "02-impact-analysis",
     "03-architecture", "04-design"
   ]
   nextPhase = first phase in ANALYSIS_PHASE_SEQUENCE not in meta.phases_completed
6. If all phases complete (nextPhase is null):
   a. Check codebase staleness: compare meta.codebase_hash with current git HEAD short SHA
   b. If hashes match: "Analysis is already complete and current. Nothing to do."
   c. If hashes differ: warn "Codebase has changed since analysis ({N} commits).
      Re-run analysis?" Options: [R] Re-analyze from Phase 00 | [C] Cancel
      If re-analyze: clear phases_completed, set analysis_status to "raw", continue from Phase 00
7. For each remaining phase starting from nextPhase:
   a. Display: "Running Phase {NN} ({phase name})..."
   b. Delegate to the standard phase agent via Task tool:
      - Phase 00: Agent 00 (quick-scan) -> produces quick-scan.md
      - Phase 01: Agent 01 (requirements-analyst) -> produces requirements-spec.md, user-stories.json
      - Phase 02: Agent 02 (impact-analysis-orchestrator) -> produces impact-analysis.md
      - Phase 03: Agent 03 (solution-architect) -> produces architecture-overview.md
      - Phase 04: Agent 04 (system-designer) -> produces interface-spec.yaml, module-designs/
   c. Append phase key to meta.phases_completed
   d. Update meta.analysis_status using deriveAnalysisStatus()
   e. Update meta.codebase_hash to current git HEAD short SHA
   f. Write meta.json using writeMetaJson()
   g. Update BACKLOG.md marker using updateBacklogMarker() with deriveBacklogMarker()
   h. Offer exit point: "Phase {NN} complete. Continue to Phase {NN+1} ({name})? [Y/n]"
      If user declines: stop. Analysis is resumable from the next phase.
8. After final phase: "Analysis complete. {slug} is ready to build."
```

**Phase Agent Delegation Context**:

When delegating to each phase agent during analysis, provide this Task context:

```
ANALYSIS MODE: This is an offline analysis (not a workflow). Write artifacts to
docs/requirements/{slug}/ only. Do NOT read or write .isdlc/state.json.
Do NOT create branches. Do NOT check for active_workflow.

ARTIFACT FOLDER: docs/requirements/{slug}/
DESCRIPTION: {item description from draft.md}
REQUIREMENTS: {path to requirements-spec.md if it exists}
```

**Constraints**:
- No state.json writes (NFR-002)
- No workflow creation (active_workflow stays null)
- No branch creation
- Can run in parallel with an active build workflow (zero shared state)
- Resumable at any phase boundary (NFR-003)
- Phase transition overhead under 2 seconds (NFR-004)

**Traces**: FR-002 (all ACs), FR-005 (AC-005-03, AC-005-06)

### 2.6 Action Handler: `build`

**Location**: New action definition, placed between `analyze` and `discover`.

**Markdown Specification for isdlc.md**:

```markdown
**build** - Start a feature workflow for a backlog item
\```
/isdlc build "payment-processing"
/isdlc build "3.2"
/isdlc build "#42"
/isdlc build "Feature description"
/isdlc build "payment-processing" --supervised
/isdlc build "payment-processing" --debate
\```
1. Validate constitution exists and is not a template
2. Check no active workflow (block if one exists, suggest `/isdlc cancel` first)
3. Resolve target item using `resolveItem(input)`:
   - If no match and input looks like a description (not a slug/number/ref):
     "No matching item found. Would you like to add it to the backlog and start building?"
     If user confirms: run `add` handler, then proceed to step 4
   - If no match and input looks like a reference: ERROR per error taxonomy ERR-BUILD-001
4. Read meta.json using `readMetaJson()` -- informational for this release
   - Log analysis_status to workflow metadata (for future 16.5 smart phase detection)
5. Parse flags from command arguments:
   - --supervised, --debate, --no-debate, --no-fan-out, -light (same as current feature)
6. Determine workflow type:
   - If item description contains bug keywords (fix, bug, broken, error, crash, regression):
     suggest fix workflow. Ask user: "This looks like a bug. Use fix workflow? [Y/n]"
   - Otherwise: use feature workflow
7. Delegate to orchestrator via Task tool (same as current `feature` action):
   MODE: init-and-phase-01
   ACTION: feature (or fix)
   DESCRIPTION: "{item description}"
   FLAGS: {parsed flags}
   (include MONOREPO CONTEXT if applicable)
8. Orchestrator initializes active_workflow, creates branch, runs Phase 01
9. Phase-Loop Controller drives remaining phases (identical to current feature flow)
```

**Backward Compatibility**:

```markdown
**feature** (alias for build) - Start a new feature workflow
\```
/isdlc feature "Feature description"
/isdlc feature "Feature description" --supervised
/isdlc feature                        (no description -- presents interactive menu)
\```
The `feature` action is preserved as an alias for `build`. When invoked with a description,
it behaves identically to `build`. When invoked without a description, it delegates to the
orchestrator which presents the SCENARIO 3 menu (with Add/Analyze/Build/Fix options).
```

**Traces**: FR-003 (all ACs), FR-005 (AC-005-04, AC-005-06)

### 2.7 Action Routing Update (Phase-Loop Controller)

The existing routing block (around line 912) must be updated:

**Current routing**:
```
If action is `analyze` (Phase A): Execute Phase A Pipeline
If action is a WORKFLOW command (feature, fix, test-run, test-generate, start, upgrade):
    Use Phase-Loop Controller
```

**New routing**:
```
If action is `add`: Execute add handler inline -- no orchestrator, no Phase-Loop Controller
If action is `analyze`: Execute analyze handler inline -- no orchestrator, no Phase-Loop Controller
If action is `build` or `feature`: Execute via Phase-Loop Controller (orchestrator delegation)
If action is `fix`: Execute via Phase-Loop Controller (unchanged)
If action is a WORKFLOW command (test-run, test-generate, upgrade): Phase-Loop Controller (unchanged)
```

Remove the Phase B consumption block entirely (lines 923-929). Build always starts from Phase 00.

**Traces**: FR-005 (AC-005-06)

### 2.8 QUICK REFERENCE Update

The Flow Summary at the end of isdlc.md must be updated:

**Current**:
```
/isdlc analyze ...  -> Phase A Preparation Pipeline (no workflow, no state.json)
/isdlc start ...    -> Phase-Loop Controller (validate meta -> init from Phase 02)
```

**New**:
```
/isdlc add ...      -> Inline handler (no workflow, no state.json, no orchestrator)
/isdlc analyze ...  -> Inline handler (phase agents 00-04, no workflow, no state.json)
/isdlc build ...    -> Phase-Loop Controller (init -> tasks -> direct-agent-loop -> finalize)
/isdlc feature ...  -> Alias for build (identical behavior)
```

Remove:
- `/isdlc start ...` line
- `/isdlc feature` (no args) Backlog Picker reference
- `/isdlc fix` (no args) Backlog Picker reference

Update no-args behavior:
```
/isdlc (no args)    -> Task -> orchestrator -> Interactive Menu -> User Selection -> Action
/isdlc feature      -> Task -> orchestrator -> SCENARIO 3 Menu (Add/Analyze/Build/Fix)
/isdlc fix          -> Task -> orchestrator -> SCENARIO 3 Menu (Add/Analyze/Build/Fix)
```

**Traces**: FR-005 (AC-005-08)

### 2.9 Complete Section Elimination Checklist

All occurrences of these patterns must be removed from isdlc.md:

| Pattern | Count (estimated) | Replacement |
|---------|-------------------|-------------|
| "Phase A" | ~20 | Remove or replace with "analysis" |
| "Phase B" | ~15 | Remove or replace with "build workflow" |
| "phase_a_completed" | ~8 | Replace with "analysis_status" |
| "SCENARIO 5" | ~3 | Remove entirely |
| "/isdlc start" | ~5 | Remove entirely |
| "Backlog Picker" (in isdlc.md) | ~4 | Remove or replace with SCENARIO 3 menu |

**Traces**: FR-005 (AC-005-01)

---

## 3. Module M2: Intent Detection (CLAUDE.md + CLAUDE.md.template)

### 3.1 Responsibilities

The intent detection module maps natural language to `/isdlc {verb}` commands. It is implemented as a markdown table in CLAUDE.md (runtime) and CLAUDE.md.template (new installs).

### 3.2 CLAUDE.md Changes

#### 3.2.1 Intent Detection Table (Step 1)

**Current table** (to be replaced):
```
| Intent | Signal Words / Patterns | Command (internal) |
|-------------|-----------------------------------------------|-------------------------------|
| **Feature** | add, build, implement, create, new feature, refactor, redesign | `/isdlc feature "<description>"` |
| **Fix** | broken, fix, bug, crash, error, wrong, failing, not working, 500 | `/isdlc fix "<description>"` |
```

**New table**:
```
| Intent | Signal Words / Patterns | Command (internal) |
|-------------|-----------------------------------------------|-------------------------------|
| **Add** | add to backlog, track this, log this, remember this, save this idea, note this down | `/isdlc add "<description>"` |
| **Analyze** | analyze, think through, plan this, review requirements, assess impact, design this, prepare | `/isdlc analyze "<item>"` |
| **Build** | build, implement, create, code, develop, ship, make this, let's do this, refactor, redesign | `/isdlc build "<description>"` |
| **Fix** | broken, fix, bug, crash, error, wrong, failing, not working, 500 | `/isdlc fix "<description>"` |
| **Upgrade** | upgrade, update, bump, version, dependency, migrate | `/isdlc upgrade "<target>"` |
| **Test run** | run tests, run the tests, check if tests pass, execute test suite | `/isdlc test run` |
| **Test generate** | write tests, add tests, add unit tests, generate tests, test coverage | `/isdlc test generate` |
| **Discovery** | set up, configure, initialize, discover, setup the project | `/discover` |
| **Skill mgmt** | add a skill, register skill, new skill, wire skill, bind skill, list skills, show skills, remove skill, delete skill | `/isdlc skill {subcommand}` |
```

**Key changes from current CLAUDE.md table**:
1. **Feature** row replaced by **Build** (signal words "add" removed from Build to avoid conflict with Add intent; "refactor" and "redesign" stay with Build)
2. **Add** is a new row with backlog-specific signal words
3. **Analyze** is a new row (replaces implicit "analyze" behavior hidden in Feature)
4. All other rows unchanged

**Traces**: FR-004 (AC-004-01 through AC-004-05)

#### 3.2.2 Disambiguation Rule

Add this paragraph after the intent detection table:

```
**Disambiguation**: If the user's intent could match both Add and Analyze (e.g., "add and
analyze this"), resolve to **Analyze** -- the analyze verb implicitly runs add first if the
item does not yet exist. If the intent could match both Analyze and Build (e.g., "let's work
on this"), resolve to **Build** -- build encompasses the full workflow. If truly ambiguous,
ask a brief clarifying question.
```

**Traces**: FR-004 (AC-004-08)

#### 3.2.3 Edge Cases Update (Step 3)

Add this bullet to the existing edge cases list:

```
- **Refactor requests**: Treat refactoring as a Build intent (refactoring follows the feature workflow)
```

(Replace the current "Treat refactoring as a feature intent" wording.)

#### 3.2.4 Remove Preparation Pipeline Paragraph

Remove this paragraph from CLAUDE.md (currently appears after the intent table in the template):
```
**Preparation Pipeline**: Requirements can be prepared ahead of time (Phase A)...
```

This paragraph is specific to CLAUDE.md.template, not the dogfooding CLAUDE.md. For the template, it is replaced by nothing -- the three-verb model is self-documenting.

### 3.3 CLAUDE.md.template Changes

#### 3.3.1 Intent Detection Table

Replace the current 9-row table (Feature, Fix, Intake, Analyze, Start (Phase B), Upgrade, Test run, Test generate, Discovery) with the same 9-row table from Section 3.2.1 above (Add, Analyze, Build, Fix, Upgrade, Test run, Test generate, Discovery, Skill mgmt).

**Rows to remove**:
- `Intake` (merged into `Add`)
- `Analyze` (old Phase A semantics, replaced by new `Analyze`)
- `Start (Phase B)` (replaced by `Build`)

**Rows to add**:
- `Add` (new)
- `Analyze` (new semantics)
- `Build` (new)

#### 3.3.2 Remove "Preparation Pipeline" Paragraph

Remove the paragraph starting with "**Preparation Pipeline**: Requirements can be prepared ahead of time (Phase A)..." that appears after the intent table.

#### 3.3.3 Remove Phase A References

Remove any remaining references to `phase_a_completed` in the Jira integration section of the template (if present).

**Traces**: FR-004 (AC-004-06, AC-004-07)

---

## 4. Module M3: Orchestrator (00-sdlc-orchestrator.md)

### 4.1 Responsibilities

The orchestrator module:
1. Presents the interactive menu when `/isdlc` is invoked with no arguments
2. Initializes workflows when `build` delegates to it
3. Manages workflow state in state.json

Changes are concentrated in two areas: SCENARIO 3 menu and BACKLOG PICKER removal.

### 4.2 BACKLOG PICKER Removal

**Entire section to remove**: Lines 222-281 (the "# BACKLOG PICKER (No-Description Feature/Fix)" section).

This includes:
- Feature Mode Sources
- Fix Mode Sources
- Jira Metadata Parsing
- Workflow Init with Jira Context
- Presentation Rules

**Reason**: The backlog picker functionality is replaced by the SCENARIO 3 menu which now offers Add/Analyze/Build/Fix options. When the user selects "Build", they provide a description or reference to an existing item -- the item resolution logic in isdlc.md handles finding the right item.

**Traces**: FR-006 (AC-006-01, AC-006-05)

### 4.3 SCENARIO 3 Menu Update

**Current SCENARIO 3**:
```
[1] New Feature       -- Implement a new feature end-to-end
[2] Fix               -- Fix a bug or defect
[3] Run Tests         -- Execute existing automation tests
[4] Generate Tests    -- Create new tests for existing code
[5] View Status       -- Check current project status
[6] Upgrade           -- Upgrade a dependency, runtime, or tool
```

**New SCENARIO 3**:
```
[1] Add to Backlog    -- Add an item to the backlog for later
[2] Analyze           -- Think through requirements, impact, and design for a backlog item
[3] Build             -- Start implementing a feature end-to-end
[4] Fix               -- Fix a bug or defect
[5] Run Tests         -- Execute existing automation tests
[6] Generate Tests    -- Create new tests for existing code
[7] View Status       -- Check current project status
[8] Upgrade           -- Upgrade a dependency, runtime, or tool
```

**Option handling**:
- Option [1] -> Ask user for description, then execute `/isdlc add "{description}"`
- Option [2] -> Ask user which item to analyze (by name, number, or reference), then execute `/isdlc analyze "{item}"`
- Option [3] -> Ask user for description or item reference, then execute `/isdlc build "{item}"`
- Option [4] -> Ask user for bug description, then execute `/isdlc fix "{description}"`
- Options [5]-[8] -> Same as current [3]-[6]

**Traces**: FR-006 (AC-006-02, AC-006-04)

### 4.4 COMMANDS YOU SUPPORT Update

**Current**:
```
- /isdlc feature "<description>": Start a new feature workflow
- /isdlc fix "<description>": Start a bug fix workflow
```

**New**:
```
- /isdlc add "<description>": Add an item to the backlog
- /isdlc analyze "<item>": Run interactive analysis on a backlog item
- /isdlc build "<item>": Start a feature workflow for a backlog item
- /isdlc feature "<description>": Start a new feature workflow (alias for build)
- /isdlc fix "<description>": Start a bug fix workflow
```

**Traces**: FR-006 (AC-006-03, AC-006-04)

### 4.5 Workflow Available Workflows Table Update

Update the table in Section 3 (Workflow Selection & Initialization):

**Add row**:
```
| `/isdlc build` | feature | 00 -> 01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 16 -> 08 | Build a feature (same as /isdlc feature) |
```

**Traces**: FR-003 (AC-003-06)

---

## 5. Module M4: Hook Enforcement (skill-delegation-enforcer.cjs, delegation-gate.cjs)

### 5.1 Responsibilities

The hook enforcement module ensures that commands requiring orchestrator delegation go through the orchestrator, while inline commands (add, analyze) are exempt.

### 5.2 skill-delegation-enforcer.cjs Changes

**Single-line change** at line 36:

**Current**:
```javascript
const EXEMPT_ACTIONS = new Set(['analyze']);
```

**New**:
```javascript
const EXEMPT_ACTIONS = new Set(['add', 'analyze']);
```

**Comment update** at line 32-35:

**Current**:
```javascript
/**
 * BUG-0021: Subcommands that run inline (Phase A) without orchestrator delegation.
 * When the first non-flag word in args matches, skip writing pending_delegation
 * and skip the mandatory delegation context message.
 */
```

**New**:
```javascript
/**
 * REQ-0023: Three-verb model inline commands that run without orchestrator delegation.
 * `add` creates backlog items inline. `analyze` runs analysis phases inline.
 * Both skip pending_delegation and mandatory delegation context.
 * `build` is NOT exempt -- it goes through standard orchestrator delegation.
 */
```

**Traces**: FR-008 (AC-008-01, AC-008-02, AC-008-03)

### 5.3 delegation-gate.cjs Changes

**Single-line change** at line 31:

**Current**:
```javascript
const EXEMPT_ACTIONS = new Set(['analyze']);
```

**New**:
```javascript
const EXEMPT_ACTIONS = new Set(['add', 'analyze']);
```

**Comment update** at line 27-30:

**Current**:
```javascript
/**
 * BUG-0021: Subcommands that run inline without orchestrator delegation.
 * Defense-in-depth: if a pending_delegation marker exists for an exempt action,
 * auto-clear it without blocking.
 */
```

**New**:
```javascript
/**
 * REQ-0023: Three-verb model inline commands exempt from delegation enforcement.
 * Defense-in-depth: if a pending_delegation marker exists for an exempt action
 * (add, analyze), auto-clear it without blocking.
 * `build` is NOT exempt -- delegation must occur.
 */
```

**Traces**: FR-008 (AC-008-01, AC-008-02, AC-008-03)

### 5.4 Test File Changes

#### 5.4.1 test-skill-delegation-enforcer.test.cjs

**BUG-0021 section header update**:
- Change: "Phase A analyze carve-out (BUG-0021)" to "Three-verb model inline carve-out (REQ-0023)"

**New test cases to add** (parallel to existing `analyze` tests):

```javascript
// Test: 'add' action is exempt from delegation
test('add action exempt from delegation enforcement', async () => {
    const input = {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'add "Add payment processing"' }
    };
    const { exitCode, stdout } = await runHook(hookPath, input);
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(stdout.trim(), '');
    // Verify no pending_delegation marker was written
    const marker = readPendingDelegation(testDir);
    assert.strictEqual(marker, null);
});

// Test: 'add' with flags still exempt
test('add action with flags exempt from delegation', async () => {
    const input = {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: '--verbose add "#42"' }
    };
    const { exitCode, stdout } = await runHook(hookPath, input);
    assert.strictEqual(exitCode, 0);
    assert.strictEqual(stdout.trim(), '');
});

// Test: 'build' is NOT exempt (requires delegation)
test('build action requires delegation enforcement', async () => {
    setupState({ /* valid state */ });
    const input = {
        tool_name: 'Skill',
        tool_input: { skill: 'isdlc', args: 'build "payment-processing"' }
    };
    const { exitCode, stdout } = await runHook(hookPath, input);
    assert.strictEqual(exitCode, 0);
    assert.ok(stdout.includes('MANDATORY'));
    // Verify pending_delegation marker was written
    const marker = readPendingDelegation(testDir);
    assert.ok(marker !== null);
});
```

**Traces**: FR-008 (AC-008-01, AC-008-02, AC-008-04)

#### 5.4.2 test-delegation-gate.test.cjs

**BUG-0021 section header update**:
- Change: "Phase A analyze carve-out (BUG-0021)" to "Three-verb model inline carve-out (REQ-0023)"

**New test cases to add**:

```javascript
// Test: pending_delegation for 'add' action auto-clears
test('pending delegation for add action auto-clears', async () => {
    writePendingDelegation(testDir, {
        skill: 'isdlc',
        required_agent: 'sdlc-orchestrator',
        invoked_at: new Date().toISOString(),
        args: 'add "payment processing"'
    });
    const { exitCode, stdout } = await runHook(hookPath, {});
    assert.strictEqual(exitCode, 0);
    // Verify marker was cleared
    const marker = readPendingDelegation(testDir);
    assert.strictEqual(marker, null);
    // Verify no block decision
    if (stdout.trim()) {
        const output = JSON.parse(stdout);
        assert.notStrictEqual(output.decision, 'block');
    }
});

// Test: pending_delegation for 'build' action NOT auto-cleared (requires delegation)
test('pending delegation for build action blocks without delegation', async () => {
    setupState({ skill_usage_log: [] });
    writePendingDelegation(testDir, {
        skill: 'isdlc',
        required_agent: 'sdlc-orchestrator',
        invoked_at: new Date().toISOString(),
        args: 'build "payment-processing"'
    });
    const { exitCode, stdout } = await runHook(hookPath, {});
    assert.strictEqual(exitCode, 0);
    const output = JSON.parse(stdout);
    assert.strictEqual(output.decision, 'block');
});
```

**Traces**: FR-008 (AC-008-01, AC-008-02, AC-008-04)

### 5.5 Files Confirmed Safe (No Changes)

| File | Reason |
|------|--------|
| `gate-blocker.cjs` | No Phase A/B references. Only checks `active_workflow`. Safe. |
| `menu-halt-enforcer.cjs` | `backlog-picker` pattern name still valid for generic menu detection. Consider renaming to `other-option-menu` but not required for this REQ. |

**Traces**: FR-008 (Impact Analysis confirmation)

---

## 6. Data Flow Diagrams

### 6.1 Add Verb Data Flow

```
User Input: "add payment processing to the backlog"
    |
    v
[CLAUDE.md Intent Detection] -- matches "add to backlog" signal
    |
    v
[isdlc.md ACTION routing] -- action = "add"
    |
    v
[Add Handler (inline)]
    |
    +--[1] Parse source type --> source: "manual", source_id: null
    +--[2] generateSlug("payment processing") --> "payment-processing"
    +--[3] Read state.json.counters.next_req_id (peek only) --> 24
    +--[4] Check docs/requirements/payment-processing/ --> does not exist
    +--[5] Write docs/requirements/payment-processing/draft.md
    +--[6] Write docs/requirements/payment-processing/meta.json
    |      {
    |        "source": "manual",
    |        "source_id": null,
    |        "slug": "payment-processing",
    |        "created_at": "2026-02-18T20:00:00Z",
    |        "analysis_status": "raw",
    |        "phases_completed": [],
    |        "codebase_hash": "abc1234"
    |      }
    +--[7] appendToBacklog("16.2", "Payment processing", ' ')
    |      BACKLOG.md: "- 16.2 [ ] Payment processing"
    +--[8] Confirm to user
```

### 6.2 Analyze Verb Data Flow

```
User Input: "analyze payment processing"
    |
    v
[CLAUDE.md Intent Detection] -- matches "analyze" signal
    |
    v
[isdlc.md ACTION routing] -- action = "analyze"
    |
    v
[Analyze Handler (inline)]
    |
    +--[1] resolveItem("payment processing")
    |      Strategy 4 (fuzzy): matches "payment-processing" in BACKLOG.md
    |      Returns { slug: "payment-processing", dir: "docs/requirements/payment-processing/" }
    |
    +--[2] readMetaJson(dir)
    |      Returns { analysis_status: "raw", phases_completed: [] }
    |
    +--[3] Next phase: "00-quick-scan" (first not in phases_completed)
    |
    +--[4] Loop:
    |
    |  Phase 00: Quick Scan
    |  +-- Task -> Agent 00 -> produces quick-scan.md
    |  +-- meta.phases_completed = ["00-quick-scan"]
    |  +-- meta.analysis_status = "partial"
    |  +-- BACKLOG.md: [ ] -> [~]
    |  +-- "Continue to Phase 01? [Y/n]" -- user says Y
    |
    |  Phase 01: Requirements
    |  +-- Task -> Agent 01 -> produces requirements-spec.md, user-stories.json
    |  +-- meta.phases_completed = ["00-quick-scan", "01-requirements"]
    |  +-- BACKLOG.md stays [~] (still partial)
    |  +-- "Continue to Phase 02? [Y/n]" -- user says Y
    |
    |  Phase 02: Impact Analysis
    |  +-- Task -> Agent 02 -> produces impact-analysis.md
    |  +-- meta.phases_completed = [..., "02-impact-analysis"]
    |
    |  Phase 03: Architecture
    |  +-- Task -> Agent 03 -> produces architecture-overview.md
    |  +-- meta.phases_completed = [..., "03-architecture"]
    |
    |  Phase 04: Design
    |  +-- Task -> Agent 04 -> produces interface-spec.yaml, module-designs/
    |  +-- meta.phases_completed = [..., "04-design"]
    |  +-- meta.analysis_status = "analyzed"
    |  +-- BACKLOG.md: [~] -> [A]
    |
    +--[5] "Analysis complete. payment-processing is ready to build."
```

### 6.3 Build Verb Data Flow

```
User Input: "build payment processing"
    |
    v
[CLAUDE.md Intent Detection] -- matches "build" signal
    |
    v
[isdlc.md ACTION routing] -- action = "build"
    |
    v
[Build Handler (orchestrated)]
    |
    +--[1] resolveItem("payment processing") --> found
    +--[2] readMetaJson() --> { analysis_status: "analyzed" }
    +--[3] Check no active workflow --> OK
    +--[4] Parse flags (--supervised, --debate, etc.)
    +--[5] Determine workflow type: feature (no bug keywords)
    +--[6] Delegate to orchestrator:
    |      Task -> sdlc-orchestrator
    |      MODE: init-and-phase-01
    |      ACTION: feature
    |      DESCRIPTION: "payment-processing"
    |
    v
[Orchestrator]
    |
    +--[7] Initialize active_workflow in state.json
    +--[8] Increment counters.next_req_id: 24 -> 25
    +--[9] Create branch: feature/REQ-0024-payment-processing
    +--[10] Run Phase 00 (Quick Scan)
    |
    v
[Phase-Loop Controller] -- standard feature workflow
    (identical to current /isdlc feature behavior)
```

### 6.4 Resumable Analysis Flow

```
User Input (Day 1): "analyze payment processing"
    -> Completes Phase 00, Phase 01
    -> User exits at Phase 01 prompt ("Continue to Phase 02? [Y/n]" -> n)
    -> meta.json: { analysis_status: "partial", phases_completed: ["00-quick-scan", "01-requirements"] }
    -> BACKLOG.md: [~]

User Input (Day 2): "analyze payment processing"
    -> resolveItem() finds existing folder
    -> readMetaJson() returns phases_completed with 2 entries
    -> Next phase: "02-impact-analysis" (first not in phases_completed)
    -> Resumes from Phase 02
    -> Eventually completes all 5 phases
    -> meta.json: { analysis_status: "analyzed", phases_completed: [all 5] }
    -> BACKLOG.md: [A]
```

---

## 7. meta.json Schema Specification

### 7.1 Schema Version 2 (New)

```json
{
  "source": "manual | github | jira | backlog-migration",
  "source_id": "<ticket-id-or-null>",
  "slug": "<slug-string>",
  "created_at": "<ISO-8601-timestamp>",
  "updated_at": "<ISO-8601-timestamp-or-null>",
  "analysis_status": "raw | partial | analyzed",
  "phases_completed": ["00-quick-scan", "01-requirements", ...],
  "codebase_hash": "<git-HEAD-short-SHA>"
}
```

### 7.2 Schema Version 1 (Legacy -- read-only migration)

```json
{
  "source": "manual | github | jira | backlog-migration",
  "source_id": "<ticket-id-or-null>",
  "slug": "<slug-string>",
  "created_at": "<ISO-8601-timestamp>",
  "phase_a_completed": true | false,
  "codebase_hash": "<git-HEAD-short-SHA>"
}
```

### 7.3 Migration Matrix

| Legacy Field | Legacy Value | New Field | New Value |
|-------------|-------------|-----------|-----------|
| `phase_a_completed` | `true` | `analysis_status` | `"analyzed"` |
| `phase_a_completed` | `true` | `phases_completed` | All 5 phases |
| `phase_a_completed` | `false` | `analysis_status` | `"raw"` |
| `phase_a_completed` | `false` | `phases_completed` | `[]` |
| `phase_a_completed` | missing | `analysis_status` | `"raw"` |
| `phase_a_completed` | missing | `phases_completed` | `[]` |

### 7.4 Affected Existing Files

| File | Current Schema | Migration |
|------|---------------|-----------|
| `docs/requirements/REQ-0020-t6-hook-io-optimization/meta.json` | v1 (`phase_a_completed: true`) | Read-time: analyzed |
| `docs/requirements/REQ-0021-t7-agent-prompt-boilerplate-extraction/meta.json` | v1 (`phase_a_completed: true`) | Read-time: analyzed |
| `docs/requirements/REQ-0022-performance-budget-guardrails/meta.json` | v1 (`phase_a_completed: true`) | Read-time: analyzed |

**Traces**: FR-009 (all ACs), ADR-0013

---

## 8. BACKLOG.md Marker Specification

### 8.1 Marker Character Set

| Marker | Character | Status | Set By |
|--------|-----------|--------|--------|
| `[ ]` | space | Raw (no analysis) | `add` verb |
| `[~]` | tilde | Partially analyzed (1-4 phases) | `analyze` verb (after first phase) |
| `[A]` | uppercase A | Fully analyzed (all 5 phases) | `analyze` verb (after last phase) |
| `[x]` | lowercase x | Completed (workflow finished) | Orchestrator (workflow finalize) |

### 8.2 Parsing Regex

```
/^(\s*-\s+)(\d+\.\d+)\s+\[([ ~Ax])\]\s+(.+)$/
```

Capture groups:
1. Prefix (whitespace + dash + whitespace)
2. Item number (e.g., "16.2")
3. Marker character (space, tilde, A, or x)
4. Description text

### 8.3 Backward Compatibility

- Existing `[ ]` items: Parsed as raw (space character). No change needed.
- Existing `[x]` items: Parsed as completed. No change needed.
- `[~]` and `[A]` are additive new markers that do not exist in current BACKLOG.md files.
- Items without the `N.N` number prefix are NOT matched by the regex and are left untouched.

### 8.4 Marker Progression

```
[ ] --add--> [ ] --analyze(partial)--> [~] --analyze(complete)--> [A] --build+finalize--> [x]
```

Markers only progress forward. There is no backward transition except during re-analysis (which resets to `[ ]` before starting over).

**Traces**: FR-007 (all ACs), ADR-0014

---

## 9. Item Resolution Specification

### 9.1 Priority Chain (ADR-0015)

| Priority | Strategy | Input Pattern | Lookup Method | Cost |
|----------|----------|---------------|---------------|------|
| 1 | Exact slug | `/^[a-z0-9-]+$/` | `fs.existsSync(docs/requirements/{input}/meta.json)` | O(1) |
| 2 | Partial slug | `/^[a-z0-9-]+$/` | Scan directory names ending with `-{input}` | O(n) |
| 3 | Item number | `/^\d+\.\d+$/` | Line-scan BACKLOG.md for matching number | O(n) |
| 4 | External ref | `/^#\d+$/` or `/^[A-Z]+-\d+$/i` | Scan meta.json files for `source_id` match | O(m) |
| 5 | Fuzzy match | Free text | Case-insensitive substring in BACKLOG.md titles | O(n) |

### 9.2 Resolution Output

```
{
  "slug": "payment-processing",
  "dir": "docs/requirements/payment-processing/",
  "meta": { ... },       // readMetaJson() result or null
  "backlogLine": "- 16.2 [ ] Payment processing",  // BACKLOG.md line or null
  "itemNumber": "16.2"   // extracted item number or null
}
```

### 9.3 No-Match Behavior

When no item is found:
- If input looks like a description (contains spaces, no special patterns): Offer to run `add` first
- If input looks like a reference (slug, number, external ref): Report error ERR-RESOLVE-001

### 9.4 Multi-Match Behavior (Strategy 5 only)

When fuzzy matching produces multiple results:
- Present numbered options to the user
- Ask user to select one
- Maximum 10 options displayed (overflow: "... and N more")

**Traces**: ADR-0015, FR-002 (step 1), FR-003 (step 1)

---

## 10. Constitutional Compliance

### Article I (Specification Primacy)
All designs implement architecture specifications from ADR-0012 through ADR-0015 exactly. The add/analyze/build handlers follow the command-dispatch pattern defined in the architecture. The meta.json migration follows the read-time approach from ADR-0013.

### Article IV (Explicit Over Implicit)
All decisions are documented. The disambiguation rule for intent detection is explicit. Error messages include specific file paths and remediation commands. The marker character set is fully specified.

### Article V (Simplicity First)
- No new files created (all modifications to existing files)
- No new architectural patterns introduced
- BACKLOG.md markers use single characters in existing bracket format
- Read-time migration avoids batch scripts
- Item resolution uses sequential priority chain (no complex scoring)

### Article VII (Artifact Traceability)
Every section in this document traces to specific FRs, ACs, and ADRs. The traceability matrix in the requirements spec covers all 44 ACs.

### Article IX (Quality Gate Integrity)
GATE-04 checklist will be validated after all artifacts are produced.

---

## 11. Traceability Matrix

| Design Section | Requirements | ADRs | ACs |
|---------------|-------------|------|-----|
| 2.3.1 readMetaJson | FR-009 | ADR-0013 | AC-009-01..05 |
| 2.3.2 writeMetaJson | FR-009 | ADR-0013 | AC-009-01..02 |
| 2.3.3 generateSlug | FR-001 | - | AC-001-01 |
| 2.3.4 resolveItem | FR-002, FR-003 | ADR-0015 | - |
| 2.3.5 updateBacklogMarker | FR-007 | ADR-0014 | AC-007-01..06 |
| 2.3.6 appendToBacklog | FR-001, FR-007 | ADR-0014 | AC-001-04, AC-007-01 |
| 2.3.7 deriveAnalysisStatus | FR-009 | - | AC-009-01 |
| 2.3.8 deriveBacklogMarker | FR-007 | ADR-0014 | AC-007-01..03 |
| 2.4 Add handler | FR-001 | ADR-0012 | AC-001-01..07 |
| 2.5 Analyze handler | FR-002 | ADR-0012 | AC-002-01..09 |
| 2.6 Build handler | FR-003 | ADR-0012 | AC-003-01..07 |
| 2.7 Action routing | FR-005 | ADR-0012 | AC-005-06 |
| 2.8 QUICK REFERENCE | FR-005 | - | AC-005-08 |
| 2.9 Section elimination | FR-005 | - | AC-005-01 |
| 3.2 CLAUDE.md changes | FR-004 | - | AC-004-01..05 |
| 3.3 Template changes | FR-004 | - | AC-004-06..07 |
| 4.2 BACKLOG PICKER removal | FR-006 | - | AC-006-01 |
| 4.3 SCENARIO 3 update | FR-006 | - | AC-006-02..04 |
| 4.4 COMMANDS YOU SUPPORT | FR-006 | - | AC-006-03..04 |
| 5.2 skill-delegation-enforcer | FR-008 | ADR-0012 | AC-008-01..03 |
| 5.3 delegation-gate | FR-008 | ADR-0012 | AC-008-01..03 |
| 5.4 Test files | FR-008 | - | AC-008-04 |
| 7 meta.json schema | FR-009 | ADR-0013 | AC-009-01..05 |
| 8 BACKLOG.md markers | FR-007 | ADR-0014 | AC-007-01..06 |
| 9 Item resolution | FR-002, FR-003 | ADR-0015 | - |
