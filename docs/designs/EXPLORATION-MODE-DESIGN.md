# Exploration Mode Design: Mapping & Tracing

**Version**: 1.0.0
**Date**: 2026-02-04
**Status**: Draft
**Author**: Claude Opus 4.5

---

## Executive Summary

This design introduces two exploration sub-systems that run as **Phase 00** before the main SDLC workflow begins:

| Workflow | Exploration Mode | Purpose |
|----------|------------------|---------|
| **Feature** | Mapping | Understand blast radius, find entry points, scope the change |
| **Fix** | Tracing | Follow execution path, track bug through code, identify root cause |

Both systems use **parallel sub-agents** with clean context windows, consolidated by an **orchestrator** that produces a unified report passed to Phase 01.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FEATURE WORKFLOW                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 00: Mapping                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Mapping Orchestrator (M0)                                              ││
│  │       │                                                                 ││
│  │       ├──► M1: Impact Analyzer ──────────┐                              ││
│  │       │    (files, modules, deps)        │                              ││
│  │       │                                  │                              ││
│  │       ├──► M2: Entry Point Finder ───────┼──► M0 Consolidates ──►      ││
│  │       │    (APIs, UIs, jobs)             │    impact-analysis.md        ││
│  │       │                                  │                              ││
│  │       └──► M3: Risk Assessor ────────────┘                              ││
│  │            (complexity, coverage gaps)                                  ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                          │                                                   │
│                          ▼                                                   │
│  Phase 01: Requirements (receives impact-analysis.md as input context)      │
│  Phase 02: Architecture ...                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           FIX WORKFLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  Phase 00: Tracing                                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Tracing Orchestrator (T0)                                              ││
│  │       │                                                                 ││
│  │       ├──► T1: Symptom Analyzer ─────────┐                              ││
│  │       │    (errors, logs, user report)   │                              ││
│  │       │                                  │                              ││
│  │       ├──► T2: Execution Path Tracer ────┼──► T0 Consolidates ──►      ││
│  │       │    (call chain, data flow)       │    trace-analysis.md         ││
│  │       │                                  │                              ││
│  │       └──► T3: Root Cause Identifier ────┘                              ││
│  │            (hypothesis, evidence)                                       ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│                          │                                                   │
│                          ▼                                                   │
│  Phase 01: Requirements (receives trace-analysis.md as input context)       │
│  Phase 04: Test Strategy ...                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 1: Mapping System (Feature Workflow)

### 1.1 Agents

#### M0: Mapping Orchestrator

**File**: `src/claude/agents/mapping/mapping-orchestrator.md`

```yaml
---
name: mapping-orchestrator
description: "Orchestrates Phase 00 Mapping for feature workflows. Launches parallel sub-agents to analyze impact, find entry points, and assess risk. Consolidates results into impact-analysis.md for Phase 01."
model: opus
owned_skills:
  - MAP-001  # mapping-delegation
  - MAP-002  # impact-consolidation
  - MAP-003  # scope-estimation
---
```

**Responsibilities**:
1. Parse feature description to identify keywords/domains
2. Launch M1, M2, M3 in parallel
3. Collect `report_section` from each sub-agent
4. Consolidate into `docs/requirements/{artifact-folder}/impact-analysis.md`
5. Update state.json with mapping completion status
6. Pass consolidated context to Phase 01

#### M1: Impact Analyzer

**File**: `src/claude/agents/mapping/impact-analyzer.md`

```yaml
---
name: impact-analyzer
description: "Use this agent for Mapping Phase M1: Impact Analysis. Analyzes which files, modules, and dependencies will be affected by a proposed feature. Estimates blast radius and identifies coupling points."
model: opus
owned_skills:
  - MAP-101  # file-impact-detection
  - MAP-102  # module-dependency-mapping
  - MAP-103  # coupling-analysis
  - MAP-104  # change-propagation-estimation
---
```

**Responsibilities**:
1. Read feature description and discovery report
2. Identify directly affected files/modules
3. Map outward dependencies (what depends on changed code)
4. Map inward dependencies (what changed code depends on)
5. Estimate change propagation paths
6. Return structured impact report

**Output Format**:
```json
{
  "status": "success",
  "report_section": "## Impact Analysis\n...",
  "impact_summary": {
    "directly_affected": ["src/modules/auth/*", "src/api/users.ts"],
    "dependency_chain": [
      {"from": "src/modules/auth", "to": "src/modules/orders", "type": "imports"}
    ],
    "blast_radius": "medium",
    "files_estimated": 12,
    "modules_estimated": 3
  }
}
```

#### M2: Entry Point Finder

**File**: `src/claude/agents/mapping/entry-point-finder.md`

```yaml
---
name: entry-point-finder
description: "Use this agent for Mapping Phase M2: Entry Point Discovery. Identifies where to implement features - API endpoints, UI components, CLI commands, background jobs, or event handlers."
model: opus
owned_skills:
  - MAP-201  # api-endpoint-discovery
  - MAP-202  # ui-component-discovery
  - MAP-203  # job-handler-discovery
  - MAP-204  # event-listener-discovery
---
```

**Responsibilities**:
1. Read feature description and feature map from discovery
2. Identify existing entry points that relate to feature
3. Suggest new entry points that need to be created
4. Map entry point → handler → service → repository chain
5. Return structured entry point report

**Output Format**:
```json
{
  "status": "success",
  "report_section": "## Entry Points\n...",
  "entry_points": {
    "existing": [
      {"type": "api", "path": "/api/users", "file": "src/api/users.ts", "relevance": "high"}
    ],
    "suggested_new": [
      {"type": "api", "path": "/api/users/preferences", "rationale": "Feature requires new endpoint"}
    ],
    "implementation_chain": {
      "/api/users/preferences": ["UserController", "UserService", "UserRepository"]
    }
  }
}
```

#### M3: Risk Assessor

**File**: `src/claude/agents/mapping/risk-assessor.md`

```yaml
---
name: risk-assessor
description: "Use this agent for Mapping Phase M3: Risk Assessment. Evaluates complexity, test coverage gaps, and technical debt in affected areas. Identifies high-risk zones requiring extra attention."
model: opus
owned_skills:
  - MAP-301  # complexity-scoring
  - MAP-302  # coverage-gap-detection
  - MAP-303  # technical-debt-identification
  - MAP-304  # risk-zone-mapping
---
```

**Responsibilities**:
1. Read impact analysis areas from M1
2. Check test coverage for affected modules (from discovery)
3. Assess cyclomatic complexity of touched code
4. Identify technical debt markers (TODOs, deprecated code)
5. Score overall risk and highlight danger zones
6. Return structured risk report

**Output Format**:
```json
{
  "status": "success",
  "report_section": "## Risk Assessment\n...",
  "risk_assessment": {
    "overall_risk": "medium",
    "risk_score": 65,
    "coverage_gaps": [
      {"module": "src/modules/auth", "coverage": 45, "risk": "high"}
    ],
    "complexity_hotspots": [
      {"file": "src/services/order.ts", "complexity": 28, "risk": "high"}
    ],
    "technical_debt": [
      {"file": "src/utils/legacy.ts", "markers": ["TODO", "FIXME"], "count": 5}
    ],
    "recommendations": [
      "Add tests for auth module before modifying",
      "Refactor order.ts before adding features"
    ]
  }
}
```

### 1.2 Skills

#### Skill Category: MAP (Mapping)

| Skill ID | Name | Owner | Description |
|----------|------|-------|-------------|
| MAP-001 | mapping-delegation | mapping-orchestrator | Delegate to mapping sub-agents |
| MAP-002 | impact-consolidation | mapping-orchestrator | Consolidate sub-agent reports |
| MAP-003 | scope-estimation | mapping-orchestrator | Estimate overall scope from mapping |
| MAP-101 | file-impact-detection | impact-analyzer | Detect files affected by feature |
| MAP-102 | module-dependency-mapping | impact-analyzer | Map module dependencies |
| MAP-103 | coupling-analysis | impact-analyzer | Analyze coupling between components |
| MAP-104 | change-propagation-estimation | impact-analyzer | Estimate change ripple effects |
| MAP-201 | api-endpoint-discovery | entry-point-finder | Find relevant API endpoints |
| MAP-202 | ui-component-discovery | entry-point-finder | Find relevant UI components |
| MAP-203 | job-handler-discovery | entry-point-finder | Find background job handlers |
| MAP-204 | event-listener-discovery | entry-point-finder | Find event listeners/handlers |
| MAP-301 | complexity-scoring | risk-assessor | Score code complexity |
| MAP-302 | coverage-gap-detection | risk-assessor | Detect test coverage gaps |
| MAP-303 | technical-debt-identification | risk-assessor | Identify tech debt markers |
| MAP-304 | risk-zone-mapping | risk-assessor | Map high-risk code zones |

**Total**: 15 skills (3 orchestrator + 4 M1 + 4 M2 + 4 M3)

### 1.3 Output Artifact

**File**: `docs/requirements/{artifact-folder}/impact-analysis.md`

```markdown
# Impact Analysis: {Feature Name}

**Generated**: {timestamp}
**Feature**: {feature description}
**Workflow**: feature
**Phase**: 00-mapping

---

## Executive Summary

{1-paragraph summary of mapping findings}

**Blast Radius**: {low|medium|high}
**Risk Level**: {low|medium|high}
**Estimated Files**: {N}
**Estimated Modules**: {N}

---

## Impact Analysis
{from M1: impact-analyzer}

### Directly Affected Areas
- {list of files/modules}

### Dependency Chain
```
{visual dependency graph}
```

### Change Propagation
- {list of ripple effects}

---

## Entry Points
{from M2: entry-point-finder}

### Existing Entry Points
| Type | Path/Name | File | Relevance |
|------|-----------|------|-----------|
| API | /api/users | src/api/users.ts | High |

### Suggested New Entry Points
| Type | Path/Name | Rationale |
|------|-----------|-----------|
| API | /api/users/preferences | Feature requires new endpoint |

### Implementation Chain
```
{entry point → controller → service → repository}
```

---

## Risk Assessment
{from M3: risk-assessor}

### Overall Risk Score: {N}/100

### Coverage Gaps
| Module | Coverage | Risk |
|--------|----------|------|
| src/modules/auth | 45% | High |

### Complexity Hotspots
| File | Complexity | Risk |
|------|------------|------|
| src/services/order.ts | 28 | High |

### Technical Debt
| File | Markers | Count |
|------|---------|-------|
| src/utils/legacy.ts | TODO, FIXME | 5 |

### Recommendations
1. {recommendation}
2. {recommendation}

---

## Mapping Metadata

```json
{
  "mapping_completed_at": "{timestamp}",
  "sub_agents": ["M1", "M2", "M3"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "feature_keywords": ["auth", "user", "preferences"]
}
```
```

---

## Part 2: Tracing System (Fix Workflow)

### 2.1 Agents

#### T0: Tracing Orchestrator

**File**: `src/claude/agents/tracing/tracing-orchestrator.md`

```yaml
---
name: tracing-orchestrator
description: "Orchestrates Phase 00 Tracing for fix workflows. Launches parallel sub-agents to analyze symptoms, trace execution paths, and identify root causes. Consolidates results into trace-analysis.md for Phase 01."
model: opus
owned_skills:
  - TRACE-001  # tracing-delegation
  - TRACE-002  # trace-consolidation
  - TRACE-003  # hypothesis-ranking
---
```

**Responsibilities**:
1. Parse bug description to extract symptoms/errors
2. Launch T1, T2, T3 in parallel
3. Collect `report_section` from each sub-agent
4. Consolidate into `docs/requirements/{artifact-folder}/trace-analysis.md`
5. Update state.json with tracing completion status
6. Pass consolidated context to Phase 01

#### T1: Symptom Analyzer

**File**: `src/claude/agents/tracing/symptom-analyzer.md`

```yaml
---
name: symptom-analyzer
description: "Use this agent for Tracing Phase T1: Symptom Analysis. Analyzes error messages, log patterns, and user-reported symptoms to establish what is going wrong and under what conditions."
model: opus
owned_skills:
  - TRACE-101  # error-message-parsing
  - TRACE-102  # log-pattern-analysis
  - TRACE-103  # reproduction-step-extraction
  - TRACE-104  # condition-identification
---
```

**Responsibilities**:
1. Parse bug description for error messages/stack traces
2. Search codebase for error message origins
3. Analyze logs if provided
4. Extract reproduction steps
5. Identify triggering conditions
6. Return structured symptom report

**Output Format**:
```json
{
  "status": "success",
  "report_section": "## Symptom Analysis\n...",
  "symptoms": {
    "error_messages": [
      {"message": "TypeError: Cannot read property 'id' of undefined", "source": "src/services/user.ts:42"}
    ],
    "stack_trace_files": ["src/services/user.ts", "src/controllers/auth.ts"],
    "reproduction_steps": ["1. Login as admin", "2. Click preferences", "3. Error appears"],
    "triggering_conditions": ["Only occurs for admin users", "Only after session timeout"],
    "frequency": "intermittent",
    "severity": "high"
  }
}
```

#### T2: Execution Path Tracer

**File**: `src/claude/agents/tracing/execution-path-tracer.md`

```yaml
---
name: execution-path-tracer
description: "Use this agent for Tracing Phase T2: Execution Path Tracing. Follows the code execution from entry point through the call chain to where the bug manifests. Maps data flow and state changes."
model: opus
owned_skills:
  - TRACE-201  # call-chain-tracing
  - TRACE-202  # data-flow-analysis
  - TRACE-203  # state-mutation-tracking
  - TRACE-204  # async-flow-tracing
---
```

**Responsibilities**:
1. Read symptom analysis to identify starting points
2. Trace execution from entry point (API/UI/Job)
3. Follow call chain through services/repositories
4. Track data transformations along the path
5. Identify state mutations and side effects
6. Return structured execution path report

**Output Format**:
```json
{
  "status": "success",
  "report_section": "## Execution Path\n...",
  "execution_path": {
    "entry_point": {"type": "api", "path": "/api/users/preferences", "file": "src/api/users.ts:28"},
    "call_chain": [
      {"caller": "UserController.getPreferences", "callee": "UserService.getPreferences", "file": "src/services/user.ts:42"},
      {"caller": "UserService.getPreferences", "callee": "UserRepository.findById", "file": "src/repos/user.ts:15"}
    ],
    "data_flow": [
      {"step": 1, "variable": "userId", "value": "from request.params", "transformation": "none"},
      {"step": 2, "variable": "user", "value": "from database", "transformation": "null when not found"}
    ],
    "state_mutations": [
      {"location": "src/services/user.ts:45", "state": "session.lastAccess", "mutation": "updated"}
    ],
    "failure_point": {"file": "src/services/user.ts", "line": 42, "reason": "user is null, accessing user.id"}
  }
}
```

#### T3: Root Cause Identifier

**File**: `src/claude/agents/tracing/root-cause-identifier.md`

```yaml
---
name: root-cause-identifier
description: "Use this agent for Tracing Phase T3: Root Cause Identification. Synthesizes symptom and execution path analysis to identify the most likely root cause. Generates hypotheses ranked by evidence."
model: opus
owned_skills:
  - TRACE-301  # hypothesis-generation
  - TRACE-302  # evidence-correlation
  - TRACE-303  # similar-bug-search
  - TRACE-304  # fix-suggestion
---
```

**Responsibilities**:
1. Read symptom and execution path analyses
2. Generate hypotheses for root cause
3. Correlate evidence from symptoms and execution path
4. Search for similar past bugs (git history, comments)
5. Rank hypotheses by likelihood
6. Suggest potential fixes
7. Return structured root cause report

**Output Format**:
```json
{
  "status": "success",
  "report_section": "## Root Cause Analysis\n...",
  "root_cause": {
    "primary_hypothesis": {
      "description": "User lookup returns null for expired sessions, but code assumes user always exists",
      "confidence": "high",
      "evidence": ["Stack trace shows null access", "Only occurs after session timeout"],
      "location": {"file": "src/services/user.ts", "line": 42}
    },
    "alternative_hypotheses": [
      {
        "description": "Race condition in session refresh",
        "confidence": "medium",
        "evidence": ["Intermittent occurrence", "Async session handling"]
      }
    ],
    "similar_bugs": [
      {"commit": "abc123", "message": "Fix null user in order service", "similarity": "high"}
    ],
    "suggested_fixes": [
      {"approach": "Add null check before accessing user.id", "complexity": "low"},
      {"approach": "Refresh session before user lookup", "complexity": "medium"}
    ]
  }
}
```

### 2.2 Skills

#### Skill Category: TRACE (Tracing)

| Skill ID | Name | Owner | Description |
|----------|------|-------|-------------|
| TRACE-001 | tracing-delegation | tracing-orchestrator | Delegate to tracing sub-agents |
| TRACE-002 | trace-consolidation | tracing-orchestrator | Consolidate sub-agent reports |
| TRACE-003 | hypothesis-ranking | tracing-orchestrator | Rank root cause hypotheses |
| TRACE-101 | error-message-parsing | symptom-analyzer | Parse error messages and stack traces |
| TRACE-102 | log-pattern-analysis | symptom-analyzer | Analyze log patterns |
| TRACE-103 | reproduction-step-extraction | symptom-analyzer | Extract reproduction steps |
| TRACE-104 | condition-identification | symptom-analyzer | Identify triggering conditions |
| TRACE-201 | call-chain-tracing | execution-path-tracer | Trace function call chains |
| TRACE-202 | data-flow-analysis | execution-path-tracer | Analyze data flow through code |
| TRACE-203 | state-mutation-tracking | execution-path-tracer | Track state changes |
| TRACE-204 | async-flow-tracing | execution-path-tracer | Trace async execution paths |
| TRACE-301 | hypothesis-generation | root-cause-identifier | Generate root cause hypotheses |
| TRACE-302 | evidence-correlation | root-cause-identifier | Correlate evidence to hypotheses |
| TRACE-303 | similar-bug-search | root-cause-identifier | Search for similar past bugs |
| TRACE-304 | fix-suggestion | root-cause-identifier | Suggest potential fixes |

**Total**: 15 skills (3 orchestrator + 4 T1 + 4 T2 + 4 T3)

### 2.3 Output Artifact

**File**: `docs/requirements/{artifact-folder}/trace-analysis.md`

```markdown
# Trace Analysis: {Bug Description}

**Generated**: {timestamp}
**Bug**: {bug description}
**Workflow**: fix
**Phase**: 00-tracing

---

## Executive Summary

{1-paragraph summary of tracing findings}

**Root Cause Confidence**: {low|medium|high}
**Severity**: {low|medium|high|critical}
**Estimated Complexity**: {low|medium|high}

---

## Symptom Analysis
{from T1: symptom-analyzer}

### Error Messages
| Message | Source |
|---------|--------|
| TypeError: Cannot read property 'id' of undefined | src/services/user.ts:42 |

### Reproduction Steps
1. {step}
2. {step}
3. {step}

### Triggering Conditions
- {condition}
- {condition}

---

## Execution Path
{from T2: execution-path-tracer}

### Entry Point
- **Type**: API
- **Path**: /api/users/preferences
- **File**: src/api/users.ts:28

### Call Chain
```
UserController.getPreferences (src/controllers/user.ts:28)
    └── UserService.getPreferences (src/services/user.ts:42) ← FAILURE POINT
        └── UserRepository.findById (src/repos/user.ts:15)
```

### Data Flow
| Step | Variable | Source | Transformation |
|------|----------|--------|----------------|
| 1 | userId | request.params | none |
| 2 | user | database | null when not found |

### Failure Point
- **File**: src/services/user.ts
- **Line**: 42
- **Reason**: user is null, accessing user.id

---

## Root Cause Analysis
{from T3: root-cause-identifier}

### Primary Hypothesis (Confidence: HIGH)

**Description**: User lookup returns null for expired sessions, but code assumes user always exists

**Evidence**:
- Stack trace shows null access at line 42
- Bug only occurs after session timeout
- No null check before user.id access

**Location**: `src/services/user.ts:42`

### Alternative Hypotheses

| Hypothesis | Confidence | Evidence |
|------------|------------|----------|
| Race condition in session refresh | Medium | Intermittent occurrence, async handling |

### Similar Past Bugs
| Commit | Message | Similarity |
|--------|---------|------------|
| abc123 | Fix null user in order service | High |

### Suggested Fixes

| Approach | Complexity | Risk |
|----------|------------|------|
| Add null check before accessing user.id | Low | Low |
| Refresh session before user lookup | Medium | Medium |

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "{timestamp}",
  "sub_agents": ["T1", "T2", "T3"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["TypeError", "undefined", "user.id"]
}
```
```

---

## Part 3: Workflow Integration

### 3.1 Updated workflows.json

```json
{
  "workflows": {
    "feature": {
      "label": "New Feature",
      "command": "/sdlc feature",
      "description": "Implement a new feature end-to-end",
      "phases": [
        "00-mapping",
        "01-requirements",
        "02-architecture",
        "03-design",
        "04-test-strategy",
        "05-implementation",
        "10-local-testing",
        "06-testing",
        "09-cicd",
        "07-code-review"
      ],
      "gate_mode": "strict",
      "options": {
        "skip_mapping": {
          "description": "Skip mapping phase for small, well-understood changes",
          "default": false,
          "flag": "--skip-mapping"
        },
        "atdd_mode": {
          "description": "Enable ATDD with test.skip() scaffolds",
          "default": false,
          "flag": "--atdd"
        }
      },
      "agent_modifiers": {
        "00-mapping": {
          "parallel_agents": ["M1", "M2", "M3"],
          "output_artifact": "impact-analysis.md",
          "pass_to_next_phase": true
        },
        "01-requirements": {
          "scope": "feature",
          "artifact_prefix": "REQ",
          "read_mapping_context": true
        },
        "02-architecture": { "scope": "impact-assessment" }
      },
      "prerequisites": {
        "discover_completed": true,
        "artifacts_required": [
          "docs/project-discovery-report.md"
        ]
      },
      "requires_branch": true
    },

    "fix": {
      "label": "Bug Fix",
      "command": "/sdlc fix",
      "description": "Fix a bug or defect with TDD",
      "phases": [
        "00-tracing",
        "01-requirements",
        "04-test-strategy",
        "05-implementation",
        "10-local-testing",
        "06-testing",
        "09-cicd",
        "07-code-review"
      ],
      "gate_mode": "strict",
      "options": {
        "skip_tracing": {
          "description": "Skip tracing phase when root cause is already known",
          "default": false,
          "flag": "--skip-tracing"
        },
        "atdd_mode": {
          "description": "Enable ATDD with test.skip() scaffolds",
          "default": false,
          "flag": "--atdd"
        }
      },
      "agent_modifiers": {
        "00-tracing": {
          "parallel_agents": ["T1", "T2", "T3"],
          "output_artifact": "trace-analysis.md",
          "pass_to_next_phase": true
        },
        "01-requirements": {
          "scope": "bug-report",
          "artifact_prefix": "BUG",
          "require_external_id": true,
          "read_tracing_context": true
        },
        "05-implementation": {
          "require_failing_test_first": true
        }
      },
      "prerequisites": {
        "discover_completed": true,
        "artifacts_required": [
          "docs/project-discovery-report.md"
        ]
      },
      "requires_branch": true
    }
  }
}
```

### 3.2 State.json Updates

```json
{
  "phases": {
    "00-mapping": {
      "status": "completed",
      "sub_agents": {
        "M1-impact-analyzer": { "status": "completed", "duration_ms": 12500 },
        "M2-entry-point-finder": { "status": "completed", "duration_ms": 8200 },
        "M3-risk-assessor": { "status": "completed", "duration_ms": 9800 }
      },
      "output_artifact": "docs/requirements/REQ-0001-user-auth/impact-analysis.md",
      "completed_at": "2026-02-04T10:15:00Z"
    },
    "00-tracing": {
      "status": "completed",
      "sub_agents": {
        "T1-symptom-analyzer": { "status": "completed", "duration_ms": 7500 },
        "T2-execution-path-tracer": { "status": "completed", "duration_ms": 15200 },
        "T3-root-cause-identifier": { "status": "completed", "duration_ms": 11800 }
      },
      "output_artifact": "docs/requirements/BUG-0001-JIRA-1234/trace-analysis.md",
      "completed_at": "2026-02-04T10:15:00Z"
    }
  }
}
```

### 3.3 Gate Definitions

#### GATE-00-MAPPING

**File**: `src/isdlc/checklists/00-mapping-gate.md`

```markdown
# GATE-00: Mapping Validation

## Checklist

- [ ] All three sub-agents (M1, M2, M3) completed successfully
- [ ] impact-analysis.md generated in artifact folder
- [ ] Blast radius identified (low/medium/high)
- [ ] Entry points documented
- [ ] Risk assessment complete with recommendations
- [ ] No sub-agent errors or timeouts

## Pass Criteria

- All sub-agents returned `status: "success"`
- Output artifact exists and is valid markdown
- Impact summary includes `blast_radius` and `files_estimated`

## Failure Actions

- If any sub-agent fails: Retry once, then escalate
- If output artifact missing: Block advancement
```

#### GATE-00-TRACING

**File**: `src/isdlc/checklists/00-tracing-gate.md`

```markdown
# GATE-00: Tracing Validation

## Checklist

- [ ] All three sub-agents (T1, T2, T3) completed successfully
- [ ] trace-analysis.md generated in artifact folder
- [ ] At least one root cause hypothesis identified
- [ ] Execution path traced from entry to failure
- [ ] Suggested fixes provided

## Pass Criteria

- All sub-agents returned `status: "success"`
- Output artifact exists and is valid markdown
- Root cause has confidence level assigned
- At least one suggested fix provided

## Failure Actions

- If any sub-agent fails: Retry once, then escalate
- If no root cause identified: Mark as "needs investigation", allow manual override
```

---

## Part 4: Directory Structure

### 4.1 New Agent Files

```
src/claude/agents/
├── mapping/
│   ├── mapping-orchestrator.md      # M0
│   ├── impact-analyzer.md           # M1
│   ├── entry-point-finder.md        # M2
│   └── risk-assessor.md             # M3
└── tracing/
    ├── tracing-orchestrator.md      # T0
    ├── symptom-analyzer.md          # T1
    ├── execution-path-tracer.md     # T2
    └── root-cause-identifier.md     # T3
```

### 4.2 New Skill Files

```
src/claude/skills/
├── mapping/
│   ├── mapping-delegation/SKILL.md           # MAP-001
│   ├── impact-consolidation/SKILL.md         # MAP-002
│   ├── scope-estimation/SKILL.md             # MAP-003
│   ├── file-impact-detection/SKILL.md        # MAP-101
│   ├── module-dependency-mapping/SKILL.md    # MAP-102
│   ├── coupling-analysis/SKILL.md            # MAP-103
│   ├── change-propagation-estimation/SKILL.md # MAP-104
│   ├── api-endpoint-discovery/SKILL.md       # MAP-201
│   ├── ui-component-discovery/SKILL.md       # MAP-202
│   ├── job-handler-discovery/SKILL.md        # MAP-203
│   ├── event-listener-discovery/SKILL.md     # MAP-204
│   ├── complexity-scoring/SKILL.md           # MAP-301
│   ├── coverage-gap-detection/SKILL.md       # MAP-302
│   ├── technical-debt-identification/SKILL.md # MAP-303
│   └── risk-zone-mapping/SKILL.md            # MAP-304
└── tracing/
    ├── tracing-delegation/SKILL.md           # TRACE-001
    ├── trace-consolidation/SKILL.md          # TRACE-002
    ├── hypothesis-ranking/SKILL.md           # TRACE-003
    ├── error-message-parsing/SKILL.md        # TRACE-101
    ├── log-pattern-analysis/SKILL.md         # TRACE-102
    ├── reproduction-step-extraction/SKILL.md # TRACE-103
    ├── condition-identification/SKILL.md     # TRACE-104
    ├── call-chain-tracing/SKILL.md           # TRACE-201
    ├── data-flow-analysis/SKILL.md           # TRACE-202
    ├── state-mutation-tracking/SKILL.md      # TRACE-203
    ├── async-flow-tracing/SKILL.md           # TRACE-204
    ├── hypothesis-generation/SKILL.md        # TRACE-301
    ├── evidence-correlation/SKILL.md         # TRACE-302
    ├── similar-bug-search/SKILL.md           # TRACE-303
    └── fix-suggestion/SKILL.md               # TRACE-304
```

### 4.3 New Checklist Files

```
src/isdlc/checklists/
├── 00-mapping-gate.md
└── 00-tracing-gate.md
```

---

## Part 5: Integration with Phase 01

### 5.1 Requirements Analyst Updates

The Requirements Analyst (Agent 01) needs to be updated to:

1. **Check for exploration context**:
   ```markdown
   ## PRE-PHASE CHECK: Exploration Context

   Before starting requirements capture:

   1. Check workflow type in state.json
   2. If feature workflow: Look for `impact-analysis.md` in artifact folder
   3. If fix workflow: Look for `trace-analysis.md` in artifact folder
   4. Load exploration context to inform requirements gathering
   ```

2. **Use mapping context for features**:
   ```markdown
   When capturing feature requirements with mapping context:

   - Reference identified entry points when discussing scope
   - Highlight high-risk areas from risk assessment
   - Use blast radius to estimate NFRs
   - Include affected modules in stakeholder identification
   ```

3. **Use tracing context for fixes**:
   ```markdown
   When capturing bug requirements with tracing context:

   - Pre-populate reproduction steps from symptom analysis
   - Reference root cause hypothesis in bug description
   - Use execution path to identify affected components
   - Include suggested fixes in acceptance criteria discussion
   ```

---

## Part 6: Summary

### 6.1 New Components

| Category | Count | Items |
|----------|-------|-------|
| Agents | 8 | M0, M1, M2, M3, T0, T1, T2, T3 |
| Skills | 30 | 15 MAP-XXX + 15 TRACE-XXX |
| Checklists | 2 | 00-mapping-gate, 00-tracing-gate |
| Artifacts | 2 | impact-analysis.md, trace-analysis.md |

### 6.2 Framework Totals After Implementation

| Category | Before | After | Change |
|----------|--------|-------|--------|
| Agents | 28 | 36 | +8 |
| Skills | 170 | 200 | +30 |
| Phases | 14 + R1-R4 | 14 + R1-R4 + 00-M + 00-T | +2 |
| Gates | 14 | 16 | +2 |

### 6.3 Key Design Decisions

1. **Parallel sub-agents**: M1/M2/M3 and T1/T2/T3 run in parallel for context efficiency
2. **Orchestrator consolidation**: M0 and T0 consolidate outputs into single artifacts
3. **Phase 00 position**: Exploration runs BEFORE requirements (Phase 01)
4. **Skip flags**: `--skip-mapping` and `--skip-tracing` for known-scope changes
5. **Discovery prerequisite**: Both exploration modes require `/discover` first
6. **Artifact handoff**: Exploration artifacts stored in requirement folder, read by Phase 01

### 6.4 Implementation Order

1. Create agent markdown files (8 files)
2. Create skill SKILL.md files (30 files)
3. Create gate checklists (2 files)
4. Update workflows.json with new phases
5. Update 00-sdlc-orchestrator.md to handle Phase 00
6. Update 01-requirements-analyst.md to read exploration context
7. Update skills-manifest.yaml with new skills
8. Update README.md with new agent/skill counts
9. Test feature workflow with mapping
10. Test fix workflow with tracing

---

## Appendix A: Skill Detail Template

Each skill follows this structure:

```markdown
---
name: {skill-name}
description: {one-liner}
skill_id: {CATEGORY}-{NNN}
owner: {agent-name}
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: {context}
dependencies: [{dependency-skill-ids}]
---

# {Skill Name}

## Purpose
{1-2 sentences}

## When to Use
{specific contexts}

## Prerequisites
{what must exist}

## Process
{step-by-step}

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|

## Outputs
| Output | Type | Description |
|--------|------|-------------|

## Integration Points
{which skills/agents interact}

## Validation
{how to verify correctness}
```

---

## Appendix B: Agent Detail Template

Each agent follows this structure:

```markdown
---
name: {agent-name}
description: "{description with usage guidance}"
model: opus
owned_skills:
  - SKILL-001
  - SKILL-002
---

You are the **{Agent Name}**, responsible for **{Phase}: {Phase Name}**.

> **Monorepo Mode**: {monorepo handling instructions}

# ⚠️ MANDATORY ITERATION ENFORCEMENT
{iteration requirements}

# PHASE OVERVIEW
{phase context}

# ⚠️ PRE-PHASE CHECK
{prerequisites}

# CONSTITUTIONAL PRINCIPLES
{applicable articles}

# CORE RESPONSIBILITIES
{numbered list}

# SKILLS AVAILABLE
{table of owned skills}

# SKILL ENFORCEMENT PROTOCOL
{ownership validation}

# REQUIRED ARTIFACTS
{output list}

# PHASE GATE VALIDATION
{checklist}

# PROCESS
{detailed steps}

# OUTPUT STRUCTURE
{file locations}

# PROGRESS TRACKING (TASK LIST)
{TaskCreate/TaskUpdate pattern}

# ERROR HANDLING
{common errors}

# SELF-VALIDATION
{completion criteria}
```
