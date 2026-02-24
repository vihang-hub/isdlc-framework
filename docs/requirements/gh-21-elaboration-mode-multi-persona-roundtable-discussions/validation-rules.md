# Validation Rules: Elaboration Mode

**Feature**: Elaboration Mode -- Multi-Persona Roundtable Discussions
**Feature ID**: REQ-GH21-ELABORATION-MODE
**Source**: GH-21
**Phase**: 04-design

---

## 1. Overview

This document defines the validation rules for elaboration mode inputs and outputs. Because this is a prompt-engineering feature (ADR-0002), validation rules are expressed as behavioral constraints enforced by the agent's markdown instructions, not as code-level validators. The exception is the `readMetaJson()` defensive default, which is a code-level validation.

Each rule has a unique ID (VR-ELAB-NNN), traces to requirements, and specifies the validation behavior.

---

## 2. Input Validation Rules

### VR-ELAB-001: Entry Precondition -- Step Completion

**Traces**: FR-001 (AC-001-01, AC-001-02)
**Scope**: Agent behavior
**When**: User selects [E]

| Check | Rule | Failure Action |
|-------|------|---------------|
| Step completion | The just-completed step MUST have been fully executed (artifacts written, step_id appended to steps_completed, meta.json written) before [E] is available | If step is not complete, [E] is not presented in the menu (this is already enforced by Section 2.5 -- the menu is only shown AFTER step completion) |
| Menu context | [E] MUST only be processed at a step boundary or phase boundary menu, not during step execution | Input during step execution is processed as natural language (Section 4.3), not as a menu command |

### VR-ELAB-002: Entry Precondition -- Step Context Available

**Traces**: FR-001 (AC-001-03, AC-001-04)
**Scope**: Agent behavior
**When**: User selects [E]

| Check | Rule | Failure Action |
|-------|------|---------------|
| step_id present | The current step's step_id MUST be non-empty | Fall back to step menu (ERR-ELAB-001) |
| title present | The current step's title MUST be non-empty | Fall back to step menu (ERR-ELAB-001) |
| outputs field | The current step's outputs field SHOULD be a non-empty array | If empty, elaboration proceeds but synthesis skips artifact updates (no targets to update) |

### VR-ELAB-003: Max Turns Validation

**Traces**: FR-007 (AC-007-03)
**Scope**: Agent behavior
**When**: Elaboration entry (Section 4.4.1, step 4)

| Check | Rule | Failure Action |
|-------|------|---------------|
| Type check | `elaboration_config.max_turns` MUST be a positive integer | Use default: 10 |
| Minimum value | `max_turns` MUST be >= 3 | Use default: 10 |
| Maximum value | `max_turns` SHOULD be <= 20 (advisory, not enforced) | Accept the value but expect degraded synthesis quality at very high limits |
| Missing field | If `elaboration_config` or `max_turns` is absent | Use default: 10 |

### VR-ELAB-004: User Input Classification

**Traces**: FR-003 (AC-003-01, AC-003-02, AC-003-03), FR-006 (AC-006-01)
**Scope**: Agent behavior
**When**: User provides input during discussion loop

| Check | Rule | Failure Action |
|-------|------|---------------|
| Exit keyword priority | Exit keywords MUST be checked BEFORE persona addressing | N/A (processing order) |
| Exit intent validation | Exit keywords MUST represent PRIMARY intent, not incidental | If ambiguous, ask: "Did you want to end the discussion, or continue?" |
| Persona name match | Persona names MUST be matched case-insensitively, first name only | Unrecognized names treated as general input |
| Empty input | Empty input or whitespace-only MUST be treated as "no user input" for inactivity tracking | Increment inactivity counter |

### VR-ELAB-005: Persona Name Resolution

**Traces**: FR-003 (AC-003-02)
**Scope**: Agent behavior
**When**: User input contains a persona name

| Check | Rule | Failure Action |
|-------|------|---------------|
| Name matching | Only first names are valid: "Maya", "Alex", "Jordan" | Role names ("architect", "designer", "analyst") do NOT trigger addressing |
| Case sensitivity | Matching is case-insensitive | "maya" = "Maya" = "MAYA" |
| Disambiguation | Name must be followed by comma, colon, question mark, or be at start of input to count as addressing | Mid-sentence references ("Jordan's point") do NOT trigger direct addressing |

### VR-ELAB-006: Turn Counter Integrity

**Traces**: FR-007 (AC-007-01, AC-007-02)
**Scope**: Agent behavior
**When**: Every discussion contribution

| Check | Rule | Failure Action |
|-------|------|---------------|
| Increment on contribution | Turn counter MUST increment by exactly 1 for each persona contribution and each user contribution | If counter is out of sync, recalculate from discussion history |
| Framing counts | The lead persona's framing statement counts as turn 1 | N/A (starting state) |
| Warning trigger | Warning MUST fire at exactly `max_turns - 2` | If missed, no error -- the hard stop at max_turns still fires |
| Hard stop trigger | Hard stop MUST fire at exactly `max_turns` | If turn counter exceeds max_turns, immediately trigger synthesis |
| Counter never negative | Turn counter MUST be >= 0 at all times | If negative, reset to 0 |

---

## 3. Output Validation Rules

### VR-ELAB-010: Introduction Message Completeness

**Traces**: FR-001 (AC-001-03)
**Scope**: Agent behavior
**When**: Elaboration entry (Section 4.4.1, step 5)

| Check | Rule |
|-------|------|
| Non-lead personas named | Introduction MUST name both non-lead personas with their roles |
| Topic stated | Introduction MUST state the discussion topic (step title + item name) |
| Turn limit stated | Introduction MUST state the turn limit |
| Exit instruction | Introduction MUST include "Type 'done' to end discussion early" |

### VR-ELAB-011: Persona Contribution Format

**Traces**: FR-002 (AC-002-04), FR-010
**Scope**: Agent behavior
**When**: Every persona contribution during elaboration

| Check | Rule |
|-------|------|
| Attribution prefix | Every contribution MUST start with `{Name} ({Role}):` |
| Name accuracy | The name and role MUST match the persona definitions in Section 1 |
| Voice distinctiveness | Each contribution MUST be stylistically distinguishable (see VR-ELAB-020) |
| Non-empty content | The contribution text after the prefix MUST be non-empty |

### VR-ELAB-012: Cross-Talk Reference Validity

**Traces**: FR-005 (AC-005-01, AC-005-02)
**Scope**: Agent behavior
**When**: A persona references another persona's point

| Check | Rule |
|-------|------|
| Name used | Cross-references MUST use the persona's first name |
| Specificity | References MUST be specific ("Alex's point about caching") not vague ("the previous point") |
| Accuracy | The referenced point MUST have actually been made by that persona in this session |

### VR-ELAB-013: Topic Focus Compliance

**Traces**: FR-004 (AC-004-01, AC-004-02)
**Scope**: Agent behavior
**When**: Every persona contribution

| Check | Rule |
|-------|------|
| Topic relevance | Each contribution MUST relate to the focus question stated during framing |
| Drift detection | Contributions about different steps, features, or systems MUST be redirected |
| Redirect format | Redirects MUST follow the template in Section 4.4.5 |
| Redirect attribution | Only the lead persona issues redirects |

### VR-ELAB-014: Synthesis Summary Completeness

**Traces**: FR-008 (AC-008-01, AC-008-05), NFR-003
**Scope**: Agent behavior
**When**: Synthesis engine runs (Section 4.4.7)

| Check | Rule |
|-------|------|
| Required sections | Summary MUST contain: Key Insights, Decisions Made, Open Questions |
| Attribution on insights | Every insight in Key Insights MUST have a persona attribution |
| Participant list | Summary MUST list all three personas |
| Turn count | Summary MUST show actual turn count |
| Exit type | Summary MUST show "user-initiated" or "turn-limit" |
| Non-trivial content | At least one insight MUST be listed (unless discussion was minimal, see edge case 4.6 in error-taxonomy.md) |

### VR-ELAB-015: Artifact Update Integrity

**Traces**: FR-008 (AC-008-03), NFR-004
**Scope**: Agent behavior
**When**: Synthesis writes to artifact files

| Check | Rule |
|-------|------|
| Additive only | No existing content line MUST be deleted |
| No replacement | No existing paragraph or bullet MUST be modified |
| No reordering | Existing section order MUST be preserved |
| Traceability marker | Every elaboration addition MUST be preceded by an HTML comment marker: `<!-- Elaboration: step {step_id}, {timestamp} -->` |
| Section targeting | Additions MUST be placed in the section most relevant to the step topic |
| Announcement | Each artifact update MUST be announced to the user |

### VR-ELAB-016: Elaboration Record Schema

**Traces**: FR-009 (AC-009-01)
**Scope**: Data (meta.json)
**When**: State tracker writes to meta.json (Section 4.4.8)

| Field | Type | Required | Constraints |
|-------|------|----------|------------|
| `step_id` | string | Yes | Non-empty, format `NN-NN` |
| `turn_count` | integer | Yes | >= 1, <= max_turns |
| `personas_active` | string[] | Yes | Exactly 3 elements for this release |
| `timestamp` | string | Yes | Valid ISO 8601 format |
| `synthesis_summary` | string | Yes | Non-empty, recommended <= 100 chars |

### VR-ELAB-017: Elaboration Array Integrity

**Traces**: FR-009 (AC-009-02, AC-009-04)
**Scope**: Data (meta.json)
**When**: Writing elaboration records

| Check | Rule |
|-------|------|
| Array type | `elaborations` MUST be an array |
| Append only | New records MUST be appended, never replacing existing records |
| No deduplication | Multiple records for the same step_id are valid |
| Chronological order | Records MUST be in append order (newest last) |

---

## 4. Voice Integrity Validation Rules

### VR-ELAB-020: Maya Chen Voice Markers

**Traces**: FR-010 (AC-010-01)
**Scope**: Agent behavior

Maya's contributions during elaboration SHOULD exhibit these markers:

| Marker | Description | Example |
|--------|------------|---------|
| Question-led | Opens with questions, not assertions | "Before we go deeper, who benefits?" |
| User-grounded | References user scenarios and impact | "What does the user actually see?" |
| Acceptance criteria | Uses AC language naturally | "The acceptance criterion would be..." |
| Challenge pattern | Challenges solutions without user benefit | "That sounds elegant, but..." |
| Summarization | Periodically summarizes agreement/tension | "So we agree on X, but Y is unresolved." |

**Forbidden patterns**: Technical jargon unprompted, implementation proposals, silent agreement without "so what" for user.

### VR-ELAB-021: Alex Rivera Voice Markers

**Traces**: FR-010 (AC-010-02)
**Scope**: Agent behavior

Alex's contributions during elaboration SHOULD exhibit these markers:

| Marker | Description | Example |
|--------|------------|---------|
| Options-first | Presents multiple approaches before recommending | "I see two approaches here..." |
| Tradeoff analysis | Names tradeoffs explicitly | "The tradeoff is X versus Y." |
| Architecture bridging | Connects requirements to architecture | "Maya's requirement implies we need..." |
| Risk naming | Explicitly names risks and mitigations | "The risk with this is..." |
| ADR awareness | Recognizes decisions worth documenting | "This is an architectural decision." |

**Forbidden patterns**: UI aesthetics focus, acceptance criteria writing, function signature specification.

### VR-ELAB-022: Jordan Park Voice Markers

**Traces**: FR-010 (AC-010-03)
**Scope**: Agent behavior

Jordan's contributions during elaboration SHOULD exhibit these markers:

| Marker | Description | Example |
|--------|------------|---------|
| Concreteness | Makes abstract discussion concrete | "To make this concrete, the signature..." |
| Spec translation | Translates discussion to specifications | "That translates to this test: Given..." |
| Error-path focus | Proactively raises failure scenarios | "What happens when X fails?" |
| Contract language | Uses interface/contract terminology | "The contract between these modules..." |
| Anti-abstraction | Flags when discussion is too abstract | "We are getting abstract. Let me ground..." |

**Forbidden patterns**: Open-ended discovery questions, system-wide tradeoff evaluation, business value discussion.

### VR-ELAB-023: Anti-Blending Check

**Traces**: FR-010 (AC-010-04), NFR-002
**Scope**: Agent behavior (self-check)

| Check | Rule |
|-------|------|
| No committee voice | Contributions MUST NOT use generic language that any persona could say |
| Distinct vocabulary | Each persona's keyword frequency should differ (Maya: "user", "why", "criteria"; Alex: "tradeoff", "risk", "option"; Jordan: "interface", "contract", "error") |
| Silence over echo | If a persona has nothing distinct to add, they stay silent rather than echoing another persona |

---

## 5. Code-Level Validation Rules

### VR-ELAB-030: readMetaJson() Defensive Default

**Traces**: FR-009 (AC-009-02), NFR-005
**Scope**: Code (`src/claude/hooks/lib/three-verb-utils.cjs`)

| Check | Input | Expected Output |
|-------|-------|-----------------|
| Missing field | meta.json has no `elaborations` key | `elaborations: []` added to returned object |
| Null value | `"elaborations": null` | Replaced with `[]` |
| String value | `"elaborations": "invalid"` | Replaced with `[]` |
| Number value | `"elaborations": 42` | Replaced with `[]` |
| Object value | `"elaborations": {}` | Replaced with `[]` |
| Empty array | `"elaborations": []` | Preserved as `[]` |
| Populated array | `"elaborations": [{"step_id": "01-03"}]` | Preserved as-is |

**Implementation**: `if (!Array.isArray(raw.elaborations)) { raw.elaborations = []; }`

### VR-ELAB-031: writeMetaJson() Passthrough

**Traces**: FR-009 (AC-009-01)
**Scope**: Code (`src/claude/hooks/lib/three-verb-utils.cjs`)

| Check | Rule |
|-------|------|
| No changes needed | writeMetaJson() uses JSON.stringify on the entire meta object |
| New fields pass through | `elaborations` and `elaboration_config` are serialized automatically |
| No field filtering | writeMetaJson() does NOT filter or validate individual fields |

---

## 6. Acceptance Testing Validation Protocol

Since agent markdown files cannot be unit-tested, the following manual validation protocol verifies the behavioral rules.

### 6.1 Basic Elaboration Flow Test

| Step | Action | Expected | Rules Verified |
|------|--------|----------|---------------|
| 1 | Start `/isdlc analyze` on a test item | Analysis begins | -- |
| 2 | Complete one step normally | Step menu presented with [E] | VR-ELAB-001 |
| 3 | Select [E] | Introduction message displayed | VR-ELAB-010 |
| 4 | Observe framing | Lead persona frames with focus question | VR-ELAB-013 |
| 5 | Type "Alex, what about scalability?" | Alex responds first | VR-ELAB-004, VR-ELAB-005 |
| 6 | Type "What do you all think?" | All 3 personas respond | VR-ELAB-004 |
| 7 | Type "done" | Synthesis summary displayed | VR-ELAB-014 |
| 8 | Verify synthesis | Key Insights with attributions | VR-ELAB-014 |
| 9 | Verify artifact update | Artifact file has new content with HTML marker | VR-ELAB-015 |
| 10 | Verify meta.json | elaborations[] has one record | VR-ELAB-016, VR-ELAB-017 |
| 11 | Verify step menu | Same position, [E] available | FR-006 (AC-006-03, 04) |

### 6.2 Turn Limit Test

| Step | Action | Expected | Rules Verified |
|------|--------|----------|---------------|
| 1 | Enter elaboration mode | Discussion starts | -- |
| 2 | Participate through turn 8 | Warning: "nearing end of discussion time" | VR-ELAB-006 |
| 3 | Continue to turn 10 | Auto-exit: "thorough discussion" + synthesis | VR-ELAB-006 |
| 4 | Check elaboration record | turn_count <= 10 | VR-ELAB-016 |

### 6.3 Voice Integrity Test

| Step | Action | Expected | Rules Verified |
|------|--------|----------|---------------|
| 1 | Enter elaboration | All 3 personas contribute | -- |
| 2 | Read Maya's contribution | Question-led, user-grounded, no jargon | VR-ELAB-020 |
| 3 | Read Alex's contribution | Options-first, tradeoff analysis, risk naming | VR-ELAB-021 |
| 4 | Read Jordan's contribution | Concrete specs, error paths, contract language | VR-ELAB-022 |
| 5 | Blind review | Can identify persona without reading prefix? | VR-ELAB-023 |

### 6.4 State Persistence Test

| Step | Action | Expected | Rules Verified |
|------|--------|----------|---------------|
| 1 | Complete elaboration | meta.json updated | VR-ELAB-016 |
| 2 | Re-enter [E] for same step | New elaboration session starts | VR-ELAB-017 |
| 3 | Complete second elaboration | meta.json has 2 records for same step_id | VR-ELAB-017 |
| 4 | Resume session from scratch | Greeting mentions elaboration history | FR-009 AC-009-03 |

### 6.5 Artifact Integrity Test

| Step | Action | Expected | Rules Verified |
|------|--------|----------|---------------|
| 1 | Save artifact before elaboration | Baseline content recorded | -- |
| 2 | Complete elaboration with synthesis | Artifact updated | -- |
| 3 | Diff artifact before vs after | Only additions, no deletions | VR-ELAB-015 |
| 4 | Check HTML comment marker | `<!-- Elaboration: step ... -->` present | VR-ELAB-015 |

---

## 7. Traceability

| Rule ID | Requirement | Type |
|---------|------------|------|
| VR-ELAB-001 | FR-001 | Input |
| VR-ELAB-002 | FR-001 | Input |
| VR-ELAB-003 | FR-007 | Input |
| VR-ELAB-004 | FR-003, FR-006 | Input |
| VR-ELAB-005 | FR-003 | Input |
| VR-ELAB-006 | FR-007 | Input |
| VR-ELAB-010 | FR-001 | Output |
| VR-ELAB-011 | FR-002, FR-010 | Output |
| VR-ELAB-012 | FR-005 | Output |
| VR-ELAB-013 | FR-004 | Output |
| VR-ELAB-014 | FR-008, NFR-003 | Output |
| VR-ELAB-015 | FR-008, NFR-004 | Output |
| VR-ELAB-016 | FR-009 | Data |
| VR-ELAB-017 | FR-009 | Data |
| VR-ELAB-020 | FR-010 | Voice |
| VR-ELAB-021 | FR-010 | Voice |
| VR-ELAB-022 | FR-010 | Voice |
| VR-ELAB-023 | FR-010, NFR-002 | Voice |
| VR-ELAB-030 | FR-009, NFR-005 | Code |
| VR-ELAB-031 | FR-009 | Code |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-20 | System Designer (Phase 04) | Initial validation rules |
