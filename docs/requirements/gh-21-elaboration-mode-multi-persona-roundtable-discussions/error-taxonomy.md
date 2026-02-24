# Error Taxonomy: Elaboration Mode

**Feature**: Elaboration Mode -- Multi-Persona Roundtable Discussions
**Feature ID**: REQ-GH21-ELABORATION-MODE
**Source**: GH-21
**Phase**: 04-design

---

## 1. Overview

This document catalogs all error conditions, edge cases, and degradation paths for elaboration mode. Because elaboration mode is a prompt-engineering feature (ADR-0002), "errors" fall into two categories:

1. **Behavioral errors**: The agent produces incorrect behavior (voice blending, off-topic drift, lost state)
2. **Data errors**: File operations fail (meta.json corruption, artifact write failure, missing step files)

The general principle is **fail-safe with graceful degradation** (Constitution Article X): if elaboration cannot complete normally, the system falls back to the step boundary menu without corrupting state.

---

## 2. Error Classification

### 2.1 Error Severity Levels

| Level | Definition | Response |
|-------|-----------|----------|
| CRITICAL | Elaboration cannot start or complete; data corruption risk | Abort elaboration, fall back to step menu, preserve existing state |
| HIGH | Discussion quality significantly degraded | Warn user, attempt recovery, continue if possible |
| MEDIUM | Discussion quality mildly degraded | Log/acknowledge, continue without interruption |
| LOW | Cosmetic or minor behavioral issue | No user-visible action; noted for improvement |

### 2.2 Error Code Prefix

All elaboration error codes use the prefix `ERR-ELAB-`.

---

## 3. Error Catalog

### ERR-ELAB-001: Step Context Unavailable at Entry

**Severity**: CRITICAL
**Trigger**: User selects [E] but the step_id, title, or outputs field cannot be read from the step file frontmatter.
**Traces**: FR-001 (AC-001-01)

**Cause**: Step file was not properly parsed during step execution, or the step execution state is corrupted.

**Recovery**:
1. Display: "I could not load the step context for elaboration. Let me continue with the normal menu."
2. Fall back to the step boundary menu (re-present [E], [C], [S]).
3. The user can retry [E] or proceed with [C].

**Prevention**: Step file parsing (Section 2.2) validates frontmatter before step execution. If parsing fails, the step is skipped, so [E] would never be presented for an unparsed step.

---

### ERR-ELAB-002: Lead Persona Cannot Be Determined

**Severity**: HIGH
**Trigger**: The phase_key from the delegation prompt does not match any entry in the Phase-to-Persona Mapping table (Section 1.4).
**Traces**: FR-001 (AC-001-04)

**Cause**: Unknown phase key (e.g., a new phase added without updating the mapping table).

**Recovery**:
1. Apply Section 1.5 Fallback Persona Rule: default to Maya Chen (Business Analyst) as lead.
2. Log warning: "Unknown phase key '{phase_key}'. Defaulting to Maya Chen as lead persona for elaboration."
3. Continue with elaboration using Maya as lead.

**Prevention**: The Phase-to-Persona Mapping covers all 5 analysis phases (00 through 04). This error only occurs if a new phase is added without updating the table.

---

### ERR-ELAB-003: Meta.json Read Failure During Max Turns Lookup

**Severity**: LOW
**Trigger**: Cannot read `elaboration_config.max_turns` from meta.json.
**Traces**: FR-007 (AC-007-03)

**Cause**: meta.json missing, corrupted, or `elaboration_config` field absent.

**Recovery**:
1. Use hardcoded default: `max_turns = 10`.
2. No user-visible warning (this is the expected case for most sessions).

**Prevention**: `readMetaJson()` applies defensive defaults. The agent checks `meta.elaboration_config?.max_turns` with optional chaining. This error is handled by design.

---

### ERR-ELAB-004: Voice Blending During Discussion

**Severity**: MEDIUM
**Trigger**: Personas produce contributions that are stylistically indistinguishable.
**Traces**: FR-010 (AC-010-04), NFR-002

**Cause**: Prompt instructions in Section 4.4.9 are not sufficiently constraining, or the context window is overloaded with content, diluting persona identity.

**Detection**: This is a behavioral error detectable only through manual review. NFR-002 defines the threshold: >= 80% correct identification in blind review.

**Recovery**: No runtime recovery. This is addressed by:
1. Strengthening voice integrity rules (Section 4.4.9)
2. Adding more distinct example phrases per persona
3. Adding anti-blending directives (explicit "do NOT" instructions)

**Prevention**: The voice integrity rules (Section 4.4.9) include forbidden patterns per persona and an explicit anti-blending directive.

---

### ERR-ELAB-005: Topic Drift Not Redirected

**Severity**: MEDIUM
**Trigger**: Discussion drifts to topics unrelated to the current step, and the lead persona does not redirect.
**Traces**: FR-004 (AC-004-01, AC-004-02)

**Cause**: The topic focus enforcement instructions (Section 4.4.5) are not effective, or the drift is subtle enough that the agent does not detect it.

**Detection**: Manual review. User may notice irrelevant discussion.

**Recovery**:
1. User can manually redirect: "Let's get back to {topic}."
2. User can exit early with "done" if discussion is unproductive.

**Prevention**: Section 4.4.5 includes explicit redirect instructions and templates. The focus question stated during framing (Section 4.4.2) anchors the discussion.

---

### ERR-ELAB-006: Turn Counter Overflow (Exceeds max_turns)

**Severity**: HIGH
**Trigger**: Discussion continues beyond the configured max_turns.
**Traces**: FR-007 (AC-007-01), NFR-006

**Cause**: Agent fails to check the turn counter or misses the transition to synthesis.

**Detection**: The turn counter value in the elaboration record exceeds max_turns.

**Recovery**:
1. If detected mid-discussion: immediately transition to synthesis with announcement.
2. The turn limit warning at `max_turns - 2` (Section 4.4.3) provides an early signal.

**Prevention**: Section 4.4.3 includes explicit turn counter check instructions at every discussion iteration. The turn limit is enforced at two points: the warning at `max_turns - 2` and the hard stop at `max_turns`.

---

### ERR-ELAB-007: Synthesis Fails to Produce Structured Output

**Severity**: HIGH
**Trigger**: The synthesis engine produces unstructured text instead of the specified format (Section 4.4.7).
**Traces**: FR-008 (AC-008-01), NFR-003

**Cause**: Discussion content is too complex or fragmented for the agent to organize into the structured summary format.

**Recovery**:
1. If the synthesis output lacks the required sections (Key Insights, Decisions, Open Questions), the agent should retry once with a more explicit prompt.
2. If retry fails, produce a simplified summary: "Key takeaway: {single_sentence_summary}" and skip artifact updates.
3. State tracking still occurs (the elaboration happened even if synthesis is degraded).

**Prevention**: The synthesis format is explicitly specified in Section 4.4.7 with template and field definitions. The structured format is simple enough (bulleted lists) to be consistently reproducible.

---

### ERR-ELAB-008: Artifact Update Corrupts Existing Content

**Severity**: CRITICAL
**Trigger**: Synthesis writes to an artifact file and deletes or modifies existing content.
**Traces**: FR-008 (AC-008-03), NFR-004

**Cause**: The Read-Identify-Append pattern fails. The agent replaces a section instead of appending, or a write operation truncates the file.

**Detection**: Post-elaboration artifact diff shows deletions of pre-existing content.

**Recovery**:
1. The traceability marker (`<!-- Elaboration: step ... -->`) identifies all elaboration additions.
2. Content before the marker is original; content after is from elaboration.
3. If corruption is detected, the user can manually remove the elaboration additions.

**Prevention**:
1. Section 4.4.7 explicitly states "NEVER delete or replace existing content"
2. The additive-only rules (Section 5.4 of interface-spec.md) provide clear constraints
3. ADR-0004 establishes additive-only as an architectural decision
4. The HTML comment marker enables audit

---

### ERR-ELAB-009: Meta.json Write Failure After Synthesis

**Severity**: HIGH
**Trigger**: The writeMetaJson() call fails after synthesis completes.
**Traces**: FR-009 (AC-009-01), NFR-005

**Cause**: File system error (permissions, disk full, concurrent write conflict).

**Detection**: The agent catches the write error.

**Recovery**:
1. Display warning: "Elaboration completed successfully but I could not save the elaboration record to meta.json. The discussion insights are in the artifacts."
2. Continue to re-present the step menu.
3. The artifact updates from synthesis are already persisted (written before meta.json).
4. The elaboration record is lost, but the enriched content in artifacts is preserved.

**Prevention**: writeMetaJson() uses atomic JSON write (full file replacement). File system errors are rare in local development.

---

### ERR-ELAB-010: Session Resume Misses Elaboration History

**Severity**: LOW
**Trigger**: Session is resumed after elaboration occurred, but the context recovery does not mention the elaboration.
**Traces**: FR-009 (AC-009-03), NFR-005

**Cause**: The elaboration record was not written (ERR-ELAB-009), or the session recovery logic does not read the elaborations[] field.

**Detection**: User notices the greeting does not mention previous elaboration discussions.

**Recovery**: No runtime recovery needed. The artifacts still contain the elaboration enrichments (they are persisted independently of meta.json). The loss is only the context recovery mention.

**Prevention**: The readMetaJson() defensive default ensures elaborations[] is always an array. The session recovery extension (Section 5.1) filters by phase prefix.

---

### ERR-ELAB-011: Exit Keyword Detected in Discussion Content

**Severity**: MEDIUM
**Trigger**: User input contains an exit keyword (e.g., "done") as part of a longer statement, and the agent incorrectly exits elaboration.
**Traces**: FR-006 (AC-006-01)

**Cause**: Exit keyword detection is too aggressive. "I'm not done yet" or "When the task is done, what happens?" triggers false positive exit.

**Detection**: User is surprised by premature exit.

**Recovery**:
1. The user can re-enter elaboration with [E] at the re-presented menu.
2. State is preserved: synthesis would run on whatever discussion occurred so far.

**Prevention**: Section 4.4.6 specifies disambiguation rules. The exit keyword must represent the PRIMARY intent of the message. The agent should evaluate context, not just keyword presence.

---

### ERR-ELAB-012: Persona Addressing Misroute

**Severity**: LOW
**Trigger**: User addresses a persona by name, but the wrong persona responds first.
**Traces**: FR-003 (AC-003-02)

**Cause**: The persona addressing parser (Section 4.4.4) fails to parse the name correctly. Edge case: "Jordan mentioned that..." is parsed as addressing Jordan, when the user was quoting Jordan's previous statement.

**Detection**: User notices unexpected persona responding.

**Recovery**: User can re-address: "Sorry, I meant to ask Alex about this."

**Prevention**: Section 4.4.4 specifies that addressing requires the name followed by a comma, colon, or being at the start of the input. Simple reference to a name mid-sentence (e.g., "Jordan's earlier point") should not trigger direct addressing.

---

### ERR-ELAB-013: Artifact File Missing at Synthesis Time

**Severity**: MEDIUM
**Trigger**: The step's `outputs` field references an artifact file that does not exist on disk.
**Traces**: FR-008 (AC-008-02)

**Cause**: The artifact file was not created during the step execution (e.g., the step was completed without writing all artifacts).

**Recovery**:
1. Skip the missing artifact file.
2. Display: "Could not update {filename} (file not found). Elaboration insights are in the synthesis summary above."
3. Continue with other artifact files if any exist.

**Prevention**: Section 2.5 (Step Completion Protocol) writes artifacts before recording step completion. If the step is marked complete, its outputs should exist. This error indicates an inconsistency in step execution, not an elaboration bug.

---

### ERR-ELAB-014: Context Window Exhaustion During Discussion

**Severity**: HIGH
**Trigger**: The discussion uses so many tokens that the agent's context window is exhausted before synthesis can run.
**Traces**: RSK-004, NFR-006

**Cause**: Long persona contributions, lengthy user inputs, or many turns combine to fill the context window.

**Detection**: The agent produces truncated or incoherent output, or fails to generate a response.

**Recovery**:
1. The turn limit (default 10) is the primary mitigation. With 3 personas + user, 10 turns is approximately 30-40 individual messages, which should fit within the context window alongside step context.
2. If exhaustion is detected, the agent should immediately trigger synthesis with whatever discussion has occurred.

**Prevention**: Turn limits (FR-007) bound the total discussion length. The default of 10 turns is conservative. Users can set a lower limit via `elaboration_config.max_turns` in meta.json.

---

## 4. Edge Cases

### 4.1 Elaboration on the First Step of a Phase

**Scenario**: User selects [E] after the very first step of a phase.
**Behavior**: Normal elaboration. The lead persona frames the topic based on the first step's output. There is no issue with limited context because even a single step produces output to discuss.
**Concern**: None. Fully supported.

### 4.2 Elaboration on the Last Step of a Phase (Phase Boundary)

**Scenario**: User selects [E] on the phase boundary menu (after the final step of a phase).
**Behavior**: Normal elaboration. After synthesis and state persist, the PHASE boundary menu is re-presented (not a step boundary menu). The [C] option on this menu advances to the next phase.
**Traces**: FR-001 (AC-001-02)

### 4.3 Multiple Sequential Elaborations on the Same Step

**Scenario**: User elaborates on step 01-03, exits, then immediately selects [E] again.
**Behavior**: A new elaboration session starts for the same step. The second session may reference the first session's synthesis if the agent retains it in context (likely, since it was just output). A second elaboration record is appended to meta.json (AC-009-04).
**Concern**: Artifact updates are additive, so multiple elaborations stack enrichments. No content is lost or duplicated (each elaboration adds new insights, not the same ones).

### 4.4 Elaboration After Skip

**Scenario**: User is at a step menu, previously selected [S] to skip remaining steps, then re-enters the analysis.
**Behavior**: [E] is only available at step boundary menus. If the user skipped, the phase is treated as complete and no step menu is presented. Therefore, elaboration after skip is not possible within the same session.

### 4.5 User Types [E] During Natural Input (Not at Menu)

**Scenario**: User types "E" or "Excellent point" as natural input during a step's question-answer flow, not at a menu boundary.
**Behavior**: The input is processed as natural language feedback (Section 4.3), not as an [E] menu selection. [E] is only detected at step/phase boundary menus, not during step execution.
**Traces**: CON -- elaboration only at step boundaries (requirements Section 1.4, out of scope: mid-step elaboration)

### 4.6 Empty Elaboration (User Exits Immediately)

**Scenario**: User selects [E], then immediately types "done" before any persona contributes.
**Behavior**:
1. Introduction message is displayed (turn 0)
2. Lead persona frames topic (turn 1)
3. User types "done" -- exit triggered
4. Synthesis runs with only the framing content
5. Synthesis summary will be minimal: "Discussion ended early. The framing identified {topic} as a discussion point."
6. No artifact updates (insufficient discussion content to synthesize)
7. Elaboration record is written with turn_count: 1
8. Step menu re-presented

### 4.7 Elaboration with max_turns Set to Minimum (3)

**Scenario**: User sets `elaboration_config.max_turns: 3` in meta.json.
**Behavior**:
- Turn 1: Lead persona frames
- Turn 2: Addressed non-lead responds (turn limit warning: 3-2=1, so warning at turn 1 -- this is before the first non-lead speaks, which is awkward)
- Turn 3: Second non-lead responds, hard limit reached, synthesis triggered

**Design clarification**: The turn limit warning fires at `max_turns - 2`. For very low limits (3-4), the warning may fire before all personas have spoken. This is acceptable -- the warning is advisory, not blocking. The hard stop at max_turns always fires.

### 4.8 Concurrent Meta.json Writes

**Scenario**: User has two analysis sessions open for the same item (different terminal tabs).
**Behavior**: meta.json is written atomically (full file replacement). The last write wins. An elaboration record from one session could be overwritten by the other session's write.
**Mitigation**: This is a known limitation of the file-based state model (not specific to elaboration). Single-session usage is the expected pattern.

---

## 5. Degradation Matrix

| Error | Severity | Elaboration Continues? | Artifacts Updated? | State Persisted? | User Action Required? |
|-------|----------|----------------------|-------------------|-----------------|---------------------|
| ERR-ELAB-001 | CRITICAL | No | No | No | Select [C] or retry [E] |
| ERR-ELAB-002 | HIGH | Yes (degraded lead) | Yes | Yes | None |
| ERR-ELAB-003 | LOW | Yes (default limit) | Yes | Yes | None |
| ERR-ELAB-004 | MEDIUM | Yes | Yes | Yes | None (post-hoc review) |
| ERR-ELAB-005 | MEDIUM | Yes | Yes | Yes | Manual redirect or exit |
| ERR-ELAB-006 | HIGH | No (forced exit) | Yes | Yes | None |
| ERR-ELAB-007 | HIGH | No | Partial/No | Yes | May re-elaborate |
| ERR-ELAB-008 | CRITICAL | N/A (post-exit) | Corrupted | Yes | Manual artifact repair |
| ERR-ELAB-009 | HIGH | N/A (post-exit) | Yes | No | None (record lost) |
| ERR-ELAB-010 | LOW | N/A (session resume) | N/A | N/A | None |
| ERR-ELAB-011 | MEDIUM | No (false exit) | Yes (partial) | Yes | Re-enter [E] |
| ERR-ELAB-012 | LOW | Yes | Yes | Yes | Re-address persona |
| ERR-ELAB-013 | MEDIUM | Partial | Partial | Yes | None |
| ERR-ELAB-014 | HIGH | No (forced exit) | Partial/No | Partial | Lower max_turns |

---

## 6. Traceability

| Error Code | Requirements Traced | Risk Items |
|-----------|-------------------|-----------|
| ERR-ELAB-001 | FR-001 | -- |
| ERR-ELAB-002 | FR-001 | -- |
| ERR-ELAB-003 | FR-007 | -- |
| ERR-ELAB-004 | FR-010, NFR-002 | RSK-002 |
| ERR-ELAB-005 | FR-004 | RSK-001 |
| ERR-ELAB-006 | FR-007, NFR-006 | RSK-004 |
| ERR-ELAB-007 | FR-008, NFR-003 | -- |
| ERR-ELAB-008 | FR-008, NFR-004 | RSK-003 |
| ERR-ELAB-009 | FR-009, NFR-005 | RSK-005 |
| ERR-ELAB-010 | FR-009, NFR-005 | RSK-005 |
| ERR-ELAB-011 | FR-006 | -- |
| ERR-ELAB-012 | FR-003 | -- |
| ERR-ELAB-013 | FR-008 | -- |
| ERR-ELAB-014 | FR-007, NFR-006 | RSK-004 |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-20 | System Designer (Phase 04) | Initial error taxonomy |
