# Requirements Specification: BUG-0033-GH-11

**Bug ID:** BUG-0033
**Title:** BACKLOG.md Completion Marking Not Wired Into Standard Workflow Finalize
**External Link:** https://github.com/vihang-hub/isdlc-framework/issues/11
**External ID:** GH-11
**Severity:** Medium
**Phase:** 01-requirements
**Created:** 2026-02-23

---

## Context

The orchestrator's finalize step (Section 3a, step 2.5d in `00-sdlc-orchestrator.md`) specifies that BACKLOG.md should be updated when a workflow completes. This specification exists but is not included in the finalize mode execution sequence. The `updateBacklogMarker()` utility already exists in `isdlc.md` but is only called during the build/analyze inline handlers -- not during orchestrator finalize.

The fix must add BACKLOG.md completion marking to the orchestrator's finalize mode so that items are automatically marked done when workflows complete.

---

## Fix Requirements

### FR-001: Locate Matching BACKLOG.md Entry

The finalize step must locate the matching BACKLOG.md item using a priority-based matching strategy:

1. **Artifact folder slug match**: Search for the `artifact_folder` value from `active_workflow` (e.g., `REQ-0021-agent-prompt-boilerplate-extraction` or `BUG-0033-backlog-completion-marking-not-wired-into-finalize`) anywhere in the item line
2. **External reference match**: Search for the `external_id` (e.g., `#11`, `GH-11`, `PROJ-1234`) in the item line or sub-bullets
3. **Item number match**: If `active_workflow` contains a backlog item number reference, match by `N.N` prefix

If no match is found, log a warning and skip the update (non-blocking per Article X).

### FR-002: Mark Item as Complete

Change the checkbox from `[ ]` to `[x]` on the matched item line.

### FR-003: Add Completion Date Sub-Bullet

Add a `**Completed:** {YYYY-MM-DD}` sub-bullet immediately after the last existing sub-bullet of the matched item block. Use the current date at the time of finalize execution.

### FR-004: Move Item Block to Completed Section

Move the entire item block (the item line plus all its indented sub-bullets) from the `## Open` section to the `## Completed` section.

- If a `## Completed` section does not exist in BACKLOG.md, create it at the end of the file
- Preserve the item's original formatting and indentation
- Append the moved block at the end of the `## Completed` section

### FR-005: Non-Blocking Execution

Any failure during BACKLOG.md update must:
- Log a warning message (e.g., "WARNING: Could not update BACKLOG.md: {reason}")
- NOT block workflow completion
- NOT cause the finalize step to fail
- This is consistent with the Jira sync behavior and Article X (Fail-Safe Defaults)

### FR-006: Specification Alignment

The orchestrator's finalize mode execution sequence (in `00-sdlc-orchestrator.md`) must be updated to explicitly include the BACKLOG.md update step. Step 2.5d must be promoted to a top-level finalize action that runs unconditionally (not nested under Jira sync).

---

## Constraints

### CON-001: No New Dependencies

The fix must use existing utilities (`updateBacklogMarker`, BACKLOG.md parsing functions already in `isdlc.md`) where possible. No new npm packages or external dependencies.

### CON-002: Backward Compatibility

- Workflows without a matching BACKLOG.md entry must complete without error
- Projects without a BACKLOG.md file must complete without error (graceful skip)
- The existing `updateBacklogMarker()` function signature and behavior must be preserved

### CON-003: Agent File Changes Only

Since this is a specification/agent bug (not a code bug), the fix modifies markdown agent files (`00-sdlc-orchestrator.md`, `isdlc.md`), not JavaScript source files. No runtime code changes are expected unless the `updateBacklogMarker` utility needs enhancement to support the move-to-completed behavior.

---

## Assumptions

1. BACKLOG.md follows the established format with `## Open` and `## Completed` sections
2. Item lines use the pattern `- N.N [ ] description -> [requirements](path)` or `- N.N [ ] description`
3. Sub-bullets are indented with 2 spaces under the parent item line
4. The `active_workflow` object always contains `artifact_folder` when finalize runs
5. The `external_id` field may be absent for manually-created workflows (fallback to slug match)

---

## Acceptance Criteria

### AC-001: Successful Completion Marking (Happy Path)

```
Given a workflow has completed all phases successfully
  And the active_workflow has artifact_folder "REQ-0021-agent-prompt-boilerplate-extraction"
  And BACKLOG.md contains an Open item referencing "REQ-0021-agent-prompt-boilerplate-extraction"
When the orchestrator runs in finalize mode
Then the matching item's checkbox changes from [ ] to [x]
  And a "**Completed:** {YYYY-MM-DD}" sub-bullet is added
  And the entire item block is moved from ## Open to ## Completed
```

### AC-002: External Reference Matching

```
Given a workflow has completed all phases successfully
  And the active_workflow has external_id "GH-11"
  And BACKLOG.md contains an Open item with "#11" in its line or sub-bullets
When the orchestrator runs in finalize mode
Then the matching item is located via external reference match
  And the item is marked complete and moved to ## Completed
```

### AC-003: No Matching Entry (Graceful Skip)

```
Given a workflow has completed all phases successfully
  And BACKLOG.md does not contain any item matching the artifact_folder or external_id
When the orchestrator runs in finalize mode
Then a warning is logged: "WARNING: Could not find matching BACKLOG.md entry for {artifact_folder}"
  And the workflow completes successfully without error
```

### AC-004: No BACKLOG.md File (Graceful Skip)

```
Given a workflow has completed all phases successfully
  And the project root does not contain a BACKLOG.md file
When the orchestrator runs in finalize mode
Then the BACKLOG.md update step is skipped silently
  And the workflow completes successfully without error
```

### AC-005: Non-Blocking on Parse Failure

```
Given a workflow has completed all phases successfully
  And BACKLOG.md exists but has an unexpected format (no ## Open section, malformed items)
When the orchestrator runs in finalize mode
Then a warning is logged about the parse failure
  And the workflow completes successfully without error
  And BACKLOG.md is not corrupted (original content preserved)
```

### AC-006: Completed Section Auto-Creation

```
Given BACKLOG.md exists with a ## Open section but no ## Completed section
When the orchestrator marks an item complete during finalize
Then a ## Completed section is created at the end of the file
  And the completed item block is placed under it
```

### AC-007: Item Block Integrity

```
Given a BACKLOG.md item has 3 indented sub-bullets beneath it
When the item is moved to ## Completed during finalize
Then all 3 sub-bullets are moved together with the parent line
  And the **Completed:** date sub-bullet is added after the existing sub-bullets
  And the original sub-bullets are preserved verbatim
```

### AC-008: Specification Updated

```
Given the fix is implemented
When reviewing 00-sdlc-orchestrator.md finalize mode description (line 655 area)
Then the BACKLOG.md update step is explicitly listed in the finalize execution sequence
  And it is not nested under or conditional on Jira sync availability
```

---

## Out of Scope

- **Auto-move headings when all items done** (GitHub Issue #12) -- separate enhancement
- **Jira ticket status transition** (GitHub Issue #13) -- separate concern, already specified
- **GitHub issue close/label sync** (GitHub Issue #58) -- already implemented separately
- **BACKLOG.md format validation or migration** -- assumes current format is correct
- **Undo/rollback of BACKLOG.md changes** -- finalize is a terminal operation
