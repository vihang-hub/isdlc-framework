# Trace Analysis: Phase A Cannot Pull Jira Ticket Content

**Generated**: 2026-02-23
**Bug**: Phase A (add/analyze pipeline) cannot fetch Jira ticket content because the Atlassian MCP `getJiraIssue` call is not wired into the command handlers in `isdlc.md`
**External ID**: GH-7
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

The bug is a **specification gap** in `src/claude/commands/isdlc.md`: the add handler (step 3b) and analyze handler (step 3a, Group 1) describe intent to fetch Jira ticket content but lack the concrete MCP tool call instructions. The GitHub path has explicit `gh issue view N --json title,labels,body` calls at both locations, while the Jira path has only prose ("Fetch the issue summary and type") with no corresponding tool invocation. The Atlassian MCP tools (`getJiraIssue`, `getAccessibleAtlassianResources`) are available in the environment (detected during installation by `checkAtlassianMcp()` in `lib/installer.js`) and used at workflow finalization for Jira status sync, but are completely absent from the content-fetching pipeline. The fix requires adding explicit MCP tool call instructions to 2 locations in `isdlc.md` plus a cloudId resolution step.

**Root Cause Confidence**: HIGH -- the gap is directly visible in the source specification
**Severity**: Medium
**Estimated Complexity**: Low -- specification changes to one markdown file, no code changes

---

## Symptom Analysis

### Error Description

This is a **silent failure** -- there is no error message or crash. The system simply does not attempt to fetch Jira ticket content, so the user must manually provide all details that should have been auto-fetched.

### Observable Symptoms

1. **Missing ticket title in slug**: When a user runs `/isdlc add "PROJ-123"` or `/isdlc analyze "PROJ-123"`, the slug is generated from the raw input (e.g., `proj-123`) rather than the Jira ticket's actual title. Compare with GitHub: `/isdlc add "#42"` fetches the issue title via `gh issue view` and uses it for the slug.

2. **Missing ticket body in draft.md**: The `draft.md` file is created without the Jira ticket's description, acceptance criteria, or other fields. The user must manually copy-paste all content from Jira.

3. **Missing item_type auto-detection**: For Jira tickets, the system cannot automatically determine whether the issue is a Bug (item_type = "BUG") or Story/Task (item_type = "REQ") because it never fetches the issue type field. Instead, it falls through to asking the user.

4. **Analyze handler Group 1 gap**: The optimized dependency group path in step 3a fires `gh issue view N --json title,labels,body` for GitHub issues but has no equivalent Jira fetch. For `PROJECT-N` inputs, Group 1 proceeds with 4 of 5 parallel operations but skips the critical content fetch.

### Triggering Conditions

- User has Atlassian MCP installed and configured
- Issue tracker preference is set to `jira` in CLAUDE.md
- User provides a Jira reference: `PROJECT-N` pattern, bare number with jira preference, or `--link` URL
- System: iSDLC 0.1.0-alpha on any platform

### Non-Triggering Conditions

- GitHub issue references (`#N` pattern) work correctly -- full fetch via `gh issue view`
- Manual descriptions (no external reference) are unaffected
- Jira status sync at workflow finalization (step 2.5 in orchestrator finalize) is a separate path and IS specified (though it also lacks explicit cloudId resolution)

---

## Execution Path

### Entry Points

There are three entry points where this bug manifests:

**Entry Point 1: Add Handler (step 3b in isdlc.md)**
```
User: /isdlc add "PROJ-123"
  -> isdlc.md: add handler, step 3
  -> detectSource("PROJ-123") in three-verb-utils.cjs
     Returns: { source: "jira", source_id: "PROJ-123", description: "PROJ-123" }
  -> Step 3b: "Fetch the issue summary and type"  <-- BUG: no tool call specified
  -> Step 4: generateSlug() uses raw "PROJ-123" instead of fetched title
  -> Step 6: Creates folder like BUG-NNNN-proj-123 instead of BUG-NNNN-{actual-title}
```

**Entry Point 2: Analyze Handler (step 3a, Group 1 in isdlc.md)**
```
User: /isdlc analyze "PROJ-123"
  -> isdlc.md: analyze handler, step 3
  -> Detects "PROJECT-N" pattern -> optimized path (step 3a)
  -> Group 1 fires 5 parallel operations:
     1. gh issue view N --json title,labels,body  <-- BUG: GitHub-only, no Jira equivalent
     2. Grep for existing match
     3. Glob for folder list
     4. Read persona files
     5. Glob for topic paths
  -> Group 2: auto-add invokes add handler (which also lacks Jira fetch)
```

**Entry Point 3: Fix Handler with --link (step 4 in isdlc.md)**
```
User: /isdlc fix "bug description" --link https://company.atlassian.net/browse/PROJ-123
  -> isdlc.md: fix handler, step 4
  -> Passes link to Agent 01 (requirements analyst)
  -> Agent 01 extracts "PROJ-123" from URL (step: Bug Step 2)
  -> Stores as external_id but does NOT fetch ticket content via MCP
  -> Bug report is created from user description only, not enriched with Jira data
```

### Call Chain Analysis

#### Working Path (GitHub -- for comparison)

```
isdlc.md add handler step 3a:
  detectSource("#42") -> { source: "github", source_id: "GH-42" }
  gh issue view 42 --json title,labels,body  <-- EXPLICIT TOOL CALL
  -> issueData = { title: "Add login page", labels: [...], body: "..." }
  -> Check labels for "bug" -> item_type = "REQ" or "BUG"
  -> generateSlug(issueData.title) -> "add-login-page"
  -> Folder: REQ-0020-add-login-page
```

#### Broken Path (Jira)

```
isdlc.md add handler step 3b:
  detectSource("PROJ-123") -> { source: "jira", source_id: "PROJ-123" }
  "Fetch the issue summary and type"  <-- PROSE ONLY, NO TOOL CALL
  -> No issueData available
  -> Falls through to asking user for item_type
  -> generateSlug("PROJ-123") -> "proj-123"  (raw input, not ticket title)
  -> Folder: REQ-NNNN-proj-123
```

### Data Flow Gaps

| Data Point | GitHub Path | Jira Path | Gap |
|-----------|-------------|-----------|-----|
| Issue title | `gh issue view N --json title` | (not fetched) | Missing MCP call |
| Issue type | Labels check (`bug` label) | (not fetched) | Missing MCP call |
| Issue body | `gh issue view N --json body` | (not fetched) | Missing MCP call |
| Issue priority | (not fetched for GH either) | (not fetched) | N/A |
| CloudId | N/A (GH CLI handles auth) | (not resolved) | Missing `getAccessibleAtlassianResources` call |
| Slug source | Fetched title | Raw input "PROJ-123" | Degraded UX |
| item_type source | Label check | Manual user prompt | Degraded UX |

### Exact Failure Locations

**Location 1**: `src/claude/commands/isdlc.md`, lines 552-554 (add handler, step 3b)
```
b. Jira ticket (`PROJECT-N` pattern or bare number with jira preference): source = "jira", source_id = input.
   If pre-fetched issue data is provided, use it instead of fetching. Otherwise:
   Fetch the issue summary and type. If type is "Bug", item_type = "BUG", else item_type = "REQ".
```
The instruction says "Fetch the issue summary and type" but does not specify HOW. No MCP tool call is documented.

**Location 2**: `src/claude/commands/isdlc.md`, line 641 (analyze handler, Group 1)
```
**Group 1** (fire all 5 in parallel at T=0):
- `gh issue view N --json title,labels,body` --> issueData (title, labels, body). If this fails, fail fast...
```
This is GitHub-only. There is no conditional branch for when the input is `PROJECT-N` (Jira). The Group 1 specification assumes all external references are GitHub issues.

---

## Root Cause Analysis

### Primary Hypothesis (Confidence: HIGH)

**Specification omission in `isdlc.md`**: The Jira content fetch was designed conceptually ("Fetch the issue summary and type") but never specified at the tool-call level. The GitHub integration was implemented first with explicit `gh issue view` CLI calls, and the Jira integration was left as a placeholder.

**Evidence:**
1. The add handler step 3a (GitHub) has an explicit tool call: `gh issue view N --json title,labels,body`
2. The add handler step 3b (Jira) has only prose: "Fetch the issue summary and type"
3. The analyze handler Group 1 specifies only `gh issue view` -- no Jira alternative
4. The `detectSource()` function in `three-verb-utils.cjs` correctly identifies Jira sources (line 128-134), proving the upstream detection works
5. The `checkAtlassianMcp()` function in `installer.js` (line 75-85) exists and is called during installation, proving the MCP availability detection works
6. The Jira status sync at finalization (orchestrator line 588-602) references MCP but also lacks explicit `cloudId` resolution

### Secondary Hypothesis (Confidence: LOW)

**MCP tool naming uncertainty**: The specification author may have been uncertain about the exact MCP tool names and parameter format, leaving the Jira fetch as prose to be filled in later.

**Evidence:**
- The CLAUDE.md template uses conceptual method names (`getTicket(id)`, `updateStatus(id, status)`) rather than actual MCP tool names
- The Jira sync at finalization also uses conceptual `updateStatus()` rather than `mcp__claude_ai_Atlassian__transitionJiraIssue`

### What Is NOT the Root Cause

1. **`detectSource()` is NOT broken**: It correctly identifies `PROJECT-N` patterns and returns `source: "jira"`. The function works as designed.
2. **`three-verb-utils.cjs` does NOT need modification**: The MCP calls are agent-level tool invocations specified in `isdlc.md`, not programmatic function calls. Per CON-002 in the requirements spec, no hook-level code changes are needed.
3. **The Atlassian MCP is NOT unavailable**: `checkAtlassianMcp()` confirms it is installed, and the tools are listed in the environment (e.g., `mcp__claude_ai_Atlassian__getJiraIssue`).

### Suggested Fix

The fix is a **specification-level change** to `src/claude/commands/isdlc.md` at 2 primary locations, plus a cloudId resolution pattern:

**Fix 1: Add handler step 3b** (line 552-554)
Replace the prose "Fetch the issue summary and type" with explicit MCP tool calls:
```
b. Jira ticket (`PROJECT-N` pattern or bare number with jira preference): source = "jira", source_id = input.
   If pre-fetched issue data is provided, use it instead of fetching. Otherwise:
   1. Resolve cloudId: call `mcp__claude_ai_Atlassian__getAccessibleAtlassianResources()` and use the first result's `id` field.
      If MCP unavailable or call fails: log "Atlassian MCP not available. Provide Jira ticket details manually." and fall through to manual entry (ask user for item_type).
   2. Fetch ticket: call `mcp__claude_ai_Atlassian__getJiraIssue(cloudId, source_id)`.
      Extract: summary (for slug), issuetype.name (for item_type), description (for draft body), priority.name.
      If type is "Bug", item_type = "BUG", else item_type = "REQ".
   3. If fetch fails: log "Could not fetch Jira ticket {source_id}: {error}" and fall through to manual entry.
```

**Fix 2: Analyze handler Group 1** (line 640-641)
Add a conditional Jira fetch alongside the existing GitHub fetch:
```
**Group 1** (fire all in parallel at T=0):
- **If GitHub ref (#N)**: `gh issue view N --json title,labels,body` --> issueData. Fail fast on error.
- **If Jira ref (PROJECT-N)**: Call `getAccessibleAtlassianResources()` for cloudId, then `getJiraIssue(cloudId, source_id)` --> issueData (summary, issuetype, description, priority). Fail fast on error: "Could not fetch Jira ticket PROJECT-N: {error}" and STOP.
- (remaining 4 Group 1 operations unchanged)
```

**Fix 3: Add Jira URL parsing for --link flag**
In the fix handler or requirements analyst agent, when a `--link` URL matching `https://*.atlassian.net/browse/{PROJECT-N}` is provided, extract the ticket ID and invoke `getJiraIssue` to fetch content (matching the existing URL-to-ID extraction table in `01-requirements-analyst.md` line 473).

### Complexity Assessment

- **Specification changes only**: All changes are to `isdlc.md` (markdown specification)
- **No code changes**: `three-verb-utils.cjs` does not need modification
- **No new dependencies**: MCP tools are already available in the environment
- **Pattern exists**: The GitHub path provides a clear template to follow
- **Risk**: Low -- additive change, no existing behavior modified

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-23",
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["getJiraIssue", "Jira", "MCP", "cloudId", "fetch", "add handler", "analyze handler", "Group 1"],
  "files_analyzed": [
    "src/claude/commands/isdlc.md",
    "src/claude/hooks/lib/three-verb-utils.cjs",
    "lib/installer.js",
    "src/claude/agents/01-requirements-analyst.md",
    "src/claude/agents/00-sdlc-orchestrator.md",
    "src/claude/CLAUDE.md.template"
  ],
  "phase_timing_report": {
    "debate_rounds_used": 0,
    "fan_out_chunks": 0
  }
}
```
