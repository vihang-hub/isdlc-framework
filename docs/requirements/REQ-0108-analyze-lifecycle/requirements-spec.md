# Requirements Specification: Analyze Lifecycle Implementation

**Item**: REQ-0108 | **GitHub**: #172 | **CODEX**: CODEX-039 | **Phase**: 7
**Status**: Analyzed

---

## 1. Business Context

The analyze command entry path (flag parsing, prefetch, bug-vs-feature classification, routing) is currently embedded as procedural logic in `isdlc.md`. Extract the frozen configuration — routing model, prefetch dependency graph, and classification signals — into a declarative data module so that downstream tools can introspect and test these rules without parsing markdown.

## 2. Functional Requirements

### FR-001: Entry Routing Model
- **AC-001-01**: A frozen config object defines flag parsing rules (recognized flags, their types, and default values).
- **AC-001-02**: The config defines a prefetch dependency graph specifying 6-way parallel fetch groups.
- **AC-001-03**: The config defines a classification gate distinguishing bug signals from feature signals.
- **AC-001-04**: The config defines routing decisions mapping classification outcomes to handler paths.

### FR-002: Prefetch Dependency Graph
- **AC-002-01**: 6 parallel fetch groups are defined: issue tracker, requirements folder, memory, personas, topics, discovery.
- **AC-002-02**: Each group declares: source path/API, fallback value, and fail-open behavior (true/false).
- **AC-002-03**: Groups with no interdependencies are marked as parallelizable.

### FR-003: Bug Classification Signals
- **AC-003-01**: A frozen list of bug signals (e.g., "broken", "fix", "crash", "error", "failing", "not working", "500") is defined.
- **AC-003-02**: A frozen list of feature signals (e.g., "add", "build", "create", "implement", "design", "refactor") is defined.
- **AC-003-03**: Signal matching is case-insensitive.

### FR-004: Registry Functions
- **AC-004-01**: `getEntryRoutingModel()` returns the full frozen routing config.
- **AC-004-02**: `getPrefetchGraph()` returns the 6-group prefetch dependency graph.
- **AC-004-03**: `getBugClassificationSignals()` returns `{ bug_signals, feature_signals }`.

## 3. Out of Scope

- Actual routing logic execution (stays in `isdlc.md`)
- Runtime prefetch orchestration
- Modifying the analyze command handler

## 4. MoSCoW

FR-001, FR-002, FR-003, FR-004: **Must Have**.
