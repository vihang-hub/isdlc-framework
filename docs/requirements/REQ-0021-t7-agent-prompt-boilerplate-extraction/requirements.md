# Requirements Specification: T7 Agent Prompt Boilerplate Extraction

**Requirement ID**: REQ-0021
**Feature**: T7 - Agent Prompt Boilerplate Extraction
**Status**: Draft
**Created**: 2026-02-16
**Backlog Item**: 2.3 (Performance category)

---

## 1. Project Overview

### 1.1 Problem Statement

Multiple iSDLC agent prompt files contain identical boilerplate sections that are duplicated verbatim across many agents. This duplication inflates agent prompt token counts, increasing context window consumption and slowing agent delegation by approximately 2-3% per invocation. Since CLAUDE.md is automatically included in every agent's context by Claude Code, moving shared sections there eliminates duplication without losing access.

### 1.2 Business Drivers

- **Performance**: Each duplicated line consumes tokens in the agent context window. Removing ~250+ lines of duplication across agents reduces per-delegation token overhead.
- **Maintainability**: A change to any shared protocol currently requires updating up to 26 files. A single source of truth in CLAUDE.md reduces maintenance burden to 1 file.
- **Consistency**: Duplication risks drift over time. Centralizing ensures all agents inherit identical protocols.
- **Precedent**: T2 already successfully extracted SKILL OBSERVABILITY, SUGGESTED PROMPTS, and CONSTITUTIONAL PRINCIPLES protocols to CLAUDE.md, establishing the pattern.

### 1.3 Success Metrics

- SM-001: Zero behavioral regression across all affected agents after extraction.
- SM-002: Total duplicated lines removed from agent files >= 250 lines.
- SM-003: All shared protocols exist in exactly one location (CLAUDE.md).
- SM-004: No agent file contains a full copy of any extracted section post-refactor.

### 1.4 Scope

**In Scope:**
- Extract 4 boilerplate categories to CLAUDE.md
- Replace inline content in agent files with 1-line references
- Validate no behavioral regression

**Out of Scope:**
- PRE-PHASE CHECK sections (agent-specific content, not identical across agents)
- Agent-specific iteration thresholds or success criteria customization
- Changes to hooks, skills, or CLI
- Changes to state.json schema
- Any new functionality

### 1.5 Constraints

- CON-001: CLAUDE.md is loaded into every agent context automatically by Claude Code. Added sections increase baseline context for ALL agents, including those that do not use the protocol. Sections must be kept concise.
- CON-002: Agent files in `src/claude/agents/` are the source of truth. Changes must be synced to `.claude/agents/` at deploy time (existing convention).
- CON-003: No functional behavior change is permitted. This is a pure refactoring task.

---

## 2. Stakeholders and Personas

### Persona 1: Framework Developer (Primary)

- **Role**: Developer maintaining the iSDLC agent prompt files
- **Goal**: Reduce maintenance overhead when updating shared protocols
- **Pain Point**: Must update up to 26 files for a single protocol change; risk of inconsistency

### Persona 2: Agent Runtime (System)

- **Role**: The Claude Code runtime that loads CLAUDE.md + agent file into context
- **Goal**: Minimize total token consumption per agent delegation
- **Pain Point**: Identical text loaded multiple times (once in each agent file, even though CLAUDE.md is always present)

---

## 3. Duplication Analysis (Verified)

The following table reflects verified codebase counts from grep analysis (updated from quick-scan estimates):

| Section | Variant | Agent Count | Lines/Agent | Total Duplicated |
|---------|---------|-------------|-------------|------------------|
| Monorepo Mode Blockquote (long form) | "all file paths are project-scoped. The orchestrator provides..." | 17 | 1 (wrapped) | 17 instances |
| Monorepo Mode Blockquote (short form) | "scope your analysis to the project path..." | 7 | 1 (wrapped) | 7 instances |
| Monorepo Mode Blockquote (orchestrator-specific) | "all file paths are project-scoped. Read state from..." | 2 | 1 (wrapped) | 2 instances |
| Mandatory Iteration Enforcement | Full section with rules 1-4, test-watcher reference | 7 | 8-12 | ~70 lines |
| Git Commit Warning | "Do NOT run git add, git commit..." | 2 | 5-6 | ~11 lines |
| ROOT RESOLUTION + MONOREPO CONTEXT | Full resolution algorithm + path routing table + delegation context | 2 | ~65 | ~130 lines |
| **TOTAL** | | **26 unique agents** | | **~255+ lines** |

### 3.1 Monorepo Blockquote Variants

**Variant A (17 agents)** - Full orchestrator delegation form:
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. The orchestrator provides project context (project ID, state file path, docs base path) in the delegation prompt. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.
```

**Variant B (7 agents)** - Short analysis-scoped form:
```
> **Monorepo Mode**: In monorepo mode, scope your analysis to the project path provided in the delegation context.
```

**Variant C (2 agents)** - Orchestrator-specific (quick-scan-agent, impact-analysis-orchestrator):
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. Read state from the project-specific state.json and write artifacts to the project-scoped docs directory.
```
or:
```
> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped. The orchestrator provides project context in the delegation prompt. Read state from the project-specific state.json.
```

### 3.2 Iteration Enforcement Variants

While all 7 agents share the same structural pattern, the first line and specific completion criteria differ slightly per agent:

| Agent | First Line | Max Iterations |
|-------|-----------|----------------|
| 05-software-developer | "ALL UNIT TESTS PASS WITH >=80% COVERAGE" | 10 |
| 06-integration-tester | "ALL TESTS PASS" | 10 |
| 14-upgrade-engineer | "ALL regression tests pass or iteration limit reached" | 10 |
| 16-quality-loop-engineer | "iterate until BOTH tracks pass" | (not specified) |
| discover/characterization-test-generator | "ALL CHARACTERIZATION TESTS ARE GENERATED AND VALIDATED" | 10 |
| discover/artifact-integration | "ALL ARTIFACTS ARE PROPERLY LINKED AND TRACEABLE" | 5 |
| discover/atdd-bridge | "ATDD ARTIFACTS ARE PROPERLY GENERATED" | 5 |

**Design Decision**: Because the iteration enforcement sections have agent-specific completion criteria and max iteration counts, the shared section in CLAUDE.md will contain the common structural protocol (rules 1-4, test-watcher reference), and each agent will retain a 1-line customization specifying its own success criteria and max iterations. This preserves agent-specific behavior while eliminating the structural duplication.

### 3.3 Git Commit Warning

Both instances (05-software-developer, 16-quality-loop-engineer) are functionally identical. The software-developer version mentions "Phase 16 (quality-loop) and Phase 08 (code-review)"; the quality-loop version mentions "Phase 08 (code-review)". These are semantically equivalent (both say "don't commit until review is done") and can be unified.

---

## 4. Functional Requirements

### FR-001: Extract Monorepo Mode Protocol to CLAUDE.md

**Description**: Add a "Monorepo Mode" section to CLAUDE.md under "Agent Framework Context" that contains the shared monorepo guidance. Define both the full delegation variant and the short analysis-scoped variant so agents can reference the appropriate one.

**Acceptance Criteria**:

- AC-001-01: Given CLAUDE.md exists with the "Agent Framework Context" section, when this requirement is implemented, then a new subsection titled "Monorepo Mode Protocol" exists under "Agent Framework Context".
- AC-001-02: Given the new Monorepo Mode Protocol section exists, when an agent reads CLAUDE.md, then it contains the full delegation-form guidance ("all file paths are project-scoped, orchestrator provides project context...").
- AC-001-03: Given the new Monorepo Mode Protocol section exists, when an analysis sub-agent reads CLAUDE.md, then it contains the short analysis-scoped guidance ("scope your analysis to the project path...").

### FR-002: Remove Monorepo Blockquote from Phase Agents

**Description**: Remove the inline `> **Monorepo Mode**:` blockquote from all 17 phase agents that have the full delegation variant. Replace with a 1-line reference: `> See **Monorepo Mode Protocol** in CLAUDE.md.`

**Affected Files** (17):
- `02-solution-architect.md`, `03-system-designer.md`, `04-test-design-engineer.md`
- `05-software-developer.md`, `06-integration-tester.md`, `07-qa-engineer.md`
- `08-security-compliance-auditor.md`, `09-cicd-engineer.md`, `10-dev-environment-engineer.md`
- `11-deployment-engineer-staging.md`, `12-release-manager.md`, `13-site-reliability-engineer.md`
- `14-upgrade-engineer.md`
- `discover/characterization-test-generator.md`, `discover/artifact-integration.md`, `discover/atdd-bridge.md`
- `tracing/tracing-orchestrator.md`

**Acceptance Criteria**:

- AC-002-01: Given any of the 17 affected agent files, when the file is read after refactoring, then it does NOT contain the full monorepo blockquote text "all file paths are project-scoped. The orchestrator provides project context (project ID, state file path, docs base path)".
- AC-002-02: Given any of the 17 affected agent files, when the file is read after refactoring, then it contains a 1-line reference to the CLAUDE.md protocol.

### FR-003: Remove Monorepo Blockquote from Analysis Sub-Agents

**Description**: Remove the inline `> **Monorepo Mode**:` blockquote from all 7 analysis sub-agents that have the short variant. Replace with a 1-line reference.

**Affected Files** (7):
- `tracing/execution-path-tracer.md`, `tracing/root-cause-identifier.md`, `tracing/symptom-analyzer.md`
- `impact-analysis/impact-analyzer.md`, `impact-analysis/entry-point-finder.md`
- `impact-analysis/cross-validation-verifier.md`, `impact-analysis/risk-assessor.md`

**Acceptance Criteria**:

- AC-003-01: Given any of the 7 affected analysis sub-agent files, when the file is read after refactoring, then it does NOT contain "scope your analysis to the project path provided in the delegation context".
- AC-003-02: Given any of the 7 affected analysis sub-agent files, when the file is read after refactoring, then it contains a 1-line reference to the CLAUDE.md protocol.

### FR-004: Remove Monorepo Blockquote from Remaining Agents

**Description**: Remove the inline `> **Monorepo Mode**:` blockquote from the 2 agents with unique wording (quick-scan-agent, impact-analysis-orchestrator). Replace with a 1-line reference.

**Affected Files** (2):
- `quick-scan/quick-scan-agent.md`
- `impact-analysis/impact-analysis-orchestrator.md`

**Acceptance Criteria**:

- AC-004-01: Given either of the 2 affected agent files, when the file is read after refactoring, then it does NOT contain an inline monorepo blockquote.
- AC-004-02: Given either of the 2 affected agent files, when the file is read after refactoring, then it contains a 1-line reference to the CLAUDE.md protocol.

### FR-005: Extract Iteration Enforcement Protocol to CLAUDE.md

**Description**: Add a "Mandatory Iteration Enforcement" section to CLAUDE.md under "Agent Framework Context" that contains the common structural protocol: the iterate-until-pass loop, test-watcher hook reference, and the prohibition on declaring completion while tests fail. The section must be parameterized so agents specify their own success criteria via a 1-line agent-side annotation.

**Acceptance Criteria**:

- AC-005-01: Given CLAUDE.md exists, when this requirement is implemented, then a new subsection titled "Mandatory Iteration Enforcement Protocol" exists under "Agent Framework Context".
- AC-005-02: Given the new section exists, when it is read, then it contains: (a) the iterate-fix-retry loop structure, (b) reference to the test-watcher hook, (c) the rule against declaring completion while tests fail, (d) instruction that agents specify their own success criteria and max iteration count.
- AC-005-03: Given the new section exists, when it is read, then it does NOT contain any agent-specific success criteria (no "80% coverage", no "both tracks pass", etc.).

### FR-006: Replace Iteration Enforcement in Agent Files with Reference + Customization

**Description**: In each of the 7 agents that currently contain a MANDATORY ITERATION ENFORCEMENT section, replace the full section with: (a) a 1-line reference to the CLAUDE.md protocol, and (b) a 1-2 line agent-specific customization stating the success criteria and max iterations for that agent.

**Affected Files** (7):
- `05-software-developer.md`
- `06-integration-tester.md`
- `14-upgrade-engineer.md`
- `16-quality-loop-engineer.md`
- `discover/characterization-test-generator.md`
- `discover/artifact-integration.md`
- `discover/atdd-bridge.md`

**Acceptance Criteria**:

- AC-006-01: Given any of the 7 affected agent files, when the file is read after refactoring, then it does NOT contain the full iteration enforcement rules (rules 1-4 and test-watcher paragraph).
- AC-006-02: Given any of the 7 affected agent files, when the file is read after refactoring, then it contains a reference to the CLAUDE.md iteration enforcement protocol.
- AC-006-03: Given any of the 7 affected agent files, when the file is read after refactoring, then it retains agent-specific success criteria (e.g., ">=80% coverage" for software-developer, "BOTH tracks pass" for quality-loop-engineer).
- AC-006-04: Given the 05-software-developer agent, when it is delegated to, then it still enforces "ALL UNIT TESTS PASS WITH >=80% COVERAGE" with max iterations of 10.
- AC-006-05: Given the discover/artifact-integration agent, when it is delegated to, then it still enforces max iterations of 5 (not the default 10).

### FR-007: Extract Git Commit Warning to CLAUDE.md

**Description**: Add a "Git Commit Prohibition" section to CLAUDE.md under "Agent Framework Context" that contains the shared warning against running git add/commit/push during phase work. The section explains that the orchestrator handles all git operations at workflow finalize.

**Acceptance Criteria**:

- AC-007-01: Given CLAUDE.md exists, when this requirement is implemented, then a new subsection titled "Git Commit Prohibition" exists under "Agent Framework Context".
- AC-007-02: Given the new section exists, when it is read, then it contains: (a) the prohibition against git add/commit/push, (b) the rationale that commits represent validated work, (c) the statement that the orchestrator manages git operations.

### FR-008: Remove Git Commit Warning from Agent Files

**Description**: Replace the full git commit warning sections in 05-software-developer.md and 16-quality-loop-engineer.md with 1-line references to the CLAUDE.md protocol.

**Affected Files** (2):
- `05-software-developer.md`
- `16-quality-loop-engineer.md`

**Acceptance Criteria**:

- AC-008-01: Given either of the 2 affected agent files, when the file is read after refactoring, then it does NOT contain the full "CRITICAL: Do NOT Run Git Commits" section with the rationale paragraph.
- AC-008-02: Given either of the 2 affected agent files, when the file is read after refactoring, then it contains a 1-line reference to the CLAUDE.md git commit prohibition.

### FR-009: Extract ROOT RESOLUTION Protocol to CLAUDE.md

**Description**: Add a "Root Resolution" section to CLAUDE.md (as a top-level section under "Agent Framework Context") that contains the 5-step root resolution algorithm currently duplicated in both orchestrator agents.

**Acceptance Criteria**:

- AC-009-01: Given CLAUDE.md exists, when this requirement is implemented, then a new subsection titled "Root Resolution Protocol" exists under "Agent Framework Context".
- AC-009-02: Given the new section exists, when it is read, then it contains all 5 steps of the root resolution algorithm (check CWD, walk parents, set project root, record CWD-relative path, report if not found).

### FR-010: Extract MONOREPO CONTEXT RESOLUTION to CLAUDE.md

**Description**: Add a "Project Context Resolution (Monorepo)" section to CLAUDE.md under "Agent Framework Context" that contains the full monorepo detection, project resolution, path routing, delegation context, and workflow independence content currently duplicated in both orchestrator agents.

**Acceptance Criteria**:

- AC-010-01: Given CLAUDE.md exists, when this requirement is implemented, then a new subsection titled "Project Context Resolution (Monorepo)" exists under "Agent Framework Context".
- AC-010-02: Given the new section exists, when it is read, then it contains: (a) monorepo detection logic, (b) project resolution priority order, (c) path routing table, (d) delegation context template, (e) workflow independence rules.

### FR-011: Remove ROOT RESOLUTION and MONOREPO CONTEXT from Orchestrator Agents

**Description**: Replace the full ROOT RESOLUTION and SECTION 0: PROJECT CONTEXT RESOLUTION sections in both orchestrator agents with 1-line references to CLAUDE.md.

**Affected Files** (2):
- `00-sdlc-orchestrator.md`
- `discover-orchestrator.md`

**Acceptance Criteria**:

- AC-011-01: Given 00-sdlc-orchestrator.md, when the file is read after refactoring, then it does NOT contain the "ROOT RESOLUTION (Before anything else)" section with the 5-step algorithm inline.
- AC-011-02: Given 00-sdlc-orchestrator.md, when the file is read after refactoring, then it does NOT contain the "SECTION 0: PROJECT CONTEXT RESOLUTION (MONOREPO)" section with the path routing table inline.
- AC-011-03: Given discover-orchestrator.md, when the file is read after refactoring, then it does NOT contain the "ROOT RESOLUTION (Before anything else)" section with the 5-step algorithm inline.
- AC-011-04: Given discover-orchestrator.md, when the file is read after refactoring, then it does NOT contain the "MONOREPO PREAMBLE" section with the full resolution algorithm inline.
- AC-011-05: Given either orchestrator agent, when the file is read after refactoring, then it contains references to the Root Resolution Protocol and Project Context Resolution sections in CLAUDE.md.

### FR-012: Preserve CLAUDE.md Section Organization

**Description**: All new sections added to CLAUDE.md must be organized under the existing "Agent Framework Context" heading, following the pattern established by T2 (SKILL OBSERVABILITY, SUGGESTED PROMPTS, CONSTITUTIONAL PRINCIPLES). New subsection order should be: existing sections first, then new sections grouped logically.

**Acceptance Criteria**:

- AC-012-01: Given CLAUDE.md after refactoring, when the "Agent Framework Context" section is read, then the following subsections exist in this order: (a) SKILL OBSERVABILITY Protocol, (b) SUGGESTED PROMPTS, (c) CONSTITUTIONAL PRINCIPLES Preamble, (d) Root Resolution Protocol, (e) Project Context Resolution (Monorepo), (f) Monorepo Mode Protocol, (g) Mandatory Iteration Enforcement Protocol, (h) Git Commit Prohibition.
- AC-012-02: Given CLAUDE.md after refactoring, when the total line count is compared to pre-refactor, then the increase is no more than 120 lines (accounting for the extracted content minus formatting consolidation).

---

## 5. Non-Functional Requirements

### NFR-001: Token Reduction

| Attribute | Value |
|-----------|-------|
| **Category** | Performance |
| **Requirement** | Net token reduction across all affected agent delegations |
| **Metric** | Each affected agent file must be shorter by at least the number of removed lines minus the 1-line reference replacement. CLAUDE.md grows by no more than 120 lines. Net savings: for agents with monorepo blockquote only, ~2 lines saved per agent (3 removed, 1 added). For agents with iteration + monorepo + git, ~18 lines saved. |
| **Measurement** | `wc -l` on each affected file before vs after. Sum of all agent reductions minus CLAUDE.md increase must be positive (net reduction >= 130 lines). |
| **Priority** | Must Have |

### NFR-002: Zero Behavioral Regression

| Attribute | Value |
|-----------|-------|
| **Category** | Reliability |
| **Requirement** | No agent behavior changes after extraction |
| **Metric** | All content available to each agent via CLAUDE.md inheritance is semantically identical to what was previously inline. Agent-specific customizations (iteration success criteria, max iteration counts) are preserved. |
| **Measurement** | Manual side-by-side comparison of pre/post content available to each agent. Automated grep verification that no extracted content remains inline. |
| **Priority** | Must Have |

### NFR-003: Single Source of Truth

| Attribute | Value |
|-----------|-------|
| **Category** | Maintainability |
| **Requirement** | Each extracted protocol exists in exactly one authoritative location |
| **Metric** | grep for key phrases of each protocol returns exactly 1 match (in CLAUDE.md) plus 0 full copies in agent files. Agent files may contain 1-line references only. |
| **Measurement** | `grep -r "pattern" src/claude/agents/` returns 0 full-content matches for each extracted section's key phrases. |
| **Priority** | Must Have |

### NFR-004: Reference Brevity

| Attribute | Value |
|-----------|-------|
| **Category** | Performance |
| **Requirement** | Agent-side references to CLAUDE.md protocols must be concise |
| **Metric** | Each reference line is <= 120 characters. No reference block exceeds 3 lines (reference + agent-specific customization). |
| **Measurement** | `wc -c` on each reference line in affected agent files. |
| **Priority** | Should Have |

### NFR-005: Backward Compatibility

| Attribute | Value |
|-----------|-------|
| **Category** | Compatibility |
| **Requirement** | Existing hook enforcement continues to work unchanged |
| **Metric** | All existing hook tests pass without modification. test-watcher hook, iteration-corridor hook, and all dispatchers function identically. |
| **Measurement** | `npm run test:hooks` passes with 0 failures and 0 new skips. |
| **Priority** | Must Have |

### NFR-006: CLAUDE.md Size Budget

| Attribute | Value |
|-----------|-------|
| **Category** | Performance |
| **Requirement** | CLAUDE.md total size increase is bounded to prevent excessive baseline context inflation |
| **Metric** | CLAUDE.md grows by no more than 120 lines from this extraction. Total CLAUDE.md size after refactoring <= 280 lines (current ~149 lines + 120 max increase + margin). |
| **Measurement** | `wc -l CLAUDE.md` before and after. |
| **Priority** | Must Have |

---

## 6. User Stories

### US-001: Centralize Monorepo Guidance

**As a** framework developer,
**I want to** have monorepo mode guidance defined once in CLAUDE.md,
**so that** I can update it in one place and all 26 agents automatically inherit the change.

**Acceptance Criteria**:
- Given I update the Monorepo Mode Protocol in CLAUDE.md, when any agent is delegated to, then it has access to the updated protocol without requiring changes to the agent file.
- Given any of the 26 affected agent files, when I read the file, then I see only a 1-line reference to CLAUDE.md (not the full blockquote).

**Linked Requirements**: FR-001, FR-002, FR-003, FR-004
**Priority**: Must Have

### US-002: Centralize Iteration Enforcement

**As a** framework developer,
**I want to** have the iteration enforcement protocol structure defined once in CLAUDE.md while keeping agent-specific success criteria in each agent file,
**so that** structural changes to the iteration loop (e.g., adding a new rule) only need to happen in one place, while each agent retains its unique completion criteria.

**Acceptance Criteria**:
- Given I update the Mandatory Iteration Enforcement Protocol in CLAUDE.md (e.g., add rule 5), when any of the 7 affected agents is delegated to, then it has access to the updated structural protocol.
- Given the 05-software-developer agent, when it is delegated to, then it still sees "ALL UNIT TESTS PASS WITH >=80% COVERAGE" as its specific success criteria.
- Given the discover/artifact-integration agent, when it is delegated to, then it still enforces max iterations of 5.

**Linked Requirements**: FR-005, FR-006
**Priority**: Must Have

### US-003: Centralize Git Commit Warning

**As a** framework developer,
**I want to** have the git commit prohibition defined once in CLAUDE.md,
**so that** all agents that should not commit (currently software-developer and quality-loop-engineer, potentially more in the future) automatically inherit the prohibition.

**Acceptance Criteria**:
- Given the Git Commit Prohibition section exists in CLAUDE.md, when the 05-software-developer agent is delegated to, then it has access to the prohibition.
- Given the Git Commit Prohibition section exists in CLAUDE.md, when the 16-quality-loop-engineer agent is delegated to, then it has access to the prohibition.
- Given either agent file, when I read it, then it contains only a 1-line reference (not the full warning section).

**Linked Requirements**: FR-007, FR-008
**Priority**: Must Have

### US-004: Centralize Orchestrator Resolution Protocols

**As a** framework developer,
**I want to** have ROOT RESOLUTION and PROJECT CONTEXT RESOLUTION defined once in CLAUDE.md,
**so that** both orchestrator agents (sdlc-orchestrator and discover-orchestrator) inherit identical resolution logic without maintaining separate copies.

**Acceptance Criteria**:
- Given the Root Resolution Protocol section exists in CLAUDE.md, when the sdlc-orchestrator is loaded, then it has access to the 5-step resolution algorithm.
- Given the Project Context Resolution section exists in CLAUDE.md, when the discover-orchestrator is loaded, then it has access to the monorepo detection, path routing, and delegation context template.
- Given either orchestrator file, when I read it, then it does not contain the full resolution algorithm inline (only a reference).

**Linked Requirements**: FR-009, FR-010, FR-011
**Priority**: Must Have

### US-005: Validate No Behavioral Regression

**As a** framework developer,
**I want to** verify that the extraction did not change any agent's effective behavior,
**so that** I can confidently deploy the refactored agent files.

**Acceptance Criteria**:
- Given all extractions are complete, when I run `npm run test:hooks`, then all existing tests pass.
- Given all extractions are complete, when I grep for key phrases of each extracted section in agent files, then no full copies remain (only references).
- Given all extractions are complete, when I compare the content available to each agent (CLAUDE.md + agent file) pre vs post, then the semantic content is identical.

**Linked Requirements**: NFR-002, NFR-003, NFR-005
**Priority**: Must Have

---

## 7. User Stories (JSON)

```json
{
  "stories": [
    {
      "id": "US-001",
      "epic": "Boilerplate Extraction",
      "persona": "Framework Developer",
      "goal": "have monorepo mode guidance defined once in CLAUDE.md",
      "benefit": "update it in one place and all 26 agents automatically inherit the change",
      "priority": "Must Have",
      "acceptance_criteria": [
        {
          "id": "AC-US001-01",
          "given": "I update the Monorepo Mode Protocol in CLAUDE.md",
          "when": "any agent is delegated to",
          "then": "it has access to the updated protocol without requiring changes to the agent file"
        },
        {
          "id": "AC-US001-02",
          "given": "any of the 26 affected agent files",
          "when": "I read the file",
          "then": "I see only a 1-line reference to CLAUDE.md, not the full blockquote"
        }
      ],
      "linked_requirements": ["FR-001", "FR-002", "FR-003", "FR-004"]
    },
    {
      "id": "US-002",
      "epic": "Boilerplate Extraction",
      "persona": "Framework Developer",
      "goal": "have the iteration enforcement protocol structure defined once in CLAUDE.md while keeping agent-specific success criteria in each agent",
      "benefit": "structural changes to the iteration loop only need to happen in one place, while each agent retains its unique completion criteria",
      "priority": "Must Have",
      "acceptance_criteria": [
        {
          "id": "AC-US002-01",
          "given": "I update the Mandatory Iteration Enforcement Protocol in CLAUDE.md",
          "when": "any of the 7 affected agents is delegated to",
          "then": "it has access to the updated structural protocol"
        },
        {
          "id": "AC-US002-02",
          "given": "the 05-software-developer agent",
          "when": "it is delegated to",
          "then": "it still sees ALL UNIT TESTS PASS WITH >=80% COVERAGE as its specific success criteria"
        },
        {
          "id": "AC-US002-03",
          "given": "the discover/artifact-integration agent",
          "when": "it is delegated to",
          "then": "it still enforces max iterations of 5"
        }
      ],
      "linked_requirements": ["FR-005", "FR-006"]
    },
    {
      "id": "US-003",
      "epic": "Boilerplate Extraction",
      "persona": "Framework Developer",
      "goal": "have the git commit prohibition defined once in CLAUDE.md",
      "benefit": "all agents that should not commit automatically inherit the prohibition",
      "priority": "Must Have",
      "acceptance_criteria": [
        {
          "id": "AC-US003-01",
          "given": "the Git Commit Prohibition section exists in CLAUDE.md",
          "when": "the 05-software-developer agent is delegated to",
          "then": "it has access to the prohibition"
        },
        {
          "id": "AC-US003-02",
          "given": "either agent file (05 or 16)",
          "when": "I read it",
          "then": "it contains only a 1-line reference, not the full warning section"
        }
      ],
      "linked_requirements": ["FR-007", "FR-008"]
    },
    {
      "id": "US-004",
      "epic": "Boilerplate Extraction",
      "persona": "Framework Developer",
      "goal": "have ROOT RESOLUTION and PROJECT CONTEXT RESOLUTION defined once in CLAUDE.md",
      "benefit": "both orchestrator agents inherit identical resolution logic without maintaining separate copies",
      "priority": "Must Have",
      "acceptance_criteria": [
        {
          "id": "AC-US004-01",
          "given": "the Root Resolution Protocol section exists in CLAUDE.md",
          "when": "the sdlc-orchestrator is loaded",
          "then": "it has access to the 5-step resolution algorithm"
        },
        {
          "id": "AC-US004-02",
          "given": "the Project Context Resolution section exists in CLAUDE.md",
          "when": "the discover-orchestrator is loaded",
          "then": "it has access to the monorepo detection, path routing, and delegation context template"
        },
        {
          "id": "AC-US004-03",
          "given": "either orchestrator file",
          "when": "I read it",
          "then": "it does not contain the full resolution algorithm inline"
        }
      ],
      "linked_requirements": ["FR-009", "FR-010", "FR-011"]
    },
    {
      "id": "US-005",
      "epic": "Boilerplate Extraction",
      "persona": "Framework Developer",
      "goal": "verify that the extraction did not change any agent's effective behavior",
      "benefit": "I can confidently deploy the refactored agent files",
      "priority": "Must Have",
      "acceptance_criteria": [
        {
          "id": "AC-US005-01",
          "given": "all extractions are complete",
          "when": "I run npm run test:hooks",
          "then": "all existing tests pass"
        },
        {
          "id": "AC-US005-02",
          "given": "all extractions are complete",
          "when": "I grep for key phrases of each extracted section in agent files",
          "then": "no full copies remain, only references"
        },
        {
          "id": "AC-US005-03",
          "given": "all extractions are complete",
          "when": "I compare the content available to each agent pre vs post",
          "then": "the semantic content is identical"
        }
      ],
      "linked_requirements": ["NFR-002", "NFR-003", "NFR-005"]
    }
  ]
}
```

---

## 8. Prioritization (MoSCoW)

### Must Have (MVP)

| ID | Requirement | Rationale |
|----|-------------|-----------|
| FR-001 | Extract Monorepo Mode Protocol to CLAUDE.md | Foundation for all monorepo reference removals |
| FR-002 | Remove monorepo blockquote from 17 phase agents | Largest duplication count |
| FR-003 | Remove monorepo blockquote from 7 analysis sub-agents | Second largest duplication count |
| FR-004 | Remove monorepo blockquote from 2 remaining agents | Completes monorepo extraction |
| FR-005 | Extract Iteration Enforcement Protocol to CLAUDE.md | Foundation for iteration reference removals |
| FR-006 | Replace iteration enforcement in 7 agents | Eliminates 70+ lines of duplication |
| FR-007 | Extract Git Commit Warning to CLAUDE.md | Foundation for git warning removal |
| FR-008 | Remove git commit warning from 2 agents | Eliminates ~11 lines of duplication |
| FR-009 | Extract ROOT RESOLUTION to CLAUDE.md | Foundation for orchestrator simplification |
| FR-010 | Extract MONOREPO CONTEXT RESOLUTION to CLAUDE.md | Largest single block (~65 lines per agent) |
| FR-011 | Remove ROOT RESOLUTION + CONTEXT from orchestrators | Eliminates ~130 lines of duplication |
| FR-012 | Preserve CLAUDE.md section organization | Ensures consistency with T2 pattern |
| NFR-001 | Token reduction | Core objective of the feature |
| NFR-002 | Zero behavioral regression | Non-negotiable safety constraint |
| NFR-003 | Single source of truth | Core maintainability objective |
| NFR-005 | Backward compatibility (hooks) | Non-negotiable safety constraint |
| NFR-006 | CLAUDE.md size budget | Prevents context inflation |

### Should Have

| ID | Requirement | Rationale |
|----|-------------|-----------|
| NFR-004 | Reference brevity (<= 120 chars) | Good practice but not critical |

### Won't Have (This Release)

- PRE-PHASE CHECK extraction (agent-specific content, not identical)
- Agent-specific iteration threshold customization UI
- Automated regression test for agent prompt content equivalence
- CLAUDE.md table of contents or section linking

---

## 9. Verification Approach

### 9.1 Pre-Refactor Baseline

Before any changes, capture baselines:

1. `wc -l CLAUDE.md` -- record line count
2. `wc -l src/claude/agents/{each affected file}` -- record line counts
3. For each extracted section, record the exact text that each agent sees (CLAUDE.md content + agent file content)
4. `npm run test:hooks` -- record all pass/fail results

### 9.2 Post-Refactor Verification

After all changes are complete:

**V-001: Line Count Verification**
- Run `wc -l` on all affected files
- Verify each agent file is shorter by the expected amount
- Verify CLAUDE.md grew by <= 120 lines
- Verify net line reduction >= 130 lines

**V-002: No Remaining Duplication (grep sweep)**
- `grep -r "all file paths are project-scoped. The orchestrator provides project context (project ID" src/claude/agents/` -- expect 0 results
- `grep -r "scope your analysis to the project path provided in the delegation context" src/claude/agents/` -- expect 0 results
- `grep -r "MANDATORY ITERATION ENFORCEMENT" src/claude/agents/` -- expect 0 full sections (1-line references are OK)
- `grep -r "Do NOT Run Git Commits" src/claude/agents/` -- expect 0 results with full explanation paragraphs
- `grep -r "ROOT RESOLUTION (Before anything else)" src/claude/agents/` -- expect 0 results

**V-003: Content Equivalence**
- For each affected agent, concatenate CLAUDE.md + refactored agent file
- Compare the concatenated content against the original agent file
- Verify all protocol content is present (either in CLAUDE.md or agent-specific customization)
- Specific checks:
  - 05-software-developer still sees ">=80% COVERAGE"
  - 06-integration-tester still sees "ALL TESTS PASS"
  - discover/artifact-integration still sees "max iterations (5)"
  - 00-sdlc-orchestrator still sees the full path routing table
  - discover-orchestrator still sees the MONOREPO CONTEXT delegation template

**V-004: Hook Test Suite**
- Run `npm run test:hooks` -- all tests must pass
- Run `npm test` -- all ESM tests must pass
- No new test failures or skips introduced

**V-005: Structural Integrity**
- Verify CLAUDE.md has valid markdown structure (headings nested correctly)
- Verify all agent files still have valid YAML frontmatter
- Verify no broken cross-references

### 9.3 Recommended Manual Smoke Tests

After deployment (sync to `.claude/`), manually verify these agents work correctly by running them through a real workflow:

1. **00-sdlc-orchestrator**: Run `/isdlc status` -- verify root resolution works
2. **05-software-developer**: Verify iteration enforcement triggers during implementation
3. **06-integration-tester**: Verify iteration enforcement triggers during testing
4. **02-solution-architect**: Verify monorepo mode guidance is accessible
5. **discover-orchestrator**: Run `/discover` -- verify root resolution and monorepo preamble work

---

## 10. Traceability Matrix

| Requirement ID | User Story ID | Epic | Priority | Status |
|----------------|---------------|------|----------|--------|
| FR-001 | US-001 | Boilerplate Extraction | Must Have | Draft |
| FR-002 | US-001 | Boilerplate Extraction | Must Have | Draft |
| FR-003 | US-001 | Boilerplate Extraction | Must Have | Draft |
| FR-004 | US-001 | Boilerplate Extraction | Must Have | Draft |
| FR-005 | US-002 | Boilerplate Extraction | Must Have | Draft |
| FR-006 | US-002 | Boilerplate Extraction | Must Have | Draft |
| FR-007 | US-003 | Boilerplate Extraction | Must Have | Draft |
| FR-008 | US-003 | Boilerplate Extraction | Must Have | Draft |
| FR-009 | US-004 | Boilerplate Extraction | Must Have | Draft |
| FR-010 | US-004 | Boilerplate Extraction | Must Have | Draft |
| FR-011 | US-004 | Boilerplate Extraction | Must Have | Draft |
| FR-012 | US-001, US-002, US-003, US-004 | Boilerplate Extraction | Must Have | Draft |
| NFR-001 | US-005 | Boilerplate Extraction | Must Have | Draft |
| NFR-002 | US-005 | Boilerplate Extraction | Must Have | Draft |
| NFR-003 | US-005 | Boilerplate Extraction | Must Have | Draft |
| NFR-004 | — | Boilerplate Extraction | Should Have | Draft |
| NFR-005 | US-005 | Boilerplate Extraction | Must Have | Draft |
| NFR-006 | US-005 | Boilerplate Extraction | Must Have | Draft |

---

## 11. Dependencies

| Dependency | Type | Description |
|------------|------|-------------|
| T2 (CLAUDE.md shared protocols) | Completed prerequisite | T2 established the extraction pattern and added the "Agent Framework Context" section. This feature extends that section. |
| CLAUDE.md auto-inclusion | Runtime assumption | Claude Code automatically includes CLAUDE.md content in every agent's context window. If this behavior changes, the extraction strategy breaks. |
| src-to-.claude sync | Deployment dependency | Changes to `src/claude/agents/` must be synced to `.claude/agents/` for runtime effect. This is an existing convention, not a new dependency. |

---

## 12. Assumptions

- ASM-001: Claude Code will continue to automatically include CLAUDE.md content in every agent delegation context.
- ASM-002: The `src/claude/agents/` to `.claude/agents/` sync mechanism will continue to operate as-is.
- ASM-003: No other in-flight work is modifying the same agent files simultaneously.
- ASM-004: The token cost of a 1-line reference is negligible compared to the full section it replaces.
- ASM-005: All 26 monorepo blockquotes identified by grep analysis are the complete set; no additional agents contain similar content under different phrasing.

---

## 13. Glossary

| Term | Definition |
|------|------------|
| Boilerplate | Repeated text blocks that are identical (or nearly identical) across multiple agent files |
| CLAUDE.md | The project-level instruction file automatically loaded into every Claude Code agent's context |
| Agent file | A markdown file in `src/claude/agents/` that defines a specialized agent's role, skills, and behavioral instructions |
| Extraction | The process of moving duplicated content from individual agent files to a shared location (CLAUDE.md) and replacing the original with a reference |
| Reference | A concise 1-line pointer in an agent file directing the reader to the full protocol in CLAUDE.md |
| Context window | The total token capacity available to a Claude agent during a delegation; every token of instruction text consumes capacity |

---

## 14. Open Questions (Resolved)

These questions from the quick-scan have been resolved in this requirements document:

| # | Question | Resolution |
|---|----------|------------|
| 1 | Should ITERATION enforcement have agent-specific variants? | Yes. CLAUDE.md gets the common structure; agents retain 1-line customizations with their specific success criteria and max iteration counts. (FR-005, FR-006) |
| 2 | Where should ROOT RESOLUTION appear in CLAUDE.md? | Under "Agent Framework Context" as a subsection, consistent with T2 pattern. (FR-012) |
| 3 | Blockquote vs directive for monorepo? | CLAUDE.md gets a proper section heading for the protocol. Agent references use a 1-line blockquote format. (FR-001) |
| 4 | Backward compatibility period? | Immediate removal. No deprecation period. Single source of truth from day one. (CON-003) |
| 5 | Discovery report update? | Out of scope for this feature. The requirements artifact is sufficient. |
| 6 | Testing approach? | Defined in Section 9 (Verification Approach) with 5 automated checks and 5 manual smoke tests. |

---

## Appendix A: Affected File Inventory

### Files to Modify (28 total)

**CLAUDE.md** (1 file - additions only):
- `/CLAUDE.md`

**Phase Agents** (13 files - remove monorepo blockquote):
- `src/claude/agents/02-solution-architect.md`
- `src/claude/agents/03-system-designer.md`
- `src/claude/agents/04-test-design-engineer.md`
- `src/claude/agents/05-software-developer.md`
- `src/claude/agents/06-integration-tester.md`
- `src/claude/agents/07-qa-engineer.md`
- `src/claude/agents/08-security-compliance-auditor.md`
- `src/claude/agents/09-cicd-engineer.md`
- `src/claude/agents/10-dev-environment-engineer.md`
- `src/claude/agents/11-deployment-engineer-staging.md`
- `src/claude/agents/12-release-manager.md`
- `src/claude/agents/13-site-reliability-engineer.md`
- `src/claude/agents/14-upgrade-engineer.md`

**Discover Sub-Agents** (3 files - remove monorepo blockquote + iteration enforcement):
- `src/claude/agents/discover/characterization-test-generator.md`
- `src/claude/agents/discover/artifact-integration.md`
- `src/claude/agents/discover/atdd-bridge.md`

**Analysis Sub-Agents** (7 files - remove short monorepo blockquote):
- `src/claude/agents/tracing/tracing-orchestrator.md`
- `src/claude/agents/tracing/execution-path-tracer.md`
- `src/claude/agents/tracing/root-cause-identifier.md`
- `src/claude/agents/tracing/symptom-analyzer.md`
- `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md`
- `src/claude/agents/impact-analysis/impact-analyzer.md`
- `src/claude/agents/impact-analysis/entry-point-finder.md`
- `src/claude/agents/impact-analysis/cross-validation-verifier.md`
- `src/claude/agents/impact-analysis/risk-assessor.md`

**Quick-Scan Agent** (1 file - remove monorepo blockquote):
- `src/claude/agents/quick-scan/quick-scan-agent.md`

**Orchestrator Agents** (2 files - remove ROOT RESOLUTION + MONOREPO CONTEXT):
- `src/claude/agents/00-sdlc-orchestrator.md`
- `src/claude/agents/discover-orchestrator.md`

**Quality Loop Agent** (1 file - remove git commit warning):
- `src/claude/agents/16-quality-loop-engineer.md`

### Files NOT Modified

- No hook files (`.cjs`) are modified
- No skill files are modified
- No CLI files are modified
- No config files are modified
- No test files are modified
