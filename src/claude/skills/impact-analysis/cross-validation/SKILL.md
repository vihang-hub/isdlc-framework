---
name: cross-validation-execution
description: Execute cross-validation checks across M1/M2/M3 outputs to detect file list inconsistencies, risk scoring gaps, and completeness issues
skill_id: IA-401
owner: cross-validation-verifier
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M4 cross-validation after M1/M2/M3 complete in Phase 02
dependencies: [IA-001]
---

# Cross-Validation Execution

## Purpose
Execute systematic cross-validation checks across the outputs of three
parallel impact analysis sub-agents (M1, M2, M3) to detect inconsistencies
in file lists, risk assessments, and analysis completeness.

## When to Use
- After M1/M2/M3 sub-agents complete in Phase 02
- When the orchestrator invokes M4 (Step 3.5)
- Both feature and upgrade workflows

## Prerequisites
- M1 (Impact Analyzer) response with impact_summary
- M2 (Entry Point Finder) response with entry_points
- M3 (Risk Assessor) response with risk_assessment
- All three responses have status: "success"

## Process

### Step 1: Extract File Lists
Extract and deduplicate file lists from M1 and M2:
- m1_files: directly_affected[].file + change_propagation.level_0[]
- m2_files: by_acceptance_criterion[*].existing[].file + implementation_chains[*][].location

### Step 2: Compare File Lists
Compute symmetric difference:
- Files in m2 but not m1: flag as MISSING_FROM_BLAST_RADIUS (WARNING)
- Files in m1 but not m2: flag as ORPHAN_IMPACT (INFO)

### Step 3: Detect Risk Scoring Gaps
Cross-reference M1 coupling with M3 risk:
- High coupling + low risk: RISK_SCORING_GAP (WARNING)
- Deep chain + low coverage: UNDERTESTED_CRITICAL_PATH (CRITICAL)
- High blast radius + low overall risk: RISK_SCORING_GAP (WARNING)

### Step 4: Validate Completeness
Check cross-references:
- Each M2 entry point maps to at least one M1 file
- Each M1 module has M3 risk assessment
- Compute completeness score (0-100%)

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| m1_response | Object | Yes | Impact Analyzer results |
| m2_response | Object | Yes | Entry Point Finder results |
| m3_response | Object | Yes | Risk Assessor results |
| workflow | String | Yes | "feature" or "upgrade" |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| findings | Array | Raw findings with severity and category |
| file_list_delta | Object | m1_only, m2_only, count |
| cross_references | Object | Validity counts per cross-ref type |
| completeness_score | Integer | 0-100 percentage |

## Validation
- All three inputs parsed (or gaps noted)
- File list comparison completed
- Risk scoring checks completed
- Completeness checks completed
- All findings have required fields

---

# Finding Categorization

## Skill Definition

```yaml
name: finding-categorization
description: Categorize cross-validation findings by severity, determine verification status, and generate dual JSON/markdown output
skill_id: IA-402
owner: cross-validation-verifier
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: After cross-validation checks to assemble the final verification report
dependencies: [IA-401]
```

## Purpose
Take raw findings from cross-validation execution (IA-401) and produce the
final verification report with severity classification, verification status
determination, and dual JSON/markdown output.

## When to Use
- After IA-401 (cross-validation-execution) produces raw findings
- When assembling the M4 response to the orchestrator

## Prerequisites
- Raw findings array from IA-401
- File list delta from IA-401
- Cross-reference counts from IA-401
- Completeness score from IA-401

## Process

### Step 1: Assign Finding IDs
Number findings sequentially: CV-001, CV-002, CV-003, ...

### Step 2: Count by Severity
- critical = count CRITICAL findings
- warning = count WARNING findings
- info = count INFO findings
- total = critical + warning + info

### Step 3: Determine Verification Status
- FAIL: critical > 0
- WARN: critical == 0 AND warning > 0
- PASS: critical == 0 AND warning == 0

### Step 4: Generate Markdown Report Section
Build the report_section markdown with summary table, findings list,
file list delta, and cross-reference tables.

### Step 5: Assemble JSON Output
Combine into the verification_report structure with all fields.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| raw_findings | Array | Yes | Findings from IA-401 |
| file_list_delta | Object | Yes | Delta from IA-401 |
| cross_references | Object | Yes | Cross-ref counts from IA-401 |
| completeness_score | Integer | Yes | Score from IA-401 |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| verification_report | Object | Complete verification JSON |
| report_section | String | Markdown for impact-analysis.md |

## Validation
- All findings have IDs
- Summary counts match array length
- Verification status matches severity counts
- Markdown is well-formed
- JSON matches output contract schema
