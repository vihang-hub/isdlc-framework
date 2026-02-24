# Interface Specification: Roundtable Analysis Agent

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 04-design
**Date**: 2026-02-19
**Traces**: FR-001 through FR-012, NFR-001 through NFR-006

---

## 1. Overview

This document specifies the interfaces between the components of the roundtable analysis agent system. There are four interface boundaries:

1. **Delegation Interface**: isdlc.md (caller) to roundtable-analyst (callee) via Task tool
2. **Step File Interface**: roundtable-analyst to step files via file system read
3. **Meta.json Interface**: roundtable-analyst and isdlc.md to meta.json via readMetaJson/writeMetaJson
4. **User Interaction Interface**: roundtable-analyst to user via conversational prompts and menus

---

## 2. Delegation Interface (isdlc.md -> roundtable-analyst)

### 2.1 Invocation Protocol

**Mechanism**: Claude Code Task tool
**Caller**: isdlc.md analyze verb handler (step 7)
**Callee**: roundtable-analyst agent

The delegation uses the standard Task tool pattern. The caller constructs a prompt string and delegates to the named agent. The callee executes within an isolated context and returns control to the caller upon completion.

### 2.2 Task Prompt Schema

The Task prompt from isdlc.md to roundtable-analyst follows this exact structure:

```
Execute Phase {phase_number} - {phase_display_name} for analysis.

ANALYSIS MODE: Do NOT write to state.json. Do NOT create branches.
Do NOT invoke the orchestrator.

Artifact folder: {slug}
Artifact path: docs/requirements/{slug}/
Phase key: {phase_key}

META CONTEXT:
  steps_completed: {steps_completed_json}
  depth_overrides: {depth_overrides_json}
  phases_completed: {phases_completed_json}

DEPTH CONTEXT:
  quick_scan_scope: {scope}
  quick_scan_file_count: {file_count}
  quick_scan_complexity: {complexity}

Produce artifacts compatible with existing phase agent outputs.
Update meta.json steps_completed after each step.
Present menu at each step boundary.
```

### 2.3 Task Prompt Field Definitions

| Field | Type | Source | Example |
|-------|------|--------|---------|
| `phase_number` | string | Phase key prefix, zero-padded | `"01"` |
| `phase_display_name` | string | Phase display name | `"Requirements"` |
| `slug` | string | Item slug from resolveItem() | `"gh-20-roundtable-analysis-agent-with-named-personas"` |
| `phase_key` | string | ANALYSIS_PHASE_SEQUENCE entry | `"01-requirements"` |
| `steps_completed_json` | string | JSON.stringify(meta.steps_completed) | `["00-01","00-02","00-03"]` |
| `depth_overrides_json` | string | JSON.stringify(meta.depth_overrides) | `{"01-requirements":"brief"}` |
| `phases_completed_json` | string | JSON.stringify(meta.phases_completed) | `["00-quick-scan"]` |
| `scope` | string | From quick-scan.md or `"unknown"` | `"medium"` |
| `file_count` | number | From quick-scan.md or `0` | `12` |
| `complexity` | string | From quick-scan.md or `"unknown"` | `"medium"` |

### 2.4 Phase Display Name Mapping

| Phase Key | Display Name (used in prompt) |
|-----------|------------------------------|
| `00-quick-scan` | Quick Scan |
| `01-requirements` | Requirements |
| `02-impact-analysis` | Impact Analysis |
| `03-architecture` | Architecture |
| `04-design` | Design |

### 2.5 Return Protocol

The roundtable agent returns control to isdlc.md by completing its Task execution. There is no explicit return value. The caller infers completion from:

1. The Task tool call completes (agent finished its work).
2. meta.json has been updated with new `steps_completed` entries.
3. Artifact files have been written or updated in the artifact folder.

After the roundtable agent returns, isdlc.md performs post-phase bookkeeping (step 7c through 7h):
- Append phase_key to `meta.phases_completed`
- Derive `analysis_status`
- Update `codebase_hash`
- Write meta.json
- Update BACKLOG.md marker
- Offer exit point

### 2.6 Existence Check Protocol

Before delegating to the roundtable agent, isdlc.md checks if the agent file exists:

```
Check: Use Glob tool with pattern "src/claude/agents/roundtable-analyst.md"
Result:
  - Match found: delegate to roundtable-analyst
  - No match: delegate to standard phase agent (fallback)
```

This check is performed once per analyze verb invocation, not once per phase. If the agent exists at the start, it is used for all phases. If it does not exist, all phases use standard agents.

**Traces**: FR-009 AC-009-01, AC-009-04.

---

## 3. Step File Interface (roundtable-analyst -> step files)

### 3.1 Discovery Interface

**Mechanism**: Glob tool (file system directory listing)
**Caller**: roundtable-analyst step execution engine
**Target**: `src/claude/skills/analysis-steps/{phase_key}/*.md`

```
Input:
  phase_key: string (e.g., "01-requirements")

Protocol:
  1. Glob("src/claude/skills/analysis-steps/{phase_key}/*.md")
  2. Sort results lexicographically by filename

Output:
  Ordered list of absolute file paths, or empty list if directory is empty/absent

Errors:
  - Directory does not exist: empty result (treated as no steps)
  - Permission denied: Glob tool returns error; agent logs warning and treats as no steps
```

### 3.2 Read Interface

**Mechanism**: Read tool (file content retrieval)
**Caller**: roundtable-analyst step execution engine
**Target**: Individual step file path

```
Input:
  file_path: string (absolute path to step file)

Protocol:
  1. Read(file_path)
  2. Extract YAML frontmatter (content between first --- and second ---)
  3. Parse YAML into object
  4. Extract body sections by ## headings

Output:
  {
    frontmatter: {
      step_id: string,
      title: string,
      persona: string,
      depth: string,
      outputs: string[],
      depends_on: string[] | undefined,
      skip_if: string | undefined
    },
    body_sections: {
      brief: string | null,
      standard: string | null,
      deep: string | null,
      validation: string | null,
      artifacts: string | null
    }
  }

Errors:
  - File not readable: skip step, log warning
  - YAML parse failure: skip step, log warning
  - Missing required frontmatter field: skip step, log warning
```

### 3.3 Frontmatter Validation Rules

The roundtable agent validates each parsed frontmatter against these rules:

| Field | Validation | On Failure |
|-------|-----------|------------|
| `step_id` | Non-empty string | Skip step |
| `title` | Non-empty string | Skip step |
| `persona` | One of: `"business-analyst"`, `"solutions-architect"`, `"system-designer"` | Skip step |
| `depth` | One of: `"brief"`, `"standard"`, `"deep"` | Skip step |
| `outputs` | Non-empty array of strings | Skip step |
| `depends_on` | Array of strings (if present) | Ignore field, treat as `[]` |
| `skip_if` | String (if present) | Ignore field, treat as `""` |

**Traces**: FR-012 AC-012-01, AC-012-02.

---

## 4. Meta.json Interface (roundtable-analyst and isdlc.md -> meta.json)

### 4.1 Read Interface

**Mechanism**: `readMetaJson(slugDir)` from `three-verb-utils.cjs`
**Callers**: isdlc.md (before delegation), roundtable-analyst (during step execution)

```
Input:
  slugDir: string (absolute path to artifact folder)

Output:
  {
    description: string,
    source: string,
    source_id: string,
    created_at: string,
    analysis_status: string,
    phases_completed: string[],
    codebase_hash: string | undefined,
    steps_completed: string[],       // v3: defaults to []
    depth_overrides: object           // v3: defaults to {}
  }
  OR null (if file missing or corrupt)

Post-conditions:
  - steps_completed is always an array (never null/undefined/non-array)
  - depth_overrides is always a plain object (never null/array/non-object)
```

### 4.2 Write Interface

**Mechanism**: `writeMetaJson(slugDir, meta)` from `three-verb-utils.cjs`
**Callers**: isdlc.md (post-phase bookkeeping), roundtable-analyst (after each step)

```
Input:
  slugDir: string (absolute path to artifact folder)
  meta: object (the full meta object to write)

Side Effects:
  - Writes meta.json to slugDir/meta.json
  - Deletes legacy field: meta.phase_a_completed
  - Derives meta.analysis_status from meta.phases_completed.length
  - Preserves all other fields including steps_completed and depth_overrides

Pre-conditions:
  - meta is a valid object
  - slugDir exists on the filesystem

Post-conditions:
  - meta.json written with JSON.stringify(meta, null, 2)
  - analysis_status is consistent with phases_completed
```

### 4.3 Roundtable Agent Write Pattern

The roundtable agent writes meta.json after each step completion. The write pattern:

```
After each step:
  1. meta.steps_completed.push(step_id)
  2. Call writeMetaJson(slugDir, meta)

After user depth override:
  1. meta.depth_overrides[phase_key] = new_depth
  2. Call writeMetaJson(slugDir, meta)
```

The roundtable agent reads meta.json content from the Task delegation prompt (passed by isdlc.md). It does NOT call `readMetaJson()` directly at phase start -- the initial state comes from the prompt. Subsequent writes go directly to disk via `writeMetaJson()`.

**Exception**: If the roundtable agent needs to re-read meta.json mid-phase (e.g., after a step write to verify persistence), it reads the file directly using the Read tool. This is a defensive measure, not a normal code path.

### 4.4 isdlc.md Write Pattern

isdlc.md writes meta.json after each phase completion (step 7c-7f):

```
After roundtable agent returns:
  1. meta.phases_completed.push(phase_key)
  2. meta.analysis_status = deriveAnalysisStatus(meta.phases_completed)
  3. meta.codebase_hash = current git HEAD short SHA
  4. Call writeMetaJson(slugDir, meta)
```

This write happens AFTER the roundtable agent's step-level writes. It updates phase-level fields without disturbing `steps_completed` or `depth_overrides` (which are already persisted by the roundtable agent).

### 4.5 Concurrency Model

There is no concurrency. The execution model is strictly sequential:

1. isdlc.md reads meta.json
2. isdlc.md delegates to roundtable-analyst (control transfers)
3. roundtable-analyst writes meta.json multiple times (one per step)
4. roundtable-analyst returns (control transfers back)
5. isdlc.md writes meta.json one final time (phase completion)

Steps 3 and 5 never overlap because the Task tool provides sequential execution.

---

## 5. User Interaction Interface

### 5.1 Interaction Model

The roundtable agent interacts with the user through text-based conversation within the Claude Code terminal. There are four interaction patterns:

1. **Persona prompt** -- the agent asks questions in the active persona's voice
2. **Step menu** -- the agent presents menu options after each step
3. **Natural conversation** -- the user types free-form text and the agent responds
4. **Depth override** -- the user changes analysis depth via keyword

### 5.2 Step Menu Interface

#### Standard Step Menu (non-final step)

```
---
[E] Elaboration Mode -- bring all perspectives to discuss this topic
[C] Continue -- move to the next step
[S] Skip remaining steps in this phase
Or type naturally to provide feedback.
---
```

#### Final Step Menu (last step of a phase, not final phase)

```
---
[E] Elaboration Mode -- bring all perspectives to discuss this topic
[C] Continue to Phase {NN+1} ({next phase name})
Or type naturally to provide feedback.
---
```

#### Final Step Menu (last step of final phase)

```
---
[E] Elaboration Mode -- bring all perspectives to discuss this topic
[C] Complete analysis
Or type naturally to provide feedback.
---
```

### 5.3 Menu Input Processing

| User Input | Pattern | Action |
|-----------|---------|--------|
| `C` or `c` | Exact match (case-insensitive) | Advance to next step or return to isdlc.md |
| `E` or `e` | Exact match (case-insensitive) | Trigger elaboration stub |
| `S` or `s` | Exact match (case-insensitive) | Skip remaining steps, return to isdlc.md |
| `deep`, `more detail`, `dig in`, `thorough`, `go deeper`, `full analysis` | Substring match (case-insensitive) | Switch to deep depth, re-engage current step |
| `brief`, `skip ahead`, `keep it short`, `quick`, `fast`, `summarize` | Substring match (case-insensitive) | Switch to brief depth, re-engage current step |
| Any other text | Default | Treat as natural language feedback on current step |

**Priority**: Menu commands (`C`, `E`, `S`) are checked first. Depth override keywords are checked second. Everything else is natural conversation.

**Edge case**: If the user types "Continue" (full word), it is treated as natural language, not as a `[C]` command. Only the single letter `C` triggers the menu action. This avoids false matches on conversational text that happens to contain menu keywords.

### 5.4 Elaboration Stub Interface

When the user selects `[E]`:

```
Agent output:
  "Elaboration mode is coming in a future update (#21). For now, I'll go
  deeper on this topic myself."

Agent behavior:
  1. Set active depth to "deep" for the current step only
  2. Re-read the current step's ## Deep Mode section
  3. Present the deep mode prompts as a follow-up to the current step
  4. After the follow-up conversation, re-present the step menu
  5. Do NOT persist the depth change to depth_overrides (this is a one-time
     elaboration, not a persistent override)
```

**Traces**: FR-007 AC-007-03.

### 5.5 Persona Prompt Interface

Each persona has a distinct prompting style that shapes the conversation:

#### Maya Chen (Business Analyst)

```
Step Header Format:
  "Maya Chen (Business Analyst) -- Step {step_id}: {title}"

Prompting Style:
  - Opens with context: "Based on what you've told me so far..."
  - Asks open-ended questions: "What problem does this solve?"
  - Challenges assumptions: "What happens if we ship without this?"
  - Summarizes before moving on: "So what I'm hearing is..."
  - Uses concrete examples: "If a user tries to X while Y happens..."

Acknowledgment Pattern:
  "That's important -- so {rephrasing of user's point}. Let me capture that."
```

#### Alex Rivera (Solutions Architect)

```
Step Header Format:
  "Alex Rivera (Solutions Architect) -- Step {step_id}: {title}"

Prompting Style:
  - Presents options: "I see two approaches here..."
  - Discusses tradeoffs: "Option A gives you X but costs Y..."
  - Asks about risk appetite: "How much risk is acceptable here?"
  - Thinks in blast radius: "This change would affect these 5 modules..."
  - Direct about debt: "This creates technical debt in..."

Acknowledgment Pattern:
  "Good point about {topic}. That affects the blast radius because..."
```

#### Jordan Park (System Designer)

```
Step Header Format:
  "Jordan Park (System Designer) -- Step {step_id}: {title}"

Prompting Style:
  - Shows concrete examples: "Here's what the function signature would look like..."
  - Defines boundaries: "This module is responsible for X, not Y."
  - Data structure focus: "The data model would be..."
  - Error handling explicit: "When this fails, the caller receives..."
  - Simplicity advocate: "Do we actually need this abstraction?"

Acknowledgment Pattern:
  "Noted. I'll revise the interface to account for {concern}."
```

### 5.6 Greeting Interface

#### New Session Greeting

```
Format:
  "{PersonaName}: Hi, I'm {name}, your {role}. I'll be guiding you through
  {phase_description}. Let's get started."

Example:
  "Maya Chen: Hi, I'm Maya, your Business Analyst. I'll be guiding you
  through requirements discovery. Let's get started."
```

#### Resumed Session Greeting

```
Format:
  "{PersonaName}: Welcome back. Last time we completed {completed_step_titles}.
  Let's pick up from {next_step_title}."

Example:
  "Maya Chen: Welcome back. Last time we covered business context, user needs,
  and UX journeys. Let's pick up from Technical Context."
```

#### Phase Transition Greeting

```
Format (two messages):
  Message 1: "{outgoing_name} has finished {outgoing_phase_description}.
  Handing off to {incoming_name} ({incoming_role}) who will
  {incoming_phase_description}."

  Message 2: "I've reviewed {outgoing_name}'s {artifact_type}. Here's what
  I'm working with: {1-2 sentence summary}."

Example:
  Message 1: "Maya Chen has finished requirements discovery. Handing off to
  Alex Rivera (Solutions Architect) who will assess the impact and design
  the architecture."

  Message 2: "I've reviewed Maya's requirements spec. Here's what I'm working
  with: the feature adds a roundtable agent with 3 personas, 24 step files,
  and two small modifications to existing code."
```

### 5.7 Depth Announcement Interface

| Depth | Announcement | When |
|-------|-------------|------|
| brief | "This looks straightforward. I'll keep the analysis brief -- say 'deep' if you want the full treatment." | After greeting, before first step |
| standard | (No announcement) | N/A |
| deep | "This is a substantial change. I'll do a thorough analysis -- say 'brief' if you want to speed things up." | After greeting, before first step |
| (user override to deep) | "Got it, switching to thorough mode." | Immediately on override detection |
| (user override to brief) | "Got it, switching to brief mode." | Immediately on override detection |

---

## 6. Phase Boundary Interface (isdlc.md -> user)

After the roundtable agent returns, isdlc.md presents the phase boundary:

```
Format:
  "Phase {NN} ({phase_name}) complete. Continue to Phase {NN+1}
  ({next_phase_name})? [Y/n]"

Example:
  "Phase 01 (Requirements) complete. Continue to Phase 02 (Impact Analysis)?
  [Y/n]"

Final phase:
  "Phase 04 (Design) complete. Analysis complete. {slug} is ready to build."
```

This interface is unchanged from the existing analyze verb behavior. The roundtable agent has no involvement in this boundary -- it is fully managed by isdlc.md.

---

## 7. Artifact Write Interface (roundtable-analyst -> file system)

### 7.1 Write Protocol

The roundtable agent writes artifact files using the Write tool:

```
Input:
  file_path: string (absolute path, e.g., docs/requirements/{slug}/requirements-spec.md)
  content: string (full file content)

Behavior:
  - If file does not exist: create it
  - If file exists: overwrite with updated content
  - If parent directory does not exist: create it

Error handling:
  - Write failure: log warning, continue (artifact may be incomplete)
```

### 7.2 Artifact Path Resolution

| Artifact | Path | Notes |
|----------|------|-------|
| `quick-scan.md` | `docs/requirements/{slug}/quick-scan.md` | Phase 00 output |
| `requirements-spec.md` | `docs/requirements/{slug}/requirements-spec.md` | Phase 01 primary |
| `user-stories.json` | `docs/requirements/{slug}/user-stories.json` | Phase 01 secondary |
| `traceability-matrix.csv` | `docs/requirements/{slug}/traceability-matrix.csv` | Phase 01 secondary |
| `nfr-matrix.md` | `docs/common/nfr-matrix.md` | Shared, created/updated |
| `impact-analysis.md` | `docs/requirements/{slug}/impact-analysis.md` | Phase 02 output |
| `architecture-overview.md` | `docs/requirements/{slug}/architecture-overview.md` | Phase 03 primary |
| `tech-stack-decision.md` | `docs/requirements/{slug}/tech-stack-decision.md` | Phase 03 secondary |
| `component-interactions.md` | `docs/requirements/{slug}/component-interactions.md` | Phase 03 secondary |
| ADR files | `docs/requirements/{slug}/adr-{NNNN}-{title}.md` | Phase 03, zero or more |
| Module design files | `docs/requirements/{slug}/module-design-*.md` | Phase 04 primary |
| `interface-spec.yaml` | `docs/requirements/{slug}/interface-spec.yaml` | Phase 04 secondary |
| `error-taxonomy.md` | `docs/requirements/{slug}/error-taxonomy.md` | Phase 04 secondary |

All paths use `{slug}` from the Task delegation prompt's artifact folder field.

---

## 8. Traceability

| Interface | Requirements Traced |
|-----------|-------------------|
| Delegation protocol | FR-009 AC-009-01, AC-009-02, AC-009-04 |
| Task prompt schema | FR-009 AC-009-02 |
| Step file discovery | FR-004 AC-004-01, AC-004-04 |
| Step file read/parse | FR-004 AC-004-02, FR-012 AC-012-01 through AC-012-04 |
| Meta.json read | FR-005 AC-005-02, AC-005-04 |
| Meta.json write | FR-005 AC-005-01, AC-005-05 |
| Step menu | FR-007 AC-007-01 through AC-007-06 |
| Natural conversation | FR-007 AC-007-04, NFR-006 |
| Elaboration stub | FR-007 AC-007-03 |
| Depth override | FR-006 AC-006-04, AC-006-05 |
| Persona prompts | FR-002 AC-002-01 through AC-002-04, NFR-006 |
| Greeting protocol | FR-011 AC-011-01 through AC-011-03 |
| Phase transition | FR-008 AC-008-01 through AC-008-04 |
| Artifact paths | FR-010 AC-010-01 through AC-010-06 |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | System Designer (Phase 04) | Initial interface specification |
