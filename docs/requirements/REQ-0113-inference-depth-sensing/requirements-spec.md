# Requirements Specification: Inference Tracking and Depth Sensing

**Item**: REQ-0113 | **GitHub**: #177 | **CODEX**: CODEX-044 | **Phase**: 7
**Status**: Analyzed

---

## 1. Business Context

The roundtable analyst adjusts its depth of analysis based on user signals and tracks confidence levels for inferred requirements. These rules — confidence enum, per-topic depth guidance, coverage guardrails, and depth adjustment signals — are currently implicit in agent behavior. Extract them into a frozen data module for testability and consistency.

## 2. Functional Requirements

### FR-001: Confidence Levels
- **AC-001-01**: A frozen enum defines 3 levels: `HIGH` (user-confirmed), `MEDIUM` (inferred from codebase), `LOW` (extrapolated with assumptions).
- **AC-001-02**: Each level has a string value and a numeric weight for comparison.

### FR-002: Depth Guidance Rules
- **AC-002-01**: A frozen per-topic depth config matches roundtable topic files.
- **AC-002-02**: Each topic defines behavior for 3 depth levels: `brief` (skip or summarize), `standard` (full coverage), `deep` (extended probing).
- **AC-002-03**: Each depth level declares: acceptance criteria and inference policy (what can be inferred vs what must be asked).

### FR-003: Coverage Guardrails
- **AC-003-01**: Minimum coverage rules per depth level (e.g., `brief` requires at least 2 topics, `standard` requires all mandatory topics, `deep` requires all topics).
- **AC-003-02**: Rules are frozen and declarative.

### FR-004: Depth Adjustment Signals
- **AC-004-01**: A frozen list of user signals that trigger depth changes.
- **AC-004-02**: Signals map to a direction: `shallower` (e.g., "let's keep it simple", "just the basics") or `deeper` (e.g., detailed questions, "tell me more", "what about edge cases").

### FR-005: Registry Functions
- **AC-005-01**: `getConfidenceLevels()` returns the frozen confidence enum.
- **AC-005-02**: `getDepthGuidance(topicId)` returns depth config for a specific topic, or `null`.
- **AC-005-03**: `getCoverageGuardrails()` returns minimum coverage rules per depth.
- **AC-005-04**: `getDepthAdjustmentSignals()` returns the signal-to-direction mappings.

## 3. Out of Scope

- Actual depth tracking logic (stays in `roundtable-analyst.md`)
- Runtime inference scoring
- NLP signal detection

## 4. MoSCoW

FR-001, FR-002, FR-003, FR-004, FR-005: **Must Have**.
