# Trace Analysis: Impact Analysis Sub-Agents Anchor on Quick Scan File List

**Generated**: 2026-02-18
**Bug**: BUG-0030-GH-24
**External ID**: GitHub Issue #24
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The root cause is an **omission in the M1, M2, and M3 agent prompt files**: none of them contain instructions to perform independent codebase searches using Glob/Grep tools. Their PROCESS sections describe "searching" at a conceptual level (e.g., "grep for keywords") but frame this as analyzing files already known to be relevant -- they never instruct the agent to exhaustively discover unknown files. The quick scan (Phase 00) file list reaches the sub-agents through the orchestrator's delegation context and the discovery report, and since no instruction overrides this implicit input, the agents treat it as the definitive scope. The M4 cross-validation verifier compounds the problem by only performing set-difference operations across M1/M2/M3 outputs -- it never independently searches the codebase, so when all three agents miss the same files, M4 reports zero findings.

**Root Cause Confidence**: HIGH
**Severity**: Medium
**Estimated Complexity**: Low (prompt-only changes to 4 `.md` files)

---

## Symptom Analysis

### Observed Behavior

During the BUG-0029-GH-18 analysis (multiline Bash permission bypass), the quick scan (Phase 00) identified 5 agent files containing multiline Bash blocks. Phase 02 impact analysis found the exact same 5 files -- no more, no fewer. Manual investigation later revealed 3 additional agent files that were missed:

| Missed File | Content Pattern |
|-------------|-----------------|
| `src/claude/agents/discover/architecture-analyzer.md` | Contains multiline Bash blocks |
| `src/claude/agents/discover/test-evaluator.md` | Contains multiline Bash blocks |
| `src/claude/agents/discover/skills-researcher.md` | Contains multiline Bash blocks |

### Symptom Pattern

The symptom pattern is **consistent omission** -- all three sub-agents (M1, M2, M3) missed the same 3 files. This is the hallmark of a shared input bottleneck rather than independent agent failures. If each agent searched independently, the probability of all three missing the same files would be low. The fact that they produced identical file lists strongly indicates they all derived their file lists from the same source: the Phase 00 quick scan output.

### Error Source in Agent Files

No error messages or stack traces are involved. The "error" is behavioral: the agents follow their prompt instructions faithfully, but those instructions do not require independent file discovery. The problem is in what the prompts **do not say**, not in what they say incorrectly.

---

## Execution Path

### Phase 00 to Phase 02 Data Flow

The execution path from Phase 00 quick scan to Phase 02 sub-agents follows this chain:

```
Phase 00: Quick Scan Agent
    |
    | Writes: docs/requirements/{artifact-folder}/quick-scan.md
    |         (contains file list, keyword matches, scope estimate)
    v
Impact Analysis Orchestrator (M0)
    |
    | Reads: quick-scan.md (Step 3 of PRE-PHASE CHECK, line 86-87)
    | Reads: requirements-spec.md (from Phase 01)
    | Reads: discovery report
    |
    | Constructs: requirements_context JSON
    | Constructs: delegation prompts for M1, M2, M3
    |
    | Delegation includes:
    |   - "Feature (Clarified Requirements): {summary}"
    |   - "Acceptance Criteria: {list}"
    |   - "Requirements Context: {JSON}"
    |   - "Discovery Report: {path}"
    |
    +---> M1: Impact Analyzer
    |         Receives: requirements context + discovery report path
    |         Step 3: "Search for files matching domain keywords"
    |         NO instruction to use Glob/Grep tools independently
    |
    +---> M2: Entry Point Finder
    |         Receives: requirements context + discovery report path
    |         Step 3: "Search for Existing Entry Points"
    |         NO instruction to use Glob/Grep tools independently
    |
    +---> M3: Risk Assessor
              Receives: requirements context + discovery report path
              Step 2: "Map Acceptance Criteria to Risk Areas"
              NO instruction to use Glob/Grep tools independently
```

### How Quick Scan Output Propagates

1. **Direct path** (orchestrator lines 86-87): The orchestrator explicitly loads `quick-scan.md` in its PRE-PHASE CHECK and uses it for scope comparison. The quick scan's file list and keyword matches become part of the `requirements_context` JSON that gets passed to sub-agents.

2. **Indirect path** (discovery report): The discovery report (`docs/project-discovery-report.md`) also contains a feature map and file inventory. When sub-agents read the discovery report, they get another pre-computed file list that may overlap with or extend the quick scan.

3. **Implicit anchoring**: The delegation prompts to M1/M2/M3 (orchestrator lines 192-254) say things like "Focus on: Which files/modules will be directly affected" but provide the requirements context as the primary input. Since the requirements context already includes file references from the quick scan, agents naturally scope their analysis to those files.

### Tracing Each Agent's File Search Instructions

#### M1: Impact Analyzer (`impact-analyzer.md`)

**Step 3 (lines 86-98): "Identify Directly Affected Areas"**
```
Based on requirements keywords and acceptance criteria:

1. Search for files matching domain keywords
   - grep for "user", "preference", "settings" in file names and content

2. Search for modules matching technical keywords
   - Look for API routes, services, repositories related to feature

3. Map each acceptance criterion to specific files
```

**Analysis**: Step 3 says "search" and "grep" but these are conceptual instructions -- examples of what to look for, not tool-level directives. There is no instruction saying "Use the Grep tool to search the entire codebase" or "Do not limit your search to files already identified." The word "exhaustive" only appears once in the entire file (line 332), and only in the UPGRADE WORKFLOW section, not the feature workflow section.

#### M2: Entry Point Finder (`entry-point-finder.md`)

**Step 3 (lines 93-138): "Search for Existing Entry Points"**
```
Based on requirements, search each entry point type:

### API Endpoints
Search for:
- Routes matching acceptance criteria
- Controllers with related methods
- OpenAPI/Swagger definitions

### UI Components
Search for:
- Pages/views that support acceptance criteria
...
```

**Analysis**: Like M1, the instructions say "search for" but do not specify tool usage or scope. The word "Glob" and "Grep" do not appear anywhere in the file. The word "independent" does not appear. The word "exhaustive" does not appear. The agent has no instruction to search beyond what the delegation context provides.

#### M3: Risk Assessor (`risk-assessor.md`)

**Step 2 (lines 73-86): "Map Acceptance Criteria to Risk Areas"**
```
For EACH acceptance criterion, identify areas to assess:

AC1: "User can set email notification preferences"
  -> Risk areas: EmailService, NotificationService, UserPreferences entity
```

**Analysis**: M3's process does not even include a "search" step. Step 2 asks to "identify areas to assess" and Step 3 asks to "Detect Coverage Gaps Per Acceptance Criterion" -- both assume the set of relevant areas/files is already known. The words "Glob", "Grep", "independent", "exhaustive", and "codebase search" do not appear anywhere in the file.

### Why M4 Fails to Catch the Gap

#### M4: Cross-Validation Verifier (`cross-validation-verifier.md`)

**Step 2 (lines 100-146): "File List Cross-Validation"**
```
Extract and compare file lists from M1 and M2:

m1_files:
  - All files from M1.directly_affected[].file
  - All files from M1.change_propagation.level_0[]

m2_files:
  - All files from M2.by_acceptance_criterion[*].existing[].file
  - All file paths from M2.implementation_chains[*][].location

Check 2a: Files in M2 but not M1 -- MISSING_FROM_BLAST_RADIUS
Check 2b: Files in M1 but not M2 -- ORPHAN_IMPACT
```

**Analysis**: M4's entire validation logic is based on **comparing M1/M2/M3 outputs against each other**. It performs:

- **Check 2a/2b**: Set difference between M1 and M2 file lists
- **Check 3a**: Coupling (from M1) vs risk score (from M3)
- **Check 3b**: Chain depth (from M2) vs coverage (from M3)
- **Check 3c**: Blast radius (from M1) vs overall risk (from M3)
- **Check 4a**: M2 entry points mapped to M1 files
- **Check 4b**: M1 modules mapped to M3 risk assessments

**Every check is a cross-reference between agent outputs.** There is no step that says "Independently search the codebase" or "Verify the combined file list is complete." The words "Glob", "Grep", "independent search", and "codebase search" do not appear in the M4 prompt.

When all three agents miss the same files (because they all anchor on the same quick scan input), M4's set-difference operations produce zero findings -- the file lists are perfectly consistent with each other, just consistently incomplete.

---

## Root Cause Analysis

### Primary Hypothesis (Confidence: HIGH)

**Root Cause**: The M1, M2, and M3 agent prompt files lack explicit instructions to perform independent, exhaustive codebase searches using Glob and Grep tools. Their "search" steps are conceptual guidance (what to look for) rather than operational directives (how to find it). Combined with the quick scan file list being passed through the delegation context, agents naturally scope their analysis to already-known files.

**Evidence**:
1. The word "Glob" appears 0 times in M1, M2, M3, M4 prompt files (feature workflow sections)
2. The word "Grep" appears 0 times in M2, M3, M4; appears once in M1 as a conceptual example ("grep for...")
3. The word "independent" appears 0 times in M1, M2, M3, M4
4. The word "exhaustive" appears 0 times in the feature workflow sections of M1, M2, M3 (appears once in M1's upgrade section, line 332)
5. The word "codebase" with "search" in proximity appears 0 times in all four files
6. M4's entire validation logic is cross-referencing agent outputs, with no independent verification step
7. The BUG-0029 case produced identical file lists across M1/M2/M3, matching Phase 00 output exactly

### Secondary Hypothesis (Confidence: MEDIUM)

**Contributing Factor**: The orchestrator's delegation prompts (lines 192-254 in `impact-analysis-orchestrator.md`) pass `requirements_context` JSON that already contains file references from quick scan, biasing the agents toward those files from the start.

**Evidence**: The orchestrator reads `quick-scan.md` in its PRE-PHASE CHECK (line 86-87), extracts keywords and file references, and passes them as `Requirements Context` in the delegation prompt. This creates an implicit scope boundary.

### Tertiary Hypothesis (Confidence: MEDIUM)

**Contributing Factor**: The discovery report (`docs/project-discovery-report.md`) serves as another source of pre-computed file lists. When agents read it, they get file inventories that may reinforce the quick scan's incomplete picture rather than challenge it.

**Evidence**: All three delegation prompts include `Discovery Report: {path}` (orchestrator lines 202, 224, 246).

### Suggested Fixes

All fixes are prompt-only changes to `.md` agent files:

#### Fix 1: Add Independent Search Directive to M1 (impact-analyzer.md)

Insert a new instruction block before Step 3 (or at the beginning of Step 3) that explicitly requires independent file discovery:

**Location**: `src/claude/agents/impact-analysis/impact-analyzer.md`, Step 3 (around line 86)

**Content to add**: A warning block stating that the quick scan file list is NOT authoritative and MUST NOT be treated as complete, followed by instructions to perform exhaustive Glob/Grep searches for domain keywords derived from the requirements.

#### Fix 2: Add Independent Search Directive to M2 (entry-point-finder.md)

**Location**: `src/claude/agents/impact-analysis/entry-point-finder.md`, Step 3 (around line 93)

**Content to add**: Same pattern as Fix 1 -- explicit instruction to search the codebase using Glob/Grep tools, not just analyze files already known.

#### Fix 3: Add Independent Search Directive to M3 (risk-assessor.md)

**Location**: `src/claude/agents/impact-analysis/risk-assessor.md`, Step 2 (around line 73)

**Content to add**: Same pattern -- explicit instruction to independently identify risk areas by searching the codebase, not just analyzing pre-identified areas.

#### Fix 4: Add Independent Completeness Verification to M4 (cross-validation-verifier.md)

**Location**: `src/claude/agents/impact-analysis/cross-validation-verifier.md`, after Step 4 (around line 253)

**Content to add**: A new step (Step 4.5 or Step 5, renumbering subsequent steps) that:
1. Extracts domain keywords from the feature/bug requirements
2. Performs an independent codebase search using those keywords with Glob/Grep
3. Compares the independently-found file list against the union of M1+M2+M3 file lists
4. Flags files found independently but missing from all three agents as CRITICAL `completeness_gap` findings

#### Fix 5: Label Quick Scan as Non-Authoritative in All Agent Prompts

Add an explicit warning to M1, M2, and M3 that the quick scan file list is a "convenience hint" or "supplementary context only" -- not an exhaustive inventory.

### Hypothesis Ranking

| Rank | Hypothesis | Confidence | Impact | Fixable |
|------|-----------|------------|--------|---------|
| 1 | M1/M2/M3 lack independent search instructions | HIGH | HIGH | Yes - prompt changes |
| 2 | M4 lacks independent verification step | HIGH | HIGH | Yes - prompt changes |
| 3 | Orchestrator passes pre-scoped context | MEDIUM | MEDIUM | No change needed if Fix 1-3 applied |
| 4 | Discovery report reinforces incomplete picture | MEDIUM | LOW | No change needed if Fix 1-3 applied |

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-18",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "files_examined": [
    "src/claude/agents/impact-analysis/impact-analyzer.md",
    "src/claude/agents/impact-analysis/entry-point-finder.md",
    "src/claude/agents/impact-analysis/risk-assessor.md",
    "src/claude/agents/impact-analysis/cross-validation-verifier.md",
    "src/claude/agents/impact-analysis/impact-analysis-orchestrator.md",
    "src/claude/agents/quick-scan/quick-scan-agent.md"
  ],
  "error_keywords": ["independent", "exhaustive", "Glob", "Grep", "codebase search", "quick scan", "file list"],
  "search_results": {
    "Glob_in_M1_feature_section": 0,
    "Grep_in_M1_feature_section": 0,
    "independent_in_any_agent": 0,
    "exhaustive_in_M1_feature": 0,
    "exhaustive_in_M2": 0,
    "exhaustive_in_M3": 0,
    "independent_search_in_M4": 0
  }
}
```
