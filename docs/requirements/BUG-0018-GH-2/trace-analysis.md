# Trace Analysis: Backlog Picker Pattern Mismatch After BACKLOG.md Restructure

**Generated**: 2026-02-16T10:15:00Z
**Bug**: BUG-0018 -- Backlog picker pattern mismatch after BACKLOG.md restructure
**External ID**: [GitHub #2](https://github.com/vihang-hub/isdlc-framework/issues/2)
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The backlog picker in `00-sdlc-orchestrator.md` (lines 288-346) scans BACKLOG.md for `- N.N [ ] <text>` patterns but does not account for the `-> [requirements](...)` suffix introduced by REQ-0019's Phase A Preparation Pipeline. The scan pattern captures everything after the checkbox as the item title, so when BACKLOG.md contains index-format entries like `- 3.1 [ ] Parallel workflow support -> [requirements](docs/requirements/3.1-parallel-workflow-support/)`, the full `-> [requirements](...)` suffix is included in the displayed title and passed as the workflow description. The root cause is a single markdown pattern definition in the orchestrator that was never updated for the new format, combined with the Phase A intake step (`isdlc.md` line 257) that writes entries in the new format. Additionally, `workflows.json` has no `start` action entry, though the `start` command in `isdlc.md` intentionally reuses the `feature` workflow phases from Phase 02 onward, so this is by design and not a bug.

**Root Cause Confidence**: High
**Severity**: Medium
**Estimated Complexity**: Low

---

## Symptom Analysis

### Error Manifestation

The bug manifests in two observable ways:

1. **Polluted picker titles**: When the backlog picker presents items from a BACKLOG.md using REQ-0019's index format, items display as:
   ```
   [1] Spike/explore workflow -> [requirements](docs/requirements/1.1-spike-explore-workflow/)
   ```
   Instead of the expected clean title:
   ```
   [1] Spike/explore workflow
   ```

2. **Polluted workflow description**: When a user selects a polluted item, the entire string including the `-> [requirements](...)` suffix becomes the workflow description in `active_workflow.description`, propagating the junk text into artifacts, branch names, and state.json.

### Triggering Conditions

- **Trigger 1 (Index-format BACKLOG.md)**: Invoke `/isdlc feature` or `/isdlc fix` without a description when BACKLOG.md contains entries in the REQ-0019 index format (`- N.N [ ] Title -> [requirements](...)`). This was the BACKLOG.md state between commits `cd9de9c` and `1ee66ab`.

- **Trigger 2 (Mixed-format BACKLOG.md)**: After Phase A adds a new item via `isdlc.md` line 257 (which always writes `- {id} [ ] {title} -> [requirements](docs/requirements/{slug}/)`), even a restored full-spec BACKLOG.md will have mixed entries. The new Phase A entry will exhibit the suffix problem.

- **Trigger 3 (Design-suffix items)**: The requirements spec notes that `-> [design](...)` suffixes should also be stripped. While no current code path produces this format, it is a forward-looking concern documented in FR-1 AC-1.2.

### Reproduction Confirmation

The BACKLOG.md at commit `cd9de9c` (REQ-0019 merge) through `6c7cf5c` (GH-2 entry) used the index format. The pre-branch checkpoint `1ee66ab` for this bug restored BACKLOG.md to the full inline format. However, the Phase A code in `isdlc.md` line 257 still generates the index format for new entries, meaning the bug will recur whenever Phase A is used.

### Error Keywords

- Pattern: `- N.N [ ] <text>`
- Suffix: `-> [requirements](...)`
- Suffix: `-> [design](...)`
- Affected code: BACKLOG PICKER section

---

## Execution Path

### Entry Points

There are two entry points that trigger the backlog picker:

1. **`/isdlc feature` (no description)**: Routed through `isdlc.md` line 858-862, which launches the `sdlc-orchestrator` agent with the instruction to run the BACKLOG PICKER in feature mode.

2. **`/isdlc fix` (no description)**: Same routing, but with fix mode. Fix mode additionally filters items by bug-related keywords.

### Call Chain

```
User invokes: /isdlc feature (no description)
  -> isdlc.md: STEP 0 ACTION ROUTING (line ~858)
     -> "Action is feature but no description provided. Run the BACKLOG PICKER in feature mode"
     -> Task tool -> sdlc-orchestrator agent
        -> 00-sdlc-orchestrator.md: BACKLOG PICKER section (line 288)
           -> Step 1: Read BACKLOG.md file
           -> Step 2: Find "## Open" section
           -> Step 3: Scan for "- N.N [ ] <text>" patterns  <-- BUG: <text> captures everything including suffix
           -> Step 4: Parse Jira metadata sub-bullets
           -> Step 5: Present items via AskUserQuestion
              -> Display: "[1] Title -> [requirements](...)"  <-- POLLUTED
           -> Step 6: User selects item
           -> Step 7: Use chosen text as workflow description  <-- POLLUTED DESCRIPTION
              -> Proceed to workflow initialization
```

### Data Flow Analysis

1. **BACKLOG.md read**: The orchestrator reads the raw file content
2. **Pattern match**: `- N.N [ ] <text>` regex captures text after the checkbox
3. **No suffix stripping**: The captured text is used as-is
4. **Picker display**: Full captured text shown to user
5. **Description propagation**: On selection, the polluted text becomes `active_workflow.description`
6. **Downstream impact**: Description appears in branch names, state.json, artifact headers

### Failure Point

The failure occurs at **Step 3** of the call chain: the scan pattern `- N.N [ ] <text>` in `00-sdlc-orchestrator.md` line 294. The pattern defines `<text>` as "everything after the checkbox", with no instruction to strip link suffixes.

---

## Root Cause Analysis

### Hypothesis 1: Missing suffix stripping in picker scan pattern (CONFIRMED -- HIGH confidence)

**Evidence**:
- The BACKLOG PICKER section at line 294 of `00-sdlc-orchestrator.md` explicitly defines the scan as: `Scan BACKLOG.md ## Open section for - N.N [ ] <text> patterns (item number + checkbox + text)`.
- There is NO instruction to strip `-> [requirements](...)` or `-> [design](...)` suffixes from the captured text.
- The REQ-0019 commit (`cd9de9c`) introduced the index format in BACKLOG.md without updating the picker pattern.
- Phase A in `isdlc.md` line 257 generates the suffix: `- {id} [ ] {title} -> [requirements](docs/requirements/{slug}/)`.
- The BACKLOG.md at commits `cd9de9c` through `6c7cf5c` contained the index format entries, confirming the pattern mismatch.

**Root cause**: The picker pattern was designed for the original BACKLOG.md format (`- N.N [ ] Title text`) and was never updated when REQ-0019 introduced the `-> [requirements](...)` suffix.

### Hypothesis 2: workflows.json missing `start` entry (EVALUATED -- NOT A BUG)

**Evidence**:
- `workflows.json` has no `start` key in the `workflows` object.
- However, `isdlc.md` lines 586-613 define the `start` action as a Phase B consumption command that reuses the `feature` workflow starting from Phase 02.
- Line 874 lists `start` as a WORKFLOW command alongside feature, fix, etc.
- Line 882-886 describe how `start` uses the feature workflow's Phase-Loop Controller with `SKIP_PHASES: ["00-quick-scan", "01-requirements"]`.

**Conclusion**: The `start` action intentionally reuses the `feature` workflow phases rather than having its own entry. This is by design -- the Phase A/B split means Phase A runs outside workflows.json and Phase B picks up an existing workflow definition. **No fix needed for workflows.json**. The mechanism should be documented in a code comment (per AC-5.3).

### Hypothesis 3: Backlog test files need format updates (EVALUATED -- NO EXISTING TESTS FOUND)

**Evidence**:
- No test files matching `backlog*test*` exist in `src/claude/hooks/tests/`.
- No test files in the entire project reference backlog picker patterns.
- The backlog picker is defined in a markdown agent file (`00-sdlc-orchestrator.md`), not in executable code, so there are no unit-testable functions to test.
- The requirements spec mentions "5 backlog test files" (FR-4), but this appears to be based on an assumption. The actual test coverage is zero for backlog parsing.

**Conclusion**: There are no existing backlog picker tests to update. New tests should be created for the pattern matching, but these would be integration/behavior tests for the orchestrator rather than unit tests for hook code. The test strategy phase should address what kind of tests are appropriate.

### Similar Past Bugs

- **BUG-0004** (commit `1ee66ab` lineage): Fixed a stale INTERACTIVE PROTOCOL block in the orchestrator. Similar pattern -- an orchestrator markdown section that became stale after another feature changed its prerequisites.
- **BUG-0017** (commit `8cd9889`): Fixed misleading artifact error messages in gate-blocker. Similar symptom category -- display/parsing issues caused by format evolution.

### Suggested Fix

**Primary fix (Component 1 -- orchestrator picker pattern)**:

Update the BACKLOG PICKER section in `src/claude/agents/00-sdlc-orchestrator.md` (line 294 and surrounding context) to:

1. Add a suffix-stripping instruction after the scan pattern:
   ```
   After capturing <text>, strip any trailing ` -> [requirements](...)` or ` -> [design](...)` suffix.
   Specifically: if the captured text contains ` -> [`, truncate at that point to get the clean title.
   ```

2. Apply the stripping to both feature mode (line 294) and fix mode (line 312) scan instructions.

3. Ensure the stripped text (clean title) is used for:
   - Picker display
   - Workflow description on selection
   - Jira keyword filtering in fix mode (strip before keyword matching to avoid false matches on link text)

**Complexity**: Low -- 2-3 lines of instruction added to a markdown file.

**Secondary fix (Component 2 -- documentation for `start` action)**:

Add a comment in `isdlc.md` near line 592 or in `workflows.json` noting that `start` intentionally reuses the `feature` workflow definition and does not need its own entry.

**Complexity**: Trivial -- 1-2 lines of comment.

**No fix needed for Component 3**: No existing test files to update. New test cases should be designed in Phase 05 (test strategy).

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-16T10:15:00Z",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": [
    "BACKLOG PICKER",
    "-> [requirements]",
    "-> [design]",
    "- N.N [ ] <text>",
    "suffix stripping",
    "index format"
  ],
  "files_analyzed": [
    "src/claude/agents/00-sdlc-orchestrator.md (lines 288-346)",
    "src/claude/commands/isdlc.md (lines 230-285, 586-613, 858-886)",
    "BACKLOG.md (current and historical at commits cd9de9c, a78f21c, 6c7cf5c, 1ee66ab)",
    ".isdlc/config/workflows.json"
  ],
  "git_history_consulted": [
    "cd9de9c feat: preparation pipeline (REQ-0019) -- introduced index format",
    "a78f21c merge: feat REQ-0019 -- merged index format to main",
    "6c7cf5c chore: add backlog entry for REQ-0019 follow-up (GH-2)",
    "1ee66ab chore: pre-branch checkpoint for BUG-0018-GH-2 -- restored inline format"
  ],
  "hypotheses_evaluated": 3,
  "hypotheses_confirmed": 1,
  "hypotheses_dismissed": 2,
  "root_cause_confidence": "high",
  "fix_complexity": "low"
}
```
