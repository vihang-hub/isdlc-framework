# Quick Scan: BUG-0029-GH-18 — Multiline Bash Permission Bypass

**Generated**: 2026-02-18T23:15:00Z
**Bug ID**: BUG-0029-GH-18
**Phase**: 00-quick-scan

---

## Executive Summary

Framework agents and commands generate **25 multiline Bash code blocks** that are susceptible to the Claude Code permission auto-allow bypass. The issue occurs because Claude Code's glob pattern matching in `.claude/settings.json` uses pattern `Bash(*)` which does NOT match newlines, causing multiline commands to always prompt for permission even when each individual command would be auto-allowed.

**Scope Estimate**: MEDIUM (~5 affected files, ~25 bash blocks to remediate)
**Confidence**: HIGH
**Risk**: Medium (Permission prompts are annoying but not a security issue)

---

## Scope Estimate

| Metric | Value |
|--------|-------|
| **Estimated Scope** | MEDIUM |
| **File Count Estimate** | 5 affected source files |
| **Total Bash Blocks** | 25 multiline blocks |
| **High-Risk Instances** | 1 (critical pattern: `node -e`) |
| **Pattern Types** | 4 (node-e, for-loop, piped-commands, if-statement) |

---

## Affected Files Summary

### 1. src/claude/agents/05-software-developer.md
- **Bash blocks**: 5 multiline
- **Critical patterns**: 1 (node -e)
- **Affected lines**: 169-174, 201-209, 392-399, 522-523, 566-567

**High-Risk Block (lines 201-209)**:
```bash
# Linux
N=$(nproc)

# macOS
N=$(sysctl -n hw.ncpu)

# Cross-platform Node.js
N=$(node -e "console.log(require('os').cpus().length)")
```
This block uses `node -e` which is in the auto-allow list but the multiline format triggers permission prompts.

### 2. src/claude/agents/06-integration-tester.md
- **Bash blocks**: 5 multiline
- **Patterns**: for-loop (2 instances), piped-commands (2 instances)
- **Affected lines**: 128-135, 522-530, 602-607, 621-626, 659-661

**Example (lines 128-135)**:
```bash
# Step 1: Check state.json for configured commands
cat .isdlc/state.json | jq '.testing_infrastructure.tools'

# Step 2: Check package.json for test scripts
cat package.json | jq '.scripts | to_entries | map(select(.key | startswith("test")))'

# Step 3: Use discovered commands in your iteration loop
```

### 3. src/claude/commands/discover.md
- **Bash blocks**: 1 multiline (23 lines)
- **Patterns**: for-loop (comment lines, not actual loops)
- **Affected lines**: 102-125

Example: Command listing with `/discover` and flags.

### 4. src/claude/commands/provider.md
- **Bash blocks**: 13 multiline
- **Patterns**: piped-commands (5), for-loop (2), if-statement (1)
- **Affected lines**: 88-101, 111-113, 125-141, 145-148, 207-212, 216-221, 225-228, 232-234, 375-376, 390-395, 399-400, 417-428, 433-438

**Example (lines 125-141)**:
```bash
# 1. Install Ollama
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh
```

### 5. src/claude/commands/isdlc.md
- **Bash blocks**: 1 multiline (8 lines)
- **Patterns**: None (comment lines and command examples)
- **Affected lines**: 665-673

---

## Pattern Frequency Analysis

| Pattern Type | Count | Risk Level | Auto-Allow Status |
|-------------|-------|------------|-------------------|
| **piped-commands** | 5 | Medium | Grep/jq/cat/echo all auto-allow individually |
| **for-loop** | 4 | Low | Often comment lines or empty loops |
| **if-statement** | 1 | Low | Curl with if-check |
| **node -e** | 1 | **CRITICAL** | `node *` is auto-allow but multiline blocks it |

---

## Claude Code Settings Context

Reviewed `.claude/settings.json`:

**Glob Pattern Used**: `Bash(*)`

**Problem**: The `*` glob does NOT match newlines in Bash. When agents generate:
```bash
git add -A && \
git commit -m "message"
```

Claude Code's permission matcher sees:
```
Bash(git add -A && \n...)
```

The `*` pattern does NOT match the newline, so the permission check fails. Even though both `git add *` and `git commit *` are in the allow list.

**Auto-Allow Commands** (lines 56-147 of settings.json):
- `Bash(node *)`
- `Bash(git add *)`
- `Bash(git commit *)`
- `Bash(grep *)`
- `Bash(cat *)`
- `Bash(jq *)`
- Many others

All of these would be auto-allowed if written on a single line.

---

## Keyword Matches

### Domain Keywords
| Keyword | Matches | Notes |
|---------|---------|-------|
| bash | 25 blocks | All bash code blocks in agents/commands |
| multiline | 25 blocks | All contain newlines |
| permission | 1 reference | Permission bypass issue |
| node -e | 1 block | Critical pattern in developer agent |

### Technical Keywords
| Keyword | Matches | Notes |
|---------|---------|-------|
| && (chain) | 0 direct | Not used in current blocks (mostly comments) |
| heredoc | 0 | No `<<EOF` patterns found |
| for loop | 4 instances | In agent documentation, not actual bash loops |
| pipe | 5 instances | Piped commands (cat \| jq) |

---

## Root Cause Assessment

The issue is **NOT in the framework code itself** but in how agents and commands document Bash examples:

1. **Agent documentation** (`.md` files) shows multi-step Bash commands as examples
2. **Claude Code permission checking** uses glob patterns that don't match newlines
3. **Result**: Every multiline Bash block in documentation causes permission prompts when agents copy/paste them

---

## Remediation Scope

The fix requires updating bash code blocks in these files to either:

### Option A: Collapse to Single Line
```bash
N=$(nproc); echo $N  # Instead of multiline version
```

### Option B: Add Backslash Continuation
```bash
N=$(nproc) && \
echo $N
```

### Option C: Refactor to use bash variables/arrays
Less applicable to documentation examples.

---

## Questions for Requirements Phase

1. **Should we collapse multiline Bash in documentation?** — Risk: Less readable examples
2. **Should we add bash line continuation characters?** — Risk: More complex to copy-paste
3. **Should we refactor the agent Bash generation code?** — Cost: Agents should avoid `&&` in multiline when possible
4. **Is this worth fixing?** — Permission prompts are annoying but not security-critical

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-18T23:15:00Z",
  "search_duration_ms": 4500,
  "keywords_searched": 12,
  "files_matched": 5,
  "scope_estimate": "medium",
  "confidence": "high",
  "affected_sources": {
    "agent_files": 2,
    "command_files": 3
  },
  "bash_block_breakdown": {
    "total_blocks": 25,
    "critical_risk": 1,
    "high_risk": 0,
    "medium_risk": 0,
    "low_risk": 24
  }
}
```

---

## Next Steps for Requirements Phase

1. **Clarify scope**: Is this fixing documentation only, or agent code that generates Bash?
2. **Prioritize**: Focus on high-risk `node -e` pattern first
3. **Validate**: Confirm permission prompts are actually occurring in practice
4. **Design**: Decide on remediation approach (collapse, continuation, refactor)
