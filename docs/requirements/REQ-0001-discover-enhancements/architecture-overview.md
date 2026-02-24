# Architecture Overview: REQ-0001 Discover Enhancements

**Phase**: 03 - Architecture
**Created**: 2026-02-07
**Architect**: Solution Architect (Agent 03)

---

## 1. Architecture Approach

This feature extends the EXISTING iSDLC architecture. Per the discovery context, the architecture is a 6-layer CLI framework: `bin -> lib -> hooks -> config -> agents -> skills`. All 5 enhancements operate within the `agents` and `hooks` layers -- no new layers, services, or dependencies are introduced.

**Constraint**: DO NOT REDESIGN. Extend existing patterns only (per Article V: Simplicity First).

---

## 2. Component Architecture

### 2.1 DE-004: --shallow Removal (Deletion Only)

No architecture changes. Pure code removal across 5 files. Conditional branches are deleted; the "always thorough" path becomes the only path.

### 2.2 DE-001: Markdown Analysis Pipeline

**New capability added to existing agent D6 (feature-mapper).**

```
D6 Feature Mapper
  |
  +-- Existing Steps 1-8: JS source analysis
  |     (endpoints, pages, jobs, domains, behavior extraction)
  |
  +-- NEW Step 9: Markdown Analysis
  |     |
  |     +-- 9a: Scan agent markdown files (YAML frontmatter + body)
  |     +-- 9b: Scan command markdown files (options, routing)
  |     +-- 9c: Scan config JSON files (iteration-requirements, skills-manifest)
  |     +-- 9d: Build delegation graph (who-calls-whom)
  |     |
  |     +-- Output: agent-catalog.md
  |     +-- Output: domain-08-agent-orchestration.md (Given/When/Then AC)
  |
  +-- Existing Step: Write to index.md, traceability CSV
```

**Design Decisions**:
1. Markdown analysis is a NEW step in D6 (not a separate agent) -- keeps the feature mapper as the single source of feature/behavior extraction (Article V: no new agent for a task an existing agent can handle)
2. Agent catalog is a structured document (not JSON) -- markdown is human-readable and version-controllable
3. Domain 8 AC use the same Given/When/Then format as Domains 1-7 -- consistency with existing extraction
4. YAML frontmatter parsing uses regex (no new dependency) -- agents already parse YAML frontmatter

### 2.3 DE-005: Presentation Format

**Modifications to existing agent D0 (discover-orchestrator).**

```
D0 Discover Orchestrator
  |
  +-- Phase 1: Parallel Analysis
  |     +-- MODIFIED: Each sub-agent returns 1-line summary
  |     +-- MODIFIED: Orchestrator displays incremental progress
  |
  +-- Phase 1 Complete
  |     +-- NEW: Structured summary dashboard format
  |     +-- NEW: Report structure template (exec summary, dashboard, actions)
```

**Design Decisions**:
1. Progress indicators are text-based (no live terminal updates) -- agents communicate via prompt text, not terminal control
2. Structured summary uses box-drawing characters consistent with existing iSDLC formatting
3. Report template is embedded in D0 instructions (not a separate template file) -- keeps orchestrator self-contained

### 2.4 DE-002: Post-Discovery Walkthrough

**New phase added to existing agent D0 (discover-orchestrator).**

```
D0 Discover Orchestrator
  |
  +-- Phase 1: Parallel Analysis (existing)
  +-- Phase 1b-1d: Behavior Extraction (existing)
  +-- Phase 2: Discovery Report (existing)
  +-- Phase 3: Constitution Generation (existing)
  +-- Phase 4: Skill Installation (existing)
  +-- Phase 5: Test Gap Filling (existing)
  |
  +-- NEW Phase: Walkthrough
  |     |
  |     +-- Step 1: Constitution Review (MANDATORY)
  |     |     +-- Present articles, collect changes, update constitution.md
  |     |
  |     +-- Step 2: Architecture Review (OPT-IN)
  |     |     +-- Present architecture layers, highlight concerns
  |     |
  |     +-- Step 2.5: Permission Audit (OPT-IN)
  |     |     +-- Read .claude/settings.json
  |     |     +-- Compare against tech-stack permissions map
  |     |     +-- Recommend additions
  |     |
  |     +-- Step 3: Test Coverage Gaps (OPT-IN)
  |     |     +-- Present gaps with recommendations
  |     |
  |     +-- Step 3.5: Iteration Configuration (OPT-IN)
  |     |     +-- Present current defaults
  |     |     +-- Write to state.json → iteration_config
  |     |
  |     +-- Step 4: Smart Next Steps (MANDATORY)
  |           +-- Context-aware menu (project type + coverage)
  |           +-- Write user selection to state.json
  |
  +-- Phase 6: Cloud Configuration (existing, optional)
  +-- Finalize (existing)
```

**Tech Stack Permission Map (embedded in D0, not a separate file)**:

```
Node.js:
  recommended: ["npm test", "npm run lint", "npx tsc --noEmit"]
  review: ["npm install *"]

Python:
  recommended: ["pytest", "python -m pytest", "pip install -r requirements.txt"]
  review: ["pip install *"]

Go:
  recommended: ["go test ./...", "go vet ./..."]

Java:
  recommended: ["mvn test", "gradle test"]
```

### 2.5 DE-003: Context Envelope

**Modification to D0 (write) and SDLC orchestrator (read).**

```
D0 Discover Orchestrator                    SDLC Orchestrator (00)
  |                                           |
  +-- On completion:                          +-- On workflow init:
  |     Write discovery_context                    Read discovery_context
  |     to state.json                              from state.json
  |                                           |
  |     {                                     +-- Check staleness:
  |       completed_at: ISO-8601                   IF > 24 hours: WARN
  |       version: "1.0"                           IF missing: PROCEED (fail-open)
  |       tech_stack: {...}                   |
  |       coverage_summary: {...}             +-- Inject into Phase 01-04 prompts:
  |       architecture_summary: str                Replace file-scan approach
  |       re_artifacts: {...}                      with structured envelope data
  |       walkthrough_completed: bool         |
  |       user_next_action: str               +-- Fallback: existing file-scan approach
  |     }                                          if discovery_context is missing
  |
```

**Design Decisions**:
1. Envelope is written to state.json (not a separate file) -- state.json is the single source of runtime state (Article XIV)
2. 24-hour staleness threshold is hardcoded (not user-configurable) -- per REQ-DE003-04
3. SDLC orchestrator maintains backward compatibility -- if discovery_context is absent, falls back to existing `project.discovery_completed` check
4. Envelope version field ("1.0") enables future schema evolution

---

## 3. Hook Architecture (DE-002)

### Current Architecture

```
iteration-corridor.js:
  loadIterationRequirements() → reads iteration-requirements.json
  determineCorridorState(state, phase, phaseReq) → uses phaseReq.test_iteration.max_iterations

test-watcher.js:
  On test failure:
    Uses phaseReq.test_iteration.max_iterations (from iteration-requirements.json)
    Uses phaseReq.test_iteration.circuit_breaker_threshold
```

### Modified Architecture

```
iteration-corridor.js:
  NEW: getIterationConfig(state) → reads state.iteration_config (if exists)
  loadIterationRequirements() → reads iteration-requirements.json (unchanged)

  Resolution chain for max_iterations:
    1. state.json → iteration_config.implementation_max (user-configured)
    2. iteration-requirements.json → phases[phase].test_iteration.max_iterations
    3. Hardcoded default: 10

test-watcher.js:
  NEW: getIterationConfig(state) → reads state.iteration_config (if exists)

  Resolution chain for max_iterations:
    1. state.json → iteration_config.testing_max (user-configured)
    2. phaseReq.test_iteration.max_iterations (from iteration-requirements.json)
    3. Hardcoded default: 10

  Resolution chain for circuit_breaker_threshold:
    1. state.json → iteration_config.circuit_breaker_threshold (user-configured)
    2. phaseReq.test_iteration.circuit_breaker_threshold
    3. Hardcoded default: 3
```

**Implementation pattern** (same for both hooks):

```javascript
function getIterationConfig(state) {
    const config = state?.iteration_config;
    if (!config || !config.configured_at) return null;
    return config;
}
```

This is ~5 lines per hook, plus ~15 lines to modify existing max_iterations/circuit_breaker reads to check the config first.

---

## 4. Data Flow

```
/discover (D0)
  |
  +--[DE-004]---> Remove --shallow gates (simplify flow)
  |
  +--[DE-001]---> D6 analyzes markdown --> agent-catalog.md + domain-08 AC
  |
  +--[DE-005]---> D0 displays progress indicators + structured summary
  |
  +--[DE-002]---> D0 runs walkthrough phase:
  |                 Step 1 --> may modify constitution.md
  |                 Step 2.5 --> may modify .claude/settings.json
  |                 Step 3.5 --> writes iteration_config to state.json
  |                 Step 4 --> writes user_next_action
  |
  +--[DE-003]---> D0 writes discovery_context to state.json
  |
  v
/sdlc feature (Orchestrator 00)
  |
  +--[DE-003]---> Reads discovery_context from state.json
  |               Staleness check (24h)
  |               Injects into Phase 01-04 delegation prompts
  |
  v
Phase agents receive structured context without re-scanning
```

---

## 5. Technology Decisions

| Decision | Choice | Rationale | Article |
|----------|--------|-----------|---------|
| No new dependencies | Keep existing deps only | Simplicity, no new attack surface | V, III |
| No new agents | Extend D0 and D6 | 1-to-1 agent-phase mapping principle | V |
| No new config files | Use state.json | Single source of runtime state | XIV |
| Hardcode permission map | Embed in D0 | Avoid config sprawl, easy to update | V |
| Hardcode 24h staleness | Not user-configurable | Per spec requirement | I |
| YAML parsing via regex | No new YAML parser | Hooks use CJS, keep deps minimal | XIII |

---

## 6. ADRs

### ADR-001: Walkthrough as Part of D0, Not a Separate Agent

**Decision**: The post-discovery walkthrough is a new phase within the discover-orchestrator (D0), not a new agent.

**Rationale**: The walkthrough reads D0's accumulated context (analysis results, constitution, coverage). Creating a separate agent would require serializing all context to pass it, adding complexity without benefit. The walkthrough is tightly coupled to discovery -- it would never run independently.

**Consequence**: D0 grows by ~150 lines. If it becomes unwieldy (>2000 lines), consider extracting walkthrough to a sub-agent in a future enhancement.

### ADR-002: Context Envelope in state.json, Not a Separate File

**Decision**: The discovery_context envelope is written to state.json, not to a separate `discovery-context.json` file.

**Rationale**: Article XIV requires state.json as the single source of runtime state. Creating parallel state files violates this principle and creates synchronization risks.

**Consequence**: state.json grows by ~20 lines. Acceptable.
