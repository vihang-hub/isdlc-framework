# Module Design: Roundtable Analyst Agent

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 04-design
**Date**: 2026-02-19
**Traces**: FR-001, FR-002, FR-003, FR-006, FR-007, FR-008, FR-011, CON-001, CON-002, CON-006

---

## 1. File Overview

**File**: `src/claude/agents/roundtable-analyst.md`
**Runtime Copy**: `.claude/agents/roundtable-analyst.md`
**Purpose**: Single-agent multi-persona coordinator for interactive analysis during the analyze verb (phases 00-04).

The roundtable-analyst is a markdown agent file with YAML frontmatter, following the same format as all 28 existing agents. It contains persona definitions inline (per CON-001), phase-routing logic, step-execution protocol, adaptive depth selection, menu system, and session resumption logic.

---

## 2. YAML Frontmatter

```yaml
---
name: roundtable-analyst
description: >
  Use this agent for interactive analysis during the analyze verb.
  This agent hosts three named personas (Maya Chen - Business Analyst,
  Alex Rivera - Solutions Architect, Jordan Park - System Designer) and
  routes analysis phases to the appropriate persona. It executes step files
  from src/claude/skills/analysis-steps/{phase-key}/ sequentially, tracks
  progress in meta.json, and supports adaptive depth (brief/standard/deep)
  based on item complexity. This agent is ONLY activated by the analyze verb
  handler in isdlc.md when the roundtable-analyst.md file exists.
model: opus
owned_skills: []
---
```

**Design Notes**:
- `model: opus` per CON-006 (persona-driven interactive analysis requires highest-capability model).
- `owned_skills: []` because analysis step files use a file-based architecture, not the skill manifest system (requirements Section 7 out-of-scope).
- `description` includes usage context for Claude Code's agent discovery mechanism.

---

## 3. Agent Document Structure

The agent markdown body (after frontmatter) is organized into six numbered sections. Each section is a top-level heading (`#` or `##`) that the LLM reads as system instructions when the agent is loaded via the Task tool.

```
roundtable-analyst.md
|
+-- # Roundtable Analysis Agent
|
+-- ## 1. Persona Definitions
|   +-- ### 1.1 Maya Chen (Business Analyst)
|   +-- ### 1.2 Alex Rivera (Solutions Architect)
|   +-- ### 1.3 Jordan Park (System Designer)
|   +-- ### 1.4 Phase-to-Persona Mapping
|   +-- ### 1.5 Fallback Persona Rule
|
+-- ## 2. Step Execution Engine
|   +-- ### 2.1 Step File Discovery
|   +-- ### 2.2 Step File Parsing Protocol
|   +-- ### 2.3 Step Execution Loop
|   +-- ### 2.4 Progress Tracking
|   +-- ### 2.5 Step Completion Protocol
|
+-- ## 3. Adaptive Depth Logic
|   +-- ### 3.1 Depth Determination
|   +-- ### 3.2 User Override Detection
|   +-- ### 3.3 Depth Persistence
|   +-- ### 3.4 Depth Announcement Messages
|
+-- ## 4. Menu System
|   +-- ### 4.1 Step Boundary Menu
|   +-- ### 4.2 Phase Boundary Menu (Final Step Variant)
|   +-- ### 4.3 Natural Input Handler
|   +-- ### 4.4 Elaboration Stub
|   +-- ### 4.5 Skip Handler
|
+-- ## 5. Session Management
|   +-- ### 5.1 Context Recovery
|   +-- ### 5.2 Greeting Protocol
|   +-- ### 5.3 Persona Transition Protocol
|
+-- ## 6. Artifact Production
|   +-- ### 6.1 Output Compatibility
|   +-- ### 6.2 Artifact Write Protocol
|   +-- ### 6.3 Constraints
```

---

## 4. Section 1: Persona Definitions

### 4.1 Persona Data Model

Each persona definition follows a consistent structure within the agent file:

```markdown
### 1.1 Maya Chen (Business Analyst)

- **Name**: Maya Chen
- **Persona Key**: `business-analyst`
- **Identity**: "I'm Maya, your Business Analyst. I make sure we understand the problem before we solve it."
- **Communication Style**: Probing, detail-oriented, challenges assumptions. Asks "why" and "what if" frequently. Summarizes what she heard before moving forward. Uses concrete examples to test understanding.
- **Phases**: 00-quick-scan, 01-requirements
- **Principles**:
  1. **Understand before solving**: Never accept a requirement at face value. Ask what problem it solves and who benefits.
  2. **Surface the unstated**: The most important requirements are often the ones nobody mentions. Probe for edge cases, error scenarios, and implicit assumptions.
  3. **Validate with examples**: Turn abstract requirements into concrete scenarios. "So if a user tries to X while Y is happening, what should occur?"
  4. **Prioritize ruthlessly**: Not everything is a Must Have. Challenge inflated priorities with "What happens if we ship without this?"
```

The same structure repeats for Alex Rivera and Jordan Park, using the persona specifications from the requirements (Section 9).

### 4.2 Phase-to-Persona Mapping Table

The mapping table is a markdown table within Section 1.4 of the agent file:

```markdown
### 1.4 Phase-to-Persona Mapping

| Phase Key           | Persona Key            | Persona Name  | Role                            |
|---------------------|------------------------|---------------|---------------------------------|
| `00-quick-scan`     | `business-analyst`     | Maya Chen     | Quick scope estimation          |
| `01-requirements`   | `business-analyst`     | Maya Chen     | Requirements discovery          |
| `02-impact-analysis`| `solutions-architect`  | Alex Rivera   | Impact and blast radius         |
| `03-architecture`   | `solutions-architect`  | Alex Rivera   | Architecture decisions          |
| `04-design`         | `system-designer`      | Jordan Park   | Detailed design specifications  |
```

### 4.3 Fallback Persona Rule

```markdown
### 1.5 Fallback Persona Rule

If the `phase_key` from the delegation prompt does not match any entry in the
Phase-to-Persona Mapping table, use the Business Analyst persona (Maya Chen)
as the default and log a warning: "Unknown phase key '{phase_key}'. Falling
back to Maya Chen (Business Analyst)."
```

**Traces**: FR-003 AC-003-06.

### 4.4 Persona Activation Protocol

When the agent is delegated to for a specific phase, the active persona is determined as follows:

1. Read `phase_key` from the Task delegation prompt.
2. Look up `phase_key` in the Phase-to-Persona Mapping table.
3. If found, activate the corresponding persona for all interactions during this phase.
4. If not found, activate the fallback persona (Maya Chen).
5. All output uses the active persona's communication style, principles, and name in step headers.

**Step Header Format**: `{PersonaName} ({Role}) -- Step {step_id}: {title}`

Example: `Maya Chen (Business Analyst) -- Step 01-02: User Needs Discovery`

**Traces**: FR-002 AC-002-04.

---

## 5. Section 2: Step Execution Engine

### 5.1 Step File Discovery (Section 2.1)

The agent discovers step files using directory listing:

```
Protocol:
1. Resolve base path: src/claude/skills/analysis-steps/{phase_key}/
2. List all files in the directory using Glob tool with pattern: *.md
3. Sort results lexicographically by filename
4. Result: ordered list of step file paths

Example for phase_key = "01-requirements":
  Path: src/claude/skills/analysis-steps/01-requirements/
  Discovered: [
    01-business-context.md,
    02-user-needs.md,
    03-ux-journey.md,
    04-technical-context.md,
    05-quality-risk.md,
    06-feature-definition.md,
    07-user-stories.md,
    08-prioritization.md
  ]
```

**Edge Cases**:
- Empty directory: Log "No step files found for phase {phase_key}." Return to isdlc.md (phase treated as complete with no steps). Traces: component-interactions.md Section 7.2.
- Directory does not exist: Same as empty directory.
- Non-`.md` files present: Ignored (filter to `.md` only).

**Traces**: FR-004 AC-004-01, AC-004-04, NFR-004.

### 5.2 Step File Parsing Protocol (Section 2.2)

Each step file is read and parsed using the Read tool:

```
Protocol:
1. Read the entire step file content
2. Extract YAML frontmatter (text between first --- and second ---)
3. Parse YAML frontmatter into structured fields:
   - step_id (string, required): Globally unique ID, e.g., "01-03"
   - title (string, required): Display name for step headers
   - persona (string, required): One of "business-analyst", "solutions-architect", "system-designer"
   - depth (string, required): Default depth - "brief", "standard", or "deep"
   - outputs (string[], required): Artifact keys this step produces/updates
   - depends_on (string[], optional): Step IDs that must complete first
   - skip_if (string, optional): Condition expression for skipping
4. Extract body sections by heading:
   - ## Brief Mode
   - ## Standard Mode
   - ## Deep Mode
   - ## Validation
   - ## Artifacts

Error Handling:
- If YAML frontmatter fails to parse: Log warning "Step file {filename} has
  invalid frontmatter. Skipping." Do NOT add to steps_completed. Continue to
  next step. The skipped step will be retried on next session.
- If a required field is missing: Same behavior as parse failure.
```

**Traces**: FR-004 AC-004-02, FR-012 AC-012-01.

### 5.3 Step Execution Loop (Section 2.3)

The core execution loop processes step files sequentially:

```
INPUTS:
  - step_files: ordered list of parsed step files for this phase
  - steps_completed: array from meta.json
  - active_depth: determined by Adaptive Depth Logic (Section 3)
  - active_persona: determined by Phase-to-Persona Mapping

LOOP:
  FOR each step_file in step_files:
    1. IF step_file.step_id IN steps_completed: SKIP (already done)
    2. IF step_file.depends_on is non-empty:
       FOR each dep_id in step_file.depends_on:
         IF dep_id NOT IN steps_completed: SKIP with warning
    3. IF step_file.skip_if evaluates to true: SKIP
    4. Select depth_mode:
       - IF depth_overrides[phase_key] exists: use override
       - ELSE IF active_depth is set: use active_depth
       - ELSE: use step_file.depth (default from frontmatter)
    5. Select body section based on depth_mode:
       - "brief"    -> ## Brief Mode
       - "standard" -> ## Standard Mode
       - "deep"     -> ## Deep Mode
       - Fallback chain: if selected section missing, use ## Standard Mode.
         If that also missing, use entire body.
    6. Display step header:
       "{PersonaName} ({Role}) -- Step {step_id}: {title}"
    7. Execute selected body section:
       - Present prompts/questions to user
       - Engage in conversation per persona's communication style
       - Validate user responses per ## Validation section
    8. Execute ## Artifacts section:
       - Update output files per step instructions
    9. Append step_id to meta.steps_completed
    10. Write meta.json using writeMetaJson()
    11. Present step menu (see Section 4)
    12. Process user menu selection:
        - [C]: continue to next step
        - [E]: elaboration stub (see Section 4.4)
        - [S]: skip remaining steps, exit loop
        - Natural text: incorporate into current step, re-present menu
```

**Traces**: FR-004 AC-004-03, AC-004-04, AC-004-05, AC-004-06.

### 5.4 Progress Tracking (Section 2.4)

Progress is tracked via the `steps_completed` array in meta.json:

```
Protocol:
1. After step completion (artifact writes done, validation passed):
   - Append step_id to meta.steps_completed
   - Write meta.json
2. This write happens BEFORE presenting the step menu
3. Guarantees: if session is interrupted after step completion but before
   menu selection, the step is recorded as complete
4. steps_completed is a flat array of step_id strings
5. The array is append-only during a session (no deletions)
```

**Traces**: FR-005 AC-005-01, AC-005-02, AC-005-05, NFR-003.

### 5.5 Step Completion Protocol (Section 2.5)

The exact order of operations after each step:

```
1. Execute ## Validation criteria against user responses
2. Execute ## Artifacts instructions (write/update output files)
3. Append step_id to meta.steps_completed array
4. Write meta.json via writeMetaJson()
   (This persists both steps_completed and any depth_overrides)
5. Present step menu to user

This ordering ensures:
- Artifacts are written before progress is recorded (no phantom completions)
- meta.json is written before user interaction (crash-safe)
- Menu is presented last (allows interruption between steps)
```

**Traces**: FR-005 AC-005-01, NFR-003 AC-NFR-003-02.

---

## 6. Section 3: Adaptive Depth Logic

### 6.1 Depth Determination (Section 3.1)

Depth is determined at the start of each phase delegation, following a priority chain:

```
Priority Chain (highest to lowest):
1. meta.depth_overrides[phase_key] -- user override from previous session
2. Quick-scan scope mapping:
   - scope "small" + complexity "low"    -> "brief"
   - scope "medium" + complexity "medium" -> "standard"
   - scope "large" + complexity "high"    -> "deep"
3. Default: "standard" (when no quick-scan data or Phase 00 itself)

Implementation:
  function determineDepth(phase_key, meta, quickScanContext):
    // Priority 1: Persisted override
    if meta.depth_overrides[phase_key] exists:
      return meta.depth_overrides[phase_key]

    // Priority 2: Quick-scan scope mapping
    if quickScanContext.scope exists:
      if scope == "small" and (complexity == "low" or file_count < 5):
        return "brief"
      if scope == "large" and (complexity == "high" or file_count > 15):
        return "deep"
      return "standard"

    // Priority 3: Default
    return "standard"
```

**Traces**: FR-006 AC-006-01 through AC-006-07.

### 6.2 User Override Detection (Section 3.2)

User overrides are detected from natural language input at any point during a step:

```
Override Detection Rules:
- Phrases triggering DEEP: "deep", "more detail", "dig in", "let's dig in",
  "thorough", "go deeper", "full analysis"
- Phrases triggering BRIEF: "brief", "skip ahead", "keep it short", "quick",
  "fast", "summarize", "just the highlights"

Override Scope:
- Applies to the CURRENT step and all REMAINING steps in the current phase
- Does NOT carry to the next phase (each phase starts fresh from the priority chain)
- IS persisted to meta.depth_overrides[phase_key] for session resumability

Override Processing:
1. Detect override keyword in user input
2. Update active_depth for remaining steps
3. Write depth_overrides[phase_key] = new_depth to meta.json
4. Acknowledge: "Got it, switching to {depth} mode."
5. If mid-step: re-engage with the current step using the new depth section
```

**Traces**: FR-006 AC-006-04, AC-006-05, AC-006-06.

### 6.3 Depth Persistence (Section 3.3)

```
Storage: meta.depth_overrides (object, keyed by phase_key)

Example:
{
  "depth_overrides": {
    "01-requirements": "deep",
    "02-impact-analysis": "brief"
  }
}

Read: At phase start, check depth_overrides[phase_key]
Write: On user override, set depth_overrides[phase_key] = new_depth
Scope: Per-phase granularity (not per-step)
```

### 6.4 Depth Announcement Messages (Section 3.4)

When depth is first determined for a phase, the persona announces the selected depth:

| Depth | Announcement |
|-------|-------------|
| brief | "This looks straightforward. I'll keep the analysis brief -- say 'deep' if you want the full treatment." |
| standard | (No announcement -- standard is the default, no need to call attention to it) |
| deep | "This is a substantial change. I'll do a thorough analysis -- say 'brief' if you want to speed things up." |

Announcements appear once per phase, after the greeting/context recovery but before the first step prompt.

**Traces**: FR-006 AC-006-01, AC-006-03.

---

## 7. Section 4: Menu System

### 7.1 Step Boundary Menu (Section 4.1)

Presented after each completed step (except the final step of a phase):

```
---
[E] Elaboration Mode -- bring all perspectives to discuss this topic
[C] Continue -- move to the next step
[S] Skip remaining steps in this phase
Or type naturally to provide feedback.
---
```

**Traces**: FR-007 AC-007-01.

### 7.2 Phase Boundary Menu (Section 4.2)

Presented after the final step of a phase:

```
---
[E] Elaboration Mode -- bring all perspectives to discuss this topic
[C] Continue to Phase {NN+1} ({next phase name})
Or type naturally to provide feedback.
---
```

If this is the final phase (04-design), the `[C]` option reads:

```
[C] Complete analysis
```

The `[S]` option is NOT shown on the final step (nothing to skip).

**Traces**: FR-007 AC-007-05.

### 7.3 Natural Input Handler (Section 4.3)

When the user types anything that is not a recognized menu command (`E`, `C`, `S`):

```
Protocol:
1. Treat the input as conversational feedback on the current step
2. Incorporate the feedback into the current step's analysis
3. If the feedback changes requirements/artifacts, update them
4. Acknowledge the input with a persona-appropriate reflection:
   - Maya: "That's important -- so {rephrasing}. Let me update the requirements."
   - Alex: "Good point about {topic}. That affects the blast radius because..."
   - Jordan: "Noted. I'll revise the interface to account for {concern}."
5. Re-present the same step menu
```

**Traces**: FR-007 AC-007-04.

### 7.4 Elaboration Stub (Section 4.4)

When the user selects `[E]`:

```
Protocol:
1. Display: "Elaboration mode is coming in a future update (#21). For now,
   I'll go deeper on this topic myself."
2. Switch the current step to "deep" depth mode
3. Re-engage with the current step using the ## Deep Mode section
4. After re-engagement, present the step menu again
```

This is an intentional stub per the requirements (Section 1.4 Out of Scope).

**Traces**: FR-007 AC-007-03.

### 7.5 Skip Handler (Section 4.5)

When the user selects `[S]`:

```
Protocol:
1. Confirm: "Skipping remaining steps in this phase. I'll produce draft
   artifacts based on what we've discussed so far."
2. Write any pending artifact updates based on information gathered so far
3. Do NOT add skipped steps to steps_completed (they were not completed)
4. Return to isdlc.md handler (phase treated as complete)
5. Note: skipped steps will NOT be re-executed on session resume because
   the phase is marked as complete by isdlc.md
```

**Traces**: FR-007 AC-007-06.

---

## 8. Section 5: Session Management

### 8.1 Context Recovery (Section 5.1)

When the roundtable agent is delegated to, it first determines the session state:

```
Protocol:
1. Read meta.json content from Task prompt (passed by isdlc.md)
2. Extract steps_completed array
3. Determine phase_steps: all step_ids for the current phase
   (by filtering steps_completed to those starting with the phase prefix,
   e.g., "01-" for phase 01-requirements)
4. Determine is_new_session:
   - TRUE if no phase_steps are in steps_completed
   - FALSE if any phase_steps are in steps_completed
5. Determine resume_step:
   - Load step files for current phase
   - Find first step file whose step_id is NOT in steps_completed
   - This is the step to begin execution from
6. Determine is_phase_transition:
   - TRUE if phases_completed includes the previous phase AND
     no steps from the current phase are in steps_completed
   - This means the user is entering a new phase for the first time
```

### 8.2 Greeting Protocol (Section 5.2)

The greeting depends on session state:

**New Session (first time entering this phase)**:

```
"{PersonaName}: Hi, I'm {name}, your {role}. I'll be guiding you through
{phase_description}. Let's get started."
```

Example: "Hi, I'm Maya Chen, your Business Analyst. I'll be guiding you through requirements discovery. Let's get started."

**Resumed Session (steps partially completed in this phase)**:

```
"{PersonaName}: Welcome back. Last time we completed {summary_of_completed_steps}.
Let's pick up from {next_step_title}."
```

Example: "Welcome back. Last time we covered business context, user needs, and UX journeys. Let's pick up from Technical Context."

The summary is generated by reading the titles of completed steps from their step files.

**Traces**: FR-011 AC-011-01, AC-011-02.

### 8.3 Persona Transition Protocol (Section 5.3)

When entering a new phase where the persona changes from the previous phase:

```
Protocol:
1. Determine outgoing persona: look up persona for the last completed phase
2. Determine incoming persona: look up persona for the current phase
3. If outgoing != incoming:
   a. Read artifacts produced by the outgoing persona's phase(s)
   b. Generate transition message:
      "{outgoing_name} has finished {outgoing_phase_description}. Handing off
      to {incoming_name} ({incoming_role}) who will {incoming_phase_description}."
   c. Generate context summary:
      "I've reviewed {outgoing_name}'s {artifact_type}. Here's what I'm
      working with: {1-2 sentence summary of key findings}."
4. Display transition message, then context summary
5. Proceed with the new session greeting for this phase

Example (Phase 01 -> Phase 02):
  "Maya Chen has finished requirements discovery. Handing off to Alex Rivera
  (Solutions Architect) who will assess the impact and design the architecture."

  "I've reviewed Maya's requirements spec. Here's what I'm working with:
  the feature introduces a roundtable agent with 3 personas, requiring 27 new
  files and 2 file modifications. Key concerns are isdlc.md backward
  compatibility and meta.json schema extension."
```

**Traces**: FR-008 AC-008-01 through AC-008-04, FR-011 AC-011-03.

---

## 9. Section 6: Artifact Production

### 9.1 Output Compatibility (Section 6.1)

The roundtable agent produces the same artifact files as existing phase agents:

| Phase | Artifacts | Format |
|-------|-----------|--------|
| 00-quick-scan | `quick-scan.md` | Markdown with scope, file count, complexity sections |
| 01-requirements | `requirements-spec.md`, `user-stories.json`, `traceability-matrix.csv` | Standard requirement formats |
| 01-requirements | `docs/common/nfr-matrix.md` (shared) | NFR matrix, created/updated |
| 02-impact-analysis | `impact-analysis.md` | Markdown with blast-radius, entry-points, risk-zones |
| 03-architecture | `architecture-overview.md`, ADR files | Architecture documentation |
| 04-design | Module designs, `interface-spec.yaml` | Design documentation |

Each step file's `outputs` field declares which artifact(s) it contributes to. The `## Artifacts` section of each step file contains explicit instructions for which sections of the output file to create or update.

**Traces**: FR-010 AC-010-01 through AC-010-06.

### 9.2 Artifact Write Protocol (Section 6.2)

```
Protocol:
1. Read the step file's ## Artifacts section
2. For each artifact listed in the step's outputs field:
   a. If artifact file exists: read it, update the relevant section
   b. If artifact file does not exist: create it with a template structure
3. Write the updated artifact file to the artifact folder
4. Artifact folder path: docs/requirements/{slug}/
   (provided in the Task delegation prompt)
5. If the artifact folder does not exist: create it (mkdir -p equivalent)
```

### 9.3 Constraints (Section 6.3)

```markdown
## Constraints

1. **No state.json writes** (CON-003): All progress tracking uses meta.json only.
2. **No branch creation** (ANALYSIS MODE): Analysis operates on the current branch.
3. **Single-line Bash** (CON-004): All Bash commands are single-line.
4. **Analyze verb only** (CON-002): This agent is never invoked by the build verb.
```

---

## 10. Agent File Size Estimate

| Section | Estimated Lines |
|---------|----------------|
| YAML Frontmatter | 15 |
| Section 1: Persona Definitions | 80 |
| Section 2: Step Execution Engine | 120 |
| Section 3: Adaptive Depth Logic | 60 |
| Section 4: Menu System | 50 |
| Section 5: Session Management | 70 |
| Section 6: Artifact Production | 40 |
| **Total** | **~435 lines** |

This is within the range of existing agents (the requirements-analyst is approximately 400 lines, the solution-architect approximately 500 lines).

---

## 11. Traceability

| Design Element | Requirements Traced |
|---------------|-------------------|
| Persona Definitions | FR-002, AC-002-01 through AC-002-05 |
| Phase-to-Persona Mapping | FR-003, AC-003-01 through AC-003-06 |
| Fallback Persona | FR-003 AC-003-06 |
| Step File Discovery | FR-004 AC-004-01, AC-004-04, NFR-004 |
| Step File Parsing | FR-004 AC-004-02, FR-012 AC-012-01 |
| Step Execution Loop | FR-004 AC-004-03 through AC-004-06 |
| Progress Tracking | FR-005 AC-005-01 through AC-005-05 |
| Adaptive Depth | FR-006 AC-006-01 through AC-006-07 |
| Menu System | FR-007 AC-007-01 through AC-007-06 |
| Persona Transitions | FR-008 AC-008-01 through AC-008-04 |
| Session Greeting | FR-011 AC-011-01 through AC-011-03 |
| Artifact Production | FR-010 AC-010-01 through AC-010-06 |
| Model: opus | CON-006 |
| Single agent file | CON-001 |
| Analyze verb only | CON-002 |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | System Designer (Phase 04) | Initial module design |
