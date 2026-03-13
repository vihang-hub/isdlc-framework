# Requirements Specification: Roundtable Memory Layer

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-03-13
**Coverage**: Full
**Source**: GitHub Issue #113 (GH-113)
**Depends On**: REQ-0045 (Semantic Search Backend), REQ-0046 (Roundtable Depth Control)

---

## 1. Business Context

The roundtable analysis conversation resets to zero knowledge at the start of every session. A developer who has been through dozens of roundtable sessions is still asked the same probing questions, receives the same default depth on every topic, and must re-establish preferences every time. This wastes time, creates friction, and undermines trust in the tool's intelligence.

The memory layer gives the roundtable persistent recall of user preferences and project-specific topic history, so that each session starts from a baseline of learned behavior rather than a blank slate.

## 2. Stakeholders and Personas

| Stakeholder | Interest | Impact |
|---|---|---|
| **Developer (primary user)** | Faster, less repetitive roundtable sessions that adapt to their style | Direct -- every roundtable session is affected |
| **Team members (project contributors)** | Shared project memory captures how topics were handled for this codebase | Indirect -- benefits from project-level patterns |
| **Framework maintainers** | Clean extension point in the dispatch/roundtable flow | Indirect -- must maintain new storage and CLI surface |

### Primary Persona: Developer

- Uses roundtable analysis regularly across multiple projects
- Has consistent preferences (e.g., brief on architecture, deep on requirements)
- Expects the tool to learn and adapt over time
- Wants control over what is remembered and when compaction happens

## 3. User Journeys

### 3.1 First Session (No Memory)

1. Developer runs `isdlc analyze` on a new project
2. No memory files exist -- roundtable behaves exactly as today
3. After roundtable completes, a session record is written to both user and project memory
4. Developer notices no difference -- graceful degradation is invisible

### 3.2 Subsequent Session (Memory Available)

1. Developer runs `isdlc analyze` on the same or different project
2. Dispatch layer reads `~/.isdlc/user-memory/profile.json` and `.isdlc/roundtable-memory.json`
3. Memory is injected as `MEMORY_CONTEXT` into the roundtable prompt
4. At topic transitions, roundtable acknowledges known preferences: "From past sessions, you tend to keep architecture brief -- same here?"
5. Developer confirms or overrides
6. Override adjusts weight for future sessions

### 3.3 Memory Conflict

1. User memory says "brief on security" but project memory says "deep on security" (4 of last 5 sessions)
2. Roundtable surfaces both signals: "Your usual preference is brief on security, but this project has needed deep security work recently -- which way?"
3. Developer chooses; choice is recorded in session record

### 3.4 Compaction

1. Developer notices roundtable startup warning: "Memory reads are slowing down -- consider running `isdlc memory compact`"
2. Developer runs `isdlc memory compact`
3. Raw session logs are aggregated into compacted summary
4. Subsequent sessions read from fast compacted summary

### 3.5 Missing or Corrupted Memory

1. Memory file is missing, empty, or contains malformed JSON
2. Dispatch layer silently skips memory injection -- `MEMORY_CONTEXT` is absent
3. Roundtable behaves exactly as today -- no error, no warning, no degradation

## 4. Technical Context

### 4.1 Existing Patterns

- `~/.isdlc/` directory already used for personal profiles (`~/.isdlc/profiles/`) and update checks (`~/.isdlc-update-check.json`)
- `.isdlc/` project directory used for state, profiles, and search config
- Dispatch prompt injection pattern established for `PERSONA_CONTEXT`, `TOPIC_CONTEXT`, `DISCOVERY_CONTEXT`
- Dynamic depth sensing (REQ-0046, Section 3.5 of `roundtable-analyst.md`) reads per-topic signals each exchange
- Profile loader (`src/claude/hooks/lib/profile-loader.cjs`) demonstrates the 3-tier resolution pattern (built-in > project > personal)

### 4.2 Constraints

- Subsecond reads at roundtable startup (<1 second even after months of usage)
- No automatic background processing -- compaction is user-triggered only
- Fail-open: missing or corrupted memory never blocks or degrades the roundtable
- Memory is advisory (weighted signals), never prescriptive
- All topics covered equally -- no topic is special-cased

## 5. Quality Attributes and Risks

| Quality Attribute | Requirement |
|---|---|
| **Performance** | Memory reads < 1 second at startup, even with ~260 sessions/year |
| **Reliability** | Fail-open on missing/corrupted files; write failures don't block ROUNDTABLE_COMPLETE |
| **Privacy** | User memory is local filesystem only (`~/.isdlc/`), never transmitted |
| **Maintainability** | Storage format is JSON, human-readable, manually editable |
| **Usability** | Brief acknowledgment at topic transitions; user always in control |

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Raw session logs grow unbounded | Medium | Low (read perf degrades) | Warn user when reads slow; `isdlc memory compact` available |
| Memory preferences become stale | Low | Medium (wrong depth applied) | Weights decay over time; user can override any preference |
| Schema changes break old memory files | Low | Low (fail-open) | Lenient schema validation; skip malformed entries |

## 6. Functional Requirements

### FR-001: User Memory Storage
**Priority**: Must Have
**Confidence**: High

Store user-level roundtable preferences in `~/.isdlc/user-memory/`.

**Acceptance Criteria**:
- AC-001-01: `~/.isdlc/user-memory/profile.json` stores compacted per-topic preferences with fields: `topic_id`, `preferred_depth`, `weight`, `last_updated`, `override_count`
- AC-001-02: `~/.isdlc/user-memory/sessions/{timestamp}.json` stores raw session records in append-only fashion
- AC-001-03: User memory persists across projects (cross-project)
- AC-001-04: User memory is local filesystem only -- never transmitted or shared

### FR-002: Project Memory Storage
**Priority**: Must Have
**Confidence**: High

Store project-level roundtable topic history in `.isdlc/roundtable-memory.json`.

**Acceptance Criteria**:
- AC-002-01: `.isdlc/roundtable-memory.json` contains a `summary` object with per-topic aggregates and a `sessions` array with raw records
- AC-002-02: Per-topic records include: `topic_id`, `depth_used`, `assumptions_count`, `assumptions_amended`
- AC-002-03: Project memory is shared across team members working on the same codebase
- AC-002-04: Project memory file is suitable for version control (deterministic JSON output)

### FR-003: Dispatch Injection
**Priority**: Must Have
**Confidence**: High

The analyze handler injects memory into the roundtable prompt via `MEMORY_CONTEXT`.

**Acceptance Criteria**:
- AC-003-01: The analyze handler reads `~/.isdlc/user-memory/profile.json` and `.isdlc/roundtable-memory.json` before dispatching the roundtable
- AC-003-02: Both files are merged into a single `MEMORY_CONTEXT` block with per-topic entries, distinguishing user vs. project source
- AC-003-03: `MEMORY_CONTEXT` follows the same inlining pattern as `PERSONA_CONTEXT` and `TOPIC_CONTEXT`
- AC-003-04: If either file is missing or corrupted, `MEMORY_CONTEXT` is omitted -- no error, no warning

### FR-004: Memory-Aware Depth Sensing
**Priority**: Must Have
**Confidence**: High

The roundtable agent uses memory as weighted input to its dynamic depth sensing.

**Acceptance Criteria**:
- AC-004-01: At each topic transition, the roundtable checks `MEMORY_CONTEXT` for a matching topic entry
- AC-004-02: If a preference exists, the roundtable briefly acknowledges it: "From past sessions, you tend to [preference] -- same here?"
- AC-004-03: The user can confirm or override the preference
- AC-004-04: Memory-backed preferences are weighted signals -- the roundtable can still adjust based on real-time conversational cues
- AC-004-05: All topics are treated equally -- no topic receives special handling

### FR-005: Memory Conflict Resolution
**Priority**: Must Have
**Confidence**: High

When user memory and project memory disagree on a topic, the roundtable surfaces both signals and lets the user decide.

**Acceptance Criteria**:
- AC-005-01: At session start or topic transition, if user and project memory disagree on preferred depth for a topic, both signals are presented to the user
- AC-005-02: The user's choice is recorded in the session record
- AC-005-03: Only conflicts are surfaced -- agreements are applied silently with brief acknowledgment

### FR-006: Session Record Write-Back
**Priority**: Must Have
**Confidence**: High

After roundtable completion, a session record is written to both memory layers.

**Acceptance Criteria**:
- AC-006-01: After `ROUNDTABLE_COMPLETE`, the analyze handler appends a session record to `~/.isdlc/user-memory/sessions/{timestamp}.json`
- AC-006-02: The same session record is appended to `.isdlc/roundtable-memory.json` sessions array
- AC-006-03: Session record contains: `session_id`, `slug`, `timestamp`, `topics: [{ topic_id, depth_used, acknowledged, overridden, assumptions_count }]`
- AC-006-04: Write failures are logged internally but do not block `ROUNDTABLE_COMPLETE`

### FR-007: User-Triggered Compaction
**Priority**: Must Have
**Confidence**: High

The `isdlc memory compact` CLI command compacts raw session logs into summaries.

**Acceptance Criteria**:
- AC-007-01: `isdlc memory compact` compacts both user and project memory by default
- AC-007-02: `isdlc memory compact --user` compacts only user memory
- AC-007-03: `isdlc memory compact --project` compacts only project memory
- AC-007-04: Compaction reads all raw session records, aggregates per-topic weights, and writes a fresh summary (user: `profile.json`, project: `roundtable-memory.json` summary section)
- AC-007-05: Raw session logs can be archived or pruned after compaction

### FR-008: Graceful Degradation
**Priority**: Must Have
**Confidence**: High

Missing or corrupted memory files never block or degrade the roundtable.

**Acceptance Criteria**:
- AC-008-01: Missing memory files result in `MEMORY_CONTEXT` being omitted -- roundtable behaves as today
- AC-008-02: Corrupted files (malformed JSON, missing fields) are treated as missing -- skip and proceed
- AC-008-03: Partial data is accepted: if `profile.json` has some topics with valid entries and others malformed, valid entries are used
- AC-008-04: No error messages or warnings are shown to the user for memory failures
- AC-008-05: Post-roundtable write failures do not block `ROUNDTABLE_COMPLETE`

### FR-009: Performance Warning
**Priority**: Should Have
**Confidence**: Medium

Warn the user when memory reads exceed the performance threshold.

**Acceptance Criteria**:
- AC-009-01: If memory reads at session start take longer than 1 second, the roundtable suggests: "Memory reads are slowing down -- consider running `isdlc memory compact`"
- AC-009-02: Warning is conversational, not an error -- the session continues normally

### FR-010: Weight Decay and Feedback
**Priority**: Should Have
**Confidence**: Medium

Preferences that are overridden lose weight; preferences that are confirmed gain weight.

**Acceptance Criteria**:
- AC-010-01: Each override increments `override_count` and reduces `weight` for that topic preference
- AC-010-02: Each confirmation increases `weight` for that topic preference
- AC-010-03: Stale preferences (not confirmed or overridden in many sessions) decay toward neutral

## 7. Out of Scope

- **Automatic semantic search at roundtable startup**: Dropped from initial scope. Semantic search over past sessions can be a future extension (`isdlc memory search`) but does not run automatically.
- **User identity / multi-user home directory segmentation**: `~/.isdlc/` is inherently per-user. No user-id scoping needed.
- **Automatic compaction**: Compaction is user-triggered only. No background or scheduled processing.
- **Cloud sync or remote storage**: Memory is local filesystem only.
- **Session memory (Layer 3)**: Already handled by REQ-0046's dynamic depth sensing. Not part of this requirement.

## 8. MoSCoW Prioritization

| Priority | Requirements |
|---|---|
| **Must Have** | FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007, FR-008 |
| **Should Have** | FR-009, FR-010 |
| **Could Have** | (none) |
| **Won't Have** | Automatic semantic search, user-id segmentation, automatic compaction, cloud sync |

## 9. Dependency Map

```
FR-001 (User Storage) ──┐
                         ├──> FR-003 (Dispatch Injection) ──> FR-004 (Depth Sensing)
FR-002 (Project Storage) ┘                                        │
                                                                   ├──> FR-005 (Conflict Resolution)
                                                                   └──> FR-006 (Write-Back)
FR-007 (Compaction) depends on FR-001, FR-002
FR-008 (Graceful Degradation) cross-cuts all FRs
FR-009 (Performance Warning) depends on FR-003
FR-010 (Weight Decay) depends on FR-006
```

## Pending Sections

(none -- all sections complete)
