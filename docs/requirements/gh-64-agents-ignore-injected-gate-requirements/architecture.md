# Architecture: GH-64 - Agents Ignore Injected Gate Requirements

**Generated:** 2026-02-20
**Phase:** 03-architecture
**Issue:** GH-64

---

## 1. Architecture Overview

This is a **prompt engineering + configuration change** — no new components, services, or data stores are introduced. The existing architecture remains unchanged; we modify the content and ordering of injected text blocks.

### Component Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Phase-Loop Controller                      │
│                    (isdlc.md STEP 3d)                        │
│                                                               │
│  ┌──────────────────┐  ┌──────────────────┐                 │
│  │ Gate Requirements │  │ External Skills  │                 │
│  │ Injection (REQ-24)│  │ Injection (REQ-22)│                │
│  └────────┬─────────┘  └──────────────────┘                 │
│           │                                                   │
│  ┌────────▼─────────────────────────────────┐               │
│  │          Delegation Prompt                │               │
│  │  [1] Mission                              │               │
│  │  [2] Workflow Context                     │               │
│  │  [3] ━━━ GATE REQUIREMENTS ━━━  ◄─ NEW   │               │
│  │  [4] Execute Phase (task instructions)    │               │
│  │  [5] Skill Index                          │               │
│  │  [6] External Skills                      │               │
│  │  [7] Budget Degradation                   │               │
│  │  [8] PHASE_TIMING_REPORT                  │               │
│  └──────────────────────────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────┐     ┌─────────────────────┐
│   Phase Agent        │────▶│   branch-guard.cjs   │
│ (reads constraints)  │     │ (enforces + feedback)│
└─────────────────────┘     └─────────────────────┘
```

**Current state:** Gate requirements are position 8 of 11. New state: position 3 of 8.

---

## 2. ADR-001: Prompt Placement Strategy

**Status:** Proposed
**Context:** Gate requirements are buried in long delegation prompts and ignored.
**Decision:** Move gate requirements to position 3 (after mission and workflow context, before task instructions).
**Rationale:** Agents process prompts sequentially. Placing constraints before task details ensures they are read and incorporated into the work plan.
**Consequences:** The `isdlc.md` STEP 3d section must be restructured. All other injection blocks shift down by one position.

---

## 3. ADR-002: Config-Driven Prohibitions

**Status:** Proposed
**Context:** Git commit prohibition is hardcoded in agent files and CLAUDE.md. New prohibitions would require code changes.
**Decision:** Add `prohibited_actions` array to `iteration-requirements.json` per-phase config. The injector reads this array and renders a PROHIBITED ACTIONS section.
**Rationale:** Centralizes prohibition management. New constraints can be added without modifying hook code.
**Consequences:** `iteration-requirements.json` schema extended. `gate-requirements-injector.cjs` reads new field. Backward compatible (optional field).

---

## 4. ADR-003: Feedback Loop via Hook Messages

**Status:** Proposed
**Context:** When hooks block actions, agents see generic error text with no link back to the gate requirements they received.
**Decision:** Enhance `outputBlockResponse()` to accept an optional `gateRequirementRef` parameter. `branch-guard.cjs` passes the prohibition reference when blocking.
**Rationale:** Connects enforcement to specification, helping agents understand why an action was blocked and not repeat it.
**Consequences:** `common.cjs` function signature gains optional parameter. `branch-guard.cjs` passes reference. Backward compatible.

---

## 5. Security Considerations (STRIDE)

No security implications. Changes are:
- Text formatting in prompts (no data exposure)
- Configuration additions (no authentication changes)
- Log entries (observability improvement, no sensitive data logged)

---

## 6. Technology Decisions

No new technologies. Changes use existing:
- Node.js CommonJS (.cjs) for hooks
- JSON for configuration
- Markdown for agent files and constitution
- Markdown string manipulation for isdlc.md

---

## 7. High Availability

Not applicable — this is a CLI tool with no HA requirements.

---

## 8. Cost Analysis

Zero infrastructure cost. Changes are text/configuration edits in the existing codebase.
