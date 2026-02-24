# Requirements Specification: Impact Analysis Cross-Validation Verifier

**ID**: REQ-0015
**Version**: 1.0
**Created**: 2026-02-15
**Status**: Draft
**Workflow**: feature
**Backlog Reference**: BACKLOG.md item 4.2 (Approach A)

---

## 1. Overview

### 1.1 Problem Statement

The Impact Analysis phase (Phase 02) launches three sub-agents in parallel -- M1 (Impact Analyzer), M2 (Entry Point Finder), and M3 (Risk Assessor) -- but they run in **complete isolation**. No cross-referencing, no awareness of each other's findings. The orchestrator consolidates after all complete, but nobody verifies consistency.

Inconsistencies flow silently into sizing and downstream phases:
- M1 might report 7 files affected while M2 found entry points in 9 files
- M3's risk score might not account for coupling that M1 identified
- M2 might find entry points in files not in M1's blast radius
- Coverage gaps in M3 might not align with M1's affected file list

### 1.2 Proposed Solution

Add a **Verifier agent (M4)** that runs after M1/M2/M3 complete but before the orchestrator consolidates their results. The Verifier cross-references all three outputs, flags inconsistencies, and produces a verification report that the orchestrator includes in the consolidated impact-analysis.md.

### 1.3 Approach

**Approach A -- Post-hoc Verification** (from BACKLOG.md):
- One new agent, +1 Task call after existing parallel phase
- Catches inconsistencies after the fact but cannot improve what agents found
- If M1 missed a file, the Verifier can flag the gap but cannot go analyse it
- Low risk, immediate value

---

## 2. Functional Requirements

### FR-01: Verifier Agent Definition
Create a new agent definition (`cross-validation-verifier.md`) in `src/claude/agents/impact-analysis/` that:
- Accepts M1, M2, and M3 outputs as input
- Performs cross-validation checks across all three outputs
- Produces a structured verification report

**Acceptance Criteria:**
- AC-01.1: Agent file exists at `src/claude/agents/impact-analysis/cross-validation-verifier.md`
- AC-01.2: Agent has frontmatter with name, description, model, owned_skills
- AC-01.3: Agent accepts structured JSON input containing M1, M2, M3 results
- AC-01.4: Agent produces a verification report with findings categorized by severity

### FR-02: File List Cross-Validation
The Verifier compares file lists across M1 and M2 outputs.

**Acceptance Criteria:**
- AC-02.1: Files in M2's entry point chains but missing from M1's affected files list are flagged as "MISSING_FROM_BLAST_RADIUS"
- AC-02.2: Files in M1's affected files list but not reachable from any M2 entry point are flagged as "ORPHAN_IMPACT" (may indicate stale or indirect impact)
- AC-02.3: The delta (symmetric difference) between M1 and M2 file lists is computed and reported
- AC-02.4: Each flagged file includes which agent(s) reported it and which did not

### FR-03: Risk Scoring Gap Detection
The Verifier validates that M3's risk assessment accounts for findings from M1 and M2.

**Acceptance Criteria:**
- AC-03.1: Files identified by M1 as high-coupling but not flagged as high-risk by M3 are reported as "RISK_SCORING_GAP"
- AC-03.2: Entry points with deep call chains (from M2) in low-coverage areas (from M3) are flagged as "UNDERTESTED_CRITICAL_PATH"
- AC-03.3: M3 risk level is validated against M1 blast radius (e.g., high blast radius + low risk = suspicious)
- AC-03.4: Each gap includes a recommended action (e.g., "increase risk for module X", "add test coverage for path Y")

### FR-04: Completeness Validation
The Verifier checks that all M2 entry points are covered in M1's analysis and all M1 affected areas are risk-assessed by M3.

**Acceptance Criteria:**
- AC-04.1: Every M2 entry point must map to at least one M1 affected file/module
- AC-04.2: Every M1 affected module must have a corresponding risk assessment from M3
- AC-04.3: Gaps in coverage are flagged as "INCOMPLETE_ANALYSIS" with the specific gap identified
- AC-04.4: A completeness score is computed (percentage of cross-references that validate)

### FR-05: Orchestrator Integration
The impact-analysis-orchestrator must invoke the Verifier after M1/M2/M3 complete and include verification results in the consolidated report.

**Acceptance Criteria:**
- AC-05.1: Orchestrator launches Verifier as a single Task call after all three sub-agents return
- AC-05.2: Verifier results are included as a "Cross-Validation" section in impact-analysis.md
- AC-05.3: If verification finds CRITICAL-severity issues, the orchestrator surfaces them in the executive summary
- AC-05.4: Orchestrator progress display shows the Verifier step (M4)
- AC-05.5: State.json sub_agents section includes M4 status alongside M1/M2/M3

### FR-06: Verification Report Structure
The Verifier produces a structured report with categorized findings.

**Acceptance Criteria:**
- AC-06.1: Report includes a summary with total findings count by severity (CRITICAL, WARNING, INFO)
- AC-06.2: Each finding has: id, severity, category (file_list, risk_scoring, completeness), description, affected_agents, recommendation
- AC-06.3: Report includes a completeness_score (0-100%)
- AC-06.4: Report includes a verification_status: PASS (no CRITICAL findings), WARN (warnings only), FAIL (critical findings exist)
- AC-06.5: Report is returned as both structured JSON and markdown report_section

### FR-07: Skill Registration
Register new skills for the Verifier agent in the skills manifest.

**Acceptance Criteria:**
- AC-07.1: New skill IDs registered (IA-004 or similar) for cross-validation
- AC-07.2: Skill file(s) created in `src/claude/skills/impact-analysis/`
- AC-07.3: Skills manifest updated with new skill entries

---

## 3. Non-Functional Requirements

### NFR-01: Performance
- The Verifier must complete within a reasonable time frame relative to M1/M2/M3 execution
- Target: Verifier should add no more than ~20% overhead to the total Phase 02 duration
- The Verifier runs sequentially (after M1/M2/M3), not in parallel

### NFR-02: Fail-Open Behavior
- If the Verifier encounters an error (malformed M1/M2/M3 output, parsing failure), it MUST NOT block Phase 02 progression
- Verifier errors should be logged as warnings, not failures
- The orchestrator should proceed to consolidation with a note that verification was incomplete
- Aligns with constitutional Article X (Fail-Safe Defaults)

### NFR-03: Backward Compatibility
- Existing M1/M2/M3 agent definitions must NOT be modified
- The Verifier is purely additive -- it reads existing outputs, does not change them
- If Verifier is absent (e.g., older framework version), the orchestrator continues without verification
- No changes to the M1/M2/M3 output format required

---

## 4. Constraints

- C-01: Must follow existing agent file conventions (frontmatter, sections, skill references)
- C-02: Must work with both feature and upgrade workflow variants of Phase 02
- C-03: Agent definition must be in `src/claude/agents/impact-analysis/` alongside M1/M2/M3
- C-04: No restructuring of existing parallel execution pattern -- Verifier is additive

---

## 5. Out of Scope

- Approach B (cross-pollination during execution) -- future backlog item
- Modifying M1/M2/M3 to produce different output formats
- Automated remediation of detected inconsistencies (Verifier flags, does not fix)
- Changes to the sizing algorithm based on verification results (future enhancement)

---

## 6. Dependencies

- Impact Analysis Orchestrator (`src/claude/agents/impact-analysis/impact-analysis-orchestrator.md`)
- Impact Analyzer M1 (`src/claude/agents/impact-analysis/impact-analyzer.md`)
- Entry Point Finder M2 (`src/claude/agents/impact-analysis/entry-point-finder.md`)
- Risk Assessor M3 (`src/claude/agents/impact-analysis/risk-assessor.md`)
- Skills manifest (`src/claude/hooks/config/skills-manifest.json`)

---

## 7. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| M1/M2/M3 output format varies between runs | Medium | Medium | Verifier uses defensive parsing with fallbacks |
| Verifier adds noticeable latency to Phase 02 | Low | Low | Sequential single call, bounded scope |
| False positive inconsistency flags | Medium | Low | Severity levels allow filtering; INFO-level for borderline cases |
| Upgrade workflow output differs from feature | Medium | Medium | Test both workflow variants explicitly |
