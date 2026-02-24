# Trace Analysis: Multiline Bash Commands Bypass Permission Auto-Allow Rules

**Generated**: 2026-02-19T21:00:00Z
**Revalidated**: 2026-02-20T19:15:00Z
**Bug**: BUG-0029-GH-18 -- Framework agents generate multiline Bash commands that bypass Claude Code's permission auto-allow rules
**External ID**: GH-18
**Workflow**: fix
**Phase**: 02-tracing

---

## Executive Summary

Framework agent prompt files (`.md` files in `src/claude/agents/` and `src/claude/commands/`) contain multiline Bash code blocks that Claude Code's LLM reproduces as multiline Bash tool calls during workflow execution. Claude Code's permission system uses `*` glob matching in `settings.json` allowlist patterns (e.g., `Bash(node *)`, `Bash(grep *)`), and the `*` glob does not match newline characters. Consequently, any Bash tool call containing newlines fails to match any auto-allow pattern, forcing the user to manually approve the command -- breaking the "invisible framework" design goal. The root cause is entirely within the agent prompt files: they teach the LLM multiline Bash patterns through their code block examples.

**Revalidation finding (2026-02-20)**: The original analysis (2026-02-19) identified 8 affected files with 28 multiline blocks. Since then, 49 commits have landed on main. Re-scanning all 65 agent/command files shows that **6 of the 8 files have already been cleaned up** (26 multiline blocks eliminated). Only **2 files with 2 multiline blocks remain** as the active fix scope. The CLAUDE.md "Single-Line Bash Convention" prevention protocol is already in place.

**Root Cause Confidence**: HIGH
**Severity**: Medium
**Estimated Complexity**: Low (only 2 blocks to fix)

---

## Symptom Analysis

### T1: Symptom Analyzer Report

#### Problem Statement

Users experience unexpected permission prompts during automated workflow execution. When agents execute Bash commands that consist of individually auto-allowed operations (grep, node, cat, find, etc.), the commands should execute silently. Instead, multiline commands always prompt for manual permission.

#### Error Pattern

There is no explicit error message or stack trace. The symptom is a **behavioral failure**: Claude Code presents a permission approval dialog when it should auto-allow the command. This manifests as:

1. User starts a workflow (e.g., `/discover`, `/isdlc feature`)
2. An agent generates a Bash tool call
3. If the tool call contains newlines, Claude Code cannot match it against any `settings.json` allowlist pattern
4. Claude Code presents a permission dialog: "Allow this command? [y/N]"
5. User must manually approve, breaking autonomous execution

#### Triggering Conditions

- **Required**: Agent prompt file contains a multiline Bash code block
- **Required**: LLM reproduces the multiline pattern in a Bash tool call
- **Required**: The generated command contains `\n` characters
- **Consequence**: `*` glob in `Bash(command *)` cannot match across newlines

#### Pattern Types Still Present (Post-Revalidation)

| Pattern Type | Description | File | Line |
|-------------|-------------|------|------|
| Line-continuation | `\` continuations spanning multiple lines | `architecture-analyzer.md` | 46 |
| Multi-example with comments | Multiple commands with comments in one fence | `quick-scan-agent.md` | 113 |

#### Pattern Types Eliminated Since Original Analysis

| Pattern Type | Originally In | Status |
|-------------|--------------|--------|
| Comments-interleaved | `05-software-developer.md`, `06-integration-tester.md`, `provider.md` | RESOLVED -- content rewritten |
| Piped-commands | `06-integration-tester.md`, `skills-researcher.md`, `test-evaluator.md` | RESOLVED -- fences removed |
| Multi-example blocks | `05-software-developer.md`, `06-integration-tester.md`, `provider.md` | RESOLVED -- fences removed or single-lined |
| Comment-only instructional | `data-model-analyzer.md` | RESOLVED -- all 6 bash fences removed |
| Node.js inline scripts | Various | RESOLVED -- no remaining instances |

#### Reproduction (Updated)

The symptom remains reproducible when:
1. Running `/discover` which loads `architecture-analyzer.md` -- the `find` command at line 46 spans 11 lines with `\` continuations
2. Running a quick-scan workflow which loads `quick-scan-agent.md` -- the multi-command block at line 113 spans 9 lines

---

## Execution Path

### T2: Execution Path Tracer Report

#### Entry Point

The execution path starts when the user invokes a workflow command:
```
User -> "/discover" or "/isdlc feature ..." or "/isdlc fix ..."
```

#### Call Chain

```
1. User invokes workflow command
   |
2. isdlc.md (command handler) parses command, determines workflow type
   |
3. Phase-Loop Controller delegates to phase agent (or discover delegates to sub-agents)
   |
4. Phase agent / sub-agent is loaded by Claude Code
   |-- Agent prompt file (.md) is read into LLM context
   |-- Prompt contains multiline bash code blocks as examples/instructions
   |
5. LLM generates a Bash tool call
   |-- LLM mimics patterns from prompt file
   |-- If prompt showed multiline bash, LLM generates multiline bash
   |
6. Claude Code permission check
   |-- Command string extracted from Bash tool call
   |-- For each pattern in settings.json allowlist:
   |     pattern = "Bash(find *)" -> internal glob = "find *"
   |     Match command against glob
   |     * matches any chars EXCEPT \n
   |-- If command contains \n -> NO pattern matches
   |
7. Permission dialog shown to user (FAILURE POINT)
   |-- User must manually approve
   |-- Autonomous execution broken
```

#### Remaining Failure Paths (Post-Revalidation)

**Path 1: architecture-analyzer.md line 46**
```
/discover -> architecture-analyzer sub-agent -> reads line 46 bash block ->
generates: "find . -type d \\\n  -not -path '*/node_modules/*' \\\n  ..." ->
Bash(find *) glob fails at first \n -> permission prompt
```

The `find` command spans 11 lines (46-57) with `\` line continuations:
```
find . -type d \
  -not -path '*/node_modules/*' \
  -not -path '*/.git/*' \
  -not -path '*/dist/*' \
  -not -path '*/build/*' \
  -not -path '*/__pycache__/*' \
  -not -path '*/.isdlc/*' \
  -not -path '*/.claude/*' \
  | head -100
```

**Path 2: quick-scan-agent.md line 113**
```
/discover (or quick-scan) -> quick-scan-agent -> reads line 113 bash block ->
generates: "# Glob for file name matches\nglob ...\nglob ...\n..." ->
No Bash() pattern starts with # -> permission prompt
```

The multi-command block spans 9 lines (113-121) with comments:
```
# Glob for file name matches
glob "**/user*.{ts,js,py,java}"
glob "**/*preference*.{ts,js,py,java}"

# Grep for keyword references
grep -l "preferences" src/
grep -l "user.*settings" src/
```

#### Failure Location

The failure is NOT in any runtime code (hooks, dispatchers, skills). It occurs in **Claude Code's built-in permission matching engine**, which is immutable. The only controllable factor is the **content of agent prompt files** -- specifically, the bash code fences that teach the LLM multiline patterns.

---

## Root Cause Analysis

### T3: Root Cause Identifier Report

#### Primary Hypothesis (HIGH confidence)

**Root Cause**: Agent prompt files contain multiline inline Bash code blocks that the LLM reproduces as multiline Bash tool calls, bypassing Claude Code's glob-based permission matching.

**Evidence**:
1. Claude Code's `*` glob in permission patterns does not match `\n` -- this is a platform constraint, documented and confirmed
2. Two remaining agent prompt files contain multiline bash code blocks (2 blocks across 2 files)
3. LLMs are known to reproduce patterns from their context -- multiline bash in context leads to multiline bash in tool calls
4. Single-line bash commands always match the existing allowlist patterns correctly
5. The same command rewritten as single-line would auto-allow (e.g., `find . -type d -not -path '*/node_modules/*' ... | head -100` matches `Bash(find *)`)
6. The 6 files already cleaned up validate the fix approach -- their multiline blocks were eliminated through content rewrites

#### Alternative Hypotheses (Rejected)

| Hypothesis | Confidence | Rejection Reason |
|-----------|-----------|-----------------|
| Bug in hooks/dispatchers | LOW | Hooks fire AFTER permission is granted; they cannot cause permission prompts |
| Bug in settings.json patterns | LOW | Patterns are correct for single-line commands; issue is only with multiline |
| Bug in Claude Code permission engine | LOW | The `*` glob behavior (not matching newlines) is by-design, not a bug |
| LLM generates multiline independently | LOW | Evidence shows strong correlation between prompt patterns and generated commands |

#### Current Affected File Inventory (Revalidated 2026-02-20)

**65 total agent/command files scanned.** Only **5 files** contain `bash`/`sh` tagged code fences. Of those, only **2 files** have multiline blocks:

| # | File | Bash Blocks | Multiline Blocks | Pattern Types |
|---|------|-------------|------------------|---------------|
| 1 | `src/claude/agents/discover/architecture-analyzer.md` | 1 | 1 | line-continuation (`\` backslashes, 11 lines) |
| 2 | `src/claude/agents/quick-scan/quick-scan-agent.md` | 1 | 1 | multi-example with comments (9 lines) |
| **Total** | | **2** | **2** | |

**Files with bash fences confirmed SAFE (single-line only):**

| File | Bash Blocks | Status |
|------|------------|--------|
| `src/claude/agents/05-software-developer.md` | 2 | SAFE -- both single-line (`npm test -- --testNamePattern="AC1"`) at lines 497, 541 |
| `src/claude/commands/provider.md` | 3 | SAFE -- all single-line (line 187: `export && export`, line 193: `export`, line 335: slash command) |
| `src/claude/agents/discover/atdd-bridge.md` | 1 | SAFE -- single-line slash command at line 230 |

**Files previously affected, now RESOLVED:**

| File | Original Multiline Blocks | Current Bash Fences | Resolution |
|------|--------------------------|--------------------|-----------|
| `src/claude/agents/05-software-developer.md` | 3 (lines 169, 201, 392) | 2 (both safe) | Content rewritten to prose + single-line |
| `src/claude/agents/06-integration-tester.md` | 4 (lines 128, 522, 602, 621) | 0 | All bash fences removed |
| `src/claude/commands/provider.md` | 10 (lines 88-433) | 3 (all safe) | Reduced to single-line fences |
| `src/claude/agents/discover/data-model-analyzer.md` | 6 (lines 99-133) | 0 | All bash fences removed |
| `src/claude/agents/discover/skills-researcher.md` | 2 (lines 57, 141) | 0 | All bash fences removed |
| `src/claude/agents/discover/test-evaluator.md` | 1 (line 74) | 0 | All bash fences removed |

#### Detailed Block-by-Block Classification (Remaining)

**`src/claude/agents/discover/architecture-analyzer.md`**:

| Line | Classification | Risk | Description |
|------|---------------|------|-------------|
| 46 | MULTILINE | HIGH | `find . -type d` with 7 `-not -path` args using `\` line continuations spanning lines 46-57, piped to `| head -100` |

**Fix approach**: Join into single line: `find . -type d -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*' -not -path '*/__pycache__/*' -not -path '*/.isdlc/*' -not -path '*/.claude/*' | head -100`

**`src/claude/agents/quick-scan/quick-scan-agent.md`**:

| Line | Classification | Risk | Description |
|------|---------------|------|-------------|
| 113 | MULTILINE | MEDIUM | 2 glob commands + 2 grep commands with interleaved comments, spanning lines 113-121 |

**Fix approach**: Split into separate single-line code fences, one per command, with comments moved to prose above each fence. Or convert to a description list of individual commands.

#### Prevention Measures Already In Place

**Fix 3 (CLAUDE.md convention)** is already deployed at line 218 of CLAUDE.md:
- "Single-Line Bash Convention" section with transformation table
- Escape hatch for extracting to `bin/` script files
- Reference syntax: `> See **Single-Line Bash Convention** in CLAUDE.md.`

#### Suggested Remaining Fixes

**Fix 1: Rewrite 2 remaining multiline blocks** (PRIMARY -- implementation scope)
- `architecture-analyzer.md` line 46: Join `find` command to single line
- `quick-scan-agent.md` line 113: Split into individual single-line fences or convert to prose
- Estimated effort: Low (2 simple text edits in .md files, no logic changes)

**Fix 4: Update CLAUDE.md.template** (DOWNSTREAM -- if template exists)
- Mirror the Single-Line Bash Convention in the template for new projects
- Estimated effort: Trivial

#### Git History Analysis (Updated)

Review of 49 recent commits shows that multiline bash blocks in 6 files were addressed through various feature and refactoring work. The cleanup was not tracked as a dedicated fix but occurred organically as files were rewritten during other workflows. The 2 remaining files (`architecture-analyzer.md`, `quick-scan-agent.md`) were not touched by those commits.

---

## Tracing Metadata

```json
{
  "tracing_completed_at": "2026-02-20T19:15:00Z",
  "original_analysis_at": "2026-02-19T21:00:00Z",
  "revalidation": true,
  "commits_since_analysis": 49,
  "sub_agents": ["T1-symptom-analyzer", "T2-execution-path-tracer", "T3-root-cause-identifier"],
  "discovery_report_used": "docs/project-discovery-report.md",
  "error_keywords": ["multiline", "bash", "permission", "auto-allow", "glob", "newline", "settings.json"],
  "files_scanned": {
    "agent_files": 57,
    "command_files": 8,
    "total_scanned": 65
  },
  "original_scope": {
    "affected_files": 8,
    "multiline_blocks": 28
  },
  "current_scope": {
    "affected_files": 2,
    "multiline_blocks": 2,
    "resolved_files": 6,
    "resolved_blocks": 26
  },
  "prevention_deployed": {
    "claude_md_convention": true,
    "convention_line": 218
  },
  "debate_rounds_used": 0,
  "fan_out_chunks": 0
}
```
