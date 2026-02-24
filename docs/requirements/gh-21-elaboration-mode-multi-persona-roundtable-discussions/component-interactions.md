# Component Interactions: Elaboration Mode

**Feature**: Elaboration Mode -- Multi-Persona Roundtable Discussions
**Feature ID**: REQ-GH21-ELABORATION-MODE
**Source**: GH-21
**Phase**: 03-architecture

---

## 1. Overview

This document describes how the elaboration mode interacts with existing components of the roundtable analysis system. The key architectural constraint is that elaboration is **contained within the existing roundtable-analyst.md agent** (CON-001) and interacts with external components only through established interfaces.

---

## 2. Interaction Map

```
+-------------------+     Task delegation     +------------------------+
| isdlc.md          |------------------------>| roundtable-analyst.md  |
| (analyze handler) |                         |                        |
| UNCHANGED         |                         | Section 2: Step Engine |
+-------------------+                         | Section 4.4: ELAB MODE |<-- NEW
                                              | Section 5: Sessions    |
                                              +------------------------+
                                                |           |        |
                                         Read   |    R/W    |   R/W  |
                                                |           |        |
                              +-----------------+     +-----+   +----+------+
                              |                       |         |           |
                              v                       v         v           v
                    +----------------+  +----------+  +---------+  +----------------+
                    | Step files     |  | Artifact |  |meta.json|  | three-verb-    |
                    | (25 files)     |  | files    |  |         |  | utils.cjs      |
                    | READ ONLY      |  | (R/W)    |  | (R/W)   |  | readMetaJson() |
                    | UNCHANGED      |  +----------+  +---------+  +----------------+
                    +----------------+                                  MINOR CHANGE
```

---

## 3. Interaction Details

### 3.1 isdlc.md -> roundtable-analyst.md (UNCHANGED)

**Interface**: Task tool delegation
**Direction**: isdlc.md delegates to roundtable-analyst.md
**Change required**: NONE

The analyze handler in isdlc.md delegates to the roundtable-analyst agent with a Task prompt containing:
- Item description and slug
- Phase key (00-quick-scan through 04-design)
- Artifact folder path
- Meta.json content (META CONTEXT block)

Elaboration mode is entirely contained within the agent's execution. The delegation interface (Task prompt format) does not change. The isdlc.md handler does not know or care whether elaboration occurred during the agent's execution.

**Verification**: Search isdlc.md for the delegation prompt format. Confirm no fields need to be added for elaboration.

### 3.2 roundtable-analyst.md -> Step Files (READ ONLY, UNCHANGED)

**Interface**: Read tool (file reads)
**Direction**: Agent reads step files
**Change required**: NONE to step files

During elaboration, the agent reads the current step file to obtain:
- `step_id`: Identifies the step for elaboration record tracking
- `title`: Used in the introduction message ("Topic: {title}")
- `outputs`: List of artifact filenames that the synthesis engine will update
- `depth` mode sections: NOT used during elaboration (elaboration has its own flow)

Step files are never written to during elaboration (CON-006).

**Interaction pattern**:
```
Elaboration Entry:
  1. Agent already has step file loaded (from step execution)
  2. Reads step_id, title from frontmatter (already parsed)
  3. Reads outputs[] for synthesis targeting (already parsed)
  -> No additional file reads required
```

### 3.3 roundtable-analyst.md -> Artifact Files (READ + WRITE)

**Interface**: Read/Write/Edit tools
**Direction**: Agent reads and writes artifact files
**Change required**: WRITE behavior extended (synthesis writes enriched content)

During normal step execution, the agent writes artifacts per the step file's Artifacts section. During elaboration, the synthesis engine performs additional writes:

**Pre-elaboration (normal step execution)**:
```
Step 01-03 completes -> writes to requirements-spec.md (Section 3: User Journeys)
Step menu presented -> user selects [E]
```

**During elaboration (synthesis)**:
```
Synthesis engine:
  1. Reads current content of each file in step.outputs[]
  2. Identifies the section most relevant to step topic
  3. Appends enriched content (insights from multi-persona discussion)
  4. Writes updated file
```

**Critical constraint (NFR-004)**: Synthesis writes are **additive only**. The Read-then-Append pattern ensures no existing content is deleted or overwritten.

**Interaction pattern**:
```
Synthesis:
  for each artifact in step.outputs[]:
    content = Read(artifact_path)
    section = identifyRelevantSection(content, step.title)
    enriched = content + elaborationInsights
    Write(artifact_path, enriched)
```

### 3.4 roundtable-analyst.md -> meta.json (READ + WRITE)

**Interface**: Read/Write tools (via readMetaJson/writeMetaJson patterns)
**Direction**: Agent reads and writes meta.json
**Change required**: NEW fields written (`elaborations[]`, optionally `elaboration_config`)

The roundtable-analyst.md already reads and writes meta.json for:
- `steps_completed` array (step tracking)
- `depth_overrides` object (adaptive depth)

Elaboration extends this with:
- `elaborations[]` array (elaboration records per step)

**Interaction pattern**:
```
Elaboration State Tracking:
  1. After synthesis completes
  2. Append elaboration record to meta.elaborations[]:
     {
       "step_id": "01-03",
       "turn_count": 7,
       "personas_active": ["business-analyst", "solutions-architect", "system-designer"],
       "timestamp": "2026-02-20T14:30:00.000Z",
       "synthesis_summary": "Brief description of what was added"
     }
  3. Write meta.json via writeMetaJson()
```

**Session Recovery (read path)**:
```
On session resume:
  1. Read meta.json (via META CONTEXT in delegation prompt)
  2. If meta.elaborations[] is non-empty:
     - Summarize previous elaboration insights in context recovery message
  3. Continue step execution from resume_step
```

### 3.5 three-verb-utils.cjs -> meta.json (READ, MINOR CHANGE)

**Interface**: readMetaJson() function
**Direction**: Utility reads and normalizes meta.json
**Change required**: Add defensive default for `elaborations` field (~3 lines)

The readMetaJson() function applies defensive defaults for all known fields. This prevents errors when reading meta.json files created before elaboration support was added.

**Current defaults** (from REQ-0027):
```javascript
if (!Array.isArray(raw.steps_completed)) {
    raw.steps_completed = [];
}
if (typeof raw.depth_overrides !== 'object' || ...) {
    raw.depth_overrides = {};
}
```

**New default** (GH-21):
```javascript
// Elaboration tracking defaults (GH-21)
if (!Array.isArray(raw.elaborations)) {
    raw.elaborations = [];
}
```

This follows the identical pattern established by REQ-0027 for `steps_completed` and `depth_overrides`. The writeMetaJson() function requires no changes because it serializes the entire meta object via JSON.stringify, which naturally includes any new fields.

---

## 4. Interaction Sequence Diagram

### 4.1 Full Elaboration Sequence

```
User          Step Engine     Elab Handler    Personas      Synthesis     meta.json    Artifacts
 |                |                |              |              |            |            |
 |  [E]           |                |              |              |            |            |
 |--------------->|                |              |              |            |            |
 |                |  route [E]     |              |              |            |            |
 |                |--------------->|              |              |            |            |
 |                |                |  read ctx    |              |            |            |
 |                |                |------------->|              |            |            |
 |                |                |  intro msg   |              |            |            |
 |                |                |<-------------|              |            |            |
 |  intro         |                |              |              |            |            |
 |<-------------------------------|              |              |            |            |
 |                |                |  frame topic |              |            |            |
 |                |                |------------->|              |            |            |
 |  lead frames   |                |              |              |            |            |
 |<-------------------------------|              |              |            |            |
 |                |                |              |              |            |            |
 |                |     DISCUSSION LOOP (turns 1..N)             |            |            |
 |                |                |              |              |            |            |
 |  persona contrib                |              |              |            |            |
 |<-------------------------------|  contribute  |              |            |            |
 |                |                |<-------------|              |            |            |
 |  user input    |                |              |              |            |            |
 |------------------------------->|  parse addr  |              |            |            |
 |                |                |------------->|              |            |            |
 |  persona resp  |                |              |              |            |            |
 |<-------------------------------|  respond     |              |            |            |
 |                |                |<-------------|              |            |            |
 |                |                |              |              |            |            |
 |  "done"        |                |              |              |            |            |
 |------------------------------->|              |              |            |            |
 |                |                |  synthesize  |              |            |            |
 |                |                |--------------------------->|            |            |
 |                |                |              |              |  read      |            |
 |                |                |              |              |----------->|            |
 |                |                |              |              |  content   |            |
 |                |                |              |              |<-----------|            |
 |                |                |              |              |  write     |            |
 |                |                |              |              |----------->|            |
 |                |                |              |              |            |            |
 |                |                |  write elab record         |            |            |
 |                |                |-------------------------------------------->|       |
 |                |                |              |              |            |            |
 |  synthesis     |                |              |              |            |            |
 |<-------------------------------|              |              |            |            |
 |                |                |              |              |            |            |
 |                |  return to menu|              |              |            |            |
 |                |<---------------|              |              |            |            |
 |  step menu     |                |              |              |            |            |
 |<---------------|                |              |              |            |            |
```

### 4.2 Session Resume After Elaboration

```
User          isdlc.md       roundtable-analyst.md     meta.json
 |                |                  |                      |
 |  /isdlc analyze|                  |                      |
 |--------------->|                  |                      |
 |                |  read meta.json  |                      |
 |                |------------------------------------------------>|
 |                |  meta content    |                      |
 |                |<------------------------------------------------|
 |                |  Task delegate   |                      |
 |                |  (META CONTEXT)  |                      |
 |                |----------------->|                      |
 |                |                  |  parse META CONTEXT  |
 |                |                  |  steps_completed     |
 |                |                  |  elaborations[]      |
 |                |                  |                      |
 |  "Welcome back.|                  |                      |
 |   Last time we |                  |                      |
 |   discussed X  |                  |                      |
 |   via roundtable|                 |                      |
 |   discussion." |                  |                      |
 |<---------------+-----------------|                      |
 |                |                  |                      |
 |                |  continue from   |                      |
 |                |  resume_step     |                      |
```

---

## 5. Boundary Analysis

### 5.1 What Changes

| Component | Change | Magnitude |
|-----------|--------|-----------|
| roundtable-analyst.md Section 4.4 | Replace 7-line stub with ~150-200 line elaboration handler | MAJOR (within file) |
| roundtable-analyst.md Section 5.1 | Extend context recovery to read elaborations[] | MINOR (5-10 lines) |
| three-verb-utils.cjs readMetaJson() | Add defensive default for elaborations[] | TRIVIAL (3 lines) |
| meta.json schema | Add optional elaborations[] and elaboration_config fields | MINOR (additive) |

### 5.2 What Does NOT Change

| Component | Reason |
|-----------|--------|
| isdlc.md (analyze handler) | Delegation interface unchanged; elaboration is agent-internal |
| 25 analysis step files | CON-006: Step File Immutability; elaboration reads outputs only |
| roundtable-analyst.md Section 2 (Step Engine) | Menu input routing already handles [E]; only the target handler changes |
| roundtable-analyst.md Section 4.1-4.3 | Step menu display, phase menu, natural input handler -- all unchanged |
| roundtable-analyst.md Section 4.5 | Skip handler unchanged |
| three-verb-utils.cjs writeMetaJson() | JSON.stringify handles any fields; no write-side changes needed |
| All other agents | Elaboration is roundtable-analyst exclusive (CON-001, CON-002) |
| All hooks | No hook logic depends on elaboration state |

### 5.3 Interface Stability

Every interface between the elaboration handler and external components uses an **existing, stable interface**:

- File reads: Read tool (standard)
- File writes: Write/Edit tools (standard)
- meta.json: readMetaJson/writeMetaJson (established in REQ-0027)
- Step file parsing: YAML frontmatter extraction (established in REQ-0027)
- Menu routing: String matching on user input (established in REQ-0027)

No new interfaces, protocols, or communication patterns are introduced.

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-20 | Solutions Architect (Phase 03) | Initial component interactions document |
