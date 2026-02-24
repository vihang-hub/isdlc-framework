# Architecture Overview: Three-Verb Backlog Model (REQ-0023)

**Phase**: 03-architecture
**Feature**: Three-verb backlog model (add/analyze/build)
**Version**: 1.0.0
**Created**: 2026-02-18
**Author**: Solution Architect (Agent 03)
**Traces**: FR-001 through FR-009, NFR-001 through NFR-006

---

## 1. Executive Summary

This architecture describes the command surface redesign that replaces the current Phase A/B preparation pipeline with three clean verbs: `add`, `analyze`, and `build`. The architecture is a **targeted modification** to an existing CLI framework -- not a greenfield system. The core workflow machinery (workflows.json, phase agents, quality loop, hooks) remains untouched. Changes are confined to four modules: command routing (isdlc.md), intent detection (CLAUDE.md), orchestrator menus (00-sdlc-orchestrator.md), and hook enforcement (2 hook files).

**Architectural Pattern**: Command-Dispatch with State Machine (extending the existing pattern).

**Key Design Decisions**:
1. Three verbs map to two execution modes: inline (add, analyze) and orchestrated (build)
2. `meta.json` replaces `phase_a_completed` boolean with structured `analysis_status` + `phases_completed[]`
3. BACKLOG.md gains four-state markers: `[ ]`, `[~]`, `[A]`, `[x]`
4. Backward compatibility preserved via read-time migration and hidden aliases

---

## 2. System Context (C4 Level 1)

The iSDLC framework operates as an extension to Claude Code. The three-verb model introduces new command entry points but does not change the system boundary.

```
[Developer] --> [Claude Code + iSDLC Extension]
                    |
                    +-- /isdlc add "..." --> Inline execution (no orchestrator)
                    +-- /isdlc analyze "..." --> Inline execution (phase agents 00-04)
                    +-- /isdlc build "..." --> Orchestrator --> Phase-Loop Controller
                    +-- /isdlc fix "..." --> Orchestrator --> Phase-Loop Controller (unchanged)
                    |
                    +-- [File System: BACKLOG.md, meta.json, state.json, docs/requirements/]
                    +-- [Git: branches, commits]
```

**External Actors**:
- Developer (primary): Interacts via natural language or direct slash commands
- Claude Code runtime: Provides tool execution, hook dispatch, agent delegation
- File system: Persistence layer for all state, artifacts, and configuration
- Git: Version control for branches and commits (build verb only)

---

## 3. Container Diagram (C4 Level 2)

### 3.1 Command Router (isdlc.md)

The central dispatch point for all `/isdlc` commands. The three-verb model adds three new action handlers while preserving existing ones.

| Action | Execution Mode | Orchestrator Required | Workflow Created | State Writes |
|--------|---------------|----------------------|-----------------|-------------|
| `add` | Inline | No | No | meta.json, draft.md, BACKLOG.md only |
| `analyze` | Inline | No | No | meta.json only (phases_completed) |
| `build` | Orchestrated | Yes | Yes | state.json (active_workflow) |
| `fix` | Orchestrated | Yes | Yes | state.json (unchanged) |
| `feature` | Alias for `build` | Yes | Yes | state.json (unchanged) |

**Routing Logic**:
```
ACTION = parse(args)

if ACTION in {add, analyze}:
    Execute inline (no Task delegation)
    Skip orchestrator entirely

elif ACTION in {build, feature}:
    Delegate to orchestrator via Task tool
    Orchestrator initializes workflow in state.json
    Phase-Loop Controller drives phase progression

elif ACTION in {fix}:
    (Unchanged from current behavior)
```

### 3.2 Intent Detection Layer (CLAUDE.md)

Maps natural language to `/isdlc {verb}` commands. The new table:

| Intent | Signal Words | Command |
|--------|-------------|---------|
| **Add** | add to backlog, track this, log this, remember this, save this idea | `/isdlc add` |
| **Analyze** | analyze, think through, plan this, review requirements, assess impact, design this | `/isdlc analyze` |
| **Build** | build, implement, create, code, develop, ship, make this, let's do this | `/isdlc build` |
| **Fix** | broken, fix, bug, crash, error, wrong, failing, not working | `/isdlc fix` |

Disambiguation rule: "add and analyze" resolves to Analyze (which implicitly runs Add first if needed -- FR-002 AC-002-08).

### 3.3 Hook Enforcement Layer

Two hooks enforce orchestrator delegation:

- **skill-delegation-enforcer.cjs**: PostToolUse[Skill] -- writes `pending_delegation` marker when `/isdlc` is loaded. EXEMPT_ACTIONS: `{add, analyze}` (inline, no delegation needed).
- **delegation-gate.cjs**: Stop hook -- verifies delegation occurred. EXEMPT_ACTIONS: `{add, analyze}` (auto-clear pending marker).

The `build` action is NOT exempt -- it must go through orchestrator delegation, identical to the current `feature` action.

### 3.4 Data Layer

Three data stores are involved:

| Store | Modified by Add | Modified by Analyze | Modified by Build |
|-------|----------------|--------------------|--------------------|
| `docs/requirements/{slug}/meta.json` | Created (new schema) | Updated (phases_completed) | Read only |
| `docs/requirements/{slug}/draft.md` | Created | Not modified | Read only |
| `BACKLOG.md` | Appended (new item) | Marker updated | Not modified |
| `.isdlc/state.json` | **Read only** (counter peek) | **Not touched** | Read/Write (workflow) |

---

## 4. Architecture Pattern: Command-Dispatch with State Machine

**Pattern**: Command-Dispatch with State Machine (existing pattern, extended)

**Rationale**: The iSDLC framework already uses a command-dispatch pattern where `isdlc.md` parses the action verb and routes to the appropriate handler. The three-verb model extends this pattern by adding two new inline handlers (`add`, `analyze`) alongside the existing orchestrated handlers (`feature`, `fix`, `build`). No new architectural pattern is needed.

**Why not a new pattern**:
- The existing dispatch model handles the new verbs naturally (Article V: Simplicity First)
- The inline vs. orchestrated distinction is already present (the `analyze` Phase A carve-out from BUG-0021 proves the pattern works)
- Adding a message bus, plugin system, or event-driven architecture would be over-engineering for 12 file changes

### 4.1 Analysis Status State Machine

```
                add                      analyze (Phase 00-04)
  [no item] ---------> [raw] ---------> [partial] ---------> [analyzed]
                         |                  |                      |
                         |                  |       build          |
                         +------ build -----+----------+-----------+
                                            |          |
                                            v          v
                                      [workflow active: standard feature phases]
                                            |
                                            v
                                      [completed]
```

States:
- **raw**: Item added via `add` verb, zero analysis phases completed. BACKLOG marker: `[ ]`
- **partial**: 1-4 of 5 analysis phases completed via `analyze` verb. BACKLOG marker: `[~]`
- **analyzed**: All 5 analysis phases (00-04) completed. BACKLOG marker: `[A]`
- **completed**: Workflow finished and merged. BACKLOG marker: `[x]` (tracked in BACKLOG.md only, not meta.json)

Transitions tracked in `meta.json.phases_completed[]` array (append-only within `analyze`).

### 4.2 Analysis Status Derivation

The `analysis_status` field is derived from `phases_completed[]` length:

```
ANALYSIS_PHASES = ["00-quick-scan", "01-requirements", "02-impact-analysis", "03-architecture", "04-design"]

function deriveStatus(phases_completed):
    completed_count = count of phases_completed entries that are in ANALYSIS_PHASES
    if completed_count == 0: return "raw"
    if completed_count < 5:  return "partial"
    if completed_count == 5: return "analyzed"
```

This makes `analysis_status` a **computed field** kept in sync for convenience, with `phases_completed[]` as the source of truth.

---

## 5. Component Responsibilities

### 5.1 Add Handler (inline, in isdlc.md)

**Responsibility**: Create a raw backlog item from user input.

**Inputs**: Description string, optional external reference (Jira ticket ID, GitHub issue number)
**Outputs**: `docs/requirements/{slug}/draft.md`, `docs/requirements/{slug}/meta.json`, BACKLOG.md entry

**Logic**:
1. Parse input to identify source type (manual, github, jira)
2. Generate slug from description (lowercase, hyphens, max 50 chars)
3. Peek at `state.json.counters.next_req_id` (read-only, do NOT increment)
4. Check for existing slug directory -- warn and prompt if collision
5. Create `draft.md` with raw content and source metadata
6. Create `meta.json` with new schema (`analysis_status: "raw"`, `phases_completed: []`)
7. Append to BACKLOG.md `## Open` section with `[ ]` marker and next available sub-item number
8. Confirm to user with next steps suggestion

**Constraints**:
- No state.json writes (NFR-002)
- No workflow creation (NFR-002)
- No branch creation
- Performance target: under 5 seconds (NFR-004)

### 5.2 Analyze Handler (inline, in isdlc.md)

**Responsibility**: Run interactive analysis phases (00-04) on a backlog item outside workflow machinery.

**Inputs**: Item reference (slug, BACKLOG number, external ID, or description match)
**Outputs**: Phase artifacts in `docs/requirements/{slug}/`, updated `meta.json`

**Logic**:
1. Resolve target item via multi-strategy resolution (see Section 5.6)
2. If item folder does not exist, run Add implicitly (FR-002 AC-002-08)
3. Read `meta.json` -- apply read-time migration if legacy schema detected
4. Determine next incomplete phase from the analysis phase sequence
5. If all phases complete and codebase hash matches, inform user analysis is current
6. If codebase hash differs, warn about staleness, offer re-analysis
7. For each remaining phase:
   a. Delegate to the standard phase agent via Task tool
   b. Agent produces artifacts in `docs/requirements/{slug}/`
   c. Append phase key to `meta.json.phases_completed[]`
   d. Update `meta.json.analysis_status` based on phases_completed count
   e. Update BACKLOG.md marker
   f. Offer user exit point ("Continue to next phase? [Y/n]")
8. After final phase, confirm analysis complete

**Analysis Phase Sequence**:

| Phase Key | Agent | Primary Artifacts |
|-----------|-------|-------------------|
| `00-quick-scan` | Agent 00 | `quick-scan.md` |
| `01-requirements` | Agent 01 | `requirements-spec.md`, `user-stories.json`, `nfr-matrix.md` |
| `02-impact-analysis` | Agent 02 | `impact-analysis.md` |
| `03-architecture` | Agent 03 | `architecture-overview.md` |
| `04-design` | Agent 04 | `interface-spec.yaml`, `module-designs/` |

**Constraints**:
- No state.json writes (NFR-002)
- No workflow creation (active_workflow stays null)
- No branch creation
- Can run in parallel with an active build workflow (zero shared state)
- Resumable at any phase boundary (NFR-003)
- Phase transition overhead under 2 seconds (NFR-004)

### 5.3 Build Handler (orchestrated, in isdlc.md)

**Responsibility**: Start a feature or fix workflow for a backlog item.

**Inputs**: Item reference (same resolution as Analyze)
**Outputs**: Initialized workflow in state.json, feature branch

**Logic**:
1. Resolve target item (same multi-strategy resolution)
2. Read `meta.json` to check analysis_status (informational for this release)
3. Check for active workflow -- block if one exists
4. Delegate to orchestrator via Task tool
5. Orchestrator initializes `active_workflow` in state.json with feature phases from workflows.json
6. Orchestrator increments `counters.next_req_id`
7. Orchestrator creates feature branch `feature/REQ-NNNN-{slug}`
8. Phase-Loop Controller begins Phase 00

**For this release**: Build always starts a full workflow from Phase 00, regardless of analysis status. Smart phase-skip based on analysis level is deferred to backlog item 16.5.

**Backward Compatibility**: `/isdlc feature` is kept as a hidden alias for `build`. Both route to the identical orchestrator flow.

### 5.4 BACKLOG.md Marker System

**Marker Format**: `- N.N [M] <description>` where M is one of:
- ` ` (space) = raw (no analysis)
- `~` = partially analyzed (1-4 phases)
- `A` = fully analyzed (all 5 phases)
- `x` = completed (workflow finished)

**Parsing Regex**: `/^(\s*-\s+)(\d+\.\d+\s+)\[([ ~Ax])\](\s+.+)$/`

Captures: prefix, item number, marker character, description.

**Update Logic**:
- `add` verb writes new item with `[ ]`
- `analyze` verb updates marker based on analysis_status: `[ ]` -> `[~]` -> `[A]`
- Workflow finalize (orchestrator) updates marker to `[x]`

**Backward Compatibility**: Existing `[ ]` and `[x]` patterns parse correctly. The `[~]` and `[A]` are additive new markers.

### 5.5 meta.json Schema and Migration

**New Schema** (v2):
```json
{
  "source": "manual" | "github" | "jira",
  "source_id": "<reference-or-null>",
  "slug": "<slug>",
  "created_at": "<ISO-8601>",
  "analysis_status": "raw" | "partial" | "analyzed",
  "phases_completed": ["00-quick-scan", "01-requirements", ...],
  "codebase_hash": "<git-HEAD-short-SHA>"
}
```

**Read-Time Migration** (for existing v1 meta.json files):
```javascript
function readMetaJson(filePath) {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Legacy migration: phase_a_completed -> analysis_status + phases_completed
    if ('phase_a_completed' in raw && !('analysis_status' in raw)) {
        if (raw.phase_a_completed === true) {
            raw.analysis_status = 'analyzed';
            raw.phases_completed = [
                '00-quick-scan', '01-requirements',
                '02-impact-analysis', '03-architecture', '04-design'
            ];
        } else {
            raw.analysis_status = 'raw';
            raw.phases_completed = [];
        }
    }

    // Defensive defaults for missing fields
    if (!raw.analysis_status) raw.analysis_status = 'raw';
    if (!Array.isArray(raw.phases_completed)) raw.phases_completed = [];

    return raw;
}
```

This handles the 3 existing meta.json files (REQ-0020, REQ-0021, REQ-0022) that have `phase_a_completed: true`. Migration is read-only -- no files are rewritten.

### 5.6 Item Resolution Strategy

Both `analyze` and `build` verbs need to resolve user input to a specific backlog item. Resolution uses a priority chain:

| Priority | Strategy | Example Input | Resolution |
|----------|----------|---------------|------------|
| 1 | Exact slug match | `"payment-processing"` | Check `docs/requirements/payment-processing/` exists |
| 2 | BACKLOG.md item number | `"3.2"` | Parse BACKLOG.md, find item at position 3.2 |
| 3 | External reference | `"#42"`, `"JIRA-1250"` | Search meta.json files for matching `source_id` |
| 4 | Fuzzy description match | `"payment processing"` | Search BACKLOG.md titles for best match |

If no match found, offer to run `add` first.

---

## 6. Data Flow Diagrams

### 6.1 Add Flow

```
User: "add payment processing to the backlog"
  |
  v
CLAUDE.md intent detection -> maps to /isdlc add "payment processing"
  |
  v
isdlc.md ACTION routing -> inline handler (no orchestrator)
  |
  +--[1]--> Generate slug: "payment-processing"
  +--[2]--> Read state.json.counters.next_req_id (peek, no write)
  +--[3]--> Create docs/requirements/payment-processing/draft.md
  +--[4]--> Create docs/requirements/payment-processing/meta.json
  +--[5]--> Append to BACKLOG.md: "- N.N [ ] Payment processing"
  +--[6]--> Confirm: "Added to backlog. You can analyze this now or later."
```

### 6.2 Analyze Flow

```
User: "analyze payment processing"
  |
  v
CLAUDE.md intent detection -> maps to /isdlc analyze "payment processing"
  |
  v
isdlc.md ACTION routing -> inline handler (no orchestrator)
  |
  +--[1]--> Resolve item: find "payment-processing" slug
  +--[2]--> Read meta.json -> analysis_status: "raw", phases_completed: []
  +--[3]--> Determine next phase: "00-quick-scan"
  |
  +--[4]--> Delegate to Agent 00 (Quick Scan) -> quick-scan.md
  +--[5]--> Update meta.json: phases_completed: ["00-quick-scan"], analysis_status: "partial"
  +--[6]--> Update BACKLOG.md: [ ] -> [~]
  +--[7]--> "Phase 00 complete. Continue to Phase 01 (Requirements)? [Y/n]"
  |
  +--[8]--> Delegate to Agent 01 (Requirements) -> requirements-spec.md
  +--[9]--> Update meta.json: phases_completed: ["00-quick-scan", "01-requirements"]
  |
  ... (repeat for phases 02, 03, 04) ...
  |
  +--[final]--> Update meta.json: analysis_status: "analyzed"
  +--[final]--> Update BACKLOG.md: [~] -> [A]
  +--[final]--> "Analysis complete. Ready to build."
```

### 6.3 Build Flow

```
User: "build payment processing"
  |
  v
CLAUDE.md intent detection -> maps to /isdlc build "payment processing"
  |
  v
isdlc.md ACTION routing -> orchestrated handler
  |
  +--[1]--> Resolve item: find "payment-processing"
  +--[2]--> Read meta.json -> analysis_status (informational)
  +--[3]--> Delegate to orchestrator via Task tool
  |
  v
Orchestrator (00-sdlc-orchestrator.md)
  |
  +--[4]--> Check no active workflow
  +--[5]--> Initialize active_workflow in state.json
  +--[6]--> Increment counters.next_req_id
  +--[7]--> Create branch feature/REQ-NNNN-payment-processing
  +--[8]--> Start Phase 00 via Phase-Loop Controller
  |
  v
Standard feature workflow (identical to /isdlc feature)
```

---

## 7. Scalability Strategy

This feature is a CLI tool running on a developer's local machine. Traditional cloud scalability concerns do not apply.

| Dimension | Current | Growth Model | Mitigation |
|-----------|---------|-------------|------------|
| BACKLOG.md items | ~142 | Linear with project lifetime | Line-by-line O(n) parsing; fast even at 10,000 items |
| meta.json files | 3 | One per item with `add` or workflow | Direct path lookup by slug (O(1)); no directory scan |
| phases_completed array | 0-5 entries | Bounded at 5 | No concern |
| Analysis artifacts | ~5 files per item | Bounded per item | Organized in per-slug directories |

---

## 8. Deployment Architecture

This is a CLI tool -- no cloud deployment infrastructure. The "deployment" is updating source files and syncing to runtime.

**Affected deployment artifacts**:
| Source | Runtime (symlink target) |
|--------|------------------------|
| `src/claude/commands/isdlc.md` | `.claude/commands/isdlc.md` |
| `src/claude/agents/00-sdlc-orchestrator.md` | `.claude/agents/00-sdlc-orchestrator.md` |
| `src/claude/hooks/skill-delegation-enforcer.cjs` | `.claude/hooks/skill-delegation-enforcer.cjs` |
| `src/claude/hooks/delegation-gate.cjs` | `.claude/hooks/delegation-gate.cjs` |
| `CLAUDE.md` (project root) | Directly read by Claude Code |
| `src/claude/CLAUDE.md.template` | Used by installer for new projects |

**Rollback**: Git revert of the feature branch changes restores all files.

---

## 9. Technology Radar

All technologies are existing in the project. No new dependencies introduced.

| Technology | Status | Notes |
|-----------|--------|-------|
| Node.js 20+ LTS | Adopt (existing) | Runtime for hooks |
| CommonJS (.cjs) | Adopt (existing) | Hook file format |
| Markdown agent prompts | Adopt (existing) | Command and agent definitions |
| JSON state files | Adopt (existing) | meta.json, state.json |
| Regular expressions | Adopt (existing) | BACKLOG.md marker parsing |

**No new technologies required** (Article V: Simplicity First).

---

## 10. Risk Mitigation

| Risk | Severity | Architectural Mitigation | Traces |
|------|----------|-------------------------|--------|
| isdlc.md routing breaks existing workflows | HIGH | Additive-only changes to ACTION routing; all existing SCENARIO/Phase-Loop logic preserved | NFR-001 |
| EXEMPT_ACTIONS update creates false blocks | MEDIUM | `build` is explicitly NOT in EXEMPT_ACTIONS; only `add` and `analyze` are exempt | FR-008, AC-008-02 |
| meta.json migration fails on edge cases | LOW | Read-time only, defensive defaults (missing field = "raw"), no file rewrites | FR-009, AC-009-03, AC-009-04 |
| BACKLOG.md parsing breaks on existing items | MEDIUM | Regex handles all 4 markers; existing `[ ]` and `[x]` patterns unchanged | FR-007, NFR-001 |
| Analyze conflicts with active workflow | LOW | Analyze never writes state.json or creates workflows; confirmed safe by gate-blocker review | NFR-002 |
| Intent detection ambiguity between Add and Build | MEDIUM | Distinct signal words; ambiguous "add and analyze" resolves to Analyze | FR-004, AC-004-08 |

---

## 11. Assumptions

1. The three-verb model covers all current use cases for backlog management
2. Existing meta.json files (3 total) all have `phase_a_completed: true` and can be migrated via read-time conversion
3. The `build` verb can fully replace `/isdlc feature` as the primary workflow entry point
4. BACKLOG.md format remains human-readable and hand-editable after marker additions
5. Analysis phases 00-04 can run outside workflow machinery using the same phase agents
6. Smart phase-skip (build detects analysis level and skips completed phases) is deferred to item 16.5

---

## 12. Traceability Matrix

| Architecture Decision | ADR | Requirements | NFRs | Constitutional Articles |
|----------------------|-----|-------------|------|----------------------|
| Inline execution for add/analyze | ADR-0012 | FR-001, FR-002 | NFR-002 | V, X, XIV |
| Orchestrated execution for build | ADR-0012 | FR-003 | NFR-001 | IX |
| meta.json schema migration (read-time) | ADR-0013 | FR-009 | NFR-001 | V, XIV |
| 4-state BACKLOG.md markers | ADR-0014 | FR-007 | NFR-001 | IV, VIII |
| EXEMPT_ACTIONS expansion | -- | FR-008 | NFR-002 | X |
| Feature alias for build | -- | NFR-001 | NFR-001 | I |
| Analysis resumability via phases_completed | ADR-0013 | FR-002 | NFR-003 | V |
| Item resolution priority chain | ADR-0015 | FR-002, FR-003 | -- | IV |
