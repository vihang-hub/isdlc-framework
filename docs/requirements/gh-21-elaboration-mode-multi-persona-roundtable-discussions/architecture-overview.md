# Architecture Overview: Elaboration Mode

**Feature**: Elaboration Mode -- Multi-Persona Roundtable Discussions
**Feature ID**: REQ-GH21-ELABORATION-MODE
**Source**: GH-21
**Phase**: 03-architecture
**Blast Radius**: LOW (2 files, 2 modules)

---

## 1. Architecture Classification

This feature is a **prompt-engineering enhancement**, not a traditional software feature. There are no new services, databases, APIs, or infrastructure components. The "architecture" consists of:

- **Instruction patterns** within a markdown agent file (roundtable-analyst.md)
- **Discussion flow control** via structured prompt sections
- **Persona orchestration** via sequential persona simulation within a single agent context
- **State management** via meta.json field extensions (additive, backward-compatible)

The architecture is proportional to the LOW blast radius: 1 primary file modified (~150-200 lines replacing a 7-line stub), 1 utility file with a minor defensive default addition (~5-8 lines).

---

## 2. Architectural Pattern

**Pattern**: State Machine within a Single-Agent Prompt

The elaboration mode follows a finite state machine pattern embedded in the agent's markdown instructions. The agent transitions between states based on user input and internal counters.

```
                          User selects [E]
                               |
                               v
                    +---------------------+
                    |  ELABORATION_ENTRY  |
                    | - Read step context |
                    | - Determine lead    |
                    | - Intro message     |
                    +---------------------+
                               |
                               v
                    +---------------------+
                    |   TOPIC_FRAMING     |
                    | - Lead persona      |
                    |   frames topic      |
                    | - Focus question    |
                    +---------------------+
                               |
                               v
                    +---------------------+
           +------->  DISCUSSION_LOOP    |<-------+
           |        | - Persona rotation  |        |
           |        | - User input        |        |
           |        | - Turn counting     |        |
           |        | - Topic enforcement |        |
           |        +---------------------+        |
           |           |             |              |
           |    exit keyword    turn < max     turn == max
           |           |             |              |
           |           v             +--------->----+
           |    +---------------------+             |
           |    |    SYNTHESIS         |<------------+
           |    | - Structured summary |
           |    | - Artifact updates   |
           |    | - Display changes    |
           |    +---------------------+
           |               |
           |               v
           |    +---------------------+
           +----+  STATE_PERSIST      |
                | - Write meta.json   |
                | - Re-present menu   |
                +---------------------+
```

**Rationale (traces to FR-001 through FR-010)**:
- State machine is the simplest pattern for a bounded, turn-based interaction flow
- Each state maps directly to one or more functional requirements
- The pattern is entirely contained within prompt instructions -- no code execution needed
- The loop is bounded by turn limits (FR-007) preventing unbounded execution

**ADR**: ADR-0001-state-machine-discussion-flow

---

## 3. Component Architecture

### 3.1 System Context (C4 Level 1 Equivalent)

For a prompt-engineering feature, "system context" means: what interacts with the elaboration handler?

```
+--------------------------------------------------------------------+
|                        isdlc.md (Command Handler)                  |
|  - Delegates to roundtable-analyst via Task tool                   |
|  - UNCHANGED by this feature                                       |
+--------------------------------------------------------------------+
           |  Task delegation (analyze verb)
           v
+--------------------------------------------------------------------+
|                   roundtable-analyst.md (Agent)                    |
|  +--------------------------------------------------------------+  |
|  | Section 2: Step Execution Engine                              |  |
|  | - Detects [E] input at step boundary                         |  |
|  | - Routes to Section 4.4 elaboration handler                  |  |
|  +--------------------------------------------------------------+  |
|  | Section 4.4: ELABORATION HANDLER (new, replaces stub)        |  |
|  | - Multi-persona discussion orchestration                     |  |
|  | - Turn management, topic enforcement, synthesis              |  |
|  +--------------------------------------------------------------+  |
|  | Section 5: Session Management                                |  |
|  | - Extended for elaboration state recovery                    |  |
|  +--------------------------------------------------------------+  |
+--------------------------------------------------------------------+
           |  Reads/Writes
           v
+--------------------------------------------------------------------+
|                        Artifact Files                              |
|  - requirements-spec.md, impact-analysis.md, etc.                 |
|  - Updated additively by synthesis                                 |
+--------------------------------------------------------------------+
           |  Reads/Writes
           v
+--------------------------------------------------------------------+
|                          meta.json                                 |
|  - elaborations[] array (new, optional)                            |
|  - elaboration_config (new, optional)                              |
|  - Managed via readMetaJson/writeMetaJson in three-verb-utils.cjs |
+--------------------------------------------------------------------+
```

### 3.2 Container Diagram (C4 Level 2 Equivalent)

Within the roundtable-analyst.md agent, the elaboration handler consists of these logical sub-components (all implemented as prompt instruction sections, not code):

| Sub-Component | Section | Responsibility | Traces To |
|---------------|---------|---------------|-----------|
| Entry Handler | 4.4.1 | Detect [E], read step context, activate personas, display intro | FR-001 |
| Topic Framer | 4.4.2 | Lead persona frames discussion with focus question | FR-004 |
| Discussion Loop | 4.4.3 | Persona rotation, user input processing, turn counting | FR-002, FR-003, FR-005, FR-007 |
| Persona Addressing Parser | 4.4.4 | Detect user addressing specific persona by name | FR-003 |
| Topic Enforcer | 4.4.5 | Lead persona redirects off-topic drift | FR-004 |
| Exit Handler | 4.4.6 | Detect exit keywords, trigger synthesis | FR-006 |
| Synthesis Engine | 4.4.7 | Produce structured summary, update artifacts additively | FR-008 |
| State Tracker | 4.4.8 | Write elaboration record to meta.json | FR-009 |
| Voice Integrity Rules | 4.4.9 | Per-persona elaboration behavior guidelines | FR-010 |

---

## 4. Data Flow

### 4.1 Entry Flow (User selects [E])

```
1. Step Execution Loop (Section 2.3) presents step boundary menu
2. User types "E" or "e"
3. Menu router matches [E] -> routes to Section 4.4 (elaboration handler)
4. Entry Handler reads:
   - Current step_id, title, outputs (from step file frontmatter)
   - Step output produced so far (from artifact files)
   - Phase-to-persona mapping (Section 1.4) to determine lead persona
5. Entry Handler displays introduction message (AC-001-03)
6. Lead persona frames topic with focus question (AC-001-04, AC-004-03)
```

### 4.2 Discussion Flow (Multi-Turn Loop)

```
7. Discussion Loop begins. Turn counter = 0.
8. For each turn:
   a. If user input available:
      - Check for exit keywords (done, exit, wrap up, back) -> goto Synthesis
      - Check for persona addressing ("Alex, ...") -> route to addressed persona
      - Otherwise -> treat as group contribution
   b. If no user input for 3 consecutive persona exchanges:
      - Lead persona prompts: "Any thoughts, or should we wrap up?" (AC-003-04)
   c. Responding persona(s) contribute in character:
      - Apply persona-specific voice rules (Section 4.4.9)
      - Cross-reference other personas' points by name (AC-005-01)
      - Stay on topic; lead redirects drift (AC-004-02)
   d. Increment turn counter
   e. If turn == max_turns - 2: lead signals "nearing end" (AC-007-02)
   f. If turn == max_turns: auto-exit to Synthesis (AC-007-01)
```

### 4.3 Synthesis Flow

```
9. Synthesis Engine activates
10. Produce structured summary:
    - Key insights (bulleted, attributed to persona(s))
    - Decisions made during discussion
    - Open questions remaining
    - Action items
11. Read step file outputs[] field -> identify artifact files
12. For each artifact file:
    a. Read current content
    b. Identify relevant section(s)
    c. Append enriched content (additive only, no deletions)
    d. Write updated content
13. Display synthesis summary to user (AC-008-04)
14. Write elaboration record to meta.json:
    { step_id, turn_count, personas_active, timestamp }
15. Re-present step boundary menu (same position)
```

---

## 5. State Management

### 5.1 Meta.json Schema Extension

The meta.json schema is extended with two optional fields. This is backward-compatible: existing consumers that do not read these fields are unaffected.

```json
{
  "existing_fields": "...",
  "steps_completed": ["01-01", "01-02", "01-03"],
  "depth_overrides": {},

  "elaborations": [
    {
      "step_id": "01-03",
      "turn_count": 7,
      "personas_active": ["business-analyst", "solutions-architect", "system-designer"],
      "timestamp": "2026-02-20T14:30:00.000Z",
      "synthesis_summary": "Identified 3 additional acceptance criteria for offline mode"
    }
  ],

  "elaboration_config": {
    "max_turns": 10
  }
}
```

**Design decisions**:
- `elaborations` is an append-only array (FR-009 AC-009-04: multiple elaborations per step produce multiple records)
- `elaboration_config` allows per-item turn limit override (FR-007 AC-007-03)
- `synthesis_summary` is a short string for session recovery context (FR-009 AC-009-03)
- Default max_turns is 10 (hardcoded in agent instructions, overridable via meta.json)

### 5.2 Defensive Defaults in readMetaJson()

Addition to `three-verb-utils.cjs` (follows existing pattern for `steps_completed` and `depth_overrides`):

```javascript
// Elaboration tracking defaults (GH-21)
if (!Array.isArray(raw.elaborations)) {
    raw.elaborations = [];
}
```

This is the only code change outside the agent file. writeMetaJson() already handles arbitrary fields via JSON.stringify, so no write-side changes are needed.

### 5.3 Session Recovery Extension

Section 5.1 (Context Recovery) of roundtable-analyst.md is extended to include elaboration state:

```
When resuming a session:
- Read meta.elaborations array
- If elaborations exist for previous steps in this phase:
  - Include in context recovery: "In our previous session, we had a roundtable
    discussion on {step_title} where {synthesis_summary}."
```

This ensures elaboration insights carry forward when sessions are resumed, without requiring the full discussion to be replayed.

---

## 6. Persona Orchestration Architecture

### 6.1 Sequential Simulation Pattern

All three personas are simulated by a single agent within a single context window (CON-005). This is not a multi-agent delegation pattern. The architecture for persona orchestration is:

```
Agent receives user input
  |
  v
Determine response mode:
  - If persona addressed by name -> single persona responds first, others may follow
  - If group addressed -> all three respond in rotation (lead, then alphabetical)
  - If no explicit address -> lead persona responds, others contribute if relevant
  |
  v
For each responding persona:
  1. Adopt persona identity (name, role, communication style)
  2. Generate contribution in persona voice
  3. Prefix with attribution: "{Name} ({Role}):"
  4. Reference other personas by name where relevant (cross-talk)
  |
  v
Yield combined response to user
```

### 6.2 Lead Persona Determination

The lead persona is determined from the phase-to-persona mapping (Section 1.4):

| Phase Range | Lead Persona | Other Personas |
|-------------|-------------|----------------|
| 00-quick-scan, 01-requirements | Maya Chen (BA) | Alex Rivera, Jordan Park |
| 02-impact-analysis, 03-architecture | Alex Rivera (Architect) | Maya Chen, Jordan Park |
| 04-design | Jordan Park (Designer) | Maya Chen, Alex Rivera |

The lead persona has special responsibilities during elaboration:
- Frames the topic at entry (FR-001 AC-001-04)
- Redirects off-topic drift (FR-004 AC-004-02)
- Signals approaching turn limit (FR-007 AC-007-02)
- Prompts inactive user (FR-003 AC-003-04)
- Summarizes tradeoffs when personas disagree (FR-005 AC-005-02)

### 6.3 Voice Integrity Architecture

Persona voice integrity (FR-010) is enforced through explicit behavioral rules in Section 4.4.9 of the agent file. Each persona has:

1. **Identity anchor**: A constant reminder of who the persona is and how they communicate
2. **Elaboration-specific patterns**: Example phrases and reasoning patterns unique to each persona during multi-party discussion (from requirements Section 13)
3. **Anti-blending rules**: Explicit instructions to avoid generic "committee" language

This is a prompt-engineering solution, not a code solution. The effectiveness depends on the quality of the behavioral instructions.

---

## 7. Synthesis Architecture

### 7.1 Synthesis Strategy: Additive Enrichment

The synthesis engine follows an additive-only strategy (FR-008 AC-008-03, NFR-004):

```
Synthesis Protocol:
1. NEVER delete or replace existing artifact content
2. ALWAYS append new insights to relevant sections
3. Attribute insights to contributing persona(s)
4. Use Meld markers if enrichments span multiple sections:
   "<!-- Elaboration enrichment (step {step_id}, {timestamp}) -->"
```

### 7.2 Artifact Section Targeting

The synthesis engine identifies which artifact sections to update by:

1. Reading the current step file's `outputs` field (list of artifact filenames)
2. Reading each artifact file
3. Identifying the section most relevant to the current step's topic
4. Appending enriched content after the existing content in that section

Example: If step 01-03 (User Experience & Journeys) elaboration produces insights about additional user journeys, the synthesis engine appends them to the "User Journeys" section of requirements-spec.md.

### 7.3 Synthesis Output Format

```markdown
## Elaboration Insights (Step {step_id}: {step_title})

**Participants**: Maya Chen (BA), Alex Rivera (Architect), Jordan Park (Designer)
**Turns**: {turn_count}

### Key Insights
- [Maya/Alex] {Insight with persona attribution}
- [Jordan] {Insight with persona attribution}

### Decisions
- {Decision made during discussion}

### Open Questions
- {Question requiring further analysis or stakeholder input}
```

---

## 8. Risk Mitigations (Architectural)

| Risk | Architectural Mitigation | Traces |
|------|-------------------------|--------|
| RSK-001: Off-topic drift | Lead persona has explicit redirect instructions; topic focus question stated at entry | FR-004, AC-004-02 |
| RSK-002: Voice blending | Per-persona behavioral rules in Section 4.4.9; attribution prefix on every contribution | FR-010, NFR-002 |
| RSK-003: Artifact corruption | Additive-only synthesis; no deletion of pre-existing content; Meld markers for traceability | FR-008 AC-008-03, NFR-004 |
| RSK-004: Context overflow | Turn limit (default 10) bounds discussion; synthesis compresses into key insights | FR-007, NFR-006 |
| RSK-005: Meta.json breakage | Defensive defaults in readMetaJson(); optional fields; existing pattern followed | FR-009 AC-009-02, NFR-005 |
| RSK-006: Menu regression | [E] handler is a new routing branch; [C] and [S] branches untouched | NFR-007 |

---

## 9. Scalability and Future Considerations

### 9.1 Extensibility Points

The architecture is designed to support future enhancements without structural changes:

- **Additional personas**: The persona activation logic uses the phase-to-persona mapping table. Adding a 4th persona requires only adding a table entry and persona definition section.
- **Configurable turn limits**: Already supported via `elaboration_config.max_turns` in meta.json.
- **Critic/Refiner integration (GH-22)**: The multi-persona discussion pattern established here becomes the interaction model for transparent critic/refiner workflows. The synthesis engine's structured output format is compatible with critic review.
- **Cross-step elaboration memory**: The `elaborations[]` array in meta.json enables future features to reference previous elaboration insights across steps.

### 9.2 Non-Goals (Architectural)

- No parallel agent delegation (CON-005 prevents this; single-context simulation is simpler)
- No persistent cross-item elaboration memory (out of scope per Section 7 of requirements)
- No automated elaboration triggers (always user-initiated per scope)
- No new infrastructure, services, or dependencies

---

## 10. Deployment and Compatibility

### 10.1 Deployment Strategy

This feature requires no deployment. The changes are to markdown agent instructions and a minor JavaScript utility function:

1. Modify `src/claude/agents/roundtable-analyst.md` (replace Section 4.4 stub)
2. Modify `src/claude/hooks/lib/three-verb-utils.cjs` (add defensive default)
3. Sync `src/claude/agents/` to `.claude/agents/` (standard dogfooding sync)

### 10.2 Backward Compatibility

- The [E] menu option already exists and displays. Replacing its handler from "coming soon" stub to full implementation is a forward-compatible enhancement.
- meta.json extensions are optional fields. All existing consumers read only their known fields and ignore unknown ones.
- Step files are unchanged (CON-006).
- The isdlc.md command handler is unchanged.
- Existing [C] and [S] menu behavior is unchanged (new [E] branch does not touch existing branches).

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-20 | Solutions Architect (Phase 03) | Initial architecture overview |
