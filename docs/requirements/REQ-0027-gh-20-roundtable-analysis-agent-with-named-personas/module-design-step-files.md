# Module Design: Analysis Step Files

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 04-design
**Date**: 2026-02-19
**Traces**: FR-004, FR-006, FR-012, CON-005

---

## 1. Overview

Analysis step files are self-contained markdown files that define individual steps within each analysis phase. The roundtable analyst agent discovers, loads, parses, and executes these files sequentially. Each file contains YAML frontmatter (metadata) and a markdown body (prompt content organized by depth level).

**Location**: `src/claude/skills/analysis-steps/{phase-key}/`
**Naming Convention**: `{NN}-{step-name}.md` where NN is a zero-padded two-digit number.
**Total Count**: 24 step files across 5 phase directories.

---

## 2. YAML Frontmatter Schema

### 2.1 Required Fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `step_id` | string | Globally unique, format `"{PP}-{NN}"` where PP = phase number, NN = step number | Unique identifier used in `steps_completed` tracking. Examples: `"00-01"`, `"01-03"`, `"04-05"`. |
| `title` | string | Non-empty, max 60 characters | Human-readable display name shown in step headers. Example: `"User Needs Discovery"`. |
| `persona` | string | One of: `"business-analyst"`, `"solutions-architect"`, `"system-designer"` | Which persona leads this step. Must match a persona key in the roundtable agent's Phase-to-Persona Mapping. |
| `depth` | string | One of: `"brief"`, `"standard"`, `"deep"` | Default depth level for this step. The adaptive depth logic may override this at runtime. |
| `outputs` | string[] | Non-empty array of artifact filenames | Artifact keys this step produces or updates. Example: `["requirements-spec.md"]`. |

### 2.2 Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `depends_on` | string[] | `[]` | Step IDs that must be in `steps_completed` before this step executes. Used for cross-step dependencies. |
| `skip_if` | string | `""` | Condition expression evaluated at runtime. If truthy, the step is skipped. Example: `"scope === 'small'"`. |

### 2.3 Frontmatter Example

```yaml
---
step_id: "01-02"
title: "User Needs Discovery"
persona: "business-analyst"
depth: "standard"
outputs:
  - requirements-spec.md
depends_on: ["01-01"]
skip_if: ""
---
```

### 2.4 step_id Format Specification

The `step_id` follows the format `"{PP}-{NN}"`:

- `PP`: Two-digit phase number matching the parent directory (`00`, `01`, `02`, `03`, `04`)
- `-`: Literal hyphen separator
- `NN`: Two-digit step number matching the filename prefix (`01`, `02`, ... `08`)
- The step_id MUST be consistent with the file location: a file at `analysis-steps/01-requirements/03-ux-journey.md` MUST have `step_id: "01-03"`

This consistency constraint enables the roundtable agent to correlate step_ids in `steps_completed` with file paths without parsing every file during resumption.

---

## 3. Body Structure

The markdown body (content after the YAML frontmatter closing `---`) is organized into five mandatory sections identified by `##` headings.

### 3.1 Section: Brief Mode

```markdown
## Brief Mode

{Condensed analysis for simple items. Presents a draft summary or confirmation
prompt rather than open-ended questions. Target: 1-2 sentences of output,
expecting a yes/no or minor correction from the user.}

Example for step 01-02 (User Needs):
"Based on the quick scan, the primary users are framework developers who need
interactive analysis during the analyze verb. The main pain point is passive
artifact generation. Sound right, or should we dig deeper?"
```

**UX Rule**: Brief mode presents draft conclusions for confirmation. It does NOT ask questions from scratch. This ensures simple items can be analyzed quickly.

**Traces**: FR-004 AC-004-05, FR-006 AC-006-01, NFR-006 AC-NFR-006-03.

### 3.2 Section: Standard Mode

```markdown
## Standard Mode

{Default analysis prompts. 2-3 focused questions with clear intent.
Open-ended but scoped to the step's topic. Includes persona-appropriate
follow-up guidance.}

Example for step 01-02 (User Needs):
"Let's talk about the people who will use this feature.

1. Who are the primary users? Describe their roles and what they do day-to-day.
2. What's their biggest pain point that this feature addresses?
3. Are there secondary users or stakeholders who are affected indirectly?

After you respond, I'll summarize the user landscape and check if we've
captured everyone."
```

**UX Rule**: Standard mode asks open-ended, domain-focused questions. Questions are never yes/no checkboxes.

**Traces**: FR-004 AC-004-02, NFR-006 AC-NFR-006-01.

### 3.3 Section: Deep Mode

```markdown
## Deep Mode

{Extended discovery with follow-up probing. 4-6 questions covering the topic
from multiple angles. Includes edge case probing, "what if" scenarios,
and cross-cutting concerns. The persona's principles guide the probing depth.}

Example for step 01-02 (User Needs):
"Let's do a thorough user analysis.

1. Who are ALL the users of this feature? Include primary users, secondary
   users, and any automated consumers.
2. For each user type, what's their current workflow? Walk me through a
   typical session.
3. What are the pain points in the current workflow? Be specific -- where
   do users get frustrated, blocked, or confused?
4. What happens when things go wrong? How do users recover from errors today?
5. Are there accessibility or internationalization needs for any user group?
6. Six months from now, how do you expect user behavior to evolve?

I'll probe each answer for edge cases before we move on."
```

**UX Rule**: Deep mode is the full treatment. The persona actively challenges assumptions and probes for unstated requirements.

**Traces**: FR-004 AC-004-06, NFR-006 AC-NFR-006-01.

### 3.4 Section: Validation

```markdown
## Validation

{Criteria for evaluating user responses before marking this step as complete.
These are guidance for the persona, not rigid checks.}

Example for step 01-02 (User Needs):
- At least one primary user type is identified
- Pain points are described in terms of user behavior, not technical implementation
- If multiple user types exist, each has a distinct role description
- Edge case: if user says "everyone is a user," probe for specific personas
```

**Behavior**: The persona uses these criteria to determine whether to proceed or ask follow-up questions. If validation criteria are not met, the persona asks targeted follow-ups rather than rejecting the response.

**Traces**: FR-012 AC-012-03.

### 3.5 Section: Artifacts

```markdown
## Artifacts

{Instructions for updating output files after this step completes.
Specifies which file to update, which section to write, and what content
to derive from the conversation.}

Example for step 01-02 (User Needs):
- Update `requirements-spec.md`:
  - Section "2. Stakeholders and Personas"
  - Write one subsection per identified user type
  - Include: role, goals, pain points, technical proficiency, key tasks
  - Format: follow the structure in the requirements-spec template
```

**Behavior**: The persona follows these instructions to produce or update artifact files in the artifact folder.

**Traces**: FR-012 AC-012-04.

### 3.6 Section Fallback Chain

If the body section selected by the depth mode is missing from a step file:

1. Try the selected depth section (e.g., `## Brief Mode`)
2. Fall back to `## Standard Mode`
3. Fall back to the entire body content (everything after frontmatter)

This ensures that step files with only a `## Standard Mode` section still work at all depth levels.

---

## 4. Complete Step File Inventory

### 4.1 Phase 00: Quick Scan (`analysis-steps/00-quick-scan/`)

Persona: Maya Chen (Business Analyst)

| # | File | step_id | Title | Default Depth | Outputs | Purpose |
|---|------|---------|-------|---------------|---------|---------|
| 1 | `01-scope-estimation.md` | `00-01` | Scope Estimation | standard | `quick-scan.md` | Estimate overall scope: small/medium/large. Read item description, identify affected areas, estimate file count range. |
| 2 | `02-keyword-search.md` | `00-02` | Keyword Search | brief | `quick-scan.md` | Identify keywords from description. Search codebase for matching files, functions, modules. Record hit count and locations. |
| 3 | `03-file-count.md` | `00-03` | File Count Estimation | brief | `quick-scan.md` | Refine file count using keyword search results. Classify affected files by type (new, modify, test). Produce final scope assessment. |

**Phase Output**: `quick-scan.md` in artifact folder with sections: Scope, Keywords, File Count, Confidence Level.

### 4.2 Phase 01: Requirements (`analysis-steps/01-requirements/`)

Persona: Maya Chen (Business Analyst)

| # | File | step_id | Title | Default Depth | Outputs | Purpose |
|---|------|---------|-------|---------------|---------|---------|
| 1 | `01-business-context.md` | `01-01` | Business Context Discovery | standard | `requirements-spec.md` | Discover the business problem, drivers, and success metrics. Why does this feature exist? Who benefits? |
| 2 | `02-user-needs.md` | `01-02` | User Needs Discovery | standard | `requirements-spec.md` | Identify users, roles, pain points, and current workflows. Build the stakeholder landscape. |
| 3 | `03-ux-journey.md` | `01-03` | User Experience & Journeys | standard | `requirements-spec.md` | Map user journeys: how users interact with the feature end-to-end. Identify touchpoints, entry points, exit points. |
| 4 | `04-technical-context.md` | `01-04` | Technical Context | standard | `requirements-spec.md` | Discover technical constraints, dependencies, existing patterns, and integration points that shape requirements. |
| 5 | `05-quality-risk.md` | `01-05` | Quality & Risk Assessment | standard | `requirements-spec.md`, `nfr-matrix.md` | Identify non-functional requirements (performance, security, scalability). Assess risk areas and quality priorities. |
| 6 | `06-feature-definition.md` | `01-06` | Core Feature Definition | deep | `requirements-spec.md` | Define functional requirements with acceptance criteria. This is the most detailed step -- write FRs with AC codes. |
| 7 | `07-user-stories.md` | `01-07` | User Story Writing | standard | `user-stories.json` | Convert requirements into user stories in standard format (As a / I want / So that) with acceptance criteria. |
| 8 | `08-prioritization.md` | `01-08` | MoSCoW Prioritization | brief | `requirements-spec.md`, `traceability-matrix.csv` | Assign MoSCoW priorities to requirements. Build traceability matrix mapping FRs to user stories. |

**Phase Outputs**: `requirements-spec.md`, `user-stories.json`, `traceability-matrix.csv` in artifact folder. `docs/common/nfr-matrix.md` (shared, created or updated).

### 4.3 Phase 02: Impact Analysis (`analysis-steps/02-impact-analysis/`)

Persona: Alex Rivera (Solutions Architect)

| # | File | step_id | Title | Default Depth | Outputs | Purpose |
|---|------|---------|-------|---------------|---------|---------|
| 1 | `01-blast-radius.md` | `02-01` | Blast Radius Assessment | standard | `impact-analysis.md` | Assess which files, modules, and systems are affected. Map direct and transitive dependencies. |
| 2 | `02-entry-points.md` | `02-02` | Entry Point Identification | standard | `impact-analysis.md` | Identify implementation entry points: which files to modify first, recommended implementation order. |
| 3 | `03-risk-zones.md` | `02-03` | Risk Zone Analysis | deep | `impact-analysis.md` | Identify high-risk areas: shared code, critical paths, areas with low test coverage. Assess risk severity and mitigation. |
| 4 | `04-impact-summary.md` | `02-04` | Impact Summary & User Review | brief | `impact-analysis.md` | Summarize impact analysis for user review. Present risk matrix. Get user confirmation on risk assessment. |

**Phase Output**: `impact-analysis.md` in artifact folder with sections: Blast Radius, Entry Points, Risk Zones, Risk Matrix, Implementation Order.

### 4.4 Phase 03: Architecture (`analysis-steps/03-architecture/`)

Persona: Alex Rivera (Solutions Architect)

| # | File | step_id | Title | Default Depth | Outputs | Purpose |
|---|------|---------|-------|---------------|---------|---------|
| 1 | `01-architecture-options.md` | `03-01` | Architecture Options & Tradeoffs | deep | `architecture-overview.md` | Present 2-3 architecture options with tradeoffs. Ask about risk appetite and constraints. Guide selection. |
| 2 | `02-technology-decisions.md` | `03-02` | Technology Decisions | standard | `tech-stack-decision.md`, ADR files | Document technology choices with rationale. Record decisions as ADRs. Identify any new dependencies. |
| 3 | `03-integration-design.md` | `03-03` | Integration Architecture | standard | `architecture-overview.md` | Design integration points: how new components connect to existing code. Document component interaction diagrams. |
| 4 | `04-architecture-review.md` | `03-04` | Architecture Review & Approval | brief | `architecture-overview.md` | Present architecture summary for user review. Confirm approach before proceeding to design. |

**Phase Outputs**: `architecture-overview.md`, `tech-stack-decision.md`, `component-interactions.md`, `adr-*.md` files in artifact folder.

### 4.5 Phase 04: Design (`analysis-steps/04-design/`)

Persona: Jordan Park (System Designer)

| # | File | step_id | Title | Default Depth | Outputs | Purpose |
|---|------|---------|-------|---------------|---------|---------|
| 1 | `01-module-design.md` | `04-01` | Module Design & Boundaries | deep | module design files | Define module responsibilities, interfaces, dependencies. Show concrete function signatures and data structures. |
| 2 | `02-interface-contracts.md` | `04-02` | Interface Contracts | deep | `interface-spec.yaml` | Define interface contracts: API endpoints, function signatures, request/response schemas, data types. |
| 3 | `03-data-flow.md` | `04-03` | Data Flow & State Management | standard | data flow documentation | Document how data moves through the system. State management approach. Caching strategy if applicable. |
| 4 | `04-error-handling.md` | `04-04` | Error Handling & Validation | standard | `error-taxonomy.md` | Define error codes, messages, recovery strategies. Input validation rules. Error response format. |
| 5 | `05-design-review.md` | `04-05` | Design Review & Approval | brief | All design artifacts | Present design summary for user review. Walk through key decisions. Confirm completeness before analysis completion. |

**Phase Outputs**: Module design files, `interface-spec.yaml`, data flow documentation, `error-taxonomy.md`, validation rules in artifact folder and/or `docs/design/`.

---

## 5. Step File Template

A complete step file template that serves as the reference for all 24 step files:

```markdown
---
step_id: "{PP}-{NN}"
title: "{Step Title}"
persona: "{persona-key}"
depth: "{brief|standard|deep}"
outputs:
  - {artifact-filename}
depends_on: []
skip_if: ""
---

## Brief Mode

{Present a draft summary derived from prior steps or quick-scan context.
Ask for confirmation. 1-2 sentences.}

"{Persona name}: Based on what we know so far, {draft conclusion}.
Does that match your understanding, or should we explore further?"

## Standard Mode

{2-3 open-ended questions focused on this step's topic. Each question
probes a different aspect. Questions are domain-focused and follow the
active persona's communication style.}

"{Persona name}: Let's discuss {topic}.

1. {Primary question about the core topic}
2. {Secondary question about constraints or alternatives}
3. {Question about edge cases or implications}

Take your time -- I'll follow up on anything that needs more detail."

## Deep Mode

{4-6 questions covering the topic from multiple angles. Include edge cases,
"what if" scenarios, failure modes, and cross-cutting concerns. The persona
actively challenges assumptions.}

"{Persona name}: I want to go deep on {topic}.

1. {Core question}
2. {Constraint question}
3. {Edge case question}
4. {Failure mode question}
5. {Cross-cutting concern question}
6. {Future evolution question}

I'll probe each answer before we move on."

## Validation

{Criteria that must be satisfied before this step is complete:}
- {Criterion 1: what must be true about the user's responses}
- {Criterion 2: what must be present in the gathered information}
- {Criterion 3: edge case that must be addressed}
- {If criteria not met: what follow-up questions to ask}

## Artifacts

{Instructions for updating output files:}
- Update `{artifact-filename}`:
  - Section: "{section name}"
  - Content: {what to write, derived from conversation}
  - Format: {formatting requirements}
```

---

## 6. Naming Convention Details

### 6.1 File Naming

Pattern: `{NN}-{step-name}.md`

- `NN`: Zero-padded two-digit number (`01`, `02`, ..., `08`)
- `-`: Literal hyphen separator
- `step-name`: Lowercase, hyphen-separated descriptive name
- `.md`: Markdown extension

Examples: `01-scope-estimation.md`, `06-feature-definition.md`, `04-impact-summary.md`

### 6.2 Directory Naming

Pattern: `{PP}-{phase-name}/`

- `PP`: Zero-padded two-digit phase number matching the ANALYSIS_PHASES constant
- `-`: Literal hyphen separator
- `phase-name`: Matching the phase key suffix

Directories:
- `00-quick-scan/`
- `01-requirements/`
- `02-impact-analysis/`
- `03-architecture/`
- `04-design/`

### 6.3 Ordering Guarantees

Step files are sorted lexicographically by filename. Because filenames start with zero-padded two-digit numbers, lexicographic order equals numeric order.

Supported range: `01-` through `99-` per phase directory. The current design uses `01-` through `08-` (Phase 01 has the most steps).

### 6.4 Adding Steps Between Existing Steps

If a future step needs to be inserted between steps 02 and 03, the recommended approach is renumbering. The alternative (using `02a-` or `02b-`) is discouraged because it breaks the step_id format convention.

When renumbering:
1. Rename step files with new numeric prefixes
2. Update step_id in each file's frontmatter
3. Update any depends_on references
4. Note: existing `steps_completed` entries in meta.json will reference old step_ids. This is safe because unknown step_ids are simply not matched during the "skip completed" filter -- the step will re-execute, which is acceptable.

---

## 7. Cross-Step Dependencies

The `depends_on` field enables ordering constraints beyond the default sequential execution:

```yaml
depends_on: ["01-01", "01-02"]
```

**Evaluation**: Before executing a step, the roundtable agent checks if all step_ids in `depends_on` are present in `steps_completed`. If any are missing, the step is skipped with a warning.

**Current Usage**: Most steps have no cross-step dependencies in the initial release. The sequential filename ordering provides sufficient ordering. The `depends_on` field exists for future extensibility (NFR-004), such as when a later-added step needs work from a specific earlier step rather than just sequential order.

**Cross-Phase Dependencies**: The `depends_on` field can reference step_ids from other phases (e.g., step `02-01` could depend on `01-06`). Since `steps_completed` is a flat array across all phases, cross-phase dependencies are automatically satisfied when the prerequisite phase is complete.

---

## 8. Conditional Skip Logic

The `skip_if` field enables conditional execution:

```yaml
skip_if: "scope === 'small'"
```

**Evaluation Context**: The condition is evaluated as a string expression by the roundtable agent. Available variables in the evaluation context:

| Variable | Type | Source |
|----------|------|--------|
| `scope` | string | Quick-scan scope from quick-scan.md (`"small"`, `"medium"`, `"large"`) |
| `complexity` | string | Quick-scan complexity (`"low"`, `"medium"`, `"high"`) |
| `file_count` | number | Quick-scan estimated file count |
| `depth` | string | Currently active depth (`"brief"`, `"standard"`, `"deep"`) |

**Current Usage**: Most steps have `skip_if: ""` (never skip). This field exists for future use cases where certain steps are irrelevant for specific contexts.

**Behavior when skipped**: The step is not executed and is NOT added to `steps_completed`. On session resume, the skip condition is re-evaluated -- if the context has changed, the step may execute.

---

## 9. Traceability

| Design Element | Requirements Traced |
|---------------|-------------------|
| Step file location | CON-005 |
| Naming convention | CON-005, FR-004 AC-004-01 |
| YAML frontmatter schema | FR-012 AC-012-01, AC-012-02 |
| Brief Mode section | FR-004 AC-004-05, NFR-006 AC-NFR-006-03 |
| Standard Mode section | FR-012 AC-012-03 |
| Deep Mode section | FR-004 AC-004-06 |
| Validation section | FR-012 AC-012-03 |
| Artifacts section | FR-012 AC-012-04 |
| Step file discovery | FR-004 AC-004-04, NFR-004 AC-NFR-004-01 |
| depends_on field | FR-012 AC-012-02 |
| skip_if field | FR-012 AC-012-02 |
| 24-step inventory | Requirements Section 10 (Step File Inventory) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | System Designer (Phase 04) | Initial step file module design |
