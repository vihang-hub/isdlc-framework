# Requirements Specification: GH-64 - Agents Ignore Injected Gate Requirements

**Round:** 1 Draft
**Status:** Draft
**Created:** 2026-02-20
**Scope:** Bug Fix
**External Reference:** GH-64

---

## 1. Project Overview

### 1.1 Problem Statement

Gate requirements injected into delegation prompts (REQ-0024) are systematically ignored by phase agents. The software-developer agent ran `git commit` during Phase 06 implementation despite the explicit Git Commit Prohibition in the gate requirements block. This undermines the framework's quality gates and creates unvalidated commits in version control.

### 1.2 Root Causes Identified

1. **Context Dilution** — Gate requirements block appears 8th of 11 sections in delegation prompt, buried after mission/context/task/workflow details
2. **Competing Instructions** — Constitutional Article VII "Artifact Traceability" implies committing ("Commits mark validated work"), contradicting gate prohibition
3. **Low Salience** — Plain text format lacks visual prominence; no unique delimiters distinguish it from surrounding prose
4. **No Feedback Loop** — Hook block messages don't reference gate requirements, so agents see no connection between prohibition and enforcement
5. **Fail-Open Design** — `gate-requirements-injector.cjs` returns empty string on failure instead of blocking delegation

### 1.3 Business Impact

- **Quality Risk**: Unvalidated code committed before code review and quality gates
- **Process Compliance**: Framework design principle (orchestrator manages git) violated
- **User Trust**: Silent failures erode confidence in automation guardrails

### 1.4 Success Criteria

- Zero git commit violations by agents during Phase 06 execution
- Gate requirements injection failures logged and escalated
- Hook block messages explicitly reference gate requirements
- Constitutional article clarified to remove commit implication

---

## 2. Stakeholders and Personas

**Primary Users:**
- **Framework Developer**: Maintains agent prompt engineering and hook system
- **Agent Designer**: Authors phase agent specifications and delegation logic

**Secondary Users:**
- **End User (Developer)**: Experiences framework behavior; benefits from reliable quality gates

---

## 3. Functional Requirements

### FR-001: Add PROHIBITED ACTIONS Section to Gate Requirements Block

**Priority:** Must Have
**Root Cause Addressed:** Low Salience (#3), Context Dilution (#1)

**Description:**
The gate requirements block must include a dedicated `⛔ PROHIBITED ACTIONS` section listing actions that are explicitly forbidden during the current phase. This section must appear first in the block and use high-visibility formatting.

**Acceptance Criteria:**

**AC-001-01:**
- **Given** the orchestrator delegates to a phase agent
- **When** `gate-requirements-injector.cjs` generates the requirements block
- **Then** the block contains a `⛔ PROHIBITED ACTIONS` section with bullet points for each prohibited action

**AC-001-02:**
- **Given** the current phase is `06-implementation`
- **When** gate requirements are injected
- **Then** the prohibited actions include "Do NOT run git add, git commit, or git push"

**AC-001-03:**
- **Given** the prohibited actions section exists
- **When** agents read the delegation prompt
- **Then** the section appears before any artifact requirements or validation checklists

---

### FR-002: Restructure Block Format with Visual Separators

**Priority:** Must Have
**Root Cause Addressed:** Low Salience (#3)

**Description:**
The gate requirements block must use unique visual separators (not reused elsewhere in the prompt) and enforce a maximum length of 30 lines to ensure agents can process it within attention limits.

**Acceptance Criteria:**

**AC-002-01:**
- **Given** the gate requirements block is generated
- **When** the block is formatted
- **Then** it uses `━━━ GATE REQUIREMENTS ━━━` as opening/closing delimiters (not `───` or `===` used elsewhere)

**AC-002-02:**
- **Given** the full gate requirements block
- **When** line count is measured
- **Then** the block contains no more than 30 lines (including delimiters)

**AC-002-03:**
- **Given** the block exceeds 30 lines due to many requirements
- **When** generation occurs
- **Then** requirements are prioritized (prohibited actions first, critical artifacts next) and truncated with "...see full checklist in [file]"

---

### FR-003: Move Gate Requirements Before Task Instructions

**Priority:** Must Have
**Root Cause Addressed:** Context Dilution (#1)

**Description:**
In the delegation prompt structure, the gate requirements block must be relocated to appear immediately after the WORKFLOW CONTEXT section and before the TASK section. This ensures agents read constraints before task details.

**Acceptance Criteria:**

**AC-003-01:**
- **Given** the orchestrator constructs a delegation prompt
- **When** sections are assembled in `isdlc.md` STEP 3d
- **Then** the gate requirements block appears in position 4 (after mission/context/workflow, before task/files/phase instructions)

**AC-003-02:**
- **Given** an agent receives the delegation prompt
- **When** the agent reads top-to-bottom
- **Then** gate requirements are encountered before the detailed task description

---

### FR-004: Add Inline Git Commit Prohibition to Agent Files

**Priority:** Must Have
**Root Cause Addressed:** Competing Instructions (#2)

**Description:**
Each agent file must contain an inline prohibition statement in its phase execution section, reinforcing the gate requirement directly in the agent's own instructions.

**Acceptance Criteria:**

**AC-004-01:**
- **Given** the `software-developer` agent file
- **When** the agent reads its own execution instructions
- **Then** the file contains "Do NOT run git add, git commit, or git push during phase work" in the main execution flow

**AC-004-02:**
- **Given** agent files are updated
- **When** the update is applied
- **Then** the prohibition appears in the CRITICAL EXECUTION RULES or equivalent section (before step-by-step instructions)

**AC-004-03:**
- **Given** the prohibition is added
- **When** agents reference the Git Commit Prohibition protocol
- **Then** the protocol exists in CLAUDE.md and is referenced via one-line pointer (not duplicated)

---

### FR-005: Clarify Constitutional Article VII

**Priority:** Must Have
**Root Cause Addressed:** Competing Instructions (#2)

**Description:**
Constitutional Article VII "Artifact Traceability" must be revised to remove language implying agents should commit code. The article should focus on ID assignment and traceability links, clarifying that commit management is an orchestrator responsibility.

**Acceptance Criteria:**

**AC-005-01:**
- **Given** Article VII is revised
- **When** the text is reviewed
- **Then** it no longer contains "Commits mark validated work" or similar phrasing suggesting agents commit

**AC-005-02:**
- **Given** the revised Article VII
- **When** agents read it
- **Then** the article explicitly states "Commit management is handled by the orchestrator at workflow finalization"

**AC-005-03:**
- **Given** Article VII discusses traceability
- **When** the article is complete
- **Then** it focuses on requirement IDs, artifact linking, and cross-phase traceability without mentioning git operations

---

### FR-006: Hook Block Messages Reference Gate Requirements

**Priority:** Should Have
**Root Cause Addressed:** No Feedback Loop (#4)

**Description:**
When the `branch-guard` hook blocks a git commit, its error message must explicitly reference the gate requirements that prohibit the action, creating a feedback loop between enforcement and specification.

**Acceptance Criteria:**

**AC-006-01:**
- **Given** an agent attempts `git commit` during Phase 06
- **When** the `branch-guard` hook blocks the action
- **Then** the `stderr` message includes "Violates gate requirement: Git Commit Prohibition"

**AC-006-02:**
- **Given** the error message is displayed
- **When** the agent reads it
- **Then** the message references the specific gate requirement ID or section name from the injected block

**AC-006-03:**
- **Given** multiple hooks may block actions
- **When** any hook blocks due to a gate requirement
- **Then** the message format follows "Blocked: [action]. Violates gate requirement: [name]."

---

### FR-007: Injection Audit Trail Logging

**Priority:** Should Have
**Root Cause Addressed:** Fail-Open Design (#5)

**Description:**
The `gate-requirements-injector.cjs` must log injection attempts, successes, and failures to `.isdlc/hook-activity.log` with structured metadata, enabling forensic analysis of gate requirement delivery.

**Acceptance Criteria:**

**AC-007-01:**
- **Given** the injector runs
- **When** it successfully generates a gate requirements block
- **Then** it logs `{ event: 'gate-requirements-injected', phase, requirementCount, timestamp }`

**AC-007-02:**
- **Given** the injector encounters an error (missing config, invalid phase)
- **When** the error occurs
- **Then** it logs `{ event: 'gate-requirements-injection-failed', phase, error, timestamp }` and returns empty string

**AC-007-03:**
- **Given** injection fails
- **When** the orchestrator proceeds with delegation
- **Then** the failure is logged to `pending_escalations` in state.json with reason "Gate requirements injection failed"

---

### FR-008: Config-Driven Prohibited Actions

**Priority:** Should Have
**Root Cause Addressed:** Maintainability (extensibility for future phases)

**Description:**
Prohibited actions must be defined in `iteration-requirements.json` per-phase configuration, allowing centralized management without modifying hook code. The git commit prohibition is the first use case.

**Acceptance Criteria:**

**AC-008-01:**
- **Given** `iteration-requirements.json` is extended
- **When** phase `06-implementation` is configured
- **Then** it contains `"prohibited_actions": ["git commit", "git push"]`

**AC-008-02:**
- **Given** the injector reads phase config
- **When** prohibited actions exist
- **Then** it renders them in the `⛔ PROHIBITED ACTIONS` section of the gate requirements block

**AC-008-03:**
- **Given** a phase has no prohibited actions in config
- **When** the injector runs for that phase
- **Then** the `⛔ PROHIBITED ACTIONS` section is omitted (not rendered as empty)

---

## 4. Non-Functional Requirements

See `nfr-matrix.md` for detailed NFR specifications.

---

## 5. Constraints

### CON-001: Backward Compatibility
Changes to delegation prompt structure must not break existing agent parsing logic. Agents must tolerate missing gate requirements blocks (fail-open for older configs).

### CON-002: Single-Line Bash Convention
Hook scripts must remain single-line Bash commands to match Claude Code permission glob patterns (see CLAUDE.md Single-Line Bash Convention).

### CON-003: Fail-Open Safety
Injection failures must not block workflow execution. The injector returns empty string on error, logs failure, and delegates without gate requirements.

---

## 6. Assumptions

1. Phase agents process delegation prompts sequentially top-to-bottom
2. Agents have sufficient context window to process 30-line gate requirements block
3. Hook stderr messages are visible to agents via Claude Code's tool result display
4. Constitutional articles are read by agents during phase initialization

---

## 7. Out of Scope

- **Enforcement of non-git prohibitions**: This fix focuses on git commit prohibition; other prohibitions are future work
- **LLM attention mechanism changes**: No changes to Claude's internal prompt processing
- **Retroactive fixes**: No changes to completed workflows or historical commits
- **Hook execution order changes**: Existing pre-task/post-bash dispatcher order unchanged

---

## 8. Glossary

- **Gate Requirements**: Phase-specific constraints and checklists injected into agent delegation prompts
- **Context Dilution**: Phenomenon where important instructions are buried in long prompts and ignored
- **Fail-Open**: System design where failures default to permissive behavior rather than blocking
- **Salience**: Visual and structural prominence of information in a prompt

---

## 9. Traceability Matrix

| Requirement ID | Linked User Stories | Root Cause | Priority |
|----------------|-------------------|------------|----------|
| FR-001 | US-001 | Low Salience (#3) | Must Have |
| FR-002 | US-002 | Low Salience (#3) | Must Have |
| FR-003 | US-003 | Context Dilution (#1) | Must Have |
| FR-004 | US-004 | Competing Instructions (#2) | Must Have |
| FR-005 | US-005 | Competing Instructions (#2) | Must Have |
| FR-006 | US-006 | No Feedback Loop (#4) | Should Have |
| FR-007 | US-007 | Fail-Open Design (#5) | Should Have |
| FR-008 | US-008 | Maintainability | Should Have |

---

## 10. Open Questions

None. All requirements are fully specified based on trace analysis (Phase 00) findings.

---

## 11. Approval

**Status:** Draft
**Next Steps:** Proceed to Phase 02 - Architecture & Blueprint after validation
