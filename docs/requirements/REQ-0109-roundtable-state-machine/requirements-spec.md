# Requirements Specification: Roundtable Confirmation State Machine

**Item**: REQ-0109 | **GitHub**: #173 | **CODEX**: CODEX-040 | **Phase**: 7
**Status**: Analyzed

---

## 1. Business Context

The roundtable analyst uses a sequential confirmation flow (Requirements, Architecture, Design) that is currently implicit in the agent markdown. Extract the state machine definition — states, events, transitions, and tier-dependent paths — into a frozen data module for introspection, testing, and potential UI rendering.

## 2. Functional Requirements

### FR-001: FSM Definition
- **AC-001-01**: 7 states are defined: `IDLE`, `PRESENTING_REQUIREMENTS`, `PRESENTING_ARCHITECTURE`, `PRESENTING_DESIGN`, `AMENDING`, `FINALIZING`, `COMPLETE`.
- **AC-001-02**: Each state is a string enum member in a frozen `STATES` object.

### FR-002: Transitions
- **AC-002-01**: A frozen transition table maps `(state, event)` pairs to a `next_state`.
- **AC-002-02**: Events are: `accept`, `amend`, `finalize_complete`.
- **AC-002-03**: Invalid `(state, event)` lookups return `null` (no implicit transitions).

### FR-003: Tier-Dependent Paths
- **AC-003-01**: `standard` tier follows all 3 domains: Requirements → Architecture → Design.
- **AC-003-02**: `light` tier follows 2 domains: Requirements → Design (skips Architecture).
- **AC-003-03**: `trivial` tier follows a brief-mention path with no per-domain confirmation.

### FR-004: Registry Functions
- **AC-004-01**: `getStateMachine()` returns the full frozen FSM (states, events, transitions).
- **AC-004-02**: `getTransition(state, event)` returns the next state or `null`.
- **AC-004-03**: `getTierPath(tier)` returns the ordered domain sequence for a given tier.

## 3. Out of Scope

- Actual state tracking at runtime (stays in `roundtable-analyst.md`)
- UI rendering of the state machine
- Transition side effects

## 4. MoSCoW

FR-001, FR-002, FR-003, FR-004: **Must Have**.
