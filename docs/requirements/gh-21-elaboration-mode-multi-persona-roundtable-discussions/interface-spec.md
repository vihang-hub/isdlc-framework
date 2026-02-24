# Interface Specification: Elaboration Mode

**Feature**: Elaboration Mode -- Multi-Persona Roundtable Discussions
**Feature ID**: REQ-GH21-ELABORATION-MODE
**Source**: GH-21
**Phase**: 04-design

---

## 1. Overview

This document specifies all interfaces for the elaboration mode feature: user-facing menu options, input commands, persona response formats, synthesis output format, and the meta.json data contract. Because this is a prompt-engineering feature (ADR-0002), "interfaces" are the text-based interaction patterns between the agent and the user, not traditional code APIs.

---

## 2. User Input Interfaces

### 2.1 Elaboration Entry

**Input**: User types `E` or `e` at a step boundary or phase boundary menu.

| Property | Value |
|----------|-------|
| Trigger | Single character `E` (case-insensitive) |
| Context | Step boundary menu (Section 4.1) or Phase boundary menu (Section 4.2) |
| Precondition | A step has just been completed and the step menu is displayed |
| Postcondition | Elaboration mode activates (Section 4.4.1) |

**Traces**: FR-001 (AC-001-01, AC-001-02)

**Menu display format** (unchanged from REQ-0027):

```
---
[E] Elaboration Mode -- bring all perspectives to discuss this topic
[C] Continue -- move to the next step
[S] Skip remaining steps in this phase
Or type naturally to provide feedback.
---
```

### 2.2 User Input During Elaboration

**Input**: Free-form text typed by the user during the discussion loop.

| Property | Value |
|----------|-------|
| Context | Elaboration discussion loop is active (Section 4.4.3) |
| Processing | Parsed by Persona Addressing Parser (Section 4.4.4) |
| Turn impact | Counts as 1 turn toward the turn limit |

**Input classification rules** (applied in priority order):

| Priority | Pattern | Classification | Response Mode |
|----------|---------|---------------|---------------|
| 1 | Exit keyword (see 2.3) | Exit trigger | Transition to synthesis |
| 2 | Starts with `Maya` / `Alex` / `Jordan` followed by `,` or `:` or whitespace | Direct persona address | Addressed persona responds first |
| 3 | Contains persona name + `,` anywhere in text | Direct persona address | Addressed persona responds first |
| 4 | Contains "you all", "everyone", "all of you", "team" | Group address | All personas respond in rotation |
| 5 | None of the above | Default (no explicit address) | Lead persona responds; others if relevant |

**Traces**: FR-003 (AC-003-01, AC-003-02, AC-003-03)

### 2.3 Exit Commands

**Input**: Keywords that trigger exit from elaboration mode.

| Keyword | Case-Sensitive | Notes |
|---------|---------------|-------|
| `done` | No | Primary exit keyword |
| `exit` | No | Alternative exit |
| `wrap up` | No | Natural language exit (2 words) |
| `back` | No | Return to menu |

**Disambiguation rules**:
- The keyword must represent the PRIMARY intent of the user's message
- "I'm not done yet" does NOT trigger exit (the word "done" is negated)
- "Let's wrap up our discussion of error handling" DOES trigger exit ("wrap up" is the intent)
- "Let's go back to discussing the API" does NOT trigger exit ("back" refers to a topic, not the menu)
- When ambiguous, the agent should ask: "Did you want to end the discussion, or continue exploring this?"

**Traces**: FR-006 (AC-006-01)

### 2.4 Persona Name Addressing

**Input**: User references a persona by name to direct a question or comment.

| Persona | Accepted Names | Not Accepted |
|---------|---------------|-------------|
| Maya Chen | "Maya", "maya" | "Chen", "BA", "business analyst", "analyst" |
| Alex Rivera | "Alex", "alex" | "Rivera", "SA", "architect", "solutions architect" |
| Jordan Park | "Jordan", "jordan" | "Park", "SD", "designer", "system designer" |

**Design decision**: Only first names are recognized for addressing. Role names are not parsed because they could appear naturally in discussion content without addressing intent (e.g., "the architect should consider..." does not address Alex).

**Traces**: FR-003 (AC-003-02)

---

## 3. Agent Output Interfaces

### 3.1 Introduction Message

**Context**: Displayed immediately after user selects [E].

**Format**:

```
---
ELABORATION MODE

Bringing {Persona2Name} ({Persona2Role}) and {Persona3Name} ({Persona3Role})
into the discussion.

Topic: {StepTitle} for {ItemName}

Turn limit: {MaxTurns} exchanges. Type "done" to end discussion early.
---
```

**Variable resolution**:

| Variable | Source | Example |
|----------|--------|---------|
| `{Persona2Name}` | Non-lead persona 1 (from Phase-to-Persona mapping) | "Alex Rivera" |
| `{Persona2Role}` | Non-lead persona 1 role | "Solutions Architect" |
| `{Persona3Name}` | Non-lead persona 2 | "Jordan Park" |
| `{Persona3Role}` | Non-lead persona 2 role | "System Designer" |
| `{StepTitle}` | Step file frontmatter `title` field | "User Experience & Journeys" |
| `{ItemName}` | Feature name from delegation prompt | "offline mode feature" |
| `{MaxTurns}` | `meta.elaboration_config.max_turns` or default 10 | "10" |

**Traces**: FR-001 (AC-001-03)

### 3.2 Persona Contribution Format

**Context**: Every persona statement during elaboration mode.

**Format**:

```
{PersonaName} ({PersonaRole}): {ContributionText}
```

**Rules**:
- The `{PersonaName} ({PersonaRole}):` prefix is MANDATORY on every persona contribution
- There is exactly one space after the colon before the contribution text
- The contribution text follows the persona's voice rules (Section 4.4.9 of the elaboration handler)
- Multi-paragraph contributions are allowed; only the first line has the prefix

**Examples**:

```
Maya Chen (Business Analyst): Before we go deeper on the technical approach,
who benefits from this? The user needs to understand what is happening during
sync -- a spinner with no context is not acceptable.

Alex Rivera (Solutions Architect): I see two approaches here. Option A: full
bi-directional sync with conflict resolution UI. Option B: last-write-wins
with an audit log. The tradeoff is user control versus implementation
complexity.

Jordan Park (System Designer): To make this concrete, the sync function
signature would be: syncLocalChanges(localState, remoteState) -> SyncResult.
The SyncResult type needs a conflicts array for Option A.
```

**Traces**: FR-002 (AC-002-04), FR-010 (AC-010-01..04)

### 3.3 Cross-Talk Reference Format

**Context**: When a persona references another persona's contribution.

**Patterns** (at least one MUST be used when referencing another persona's point):

```
"Building on {Name}'s point about {topic}..."
"I agree with {Name} that {point}..."
"{Name} and I see this differently. {explanation}"
"{Name} mentioned {point}. From a {lens} perspective, that means..."
"To add to what {Name} said..."
"{Name} raises a good point. However, {counterpoint}..."
```

**Rules**:
- Always use the persona's first name (not role name)
- The reference must be specific (not just "I agree" but "I agree with Alex that the cache layer adds risk")
- Cross-talk is encouraged but not mandatory in every contribution

**Traces**: FR-005 (AC-005-01, AC-005-02, AC-005-03)

### 3.4 Topic Redirect Format

**Context**: Lead persona redirects off-topic drift.

**Format**:

```
{LeadName} ({LeadRole}): {DrifterName} raises an interesting point about
{OffTopicSubject}, but let us stay focused on {FocusQuestion}. We can
explore that when we get to {RelevantPhaseOrStep}.
```

**User-directed variant** (when the user asks the off-topic question):

```
{LeadName} ({LeadRole}): That is a great question for {RelevantPhase}. For
now, let us focus on {FocusQuestion}.
```

**Traces**: FR-004 (AC-004-02)

### 3.5 Turn Limit Warning

**Context**: Turn counter reaches max_turns - 2.

**Format**:

```
{LeadName} ({LeadRole}): We are nearing the end of our discussion time.
Any final points before we synthesize?
```

**Traces**: FR-007 (AC-007-02)

### 3.6 Turn Limit Reached

**Context**: Turn counter reaches max_turns.

**Format**:

```
{LeadName} ({LeadRole}): We have had a thorough discussion. Let me
synthesize the key points from our conversation.
```

**Traces**: FR-007 (AC-007-01)

### 3.7 User Inactivity Prompt

**Context**: 3 consecutive persona exchange rounds with no user input.

**Format**:

```
{LeadName} ({LeadRole}): Any thoughts on this, or should we wrap up?
```

**Traces**: FR-003 (AC-003-04)

### 3.8 Disagreement Summary

**Context**: Two or more personas express opposing views.

**Format**:

```
{LeadName} ({LeadRole}): {PersonaA} and {PersonaB} see this differently.
{PersonaA} favors {OptionA} because {ReasonA}. {PersonaB} favors {OptionB}
because {ReasonB}. What matters more for your project: {OptionA_brief} or
{OptionB_brief}?
```

**Traces**: FR-005 (AC-005-02, AC-005-03)

---

## 4. Synthesis Output Interface

### 4.1 Synthesis Summary Format

**Context**: Displayed to the user after elaboration exits.

**Format**:

```markdown
### Elaboration Insights (Step {StepId}: {StepTitle})

**Participants**: Maya Chen (BA), Alex Rivera (Architect), Jordan Park (Designer)
**Turns**: {TurnCount} | **Exit**: {ExitType}

#### Key Insights
- [{Attribution}] {InsightDescription}
- [{Attribution}] {InsightDescription}

#### Decisions Made
- {Decision}: {BriefRationale}

#### Open Questions
- {Question}: {WhyOpenAndWhoResolves}
```

**Field definitions**:

| Field | Type | Description |
|-------|------|-------------|
| `{StepId}` | string | Step file frontmatter step_id (e.g., "01-03") |
| `{StepTitle}` | string | Step file frontmatter title |
| `{TurnCount}` | integer | Total turns in the discussion |
| `{ExitType}` | enum | `user-initiated` or `turn-limit` |
| `{Attribution}` | string | Persona attribution (see 4.2) |
| `{InsightDescription}` | string | Concise description of the insight |
| `{Decision}` | string | Decision statement |
| `{BriefRationale}` | string | Why the decision was made |
| `{Question}` | string | Open question statement |
| `{WhyOpenAndWhoResolves}` | string | Context for why it remains open |

**Traces**: FR-008 (AC-008-01, AC-008-05)

### 4.2 Persona Attribution Format

| Scenario | Format | Example |
|----------|--------|---------|
| Single persona insight | `[{FirstName}]` | `[Maya]` |
| Two personas shared insight | `[{Name1}/{Name2}]` | `[Maya/Alex]` |
| All personas agree | `[All]` | `[All]` |
| User contributed the insight | `[User]` | `[User]` |
| User + persona | `[User/{Name}]` | `[User/Jordan]` |

**Traces**: FR-008 (AC-008-05)

### 4.3 Artifact Update Announcement

**Context**: Displayed after each artifact file is updated by synthesis.

**Format**:

```
Updated {ArtifactFilename}, section "{SectionHeading}": added {BriefDescription}.
```

**Example**:

```
Updated requirements-spec.md, section "User Journeys": added 3 acceptance criteria for offline sync from roundtable discussion.
Updated impact-analysis.md, section "Risk Assessment": added caching strategy risk identified by Alex.
```

**Traces**: FR-008 (AC-008-04)

---

## 5. Artifact Update Interface (Synthesis Writes)

### 5.1 Write Protocol

The synthesis engine writes to artifact files identified by the current step's `outputs` field.

**Read-Identify-Append pattern**:

```
1. Read artifact file content
2. Parse headings to find the section relevant to the step topic
3. Position cursor at end of that section (before the next heading)
4. Insert traceability marker:
   <!-- Elaboration: step {step_id}, {ISO_timestamp} -->
5. Insert elaboration content (insights, new acceptance criteria, etc.)
6. Write file
```

### 5.2 Section Identification Heuristic

The synthesis engine identifies which section of an artifact file to update:

1. Match step title keywords against section headings (case-insensitive substring match)
2. If exact match found, use that section
3. If no exact match, use the section with the most keyword overlap
4. If no reasonable match, append at the end of the file under a new heading: `### Additional Insights from Elaboration`

### 5.3 Traceability Marker

**Format**:

```html
<!-- Elaboration: step {step_id}, {ISO_8601_timestamp} -->
```

**Example**:

```html
<!-- Elaboration: step 01-03, 2026-02-20T14:30:00.000Z -->
```

**Purpose**: Enables artifact diffs to identify which content came from elaboration versus normal step execution. Used for NFR-004 (artifact integrity) verification.

### 5.4 Additive-Only Constraint

**Rules** (ADR-0004):
- The synthesis engine MUST NOT delete any line of existing artifact content
- The synthesis engine MUST NOT modify any existing paragraph or bullet point
- The synthesis engine MUST NOT reorder existing sections
- The synthesis engine MAY add new bullets to an existing list
- The synthesis engine MAY add new paragraphs after existing paragraphs
- The synthesis engine MAY add new sub-sections under existing sections

**Traces**: FR-008 (AC-008-03), NFR-004

---

## 6. Meta.json Data Contract

### 6.1 Write Contract (elaboration -> meta.json)

**When**: After synthesis completes (Section 4.4.8)
**Operation**: Append to `elaborations` array
**Atomicity**: Full meta.json is written (not partial update)

**Record schema**:

```typescript
interface ElaborationRecord {
  step_id: string;           // Format: "NN-NN" (e.g., "01-03")
  turn_count: number;        // Integer, 1 <= N <= max_turns
  personas_active: string[]; // Always ["business-analyst", "solutions-architect", "system-designer"]
  timestamp: string;         // ISO 8601 (e.g., "2026-02-20T14:30:00.000Z")
  synthesis_summary: string; // One sentence, <= 100 chars recommended
}
```

### 6.2 Read Contract (meta.json -> session recovery)

**When**: At session resume (Section 5.1 Context Recovery)
**Source**: META CONTEXT block in Task delegation prompt
**Fields read**: `elaborations` array
**Filter**: Match `step_id` prefix to current phase key (e.g., "01-" for phase 01)

### 6.3 Read Contract (meta.json -> elaboration entry)

**When**: At [E] selection (Section 4.4.1)
**Fields read**: `elaboration_config.max_turns`
**Fallback**: Default 10 if field missing or invalid

---

## 7. Interaction Protocol Summary

The complete elaboration interaction follows this sequence:

```
USER: E
SYSTEM: [Introduction message - Section 3.1]
LEAD_PERSONA: [Topic framing with focus question]
NON_LEAD_1: [Perspective contribution]
NON_LEAD_2: [Perspective contribution]
USER: [Input - classified per Section 2.2]
PERSONA(S): [Response per addressing rules]
...repeat (bounded by turn limit)...
USER: done  (or turn limit reached)
SYSTEM: [Synthesis summary - Section 4.1]
SYSTEM: [Artifact update announcements - Section 4.3]
SYSTEM: [Step boundary menu re-presented]
```

---

## 8. Traceability

| Interface | Functional Requirements | Non-Functional Requirements |
|-----------|------------------------|---------------------------|
| Entry ([E] selection) | FR-001 | NFR-001, NFR-007 |
| User input parsing | FR-003 | -- |
| Persona addressing | FR-003 | -- |
| Exit keywords | FR-006 | NFR-007 |
| Persona contribution format | FR-002, FR-010 | NFR-002 |
| Cross-talk references | FR-005 | -- |
| Topic redirect | FR-004 | -- |
| Turn limit warning/enforcement | FR-007 | NFR-006 |
| Synthesis summary | FR-008 | NFR-003 |
| Artifact updates | FR-008 | NFR-004 |
| Meta.json write contract | FR-009 | NFR-005 |
| Meta.json read contract | FR-009 | NFR-005 |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-20 | System Designer (Phase 04) | Initial interface specification |
