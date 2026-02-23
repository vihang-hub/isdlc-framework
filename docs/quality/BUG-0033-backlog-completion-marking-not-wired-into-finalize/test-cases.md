# Test Cases: BUG-0033 BACKLOG.md Completion Marking Not Wired Into Finalize

**Bug ID:** BUG-0033-GH-11
**Phase:** 05-test-strategy
**Created:** 2026-02-23
**Total Test Cases:** 26

---

## Test Case Index

| ID | Category | Requirement | Type | Priority |
|----|----------|-------------|------|----------|
| SV-01 | Spec Validation | FR-006, AC-008 | positive | P0 |
| SV-02 | Spec Validation | FR-006, AC-008 | positive | P0 |
| SV-03 | Spec Validation | FR-001, AC-001 | positive | P0 |
| SV-04 | Spec Validation | FR-001, AC-002 | positive | P0 |
| SV-05 | Spec Validation | FR-002, AC-001 | positive | P0 |
| SV-06 | Spec Validation | FR-003, AC-001 | positive | P1 |
| SV-07 | Spec Validation | FR-004, AC-001 | positive | P1 |
| SV-08 | Spec Validation | FR-005, AC-003, AC-004, AC-005 | negative | P0 |
| SV-09 | Spec Validation | FR-004, AC-006 | positive | P1 |
| SV-10 | Spec Validation | FR-004, AC-007 | positive | P1 |
| SV-11 | Spec Validation | FR-006, AC-008 | positive | P0 |
| SV-12 | Spec Validation | FR-006, AC-008 | negative | P0 |
| SV-13 | Spec Validation | FR-001, AC-001, AC-002 | positive | P1 |
| SV-14 | Spec Validation | FR-005 | negative | P1 |
| RT-01 | Regression | CON-002 | positive | P0 |
| RT-02 | Regression | CON-002 | positive | P0 |
| RT-03 | Regression | CON-002 | positive | P0 |
| RT-04 | Regression | CON-002 | positive | P0 |
| RT-05 | Regression | CON-002 | positive | P0 |
| RT-06 | Regression | CON-002 | positive | P1 |
| RT-07 | Regression | CON-003 | positive | P1 |
| RT-08 | Regression | CON-003 | positive | P1 |
| SS-01 | Structure | Structural Completeness | positive | P1 |
| SS-02 | Structure | Structural Parity | positive | P1 |
| SS-03 | Structure | Behavioral Parity | positive | P1 |
| SS-04 | Structure | Structural Integrity | positive | P2 |

---

## Specification Validation Tests (SV)

### SV-01: Orchestrator finalize has top-level BACKLOG.md step (not nested under Jira)
- **Requirement:** FR-006, AC-008
- **Type:** positive
- **Priority:** P0
- **Precondition:** `src/claude/agents/00-sdlc-orchestrator.md` exists and is readable
- **Input:** Read file content, locate finalize section (lines 585+)
- **Expected:** A BACKLOG.md update step exists that is NOT a sub-step of "JIRA STATUS SYNC" -- it should appear as a top-level numbered step (e.g., step 2.6 or step 3 or similar) rather than step 2.5d
- **Verification:** Regex match for a BACKLOG.md section heading at the same indentation level as the Jira sync block, plus verify the BACKLOG.md step is NOT inside the 2.5a-2.5e range with Jira conditional guard

### SV-02: Orchestrator finalize mode summary includes BACKLOG.md
- **Requirement:** FR-006, AC-008
- **Type:** positive
- **Priority:** P0
- **Precondition:** `src/claude/agents/00-sdlc-orchestrator.md` exists and is readable
- **Input:** Read file content, locate finalize mode behavior description (Mode Behavior section, item 3)
- **Expected:** The finalize mode summary text includes "BACKLOG" in its execution sequence (alongside merge, prune, workflow_history, clear active_workflow)
- **Verification:** Regex match for `BACKLOG` within the finalize mode behavior description

### SV-03: Orchestrator BACKLOG.md step matches by artifact_folder
- **Requirement:** FR-001, AC-001
- **Type:** positive
- **Priority:** P0
- **Precondition:** `src/claude/agents/00-sdlc-orchestrator.md` contains the fixed BACKLOG.md step
- **Input:** Read file content, locate the BACKLOG.md update step
- **Expected:** The step specifies matching by `artifact_folder` from `active_workflow`
- **Verification:** Regex match for `artifact_folder` in the BACKLOG.md update section

### SV-04: Orchestrator BACKLOG.md step matches by external_id
- **Requirement:** FR-001, AC-002
- **Type:** positive
- **Priority:** P0
- **Precondition:** `src/claude/agents/00-sdlc-orchestrator.md` contains the fixed BACKLOG.md step
- **Input:** Read file content, locate the BACKLOG.md update step
- **Expected:** The step specifies matching by `external_id` (or `source_id`) as a fallback matching strategy (e.g., GH-11, #11, PROJ-1234)
- **Verification:** Regex match for `external_id` or `source_id` in the BACKLOG.md update section

### SV-05: Orchestrator BACKLOG.md step marks checkbox [x]
- **Requirement:** FR-002, AC-001
- **Type:** positive
- **Priority:** P0
- **Precondition:** `src/claude/agents/00-sdlc-orchestrator.md` contains the fixed BACKLOG.md step
- **Input:** Read file content, locate the BACKLOG.md update step
- **Expected:** The step specifies changing `[ ]` to `[x]` on the matched item line
- **Verification:** Regex match for `[x]` or checkbox marking instruction in the BACKLOG.md section

### SV-06: Orchestrator BACKLOG.md step adds Completed date sub-bullet
- **Requirement:** FR-003, AC-001
- **Type:** positive
- **Priority:** P1
- **Precondition:** `src/claude/agents/00-sdlc-orchestrator.md` contains the fixed BACKLOG.md step
- **Input:** Read file content, locate the BACKLOG.md update step
- **Expected:** The step specifies adding a `**Completed:**` date sub-bullet to the item block
- **Verification:** Regex match for `Completed` and date format reference in the BACKLOG.md section

### SV-07: Orchestrator BACKLOG.md step moves item block to ## Completed section
- **Requirement:** FR-004, AC-001
- **Type:** positive
- **Priority:** P1
- **Precondition:** `src/claude/agents/00-sdlc-orchestrator.md` contains the fixed BACKLOG.md step
- **Input:** Read file content, locate the BACKLOG.md update step
- **Expected:** The step specifies moving the entire item block (parent line + sub-bullets) from `## Open` to `## Completed`
- **Verification:** Regex match for `Completed` section and move/transfer instruction

### SV-08: Orchestrator BACKLOG.md step is non-blocking (warning on failure)
- **Requirement:** FR-005, AC-003, AC-004, AC-005
- **Type:** negative
- **Priority:** P0
- **Precondition:** `src/claude/agents/00-sdlc-orchestrator.md` contains the fixed BACKLOG.md step
- **Input:** Read file content, locate the BACKLOG.md update step
- **Expected:** The step specifies non-blocking behavior: warnings on failure, no BACKLOG.md file handled gracefully, parse failures do not corrupt the file, workflow always continues
- **Verification:** Regex match for "non-blocking" or "warning" or "do NOT block" in the BACKLOG.md section

### SV-09: Orchestrator BACKLOG.md step creates ## Completed section if missing
- **Requirement:** FR-004, AC-006
- **Type:** positive
- **Priority:** P1
- **Precondition:** `src/claude/agents/00-sdlc-orchestrator.md` contains the fixed BACKLOG.md step
- **Input:** Read file content, locate the BACKLOG.md update step
- **Expected:** The step specifies creating a `## Completed` section if one does not exist
- **Verification:** Regex match for creating/appending the Completed section when absent

### SV-10: Orchestrator BACKLOG.md step preserves sub-bullets on move
- **Requirement:** FR-004, AC-007
- **Type:** positive
- **Priority:** P1
- **Precondition:** `src/claude/agents/00-sdlc-orchestrator.md` contains the fixed BACKLOG.md step
- **Input:** Read file content, locate the BACKLOG.md update step
- **Expected:** The step specifies that all sub-bullets (indented lines) move together with the parent item line
- **Verification:** Regex match for sub-bullet/block/indented preservation instruction

### SV-11: isdlc.md STEP 4 has BACKLOG.md sync section at same level as Jira sync
- **Requirement:** FR-006, AC-008
- **Type:** positive
- **Priority:** P0
- **Precondition:** `src/claude/commands/isdlc.md` exists and is readable
- **Input:** Read file content, locate STEP 4 finalize section
- **Expected:** A `BACKLOG.md sync` section exists as a bold heading (same formatting as "Jira sync" and "GitHub sync")
- **Verification:** Regex match for `BACKLOG` as a section heading in STEP 4

### SV-12: isdlc.md BACKLOG.md sync is NOT nested under Jira sync
- **Requirement:** FR-006, AC-008
- **Type:** negative
- **Priority:** P0
- **Precondition:** `src/claude/commands/isdlc.md` exists and is readable
- **Input:** Read file content, locate the Jira sync section in STEP 4
- **Expected:** The BACKLOG.md update description is NOT a sub-bullet under "Jira sync" -- it should be a separate peer section. Currently line 2245 has the BACKLOG update as a Jira sub-bullet; after the fix, it should be independent.
- **Verification:** Extract the Jira sync section and verify it does NOT contain "BACKLOG.md" or "marks item [x]" as a sub-bullet

### SV-13: isdlc.md BACKLOG.md sync describes matching strategy
- **Requirement:** FR-001, AC-001, AC-002
- **Type:** positive
- **Priority:** P1
- **Precondition:** `src/claude/commands/isdlc.md` contains the fixed BACKLOG.md sync section
- **Input:** Read file content, locate BACKLOG.md sync section in STEP 4
- **Expected:** The section describes matching by `artifact_folder` and/or `external_id`
- **Verification:** Regex match for `artifact_folder` or matching strategy keywords in the BACKLOG.md sync section

### SV-14: isdlc.md BACKLOG.md sync describes non-blocking behavior
- **Requirement:** FR-005
- **Type:** negative
- **Priority:** P1
- **Precondition:** `src/claude/commands/isdlc.md` contains the fixed BACKLOG.md sync section
- **Input:** Read file content, locate BACKLOG.md sync section in STEP 4
- **Expected:** The section specifies non-blocking behavior (warnings, no workflow blocking)
- **Verification:** Regex match for "non-blocking" or "warning" or "does not block" in the BACKLOG.md sync section

---

## Regression Tests (RT)

### RT-01: Orchestrator still has Jira sync block with MCP transition
- **Requirement:** CON-002
- **Type:** positive
- **Priority:** P0
- **Precondition:** `src/claude/agents/00-sdlc-orchestrator.md` is readable
- **Input:** Read file content
- **Expected:** Contains "JIRA STATUS SYNC" heading and `updateStatus` or MCP transition references
- **Verification:** Regex match for Jira sync heading and MCP call

### RT-02: Orchestrator Jira sync still skips when jira_ticket_id absent
- **Requirement:** CON-002
- **Type:** positive
- **Priority:** P0
- **Input:** Read orchestrator file content
- **Expected:** Contains the conditional skip: "If jira_ticket_id is absent or null: SKIP"
- **Verification:** Regex match for jira_ticket_id absent skip pattern

### RT-03: Orchestrator finalize still includes merge, prune, workflow_history
- **Requirement:** CON-002
- **Type:** positive
- **Priority:** P0
- **Input:** Read orchestrator file content
- **Expected:** Finalize mode still references merge, collectPhaseSnapshots, prune, workflow_history, clear active_workflow
- **Verification:** Regex match for each of these keywords in the finalize section

### RT-04: isdlc.md STEP 4 still has Jira sync section
- **Requirement:** CON-002
- **Type:** positive
- **Priority:** P0
- **Input:** Read isdlc.md content
- **Expected:** "Jira sync" section still exists in STEP 4
- **Verification:** Regex match for "Jira sync" in STEP 4 area

### RT-05: isdlc.md STEP 4 still has GitHub sync section
- **Requirement:** CON-002
- **Type:** positive
- **Priority:** P0
- **Input:** Read isdlc.md content
- **Expected:** "GitHub sync" section still exists in STEP 4
- **Verification:** Regex match for "GitHub sync" in STEP 4 area

### RT-06: Trivial tier (T8) still calls updateBacklogMarker
- **Requirement:** CON-002
- **Type:** positive
- **Priority:** P1
- **Input:** Read isdlc.md content
- **Expected:** Trivial tier step T8 still references `updateBacklogMarker` with "x" marker
- **Verification:** Regex match for `updateBacklogMarker` and T8 reference in isdlc.md

### RT-07: updateBacklogMarker still exported from three-verb-utils
- **Requirement:** CON-003
- **Type:** positive
- **Priority:** P1
- **Input:** `require('../lib/three-verb-utils.cjs')`
- **Expected:** `updateBacklogMarker` is a function export
- **Verification:** `typeof threeVerbUtils.updateBacklogMarker === 'function'`

### RT-08: appendToBacklog still exported from three-verb-utils
- **Requirement:** CON-003
- **Type:** positive
- **Priority:** P1
- **Input:** `require('../lib/three-verb-utils.cjs')`
- **Expected:** `appendToBacklog` is a function export
- **Verification:** `typeof threeVerbUtils.appendToBacklog === 'function'`

---

## Specification Structure Tests (SS)

### SS-01: isdlc.md STEP 4 has all three sync sections
- **Requirement:** Structural Completeness
- **Type:** positive
- **Priority:** P1
- **Input:** Read isdlc.md STEP 4 section
- **Expected:** Three bold section headings exist: Jira sync, GitHub sync, and BACKLOG.md sync (or equivalent naming)
- **Verification:** Count distinct sync sections -- must be >= 3

### SS-02: Orchestrator finalize sequence mentions BACKLOG.md alongside merge and prune
- **Requirement:** Structural Parity
- **Type:** positive
- **Priority:** P1
- **Input:** Read orchestrator finalize mode behavior summary
- **Expected:** The finalize execution summary includes BACKLOG alongside merge, prune, and workflow_history
- **Verification:** Regex match in finalize mode summary for BACKLOG

### SS-03: BACKLOG.md sync mentions non-blocking (matching Jira/GitHub pattern)
- **Requirement:** Behavioral Parity
- **Type:** positive
- **Priority:** P1
- **Input:** Read isdlc.md BACKLOG.md sync section
- **Expected:** Non-blocking language matches the pattern used in Jira sync and GitHub sync sections
- **Verification:** Check that BACKLOG.md sync section contains "non-blocking" or "does not block" or "warning"

### SS-04: Orchestrator step numbering is consistent
- **Requirement:** Structural Integrity
- **Type:** positive
- **Priority:** P2
- **Input:** Read orchestrator finalize steps section
- **Expected:** Step numbering flows logically without orphaned sub-steps (no step 2.5d without a valid parent context that includes it)
- **Verification:** Verify the BACKLOG.md update has its own step number or is clearly independent of 2.5
