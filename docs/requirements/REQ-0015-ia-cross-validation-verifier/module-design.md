# Module Design: Cross-Validation Verifier (M4)

**Phase**: 04-Design
**Feature**: REQ-0015 -- Impact Analysis Cross-Validation Verifier
**Version**: 1.0
**Created**: 2026-02-15
**Traces To**: FR-01, FR-02, FR-03, FR-04, FR-05, FR-06, FR-07, NFR-01, NFR-02, NFR-03
**Architecture Refs**: ADR-0001 (Pipeline Pattern), ADR-0002 (Skill IDs), ADR-0003 (Fail-Open), ADR-0004 (Model)

---

## 1. Module Overview

This design specifies the exact content and behavior of four deliverables:

| # | Deliverable | File | Type |
|---|-------------|------|------|
| 1 | M4 Agent Definition | `src/claude/agents/impact-analysis/cross-validation-verifier.md` | NEW |
| 2 | Orchestrator Update | `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` | MODIFY |
| 3 | Cross-Validation Skill | `src/claude/skills/impact-analysis/cross-validation/SKILL.md` | NEW |
| 4 | Skills Manifest Entries | `src/claude/hooks/config/skills-manifest.json` | MODIFY |
| 5 | Consolidation Skill Update | `src/claude/skills/impact-analysis/impact-consolidation/SKILL.md` | MODIFY |

---

## 2. M4 Agent Definition Design

### 2.1 Frontmatter

```yaml
---
name: cross-validation-verifier
description: "Use this agent for Phase 02 Impact Analysis M4: Cross-Validation Verifier. Runs after M1/M2/M3 complete to cross-reference their outputs, detect file list inconsistencies, risk scoring gaps, and completeness issues. Returns structured verification report to the orchestrator."
model: opus
owned_skills:
  - IA-401  # cross-validation-execution
  - IA-402  # finding-categorization
supported_workflows:
  - feature
  - upgrade
---
```

**Traces**: AC-01.1 (file exists), AC-01.2 (frontmatter), C-01 (agent conventions), ADR-0004 (model: opus)

### 2.2 Purpose Section

The agent solves the **cross-agent consistency problem** -- M1, M2, and M3 run in isolation and can produce inconsistent or incomplete findings. M4 detects these issues after the fact.

### 2.3 Phase Overview

```
Phase: 02-impact-analysis (M4)
Parent: Impact Analysis Orchestrator
Input: M1 impact_summary, M2 entry_points, M3 risk_assessment (all JSON)
Output: Structured JSON with verification_report and report_section
Sequential After: M1 (Impact Analyzer), M2 (Entry Point Finder), M3 (Risk Assessor)
```

### 2.4 Core Responsibilities

1. **File List Cross-Validation** (FR-02): Compare file lists between M1 and M2
2. **Risk Scoring Gap Detection** (FR-03): Validate M3 risk scores against M1/M2 findings
3. **Completeness Validation** (FR-04): Verify all cross-references are complete
4. **Report Generation** (FR-06): Produce structured verification report

### 2.5 Process Steps

#### Step 1: Parse Inputs

Parse the three agent outputs from the delegation prompt. Extract:

From M1 (`impact_summary`):
- `directly_affected[]` -- array of `{ file, acceptance_criteria[], type? }`
- `outward_dependencies[]`
- `inward_dependencies[]`
- `change_propagation` -- `{ level_0[], level_1[], level_2[] }`
- `blast_radius` -- string: "low" | "medium" | "high"
- `files_estimated` -- integer
- `modules_estimated` -- integer

From M2 (`entry_points`):
- `by_acceptance_criterion` -- map of AC to `{ existing[], suggested_new[] }`
- `implementation_chains` -- map of entry point to layers
- `implementation_order[]`
- `integration_points[]`

From M3 (`risk_assessment`):
- `overall_risk` -- string
- `risk_score` -- integer 0-100
- `by_acceptance_criterion` -- map of AC to `{ risk_level, risk_areas[] }`
- `coverage_gaps[]`
- `complexity_hotspots[]`
- `recommendations[]`

**Defensive parsing**: If any field is missing, log the field name and continue with available data. Do not fail on missing fields.

**Traces**: AC-01.3

#### Step 2: File List Cross-Validation (FR-02)

Extract and compare file lists:

```
m1_files = set of all files from M1.directly_affected[].file
           UNION M1.change_propagation.level_0[]

m2_files = set of all files from:
           M2.by_acceptance_criterion[*].existing[].file
           UNION M2.implementation_chains[*][].location
           (where location is a file path, not a table name)

For each file in m2_files NOT in m1_files:
  -> Finding: MISSING_FROM_BLAST_RADIUS
     severity: WARNING
     category: file_list
     description: "File {path} found in M2 entry points but missing from M1 blast radius"
     affected_agents: ["M2-found", "M1-missing"]
     recommendation: "Review whether {path} should be in M1's affected files list"

For each file in m1_files NOT in m2_files:
  -> Finding: ORPHAN_IMPACT
     severity: INFO
     category: file_list
     description: "File {path} in M1 blast radius but not reachable from any M2 entry point"
     affected_agents: ["M1-found", "M2-missing"]
     recommendation: "Verify {path} is truly affected or is an indirect/stale impact"

Compute:
  symmetric_difference = m1_files XOR m2_files
  delta_count = |symmetric_difference|
```

**Traces**: AC-02.1 (MISSING_FROM_BLAST_RADIUS), AC-02.2 (ORPHAN_IMPACT), AC-02.3 (symmetric difference), AC-02.4 (affected_agents)

#### Step 3: Risk Scoring Gap Detection (FR-03)

Cross-reference M1 coupling data with M3 risk levels:

```
For each file in M1.directly_affected:
  If file has high coupling (>= 3 outward_dependencies from this file):
    Look up corresponding M3 risk_area for the file's module
    If M3 risk level is NOT "high":
      -> Finding: RISK_SCORING_GAP
         severity: WARNING
         category: risk_scoring
         description: "File {path} has high coupling ({count} dependencies)
                       but M3 rates module {module} as {risk_level} risk"
         affected_agents: ["M1-high-coupling", "M3-low-risk"]
         recommendation: "Increase risk assessment for module {module}
                          to account for coupling complexity"

For each M2 entry point with deep implementation chain (>= 4 layers):
  Look up M3 coverage for files in the chain
  If any file in chain has coverage < 50%:
    -> Finding: UNDERTESTED_CRITICAL_PATH
       severity: CRITICAL
       category: risk_scoring
       description: "Entry point {path} has deep call chain ({depth} layers)
                     passing through {file} with only {coverage}% coverage"
       affected_agents: ["M2-deep-chain", "M3-low-coverage"]
       recommendation: "Add test coverage for {file} before implementing
                        changes to this critical path"

For M1 blast_radius vs M3 overall_risk:
  If blast_radius == "high" AND overall_risk == "low":
    -> Finding: RISK_SCORING_GAP
       severity: WARNING
       category: risk_scoring
       description: "M1 reports HIGH blast radius ({files} files, {modules} modules)
                     but M3 overall risk is LOW ({score}/100)"
       affected_agents: ["M1-high-blast", "M3-low-risk"]
       recommendation: "Reconcile blast radius with risk assessment;
                        large blast radius typically warrants at least medium risk"
```

**Traces**: AC-03.1 (RISK_SCORING_GAP), AC-03.2 (UNDERTESTED_CRITICAL_PATH), AC-03.3 (blast radius vs risk), AC-03.4 (recommended actions)

#### Step 4: Completeness Validation (FR-04)

```
For each M2 entry point (across all ACs):
  Check if at least one file in the entry point's chain
  appears in M1.directly_affected[].file
  If not:
    -> Finding: INCOMPLETE_ANALYSIS
       severity: WARNING
       category: completeness
       description: "M2 entry point {path} for {AC} has no corresponding
                     file in M1's affected files list"
       affected_agents: ["M2-entry", "M1-coverage-gap"]
       recommendation: "Verify M1 analysis covers the implementation
                        chain for this entry point"

For each M1 affected module (unique module paths):
  Check if M3 has a corresponding risk_area entry
  If not:
    -> Finding: INCOMPLETE_ANALYSIS
       severity: WARNING
       category: completeness
       description: "M1 affected module {module} has no corresponding
                     risk assessment from M3"
       affected_agents: ["M1-affected", "M3-coverage-gap"]
       recommendation: "Add risk assessment for module {module}"

Compute completeness_score:
  total_cross_refs = (M2 entry points that map to M1 files)
                   + (M1 modules that map to M3 risk areas)
  valid_cross_refs = count where mapping exists
  completeness_score = round((valid_cross_refs / total_cross_refs) * 100)
  (If total_cross_refs == 0, completeness_score = 100)
```

**Traces**: AC-04.1 (entry point mapping), AC-04.2 (module risk mapping), AC-04.3 (INCOMPLETE_ANALYSIS), AC-04.4 (completeness_score)

#### Step 5: Generate Verification Report (FR-06)

Assemble all findings into the verification report structure.

**Severity classification rules**:
- CRITICAL: UNDERTESTED_CRITICAL_PATH (deep chain + low coverage)
- WARNING: MISSING_FROM_BLAST_RADIUS, RISK_SCORING_GAP, INCOMPLETE_ANALYSIS
- INFO: ORPHAN_IMPACT

**Verification status determination**:
- PASS: No CRITICAL findings and no WARNING findings
- WARN: WARNING findings exist but no CRITICAL findings
- FAIL: At least one CRITICAL finding exists

**Traces**: AC-06.1 (severity counts), AC-06.2 (finding structure), AC-06.3 (completeness_score), AC-06.4 (verification_status), AC-06.5 (dual JSON + markdown)

#### Step 6: Return Structured Response

Return JSON to the orchestrator matching the output contract (see Section 3).

### 2.6 Workflow Support (C-02)

The verifier works with both feature and upgrade workflows:

- **Feature workflow**: M1/M2/M3 outputs use requirements-based format
- **Upgrade workflow**: M1/M2/M3 outputs use breaking-changes-based format

Key differences for upgrade workflow:
- M1 `impact_summary.by_breaking_change` replaces `directly_affected` -- extract files from `by_breaking_change[*].files_affected[].file`
- M2 `entry_points.affected_entry_points` replaces `by_acceptance_criterion` -- extract files from `affected_entry_points.api_endpoints[].file`, etc.
- M3 `risk_assessment.by_breaking_change` replaces `by_acceptance_criterion` -- extract risk data per breaking change

The verifier should detect the workflow from the delegation prompt and adapt file extraction accordingly. The cross-validation logic (compare, detect gaps, compute completeness) is the same.

### 2.7 Self-Validation

Before returning:
1. All three inputs were parsed (or missing fields noted)
2. File list cross-validation completed (or skipped with note)
3. Risk scoring gaps checked (or skipped with note)
4. Completeness validation completed (or skipped with note)
5. Completeness score computed (0-100)
6. Verification status determined (PASS/WARN/FAIL)
7. Report section is valid markdown
8. JSON structure matches output contract

---

## 3. Input/Output JSON Contracts

### 3.1 M4 Input Contract

M4 receives its input via the delegation prompt from the orchestrator. The prompt includes the raw JSON responses from M1, M2, and M3.

```json
{
  "workflow": "feature | upgrade",
  "m1_response": {
    "status": "success",
    "report_section": "<markdown string>",
    "impact_summary": { ... }
  },
  "m2_response": {
    "status": "success",
    "report_section": "<markdown string>",
    "entry_points": { ... }
  },
  "m3_response": {
    "status": "success",
    "report_section": "<markdown string>",
    "risk_assessment": { ... }
  }
}
```

See Section 2.5 Step 1 for the fields extracted from each response.

### 3.2 M4 Output Contract

```json
{
  "status": "success",
  "report_section": "<markdown string -- Cross-Validation section>",
  "verification_report": {
    "verification_status": "PASS | WARN | FAIL",
    "completeness_score": 85,
    "summary": {
      "total_findings": 5,
      "critical": 1,
      "warning": 3,
      "info": 1
    },
    "findings": [
      {
        "id": "CV-001",
        "severity": "CRITICAL | WARNING | INFO",
        "category": "file_list | risk_scoring | completeness",
        "description": "Human-readable description of the finding",
        "affected_agents": ["M1-found", "M2-missing"],
        "recommendation": "Actionable recommendation"
      }
    ],
    "file_list_delta": {
      "m1_only": ["<files in M1 but not M2>"],
      "m2_only": ["<files in M2 but not M1>"],
      "symmetric_difference_count": 3
    },
    "cross_references": {
      "m2_entry_to_m1_file": {
        "total": 8,
        "valid": 7,
        "missing": 1
      },
      "m1_module_to_m3_risk": {
        "total": 4,
        "valid": 3,
        "missing": 1
      }
    }
  }
}
```

**Finding ID Convention**: `CV-NNN` (Cross-Validation finding, sequential numbering starting at 001).

**Traces**: AC-06.1 (summary), AC-06.2 (finding structure), AC-06.3 (completeness_score), AC-06.4 (verification_status), AC-06.5 (JSON + markdown)

### 3.3 Report Section Format (Markdown)

The `report_section` field contains markdown that the orchestrator embeds directly in impact-analysis.md:

```markdown
## Cross-Validation

### Verification Status: {PASS|WARN|FAIL}

**Completeness Score**: {score}%

### Summary

| Severity | Count |
|----------|-------|
| CRITICAL | {n} |
| WARNING | {n} |
| INFO | {n} |
| **Total** | **{n}** |

### Findings

#### CV-001: {description} ({severity})

**Category**: {category}
**Agents**: {affected_agents}
**Recommendation**: {recommendation}

#### CV-002: ...

### File List Delta

| Source | Files |
|--------|-------|
| M1 only (orphan impact) | {count} |
| M2 only (missing from blast radius) | {count} |
| Symmetric difference | {count} |

### Completeness Cross-References

| Cross-Reference | Total | Valid | Missing |
|----------------|-------|-------|---------|
| M2 entry point -> M1 affected file | {n} | {n} | {n} |
| M1 module -> M3 risk assessment | {n} | {n} | {n} |
```

---

## 4. Orchestrator Integration Design (Step 3.5)

### 4.1 Insertion Point

The new step is inserted between the existing Step 3 (Collect and Validate Results) and Step 4 (Consolidate Report). The existing steps are renumbered:

| Before | After | Description |
|--------|-------|-------------|
| Step 3 | Step 3 | Collect and Validate Results (unchanged) |
| -- | Step 3.5 | Cross-Validate Results (NEW) |
| Step 4 | Step 4 | Consolidate Report (modified to include M4) |

### 4.2 Step 3.5: Cross-Validate Results (NEW)

```markdown
## Step 3.5: Cross-Validate Results

After all three sub-agents complete, launch the cross-validation verifier:

**Show progress (updated):**
IMPACT ANALYSIS                                     [In Progress]
├─ ✓ Impact Analyzer (M1)                              (complete)
├─ ✓ Entry Point Finder (M2)                           (complete)
├─ ✓ Risk Assessor (M3)                                (complete)
└─ ◐ Cross-Validation Verifier (M4)                    (running)

**Fail-Open Check (Tier 1):**
Before launching M4, verify the agent exists. If the cross-validation-verifier
agent is not available, skip this step entirely (no warning, no error).
Proceed directly to Step 4.

**M4: Cross-Validation Verifier**

Cross-validate the findings from M1, M2, and M3.

WORKFLOW: {feature|upgrade}

M1 RESULTS:
{m1_response JSON}

M2 RESULTS:
{m2_response JSON}

M3 RESULTS:
{m3_response JSON}

Cross-validate these results by:
1. Comparing file lists between M1 and M2
2. Checking risk scoring consistency between M1 coupling and M3 risk levels
3. Validating completeness of cross-references
4. Computing overall verification status

Return your verification report as JSON with report_section for the
consolidated report.

**Fail-Open Handling (Tiers 2 and 3):**
If the M4 Task call fails (Tier 2) or returns an unparseable response (Tier 3):
1. Log: "WARNING: Cross-validation verification incomplete. Proceeding without verification."
2. Set m4_status = "skipped"
3. Set verification_note = "Cross-validation was skipped due to verifier error"
4. Proceed to Step 4 without M4 output

If M4 succeeds:
1. Parse the verification_report from the response
2. Set m4_status = "completed"
3. Pass verification results to Step 4 for inclusion in report
```

**Traces**: AC-05.1 (Task call), AC-05.4 (progress display), NFR-02 (fail-open), ADR-0001 (pipeline pattern), ADR-0003 (3-tier fail-open)

### 4.3 Step 4 Modification: Include M4 in Consolidation

The report template adds a Cross-Validation section between Risk Assessment and Implementation Recommendations:

```markdown
## Risk Assessment
{M3 report_section}

---

## Cross-Validation
{M4 report_section, if available}
{OR: "Cross-validation was not performed." if M4 was skipped/absent}

---

## Implementation Recommendations
```

If M4 found CRITICAL findings, add to executive summary:

```markdown
## Executive Summary

{existing summary text}

**Cross-Validation Alerts**: {count} critical finding(s) detected by
the cross-validation verifier. Review the Cross-Validation section
for details.
```

**Traces**: AC-05.2 (included in report), AC-05.3 (critical in executive summary)

### 4.4 Step 5 Modification: State Update

Add M4 to the sub_agents section:

```json
{
  "sub_agents": {
    "M1-impact-analyzer": { "status": "completed", "duration_ms": 12500 },
    "M2-entry-point-finder": { "status": "completed", "duration_ms": 8200 },
    "M3-risk-assessor": { "status": "completed", "duration_ms": 9800 },
    "M4-cross-validation-verifier": {
      "status": "completed | skipped",
      "duration_ms": 5000,
      "verification_status": "PASS | WARN | FAIL",
      "findings_count": 5,
      "completeness_score": 85
    }
  }
}
```

**Traces**: AC-05.5 (M4 in sub_agents)

### 4.5 Metadata Update

The metadata JSON block at the end of impact-analysis.md adds:

```json
{
  "sub_agents": ["M1", "M2", "M3", "M4"],
  "verification_status": "PASS | WARN | FAIL | not_performed",
  "verification_findings": 5,
  "completeness_score": 85
}
```

### 4.6 Summary Display Update

```
IMPACT ANALYSIS COMPLETE

Based on finalized requirements (Phase 01)
Scope Change: {change type}

Blast Radius: {from M1}
Risk Level: {from M3}
Cross-Validation: {PASS|WARN|FAIL} ({findings} findings, {score}% complete)

Key Findings:
{existing findings}
{If CRITICAL M4 findings: list them here}

Impact analysis saved to:
  docs/requirements/{artifact-folder}/impact-analysis.md
```

---

## 5. Skill Definitions Design

### 5.1 Cross-Validation Skill (NEW)

**File**: `src/claude/skills/impact-analysis/cross-validation/SKILL.md`

```yaml
---
name: cross-validation-execution
description: Execute cross-validation checks across M1/M2/M3 outputs to detect inconsistencies
skill_id: IA-401
owner: cross-validation-verifier
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M4 cross-validation after M1/M2/M3 complete
dependencies: [IA-001]
---
```

Sections:
- **Purpose**: Execute file list comparison, risk scoring gap detection, and completeness validation across three agent outputs
- **When to Use**: After M1/M2/M3 complete, when the orchestrator invokes M4
- **Prerequisites**: M1, M2, M3 responses available as JSON
- **Process**: 4 steps (parse inputs, file list cross-validation, risk gap detection, completeness validation)
- **Inputs**: m1_response, m2_response, m3_response (all JSON objects)
- **Outputs**: findings array, file_list_delta, cross_references, completeness_score
- **Validation**: All three inputs processed, findings categorized, score computed

### 5.2 Finding Categorization Skill

**Skill ID**: IA-402

```yaml
---
name: finding-categorization
description: Categorize cross-validation findings by severity and generate structured report
skill_id: IA-402
owner: cross-validation-verifier
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: After cross-validation checks to assemble verification report
dependencies: [IA-401]
---
```

Sections:
- **Purpose**: Take raw findings from cross-validation execution and produce the final verification report with severity classification and markdown report section
- **When to Use**: After IA-401 cross-validation checks produce raw findings
- **Prerequisites**: Raw findings from cross-validation execution
- **Process**: 3 steps (classify severity, determine verification status, generate dual output)
- **Inputs**: raw_findings array, file_list_delta, cross_references
- **Outputs**: verification_report JSON, report_section markdown
- **Validation**: All findings have severity, status determined, markdown valid

### 5.3 Skills Manifest Entries

Add to `ownership` section:

```json
"cross-validation-verifier": {
  "agent_id": "IA4",
  "phase": "02-impact-analysis",
  "skill_count": 2,
  "skills": [
    "IA-401",
    "IA-402"
  ]
}
```

Add to `skill_lookup` section:

```json
"IA-401": "cross-validation-verifier",
"IA-402": "cross-validation-verifier"
```

Add to `skill_paths` section:

```json
"impact-analysis/cross-validation": "cross-validation-verifier"
```

Update `total_skills` from 240 to 242.

**Traces**: AC-07.1 (skill IDs), AC-07.2 (skill file), AC-07.3 (manifest entries), ADR-0002 (IA-4xx series)

### 5.4 Impact Consolidation Skill Update

Update `src/claude/skills/impact-analysis/impact-consolidation/SKILL.md`:

- Description: Add "...and M4 cross-validation verifier" reference
- Prerequisites: Add "M4 verification report (optional)"
- Step 1 (Collect Results): Add "4. M4: Verification report with findings (if available)"
- Inputs table: Add `m4_response | Object | No | Cross-Validation Verifier results`
- Step 3 (Merge Results): Add "6. Include Cross-Validation section (if M4 data available)"
- Step 4 (Generate Report): Add "M4 Cross-Validation section" between Risk Assessment and Recommendations

**Traces**: AC-05.2

---

## 6. Error Taxonomy

See `docs/common/error-taxonomy.md` for the complete error taxonomy. M4-specific errors:

### 6.1 Finding Categories

| Category | Findings | Severity Range |
|----------|----------|----------------|
| file_list | MISSING_FROM_BLAST_RADIUS, ORPHAN_IMPACT | WARNING, INFO |
| risk_scoring | RISK_SCORING_GAP, UNDERTESTED_CRITICAL_PATH | WARNING, CRITICAL |
| completeness | INCOMPLETE_ANALYSIS | WARNING |

### 6.2 Severity Definitions

| Severity | Meaning | Report Impact | Workflow Impact |
|----------|---------|---------------|-----------------|
| CRITICAL | Untested critical path detected | Surfaces in executive summary | None (fail-open) |
| WARNING | Inconsistency between agents | Listed in findings | None |
| INFO | Informational observation | Listed in findings | None |

### 6.3 Orchestrator Error Handling

| Tier | Condition | User Message | State Impact |
|------|-----------|-------------|--------------|
| 1 | Agent file not found | (silent) | No M4 in sub_agents |
| 2 | Task call fails | WARNING log | M4 status: skipped |
| 3 | Response unparseable | WARNING log | M4 status: skipped |

---

## 7. Validation Rules

See `docs/common/validation-rules.json` for the complete validation rules. M4-specific rules:

### 7.1 Input Validation

- m1_response MUST have `status` field (string)
- m2_response MUST have `status` field (string)
- m3_response MUST have `status` field (string)
- If any status is not "success", skip that agent's data and log a note
- Missing fields within agent responses are handled defensively (see Step 1)

### 7.2 Output Validation

- verification_status MUST be one of: "PASS", "WARN", "FAIL"
- completeness_score MUST be integer 0-100
- findings[] each MUST have: id, severity, category, description, affected_agents, recommendation
- severity MUST be one of: "CRITICAL", "WARNING", "INFO"
- category MUST be one of: "file_list", "risk_scoring", "completeness"
- summary.total_findings MUST equal findings[].length
- summary.critical + summary.warning + summary.info MUST equal summary.total_findings

### 7.3 Orchestrator Validation

- Before invoking M4: verify M1, M2, M3 all returned successfully
- After M4: verify response has `verification_report` key
- After M4: verify `verification_report.verification_status` is valid
- If validation fails: treat as Tier 3 failure (ADR-0003)

---

## 8. Traceability Matrix

| Requirement | Design Section | Deliverable |
|-------------|---------------|-------------|
| FR-01 (Agent Definition) | 2.1-2.7 | cross-validation-verifier.md |
| FR-02 (File List Cross-Validation) | 2.5 Step 2 | Agent prompt logic |
| FR-03 (Risk Scoring Gap Detection) | 2.5 Step 3 | Agent prompt logic |
| FR-04 (Completeness Validation) | 2.5 Step 4 | Agent prompt logic |
| FR-05 (Orchestrator Integration) | 4.1-4.6 | Orchestrator modifications |
| FR-06 (Report Structure) | 2.5 Step 5, 3.2, 3.3 | Output contract |
| FR-07 (Skill Registration) | 5.1-5.4 | SKILL.md + manifest |
| NFR-01 (Performance) | 4.2 (single Task call) | Sequential step |
| NFR-02 (Fail-Open) | 4.2-4.3 (3-tier handling) | Orchestrator error handling |
| NFR-03 (Backward Compat) | 4.2 Tier 1 (silent skip) | Agent existence check |
| C-01 (Agent conventions) | 2.1 | Frontmatter format |
| C-02 (Both workflows) | 2.6 | Workflow detection |
| C-03 (Agent location) | 2.1 | File path |
| C-04 (No restructuring) | 4.1 | Additive step |
