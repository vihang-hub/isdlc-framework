# Test Cases: BUG-0032 Phase A Cannot Pull Jira Ticket Content

**Bug ID:** BUG-0032-GH-7
**Phase:** 05-test-strategy
**Created:** 2026-02-23
**Total Test Cases:** 25

---

## Test Case Index

| ID | Category | Requirement | Type | Priority |
|----|----------|-------------|------|----------|
| SV-01 | Spec Validation | FR-001 AC-001-01 | positive | P0 |
| SV-02 | Spec Validation | FR-003 AC-003-01 | positive | P0 |
| SV-03 | Spec Validation | FR-001 AC-001-02, AC-001-03 | positive | P0 |
| SV-04 | Spec Validation | FR-001 AC-001-05 | negative | P0 |
| SV-05 | Spec Validation | FR-001 AC-001-04 | positive | P1 |
| SV-06 | Spec Validation | FR-002 AC-002-01 | positive | P0 |
| SV-07 | Spec Validation | FR-002 AC-002-03 | negative | P0 |
| SV-08 | Spec Validation | FR-002 AC-002-02 | positive | P1 |
| SV-09 | Spec Validation | FR-004 AC-004-01 | positive | P1 |
| SV-10 | Spec Validation | FR-003 AC-003-03 | negative | P0 |
| SV-11 | Spec Validation | FR-002 AC-002-04 | positive | P1 |
| SV-12 | Spec Validation | FR-003 AC-003-02 | positive | P2 |
| SV-13 | Spec Validation | FR-004 AC-004-03 | negative | P1 |
| RT-01 | Regression | CON-003 | positive | P0 |
| RT-02 | Regression | CON-003 | positive | P0 |
| RT-03 | Regression | CON-003 | positive | P0 |
| RT-04 | Regression | CON-003 | positive | P0 |
| RT-05 | Regression | CON-003 | positive | P1 |
| RT-06 | Regression | CON-003 | positive | P1 |
| RT-07 | Regression | CON-003 | positive | P2 |
| RT-08 | Regression | CON-003 | positive | P2 |
| SS-01 | Structure | Structural Parity | positive | P1 |
| SS-02 | Structure | Structural Parity | positive | P1 |
| SS-03 | Structure | Behavioral Parity | positive | P2 |
| SS-04 | Structure | Regression Guard | positive | P1 |

---

## Specification Validation Tests (SV)

### SV-01: Add handler step 3b contains getJiraIssue MCP call
- **Requirement:** FR-001 AC-001-01
- **Type:** positive
- **Priority:** P0
- **Precondition:** `src/claude/commands/isdlc.md` exists and is readable
- **Input:** Read file content, extract add handler step 3b section
- **Expected:** Content contains `getJiraIssue` (or `mcp__claude_ai_Atlassian__getJiraIssue`) with `cloudId` and `issueIdOrKey` (or `source_id`) parameters
- **Verification:** Regex match for MCP tool call pattern within the Jira branch of step 3b

### SV-02: Add handler step 3b contains getAccessibleAtlassianResources for cloudId
- **Requirement:** FR-003 AC-003-01
- **Type:** positive
- **Priority:** P0
- **Precondition:** `src/claude/commands/isdlc.md` exists and is readable
- **Input:** Read file content, extract add handler step 3b section
- **Expected:** Content contains `getAccessibleAtlassianResources` as a cloudId resolution step before the getJiraIssue call
- **Verification:** Regex match for `getAccessibleAtlassianResources` in Jira branch

### SV-03: Add handler maps issuetype to item_type correctly
- **Requirement:** FR-001 AC-001-02, AC-001-03
- **Type:** positive
- **Priority:** P0
- **Precondition:** `src/claude/commands/isdlc.md` contains the fixed step 3b
- **Input:** Read file content, extract add handler step 3b Jira section
- **Expected:** Content specifies that `issuetype.name === "Bug"` maps to `item_type = "BUG"` and other types map to `item_type = "REQ"`
- **Verification:** Pattern match for Bug->BUG and non-Bug->REQ mapping

### SV-04: Add handler specifies error fallback for failed Jira fetch
- **Requirement:** FR-001 AC-001-05
- **Type:** negative
- **Priority:** P0
- **Precondition:** `src/claude/commands/isdlc.md` contains the fixed step 3b
- **Input:** Read file content, extract add handler step 3b Jira section
- **Expected:** Content specifies graceful fallback behavior when getJiraIssue fails -- logs warning ("Could not fetch Jira ticket") and falls through to manual entry
- **Verification:** Pattern match for error handling text including "Could not fetch" and fallback to manual behavior

### SV-05: Add handler uses fetched summary for slug generation
- **Requirement:** FR-001 AC-001-04
- **Type:** positive
- **Priority:** P1
- **Precondition:** `src/claude/commands/isdlc.md` contains the fixed step 3b
- **Input:** Read file content, extract add handler step 3b Jira section
- **Expected:** Content specifies that the fetched issue `summary` (not the raw `PROJECT-N` input) is used for slug generation
- **Verification:** Pattern match for `summary` used with slug/generateSlug

### SV-06: Analyze handler Group 1 contains conditional Jira fetch
- **Requirement:** FR-002 AC-002-01
- **Type:** positive
- **Priority:** P0
- **Precondition:** `src/claude/commands/isdlc.md` contains the fixed Group 1 section
- **Input:** Read file content, extract analyze handler step 3a Group 1 section
- **Expected:** Content includes a conditional branch for Jira references (`PROJECT-N`) that fires `getJiraIssue` in parallel alongside other Group 1 operations
- **Verification:** Pattern match for Jira conditional within Group 1 block

### SV-07: Analyze handler specifies fail-fast on Jira fetch error
- **Requirement:** FR-002 AC-002-03
- **Type:** negative
- **Priority:** P0
- **Precondition:** `src/claude/commands/isdlc.md` contains the fixed Group 1 section
- **Input:** Read file content, extract analyze handler Group 1 section
- **Expected:** Content specifies fail-fast behavior when Jira fetch fails in Group 1 -- logs error and STOP (matching GitHub fail-fast pattern)
- **Verification:** Pattern match for fail-fast/STOP pattern in Jira branch

### SV-08: Analyze handler passes fetched data as issueData to add handler
- **Requirement:** FR-002 AC-002-02
- **Type:** positive
- **Priority:** P1
- **Precondition:** `src/claude/commands/isdlc.md` contains the fixed Group 2 section
- **Input:** Read file content, extract analyze handler Group 2 auto-add section
- **Expected:** Content specifies that fetched Jira issue data (summary, description, type, priority) is passed to the add handler as pre-fetched data, matching the `issueData` pattern used for GitHub issues
- **Verification:** Pattern match for issueData passing in Group 2

### SV-09: Specification includes Jira URL parsing for --link flag
- **Requirement:** FR-004 AC-004-01
- **Type:** positive
- **Priority:** P1
- **Precondition:** `src/claude/commands/isdlc.md` contains fix for --link URL handling
- **Input:** Read file content, search for Atlassian URL parsing pattern
- **Expected:** Content includes pattern matching for `*.atlassian.net/browse/{PROJECT-N}` URLs and extraction of ticket ID
- **Verification:** Pattern match for `atlassian.net/browse` URL extraction logic

### SV-10: Specification includes MCP unavailability graceful degradation
- **Requirement:** FR-003 AC-003-03
- **Type:** negative
- **Priority:** P0
- **Precondition:** `src/claude/commands/isdlc.md` contains the fixed Jira handling
- **Input:** Read file content, search for MCP unavailability handling
- **Expected:** Content specifies that when Atlassian MCP is unavailable, the handler degrades gracefully -- logs message "Atlassian MCP not available" and proceeds with manual entry (no crash, no block)
- **Verification:** Pattern match for MCP unavailability handling text

### SV-11: Analyze handler specifies draft includes Jira content
- **Requirement:** FR-002 AC-002-04
- **Type:** positive
- **Priority:** P1
- **Precondition:** `src/claude/commands/isdlc.md` contains the fixed analyze handler
- **Input:** Read file content, search for draft.md content specification
- **Expected:** Content specifies that fetched Jira issue data (title as heading, description body as context, acceptance criteria if present) is incorporated into draft.md
- **Verification:** Pattern match for Jira content in draft specification

### SV-12: CloudId resolution handles multiple cloud instances
- **Requirement:** FR-003 AC-003-02
- **Type:** positive
- **Priority:** P2
- **Precondition:** `src/claude/commands/isdlc.md` contains cloudId resolution logic
- **Input:** Read file content, search for multi-instance handling
- **Expected:** Content specifies handling when getAccessibleAtlassianResources returns multiple results -- use first result or prompt user
- **Verification:** Pattern match for multi-instance/first result handling

### SV-13: Non-Jira URLs preserve existing behavior
- **Requirement:** FR-004 AC-004-03
- **Type:** negative
- **Priority:** P1
- **Precondition:** `src/claude/commands/isdlc.md` contains --link URL handling
- **Input:** Read file content, search for URL pattern guard
- **Expected:** Content specifies that non-Atlassian URLs do not trigger Jira fetch (existing behavior preserved)
- **Verification:** Pattern match for conditional/guard on URL pattern before Jira fetch

---

## Regression Tests (RT)

### RT-01: detectSource identifies PROJ-123 as Jira
- **Requirement:** CON-003
- **Type:** positive
- **Priority:** P0
- **Input:** `detectSource("PROJ-123")`
- **Expected:** `{ source: "jira", source_id: "PROJ-123", description: "PROJ-123" }`
- **Verification:** Assert exact return values

### RT-02: detectSource identifies MYAPP-1 as Jira
- **Requirement:** CON-003
- **Type:** positive
- **Priority:** P0
- **Input:** `detectSource("MYAPP-1")`
- **Expected:** `{ source: "jira", source_id: "MYAPP-1", description: "MYAPP-1" }`
- **Verification:** Assert exact return values

### RT-03: detectSource identifies #42 as GitHub
- **Requirement:** CON-003
- **Type:** positive
- **Priority:** P0
- **Input:** `detectSource("#42")`
- **Expected:** `{ source: "github", source_id: "GH-42", description: "#42" }`
- **Verification:** Assert exact return values

### RT-04: detectSource identifies free text as manual
- **Requirement:** CON-003
- **Type:** positive
- **Priority:** P0
- **Input:** `detectSource("fix login bug")`
- **Expected:** `{ source: "manual", source_id: null, description: "fix login bug" }`
- **Verification:** Assert exact return values

### RT-05: detectSource routes bare number with jira preference
- **Requirement:** CON-003
- **Type:** positive
- **Priority:** P1
- **Input:** `detectSource("123", { issueTracker: "jira", jiraProjectKey: "PROJ" })`
- **Expected:** `{ source: "jira", source_id: "PROJ-123", description: "PROJ-123" }`
- **Verification:** Assert exact return values

### RT-06: detectSource routes bare number with github preference
- **Requirement:** CON-003
- **Type:** positive
- **Priority:** P1
- **Input:** `detectSource("123", { issueTracker: "github" })`
- **Expected:** `{ source: "github", source_id: "GH-123", description: "#123" }`
- **Verification:** Assert exact return values

### RT-07: generateSlug handles raw Jira input
- **Requirement:** CON-003
- **Type:** positive
- **Priority:** P2
- **Input:** `generateSlug("PROJ-123")`
- **Expected:** `"proj-123"`
- **Verification:** Assert exact return value

### RT-08: generateSlug handles descriptive title
- **Requirement:** CON-003
- **Type:** positive
- **Priority:** P2
- **Input:** `generateSlug("Add login page")`
- **Expected:** `"add-login-page"`
- **Verification:** Assert exact return value

---

## Specification Structure Tests (SS)

### SS-01: Add handler has both GitHub and Jira branches
- **Requirement:** Structural parity
- **Type:** positive
- **Priority:** P1
- **Input:** Read `isdlc.md`, extract step 3 of add handler
- **Expected:** Content contains both "step 3a" (or equivalent GitHub branch) with `gh issue view` and "step 3b" (or equivalent Jira branch) with `getJiraIssue`
- **Verification:** Both patterns found in the same section

### SS-02: Analyze handler Group 1 has both GitHub and Jira conditionals
- **Requirement:** Structural parity
- **Type:** positive
- **Priority:** P1
- **Input:** Read `isdlc.md`, extract Group 1 of analyze handler
- **Expected:** Content contains both a GitHub fetch (`gh issue view`) and a Jira fetch (`getJiraIssue`) as conditional branches
- **Verification:** Both patterns found within Group 1 block

### SS-03: Error handling matches between GitHub and Jira paths
- **Requirement:** Behavioral parity
- **Type:** positive
- **Priority:** P2
- **Input:** Read `isdlc.md`, compare error handling in both paths
- **Expected:** Both GitHub and Jira paths have fail-fast behavior in analyze Group 1, and both have graceful fallback in add handler
- **Verification:** Both paths contain "fail fast" or "STOP" patterns

### SS-04: gh issue view call still present (regression guard)
- **Requirement:** Regression guard
- **Type:** positive
- **Priority:** P1
- **Input:** Read `isdlc.md`, search for existing GitHub fetch patterns
- **Expected:** `gh issue view` call is still present in both add handler step 3a and analyze handler Group 1
- **Verification:** Pattern match for `gh issue view` in both locations
