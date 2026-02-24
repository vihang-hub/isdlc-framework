# Error Taxonomy: REQ-0003 - Suggested Prompts

**Artifact ID:** REQ-0003-suggested-prompts
**Phase:** 04 - Design
**Created:** 2026-02-08
**Status:** Final

---

## 1. Overview

This document catalogs all edge cases, error conditions, and fallback behaviors for the suggested prompts feature. Each scenario defines the trigger condition, expected behavior, and constitutional basis. Since this feature modifies only agent markdown instructions (not runtime code), "errors" are states where the LLM agent cannot fully resolve dynamic prompt content.

---

## 2. Edge Case Taxonomy

### 2.1 State Resolution Errors

These occur when agents attempt to read `active_workflow` from state.json for dynamic prompt generation.

| ID | Condition | Trigger | Behavior | Fallback Output | Article |
|----|-----------|---------|----------|-----------------|---------|
| E-001 | `active_workflow` is null | No SDLC workflow is active | Agent emits generic fallback prompts | `[1] Show project status` / `[2] Start a new workflow` | X |
| E-002 | `state.json` does not exist | Framework not initialized, or state.json deleted | Agent emits generic fallback prompts | Same as E-001 | X |
| E-003 | `state.json` is malformed JSON | File corrupted or partially written | Agent emits generic fallback prompts | Same as E-001 | X, XIV |
| E-004 | `active_workflow.phases` is missing or empty | Incomplete state (should not normally happen) | Agent emits generic fallback prompts | Same as E-001 | X |
| E-005 | `active_workflow.current_phase_index` is undefined | State written without index | Agent emits generic fallback prompts | Same as E-001 | X |

**Design principle:** All state resolution errors degrade to the same fallback. The agent never errors out, crashes, or produces malformed output. This follows Article X (Fail-Safe Defaults).

### 2.2 Phase Resolution Errors

These occur during the next-phase resolution algorithm.

| ID | Condition | Trigger | Behavior | Output |
|----|-----------|---------|----------|--------|
| E-010 | Next index exceeds phases array | Agent is at the last phase in the workflow | Primary prompt = "Complete workflow and merge to main" | Normal (not an error) |
| E-011 | Current phase not found in phases array | Agent invoked outside its expected workflow position | Agent emits generic fallback prompts | Same as E-001 |
| E-012 | Phase key has unexpected format | Phase key without a hyphen (e.g., "requirements") | Agent uses the raw key as the display name | "Continue to Phase requirements" (degraded but functional) |

### 2.3 Agent Context Errors

These relate to the agent's execution context.

| ID | Condition | Trigger | Behavior | Output |
|----|-----------|---------|----------|--------|
| E-020 | Agent invoked ad-hoc (not via workflow) | User directly invokes agent outside `/sdlc` workflow | Agent checks for active_workflow; if null, emits fallback | Same as E-001 |
| E-021 | Sub-agent invoked directly by user | User somehow triggers a sub-agent directly | Sub-agent still emits STATUS line | STATUS format maintained |
| E-022 | Agent invoked for a different workflow type | Agent's phase is in the workflow but with different modifiers | Dynamic resolution still works correctly | Normal output |

### 2.4 Format Integrity Errors

These are implementation-time risks, not runtime errors.

| ID | Condition | Risk | Mitigation |
|----|-----------|------|------------|
| E-030 | Agent emits prompt block with wrong delimiter | Agent uses `===` instead of `---` | Code review (Phase 08) + format validation test |
| E-031 | Agent emits Unicode characters in prompt | Non-ASCII characters in prompt text | NFR-005 validation test scans for non-ASCII |
| E-032 | Agent emits more than 4 items | Agent produces 5+ numbered items | Format validation test checks item count bounds |
| E-033 | Agent emits fewer than 2 items | Agent produces only 1 item | Format validation test checks minimum items |
| E-034 | Agent emits prompt mid-response (not at end) | Prompt block appears before final content | Code review validates placement |
| E-035 | Sub-agent emits full prompt block instead of STATUS | Sub-agent given wrong template | Code review + sub-agent format test |

---

## 3. Error Severity Classification

| Severity | Impact | Examples | Response |
|----------|--------|----------|----------|
| **None** | User sees correct prompts | Normal operation | No action needed |
| **Cosmetic** | Prompts display but with minor formatting issues | E-012 (degraded phase name) | Accept -- still functional |
| **Degraded** | Fallback prompts shown instead of dynamic | E-001 through E-005 | Agent functions correctly; user gets generic guidance |
| **Silent** | No prompts emitted | Agent file lacks SUGGESTED PROMPTS section (CON-003) | Backward compatible -- no regression |
| **Implementation** | Wrong format in agent file | E-030 through E-035 | Caught by validation tests and code review |

---

## 4. Recovery Behaviors

### 4.1 Automatic Recovery (No Human Intervention)

| Scenario | Recovery |
|----------|----------|
| state.json unavailable | Agent emits fallback prompts and continues normal phase work |
| active_workflow null | Agent emits fallback prompts and continues normal phase work |
| Phase key format unexpected | Agent uses best-effort name resolution (raw key as fallback) |

### 4.2 No Recovery Needed

| Scenario | Reason |
|----------|--------|
| Missing SUGGESTED PROMPTS section | Backward compatible by design (CON-003) |
| Sub-agent invoked directly | STATUS format always applies regardless of invocation path |

### 4.3 Manual Recovery (Requires Implementation Fix)

| Scenario | Fix |
|----------|-----|
| Format errors (E-030 to E-035) | Fix agent markdown file during code review or subsequent iteration |
| Incorrect alternative prompts | Update agent file's SUGGESTED PROMPTS section |

---

## 5. Interaction with Existing Error Patterns

### 5.1 No Conflict with Existing Patterns

| Existing Pattern | Interaction | Notes |
|------------------|-------------|-------|
| Hook fail-open behavior | None | Prompts are not hook-mediated (CON-002) |
| Gate validation failures | None | Prompts emit after gate validation, not during |
| Constitution validation | None | Prompts are format-checked, not constitutionally validated |
| Iteration corridor | None | Prompts are text output, not iteration-tracked |
| Skill observability | None | No new skills involved |

### 5.2 No New Error Conditions Introduced

This feature does not introduce any new error conditions to the framework. All "errors" are degraded-but-functional states where the agent emits fallback prompts instead of dynamic ones. No error can prevent the agent from completing its phase work.

---

## 6. Traceability

| Error Category | Requirements | ADRs | NFRs | Constitutional Articles |
|----------------|-------------|------|------|------------------------|
| State resolution (E-001 to E-005) | REQ-006 | ADR-002 | NFR-006 | X (Fail-Safe), XIV (State Integrity) |
| Phase resolution (E-010 to E-012) | REQ-002 | ADR-002, ADR-007 | - | X (Fail-Safe) |
| Agent context (E-020 to E-022) | REQ-001 | ADR-001, ADR-005 | - | X (Fail-Safe) |
| Format integrity (E-030 to E-035) | REQ-005 | ADR-004 | NFR-005 | IX (Gate Integrity) |
