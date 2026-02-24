# /discover Command Enhancements — Requirements Specification

**Created**: 2026-02-07
**Status**: Draft
**Author**: iSDLC dogfooding session
**Scope**: 5 enhancements to the `/discover` command (2 absorbed into #2)

---

## Overview

The `/discover` command is the universal entry point for setting up a project with the iSDLC framework. These 5 enhancements address gaps identified during dogfooding — specifically, missing coverage of the agent orchestration layer, lack of guided post-discovery experience, context loss between discovery and workflows, a degraded mode that shouldn't exist, and presentation quality.

### Enhancement Summary

| ID | Title | Priority | Complexity | Dependencies |
|----|-------|----------|-----------|--------------|
| DE-001 | Extend behavior extraction to markdown files | High | Large | None |
| DE-002 | Post-discovery walkthrough | High | Large | DE-001 (catalog feeds into walkthrough) |
| DE-003 | Clean handover to /sdlc workflows | Medium | Medium | DE-002 (walkthrough triggers handover) |
| DE-004 | Remove --shallow option | Low | Small | None |
| DE-005 | Review /discover presentation and UX | Medium | Medium | DE-001 (new domain), DE-002 (walkthrough structure) |

### Absorbed Enhancements

| Original ID | Title | Absorbed Into |
|-------------|-------|---------------|
| (was #4) | Discovery permission audit | DE-002, Step 2.5 |
| (was #7) | Iteration awareness | DE-002, Step 3.5 |

---

## DE-001: Extend Behavior Extraction to Markdown Files

### Problem

The feature mapper (D6) only analyzes executable JavaScript files (`lib/*.js`, `src/claude/hooks/*.js`). The entire agent orchestration layer — 36 agents, 8 commands, 229 skills — is invisible to discovery. When `/discover` was run on iSDLC itself, it produced 87 AC across 7 domains but missed the framework's defining capability: its agent orchestration system.

### Requirements

#### REQ-DE001-01: Structured Agent Catalog (always produced)

The feature mapper (D6) MUST produce a structured catalog containing:
1. Complete inventory of all agents with their phase mapping, owned skills, and delegation targets
2. Complete inventory of all commands with their options, routing, and prerequisites
3. Complete inventory of all skills grouped by agent/category
4. Agent-to-agent delegation graph (who calls whom)
5. Command-to-agent routing map

**Output file**: `docs/architecture/agent-catalog.md`

#### REQ-DE001-02: Testable AC from Deterministic Markdown Behavior

The feature mapper (D6) MUST extract Given/When/Then acceptance criteria from markdown files where behavior is deterministic:

| Markdown Source | Extract AC? | Example |
|----------------|-------------|---------|
| Command routing (`/sdlc feature` → orchestrator → requirements-analyst) | Yes | Given user runs `/sdlc feature`, When orchestrator receives command, Then it delegates to requirements-analyst |
| Option handling (`--shallow` skips behavior extraction) | Yes | Given `--shallow` flag is set, When discover runs, Then steps 1b/1c/1d are skipped |
| Phase sequences (feature workflow: 01→02→03→05→10→06→09→07) | Yes | Given a feature workflow, When phase 01 completes, Then phase 02 starts |
| Gate requirements (GATE-05: unit coverage >= 80%) | Yes | Given implementation is complete, When GATE-05 is checked, Then unit coverage must be >= 80% |
| Agent YAML frontmatter (phase, owned_skills) | Yes | Given agent `software-developer`, When manifest is loaded, Then it maps to phase `06-implementation` |
| Skill descriptions (pure prompt text) | No | LLM instructions, not testable behavior |
| Agent prompt body (how to reason) | No | Prompt engineering, not deterministic logic |

#### REQ-DE001-03: New Domain 8 — Agent Orchestration & Command Routing

AC extracted from markdown MUST be organized into a new domain:

**Domain 8: Agent Orchestration & Command Routing**

Sub-categories:
1. Command definitions and routing (~8 commands × 3-5 AC each)
2. Workflow phase sequences (~6 workflow types × 2-3 AC each)
3. Agent-phase mapping (~36 agents × 1 AC each)
4. Gate requirement definitions (~16 gates × 1-2 AC each)
5. Delegation patterns (orchestrator → phase agents)

Estimated: ~60-80 additional AC on top of existing 87.

**Output file**: `docs/requirements/reverse-engineered/domain-08-agent-orchestration.md`

#### REQ-DE001-04: Files to Analyze

| Directory | File Pattern | Count | What to Extract |
|-----------|-------------|-------|----------------|
| `src/claude/commands/` | `*.md` | ~8 | Command options, routing, prerequisites |
| `src/claude/agents/sdlc/` | `00-sdlc-orchestrator.md` | 1 | Workflow definitions, phase sequences, delegation rules |
| `src/claude/agents/sdlc/` | `*-*.md` (phase agents) | ~13 | Phase mapping, gate checklists, skill usage |
| `src/claude/agents/discover/` | `*.md` | ~9 | Sub-agent coordination, parallel execution patterns |
| `src/claude/agents/tracing/` | `*.md` | ~4 | Sub-agent coordination |
| `src/claude/agents/impact-analysis/` | `*.md` | ~4 | Sub-agent coordination |
| `src/claude/hooks/config/` | `iteration-requirements.json` | 1 | Phase enablement, skip rules |
| `src/claude/hooks/config/` | `skills-manifest.json` | 1 | Agent-skill ownership |

#### REQ-DE001-05: Traceability Integration

New AC from Domain 8 MUST be added to `docs/isdlc/ac-traceability.csv` with source file references linking back to the specific markdown files.

### Implementation Notes

- Feature mapper (D6) needs a second analysis pass for markdown files
- Catalog generation is a new output type (not Given/When/Then)
- Index file (`docs/requirements/reverse-engineered/index.md`) must be updated with Domain 8

### Acceptance Criteria

```
AC-DE001-1: Given D6 runs on a project with agent markdown files,
  When analysis completes,
  Then an agent-catalog.md is produced with all agents, commands, skills, and their relationships.

AC-DE001-2: Given D6 analyzes command markdown files,
  When a command has deterministic routing (e.g., /sdlc feature → orchestrator → requirements-analyst),
  Then a Given/When/Then AC is extracted for each routing rule.

AC-DE001-3: Given D6 analyzes agent YAML frontmatter,
  When an agent has a phase mapping and owned_skills count,
  Then an AC is extracted verifying the agent-phase-skill relationship.

AC-DE001-4: Given D6 encounters pure prompt instructions (no deterministic behavior),
  When analyzing agent body text or skill descriptions,
  Then no AC is extracted for that content.

AC-DE001-5: Given D6 completes markdown analysis,
  When Domain 8 AC are generated,
  Then they are added to the index and traceability CSV with correct source file references.
```

---

## DE-002: Post-Discovery Walkthrough

### Problem

After `/discover` completes, it dumps a summary and exits. The user is left with 6-8 output files and no guided tour. During dogfooding, the user had to manually ask to walk through the constitution and architecture — these should be built-in steps.

### Requirements

#### REQ-DE002-01: Walkthrough Phase Added to Discover Orchestrator

After all discovery phases complete (analysis, behavior extraction, constitution generation, skill installation), the discover orchestrator (D0) MUST initiate an interactive walkthrough phase before finalizing.

#### REQ-DE002-02: Step 1 — Constitution Review (Mandatory)

The walkthrough MUST present each constitution article with a 1-line summary. After each article group (universal articles, then domain-specific articles), it MUST ask:
- "Any articles you'd like to modify, remove, or add to?"
- Options: [1] Looks good, continue  [2] I want to change something

If the user selects [2], collect changes and update `docs/isdlc/constitution.md` in-place.

This step MUST NOT be skippable — the user is committing to governance rules.

#### REQ-DE002-03: Step 2 — Architecture & Tech Stack Review (Opt-in)

Present the option:
- "Would you like to review the detected architecture and tech stack?"
- Options: [1] Yes, walk me through it  [2] Skip

If [1]: Present architecture layers, tech stack, data model summary. Highlight concerns (e.g., "No database detected", "3 frameworks detected — intentional?"). Allow user to correct misdetections.

#### REQ-DE002-04: Step 2.5 — Permission Audit (Opt-in)

**(Absorbs former Enhancement #4: Discovery Permission Audit)**

The walkthrough MUST:
1. Read `.claude/settings.json` current permissions
2. Compare against a tech-stack-to-permissions mapping for the detected stack
3. Present recommended additions and permissions to review

```
Current permissions: 8 allowed commands
Recommended additions for Node.js + TypeScript:
  + npm test           — Run test suite
  + npm run lint       — Run linter
  + npx tsc --noEmit   — Type-check without emitting

Permissions to review:
  ? npm install *      — Currently allows any package install (consider restricting)

[1] Apply recommended additions
[2] Let me review each one
[3] Skip — I'll manage permissions manually
```

#### REQ-DE002-05: Step 3 — Test Coverage Gaps (Opt-in)

Present the option:
- "Would you like to review the test coverage gaps?"
- Options: [1] Yes, show me the gaps  [2] Skip

If [1]: Present high-priority gaps with recommendations. Offer: "Want me to create a test plan for these gaps?"

#### REQ-DE002-06: Step 3.5 — Iteration Configuration (Opt-in)

**(Absorbs former Enhancement #7: Iteration Awareness)**

The walkthrough MUST explain iteration loops and allow configuration:

```
During feature development and bug fixes, iSDLC uses implement-test
loops. The agent writes code, runs tests, and iterates until all
tests pass.

Current settings:
  Max iterations (implementation):  5
  Max iterations (testing):         5
  Circuit breaker:                  3 identical failures → escalate
  Escalation behavior:              Pause and ask for human help

[1] Keep defaults (Recommended)
[2] Customize iteration limits
```

If [2]: Present each setting with its current value and allow adjustment.

Settings MUST be stored in `state.json` under `iteration_config`:
```json
{
  "iteration_config": {
    "implementation_max": 5,
    "testing_max": 5,
    "circuit_breaker_threshold": 3,
    "escalation_behavior": "pause",
    "configured_at": "2026-02-07T14:30:00Z"
  }
}
```

Hooks (`iteration-corridor.js`, `test-watcher.js`) MUST read from `state.json` with fallback to hardcoded defaults.

**There is NO separate `/sdlc configure iterations` command.** Iteration configuration exists only as part of the walkthrough.

#### REQ-DE002-07: Step 4 — Smart Next Steps (Mandatory)

The next steps menu MUST be context-aware:

**For existing projects, when test coverage is BELOW constitution thresholds:**

The menu MUST lead with test generation and include an explanation:

```
⚠ Test coverage gap detected:
  Current: ~20% unit coverage (constitution requires ≥80%)
  Missing: 6 critical paths have 0% coverage

Strong recommendation: Generate tests BEFORE starting new features.

[1] Generate tests for gaps (Recommended)  → /sdlc test generate
[2] Start a new feature                    → /sdlc feature
[3] Fix a bug                              → /sdlc fix
[4] I'm done for now
```

**For existing projects, when test coverage MEETS thresholds:**

```
Test coverage meets constitution thresholds ✓

[1] Start a new feature      → /sdlc feature
[2] Fix a bug                → /sdlc fix
[3] Generate more tests      → /sdlc test generate
[4] I'm done for now
```

**Constraint**: `/sdlc start` (Full lifecycle) MUST NOT be offered as a next step for existing projects. It is only appropriate after `/discover --new`.

**For new projects:**

```
[1] Start full lifecycle (Recommended)  → /sdlc start
[2] Start a new feature                 → /sdlc feature
[3] I'm done for now
```

### Acceptance Criteria

```
AC-DE002-1: Given discovery completes for an existing project,
  When the walkthrough begins,
  Then Step 1 (Constitution Review) is presented and cannot be skipped.

AC-DE002-2: Given the user is in Step 1,
  When they request a change to an article,
  Then constitution.md is updated in-place with the requested change.

AC-DE002-3: Given the detected tech stack is Node.js,
  When Step 2.5 (Permission Audit) is presented,
  Then recommended additions include npm/npx commands relevant to Node.js.

AC-DE002-4: Given iteration configuration is customized in Step 3.5,
  When settings are saved,
  Then state.json contains an iteration_config block with the user's values.

AC-DE002-5: Given test coverage is 20% (below the 80% threshold),
  When Step 4 (Next Steps) is presented,
  Then option [1] is "Generate tests for gaps (Recommended)".

AC-DE002-6: Given discovery was run on an existing project,
  When Step 4 is presented,
  Then "/sdlc start" (Full lifecycle) is NOT offered as an option.

AC-DE002-7: Given discovery was run on a new project,
  When Step 4 is presented,
  Then "/sdlc start" IS offered as option [1] (Recommended).
```

---

## DE-003: Clean Handover from /discover to /sdlc Workflows

### Problem

When `/discover` finishes and the user selects a next action (e.g., `/sdlc feature`), there is a context break. The SDLC orchestrator launches fresh and must re-read all discovery outputs from disk. This causes re-prompting, lost context, and wasted time as agents re-analyze what was already discovered.

### Requirements

#### REQ-DE003-01: Discovery Context Envelope

When `/discover` completes, the orchestrator MUST write a `discovery_context` block to `state.json`:

```json
{
  "discovery_context": {
    "completed_at": "2026-02-07T14:30:00Z",
    "version": "1.0",
    "tech_stack": {
      "primary_language": "javascript",
      "runtime": "node",
      "frameworks": ["express"],
      "test_runner": "node:test",
      "package_manager": "npm"
    },
    "coverage_summary": {
      "unit_test_pct": 20,
      "integration_test_pct": 0,
      "critical_path_coverage": 0,
      "total_tests": 24,
      "meets_constitution": false,
      "high_priority_gaps": 6
    },
    "architecture_summary": "6-layer CLI framework: bin → lib → hooks → config → agents → skills",
    "constitution_path": "docs/isdlc/constitution.md",
    "discovery_report_path": "docs/project-discovery-report.md",
    "re_artifacts": {
      "ac_count": 87,
      "domains": 7,
      "traceability_csv": "docs/isdlc/ac-traceability.csv"
    },
    "permissions_reviewed": true,
    "walkthrough_completed": true,
    "user_next_action": "test-generate"
  }
}
```

#### REQ-DE003-02: SDLC Orchestrator Reads Context Envelope

When any `/sdlc` workflow is initialized (`feature`, `fix`, `test generate`, `start`), the SDLC orchestrator MUST check for `discovery_context` in `state.json`. If present and `completed_at` is within 24 hours, it MUST inject the context into Phase 01/02/03/04 delegation prompts.

#### REQ-DE003-03: Phase Agent Context Injection

Phase agents MUST receive pre-filled context from the discovery envelope:
- **Phase 01 (Requirements)**: Architecture summary, tech stack, coverage status
- **Phase 02 (Architecture)**: "DO NOT REDESIGN" constraints, existing patterns to extend
- **Phase 03 (Design)**: Pattern constraints, consistency checks
- **Phase 04 (Test Strategy)**: Test runner, coverage gaps, AC traceability CSV path

This upgrades the existing PRE-PHASE CHECK mechanism from "scan for files" to "read structured envelope".

#### REQ-DE003-04: Staleness Check

If `discovery_context.completed_at` is more than 24 hours old, the orchestrator MUST warn: "Discovery was run N days ago. Re-run /discover to refresh?" The 24-hour threshold is a default; it is NOT user-configurable.

#### REQ-DE003-05: Graceful Degradation

If `discovery_context` is missing from state.json (discovery was never run), all workflows MUST proceed normally without error. The existing fail-open behavior is preserved.

### Acceptance Criteria

```
AC-DE003-1: Given discovery completes,
  When state.json is written,
  Then it contains a discovery_context block with tech_stack, coverage_summary, and artifact paths.

AC-DE003-2: Given discovery_context exists and is fresh (< 24 hours),
  When /sdlc feature is started,
  Then Phase 01 receives the tech stack and architecture summary without re-prompting.

AC-DE003-3: Given discovery_context is 3 days old,
  When /sdlc feature is started,
  Then the user sees a staleness warning suggesting re-running /discover.

AC-DE003-4: Given no discovery_context exists in state.json,
  When /sdlc feature is started,
  Then the workflow proceeds normally without error (fail-open).
```

---

## DE-004: Remove --shallow Option

### Problem

The `--shallow` flag allows users to skip behavior extraction (steps 1b/1c/1d) and get only the feature catalog. Discovery should always be thorough — a half-discovery creates an incomplete picture where the constitution is generated without knowing critical paths, the traceability matrix is missing, and the walkthrough cannot recommend tests for gaps it doesn't know about.

### Requirements

#### REQ-DE004-01: Remove --shallow from Command Definition

Remove `--shallow` from the options table, examples, and "What It Does" section in `src/claude/commands/discover.md`.

#### REQ-DE004-02: Remove --shallow Logic from Discover Orchestrator

Remove conditional logic around `--shallow` in `src/claude/agents/discover/D0-discover-orchestrator.md`. Steps 1b (Characterization Tests), 1c (Artifact Integration), and 1d (ATDD Bridge — still gated by `--atdd-ready`) MUST always run.

#### REQ-DE004-03: Remove --shallow Mode from Feature Mapper

Remove "shallow mode" behavior from `src/claude/agents/discover/D6-feature-mapper.md`. D6 MUST always extract Given/When/Then AC.

#### REQ-DE004-04: Remove Documentation References

Remove "(unless `--shallow`)" notes from `docs/requirements/reverse-engineered/index.md` and any other documentation.

### Risk Assessment

**Low risk.** The `--shallow` flag has only existed since 2026-02-06 (1 day). No external users depend on it.

### Acceptance Criteria

```
AC-DE004-1: Given the discover command definition,
  When a user reads the options table,
  Then --shallow is not listed.

AC-DE004-2: Given /discover is run without --shallow,
  When analysis completes,
  Then behavior extraction (steps 1b/1c) runs automatically.

AC-DE004-3: Given the discover orchestrator agent definition,
  When it is parsed,
  Then no conditional logic references --shallow or shallow mode.
```

---

## DE-005: Review /discover Presentation and UX

### Problem

The current `/discover` output is functional but not well-structured for user consumption:
1. Wall of text — large blocks without visual hierarchy
2. No progress indicators during parallel analysis
3. Feature extraction quality inconsistencies (too generic or too implementation-specific)
4. Report reads like a technical audit, not an actionable summary

### Requirements

#### REQ-DE005-01: Live Progress During Analysis

During the parallel analysis phase (D1, D2, D5, D6 running simultaneously), the orchestrator MUST show incremental progress:

```
Phase 1: Parallel Analysis
  ✓ Architecture & Tech Stack    — 6 layers, Node.js + ES Modules
  ✓ Data Model                   — No database detected (JSON file state)
  ◐ Functional Features          — Scanning 17 source files...
  ◐ Test Coverage                — Evaluating 555 tests...
```

Each agent reports a 1-line summary as it completes.

#### REQ-DE005-02: Structured Summary Presentation

After analysis completes, findings MUST be presented in a scannable format:

```
═══════════════════════════════════════════════════════════════
  DISCOVERY SUMMARY
═══════════════════════════════════════════════════════════════

  Tech Stack          Node.js 18+ | ES Modules + CommonJS hooks
  Architecture        6-layer CLI framework
  Data Model          File-based state (JSON) — no database
  Source Files        17 production files, 12,895 lines
  Test Coverage       555 tests — ~80% unit coverage

═══════════════════════════════════════════════════════════════
  BEHAVIOR EXTRACTION
═══════════════════════════════════════════════════════════════

  Total AC            87 across 7 domains
  Coverage            58 covered (66.7%) | 9 partial | 20 uncovered

  Top gaps:
  1. Workflow Orchestration — 5 critical AC uncovered
  2. Installation Lifecycle — 3 high AC partially covered
  3. Provider Routing       — 2 critical AC uncovered

═══════════════════════════════════════════════════════════════
  RECOMMENDATIONS
═══════════════════════════════════════════════════════════════

  1. Address 6 high-priority test coverage gaps
  2. Add integration tests for installer/updater
  3. Document provider routing failover behavior

  Full report: docs/project-discovery-report.md
```

#### REQ-DE005-03: Feature Extraction Quality Guidelines

The feature mapper (D6) MUST follow these quality rules:

1. Every AC MUST have a specific input condition (not "a user" — specify what input or state)
2. Every AC MUST have a verifiable output (not "it works" — specify what is returned, written, or changed)
3. Error paths MUST be extracted alongside happy paths (catch blocks, error returns, fallback behavior)
4. Priority MUST follow criticality hierarchy:
   - **Critical**: Hook enforcement logic (gate-blocker, iteration-corridor, constitution-validator)
   - **High**: Installer, updater, uninstaller, provider routing
   - **Medium**: Utility functions, detection logic, logging

#### REQ-DE005-04: Improved Report Structure

The discovery report (`docs/project-discovery-report.md`) MUST have:
1. **Executive Summary** (5 lines max) — what was found, top concerns
2. **Architecture Overview** — table/visual format, not prose paragraphs
3. **Test Health** — dashboard-style metrics
4. **Action Items** — numbered, prioritized, with effort estimates (S/M/L)
5. **Detailed Findings** — organized by domain

### Acceptance Criteria

```
AC-DE005-1: Given 4 parallel analysis agents are running,
  When one completes,
  Then its 1-line summary is displayed immediately (before others finish).

AC-DE005-2: Given all analysis is complete,
  When the summary is presented,
  Then it uses a structured table/dashboard format (not prose paragraphs).

AC-DE005-3: Given D6 extracts an AC,
  When the AC has a generic input ("a user"),
  Then D6 rewrites it with a specific input condition.

AC-DE005-4: Given the discovery report is generated,
  When a user reads it,
  Then it starts with a ≤5-line executive summary.

AC-DE005-5: Given AC are prioritized,
  When an AC covers hook enforcement logic,
  Then it is classified as Critical.
```

---

## Implementation Order

The recommended implementation sequence accounts for dependencies:

```
DE-004 (Remove --shallow)     ← Quick win, no dependencies
    ↓
DE-001 (MD extraction)        ← Foundation for catalog + new domain
    ↓
DE-005 (Presentation & UX)    ← Improves how DE-001 output is displayed
    ↓
DE-002 (Post-discovery walkthrough) ← Builds on all above outputs
    ↓
DE-003 (Clean handover)       ← Uses walkthrough's user selection to trigger handover
```

---

## Appendix: Files Impacted

| File | Enhancements |
|------|-------------|
| `src/claude/commands/discover.md` | DE-004 (remove --shallow), DE-002 (walkthrough docs) |
| `src/claude/agents/discover/D0-discover-orchestrator.md` | DE-001, DE-002, DE-003, DE-004, DE-005 |
| `src/claude/agents/discover/D6-feature-mapper.md` | DE-001 (MD analysis), DE-004 (remove shallow), DE-005 (quality rules) |
| `src/claude/agents/sdlc/00-sdlc-orchestrator.md` | DE-003 (read context envelope) |
| `.isdlc/state.json` schema | DE-002 (iteration_config), DE-003 (discovery_context) |
| `src/claude/hooks/iteration-corridor.js` | DE-002 (read iteration_config from state) |
| `src/claude/hooks/test-watcher.js` | DE-002 (read iteration_config from state) |
| `docs/requirements/reverse-engineered/index.md` | DE-001 (add Domain 8), DE-004 (remove shallow notes) |
| `docs/project-discovery-report.md` | DE-005 (new structure) |
