---
name: scope-refinement
description: Compare original feature description with finalized requirements to identify scope changes
skill_id: IA-003
owner: impact-analysis-orchestrator
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: At start of Phase 02 to detect scope changes from Phase 01
dependencies: []
---

# Scope Refinement

## Purpose
Compare the original feature description (from Phase 00 Quick Scan) with the finalized requirements (from Phase 01) to identify how the scope has changed and ensure impact analysis uses the correct, clarified scope.

## When to Use
- Starting Phase 02 Impact Analysis
- Detecting scope drift between phases
- Adjusting analysis keywords based on requirements
- Documenting scope evolution

## Prerequisites
- Quick scan completed (Phase 00)
- Requirements captured (Phase 01)
- Both artifacts accessible

## Process

### Step 1: Load Original Scope
```
From quick-scan.md:
1. Original feature description
2. Initial domain keywords
3. Initial technical keywords
4. Initial file count estimate
```

### Step 2: Load Clarified Scope
```
From requirements.md:
1. Refined feature description
2. All acceptance criteria
3. Constraints and non-functional requirements
4. Out-of-scope items explicitly excluded
```

### Step 3: Compare Scopes
```
Identify changes:
- EXPANDED: New requirements added beyond original
- REDUCED: Some original scope removed
- REFINED: Same scope but clearer/more specific
- UNCHANGED: No significant changes

Extract new keywords from requirements.
```

### Step 4: Generate Scope Comparison
```
Create comparison table:
| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | ... | ... |
| Keywords | ... | ... |
| Estimated Files | ... | ... |
| Scope Change | - | expanded/reduced/refined |
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| quick_scan_path | String | Yes | Path to quick-scan.md |
| requirements_path | String | Yes | Path to requirements.md |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| scope_change | String | expanded/reduced/refined/unchanged |
| original_keywords | Array | Keywords from quick scan |
| clarified_keywords | Array | Keywords from requirements |
| new_keywords | Array | Keywords added in requirements |
| comparison_table | String | Markdown comparison table |

## Validation
- Both source documents loaded
- Scope change classified correctly
- New keywords identified
- Comparison table generated
