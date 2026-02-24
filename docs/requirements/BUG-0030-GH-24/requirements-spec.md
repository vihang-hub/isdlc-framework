# Bug Report: BUG-0030-GH-24

## Impact Analysis Sub-Agents Anchor on Quick Scan File List Instead of Performing Independent Search

**ID**: BUG-0030-GH-24
**Type**: Bug Fix
**Severity**: Medium
**Priority**: Medium
**External Link**: https://github.com/vihangshah/isdlc/issues/24
**Source**: BACKLOG.md item 14.4
**Created**: 2026-02-18
**Status**: Open

---

## 1. Problem Description

Phase 02 impact analysis sub-agents (M1-Impact Analyzer, M2-Entry Point Finder, M3-Risk Assessor) rely on the Quick Scan (Phase 00) file inventory as their starting point for analysis instead of performing their own independent exhaustive search of the codebase. When Phase 00 misses files, the gap propagates through Phase 02 and into all downstream phases (architecture, design, implementation).

The cross-validation verifier (M4) also fails to catch these gaps because it only cross-references M1/M2/M3 outputs against each other -- it never independently verifies that the combined file lists are complete against the actual codebase.

### Root Cause

The M1/M2/M3 agent prompt files do not contain explicit instructions to perform independent file discovery. They accept the quick scan's file list as a given and analyze only those files. The M4 agent only compares M1/M2/M3 outputs against each other (set difference operations) without any independent codebase search to find files that all three agents missed.

### Observed Behavior

During the BUG-0029 analysis, the quick scan (Phase 00) missed 3 agent files that contained multiline Bash commands. Because M1/M2/M3 anchored on the quick scan file list, none of them found these files. M4's cross-validation also did not detect the gap because all three sub-agents consistently missed the same files -- there was no M1-vs-M2 delta to flag.

### Expected Behavior

Each sub-agent (M1, M2, M3) should perform its own exhaustive codebase search relevant to the feature/bug requirements, using the quick scan output only as a supplementary hint -- not as the definitive file list. M4 should independently verify that the union of M1+M2+M3 file lists covers all files that match the requirements keywords.

---

## 2. Reproduction Steps

1. Start a feature or fix workflow on a codebase where the quick scan (Phase 00) does not find all relevant files
2. Observe that Phase 02 sub-agents M1, M2, M3 only analyze files listed in the quick scan output
3. Observe that M4 cross-validation does not flag the missing files because the gap is consistent across all agents
4. Downstream phases (architecture, design, implementation) inherit the incomplete file list
5. Implementation misses files that should have been modified

---

## 3. Affected Files

| File | Agent | Role | Change Type |
|------|-------|------|-------------|
| `src/claude/agents/impact-analysis/impact-analyzer.md` | M1 | Impact Analyzer | Prompt modification |
| `src/claude/agents/impact-analysis/entry-point-finder.md` | M2 | Entry Point Finder | Prompt modification |
| `src/claude/agents/impact-analysis/risk-assessor.md` | M3 | Risk Assessor | Prompt modification |
| `src/claude/agents/impact-analysis/cross-validation-verifier.md` | M4 | Cross-Validation Verifier | Prompt modification + new verification step |

---

## 4. Acceptance Criteria

### AC-01: M1 (Impact Analyzer) performs independent file search
- **Given** the Impact Analyzer receives a delegation with requirements context
- **When** it begins Step 3 (Identify Directly Affected Areas)
- **Then** it MUST perform its own exhaustive codebase search using Grep and Glob tools for domain keywords derived from the requirements
- **And** it MUST NOT treat the quick scan file list as complete or authoritative
- **And** it MUST use the quick scan output only as a supplementary reference to seed initial keywords

### AC-02: M2 (Entry Point Finder) performs independent file search
- **Given** the Entry Point Finder receives a delegation with requirements context
- **When** it begins Step 3 (Search for Existing Entry Points)
- **Then** it MUST perform its own exhaustive search for entry points (API routes, UI components, job handlers, event listeners) using Grep and Glob tools
- **And** it MUST NOT limit its search to files listed in the quick scan
- **And** it MUST discover entry points by searching the actual codebase file tree

### AC-03: M3 (Risk Assessor) performs independent file search
- **Given** the Risk Assessor receives a delegation with requirements context
- **When** it begins risk area identification
- **Then** it MUST independently search the codebase for files matching risk assessment criteria (coverage gaps, complexity indicators, technical debt markers)
- **And** it MUST NOT assume the quick scan file list is exhaustive
- **And** it MUST verify that all files relevant to each acceptance criterion are included in its analysis

### AC-04: M4 (Cross-Validation Verifier) independently verifies file list completeness
- **Given** the Cross-Validation Verifier receives M1, M2, M3 outputs
- **When** it performs cross-validation
- **Then** it MUST add a new verification step that independently searches the codebase for files matching the feature/bug keywords
- **And** it MUST compare its independently-found file list against the union of M1+M2+M3 file lists
- **And** it MUST flag any files found in its independent search but missing from all three agents as CRITICAL findings (category: `completeness_gap`)
- **And** the finding description MUST clearly state the file was missed by all sub-agents

### AC-05: Quick scan output is explicitly labeled as non-authoritative
- **Given** the M1, M2, M3 agent prompt files reference quick scan output
- **When** an agent reads the quick scan context
- **Then** the prompt MUST contain an explicit warning that the quick scan file list is a convenience hint, NOT an exhaustive inventory
- **And** the warning MUST instruct the agent to perform its own search as the primary file discovery mechanism

---

## 5. Non-Functional Requirements

### NFR-01: No regression in analysis quality
- The fix must not reduce the quality or depth of existing analysis
- Agents must still use quick scan output as supplementary context (not discard it entirely)

### NFR-02: Prompt-only changes
- All changes are to `.md` agent prompt files
- No code changes to hooks, CLI, or runtime configuration
- No changes to state.json schema or workflow definitions

### NFR-03: Backward compatibility
- Quick scan output remains available to agents as supplementary context
- No changes to the M0 orchestrator delegation format
- No changes to agent output JSON schemas

---

## 6. Out of Scope

- Modifying the quick scan agent (Phase 00) to produce more complete file lists
- Adding runtime validation hooks for file list completeness
- Changing the M0 orchestrator's parallel delegation pattern
- Modifying the impact-analysis.md output format

---

## 7. Fix Strategy

### Part A: Add independent search instructions to M1/M2/M3

Add a prominent instruction block to each agent's PROCESS section (before the file search steps) that:
1. States the quick scan file list is NOT authoritative and MUST NOT be treated as complete
2. Instructs the agent to perform its own exhaustive search using Grep and Glob tools
3. Instructs the agent to use quick scan output only as supplementary context (additional keywords, seed file paths)
4. Provides specific search methodology guidance (search by content keywords, file name patterns, import/require chains)

### Part C: Strengthen M4 cross-validator

Add a new verification step to M4 (after the existing file list cross-validation) that:
1. Extracts domain keywords from the feature/bug requirements
2. Performs an independent codebase search using those keywords
3. Compares found files against the union of M1+M2+M3 file lists
4. Flags files found independently but missed by all agents as CRITICAL completeness gaps

---

## 8. Traceability

| AC | Affected File | Section to Modify |
|----|---------------|-------------------|
| AC-01, AC-05 | impact-analyzer.md | PROCESS > Step 1 or Step 3, add independent search block |
| AC-02, AC-05 | entry-point-finder.md | PROCESS > Step 1 or Step 3, add independent search block |
| AC-03, AC-05 | risk-assessor.md | PROCESS > Step 1 or Step 2, add independent search block |
| AC-04 | cross-validation-verifier.md | PROCESS > new Step (after Step 2), add completeness verification |
