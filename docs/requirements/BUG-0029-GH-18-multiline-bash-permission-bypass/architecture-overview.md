# Architecture Overview: BUG-0029-GH-18

**Bug ID:** BUG-0029-GH-18
**Title:** Multiline Bash Permission Bypass
**Phase:** 03 - Architecture
**Date:** 2026-02-18

---

## 1. Problem Summary

Claude Code's permission auto-allow rules use `*` glob patterns (e.g., `Bash(grep *)`) that match any characters **except newlines**. When framework agents generate multiline Bash commands -- learned from multiline code blocks in their prompt files -- the glob fails to match and the user receives a permission prompt.

23 multiline Bash code blocks across 5 agent/command files teach the LLM to produce multiline Bash. The fix eliminates these patterns and establishes a convention to prevent regression.

**Traces:** FR-001 (rewrite blocks), FR-002 (convention), FR-003 (bin/ extraction), FR-004 (template), NFR-001 (zero prompts), CON-001 (glob is immutable)

---

## 2. Architectural Decision: Single-Line Bash Convention

### 2.1 Convention Text (for CLAUDE.md)

The following section will be added to `CLAUDE.md` under "Agent Framework Context", between the existing "Git Commit Prohibition" section and the "Project Context" section. It will also be mirrored in `src/claude/CLAUDE.md.template`.

```markdown
### Single-Line Bash Convention

Agent prompt files (.md) MUST NOT contain multiline Bash code blocks. Claude Code's
permission auto-allow globs use `*` which does not match newlines -- multiline commands
bypass auto-allow and trigger user permission prompts.

**Rules:**
1. Every ` ```bash ` code block must contain exactly ONE line of executable command(s)
2. Chain dependent commands with `&&` on a single line
3. Place comments and labels in Markdown prose ABOVE the code block, not inside it
4. If a command genuinely cannot fit on one line, extract it to a script in `bin/` and
   call the script (e.g., `node bin/my-script.js --flag`)

**Acceptable:**

Use npm to run unit tests:

` ```bash `
npm test
` ``` `

Check if Ollama is running, then pull a model:

` ```bash `
curl -s http://localhost:11434/api/tags && ollama pull qwen2.5-coder:14b
` ``` `

**Not acceptable:**

` ```bash `
# Check if running
curl http://localhost:11434/api/tags
# Pull model
ollama pull qwen2.5-coder:14b
` ``` `

Agent files reference this section with:
> See **Single-Line Bash Convention** in CLAUDE.md.
```

**Design rationale:**
- The convention is 18 lines (excluding examples) -- concise enough to read in context, detailed enough to be actionable.
- It covers all 4 pattern types found in the codebase: comment-interleaved, for-loops, piped-commands, and node-e.
- The escape hatch (extract to bin/) is included for completeness but is not expected to be needed for this bug.
- The reference format (`> See **Single-Line Bash Convention** in CLAUDE.md.`) follows the exact pattern used by all other shared protocols (Mandatory Iteration Enforcement, Git Commit Prohibition, etc.).

**Traces:** FR-002/AC-002-01, AC-002-02, AC-002-03, NFR-003

### 2.2 Placement in CLAUDE.md

The new section will be inserted as a peer of existing shared protocol sections under "## Agent Framework Context":

```
## Agent Framework Context

### SKILL OBSERVABILITY Protocol          (existing)
### SUGGESTED PROMPTS                     (existing)
### CONSTITUTIONAL PRINCIPLES Preamble    (existing)
### Root Resolution Protocol              (existing)
### Project Context Resolution            (existing)
### Monorepo Mode Protocol                (existing)
### Mandatory Iteration Enforcement       (existing)
### Git Commit Prohibition                (existing)
### Single-Line Bash Convention           << NEW >>

---

## Project Context                        (existing)
```

This placement groups it with other "rules agents must follow" sections and puts it after Git Commit Prohibition (another behavioral constraint), maintaining logical ordering.

---

## 3. Rewrite Strategy

### 3.1 Dominant Pattern: Comment-Interleaved (22 of 23 blocks)

22 of the 23 multiline blocks follow the same pattern: comments between commands in a single fenced code block. The transformation is mechanical and uniform:

**Before:**
```
` ```bash `
# Step 1: Check status
curl http://localhost:11434/api/tags

# Step 2: Pull model
ollama pull qwen2.5-coder:14b

# Step 3: Verify
ollama list
` ``` `
```

**After:**
```
Step 1 -- Check status:

` ```bash `
curl http://localhost:11434/api/tags
` ``` `

Step 2 -- Pull model:

` ```bash `
ollama pull qwen2.5-coder:14b
` ``` `

Step 3 -- Verify installed models:

` ```bash `
ollama list
` ``` `
```

**Rules for the transformation:**
1. Each `# comment` line becomes Markdown prose (bold label, plain text, or numbered list item) placed above its corresponding command.
2. Each command gets its own single-line fenced code block.
3. Commands that are alternatives for the same step (e.g., platform-specific variants) are listed as separate code blocks under sub-labels ("Linux:", "macOS:").
4. Commands that form a dependent sequence (where the second requires the first to succeed) MAY be joined with `&&` on one line if the combined length is under ~100 characters. Otherwise, keep them as separate code blocks with prose between them.

### 3.2 Slash Command Examples (1 of 23 blocks)

The discover.md block (lines 102-126) contains slash command invocations (`/discover --new`, `/discover --existing`, etc.) inside a ` ```bash ` fence. These are not executable Bash commands but may still influence the LLM to produce multiline Bash output.

**Transformation:** Change the fence language from `bash` to `text` or use no language identifier. This removes the Bash-execution signal while preserving documentation readability. Alternatively, split into individual single-line code blocks if the LLM influence is a concern.

**Recommended approach:** Split into individual examples with prose labels, using plain code fences (no `bash` tag). This is consistent with the comment-interleaved transformation and eliminates any risk.

### 3.3 No Alternative Categories Needed

All 23 blocks fall into one of two categories (comment-interleaved or slash-command-examples) and both use the same core transformation: move labels to prose, keep commands as single-line blocks. No blocks require a different treatment.

**Traces:** FR-001/AC-001-01, AC-001-02, AC-001-03, AC-001-04

---

## 4. bin/ Script Extraction Decision

### 4.1 Assessment: Not Needed

The impact analysis identified the `node -e` pattern in `05-software-developer.md` (lines 201-210) as the primary candidate for bin/ extraction. On examination, the `node -e` command itself is already single-line:

```bash
N=$(node -e "console.log(require('os').cpus().length)")
```

The block is multiline only because it shows three OS-specific alternatives (`nproc`, `sysctl`, `node -e`) with comments between them. After the comment-interleaved rewrite, each alternative becomes its own single-line code block. No extraction needed.

### 4.2 No Other Extraction Candidates

All 23 multiline blocks were reviewed. None contain commands that cannot be expressed as single-line equivalents:

| Pattern | Count | Single-Line Feasible? | Extraction Needed? |
|---------|-------|-----------------------|-------------------|
| Comment-interleaved | 22 | Yes -- remove comments, split blocks | No |
| Slash-command examples | 1 | Yes -- change fence or split | No |

### 4.3 Architectural Decision

**Decision:** FR-003 (bin/ extraction) is architecturally unnecessary for this bug. No script files will be created.

**Justification:** Every multiline block's commands are individually single-line. The multiline nature comes from grouping multiple commands with interleaved comments, not from any single command being multi-statement.

**Escape hatch preserved:** The convention (Section 2.1) documents the bin/ extraction path for future cases where a genuinely complex operation cannot be single-lined. This satisfies the spirit of FR-003 without creating unnecessary files.

**Traces:** FR-003/AC-003-01 (N/A -- no candidates), AC-003-02 (N/A), AC-003-03 (N/A)

---

## 5. File-by-File Implementation Plan

### 5.1 Implementation Order

| Order | File | Blocks | Estimated Effort |
|-------|------|--------|-----------------|
| 1 | `CLAUDE.md` | 0 (new section) | Add convention section |
| 2 | `src/claude/CLAUDE.md.template` | 0 (new section) | Mirror convention section |
| 3 | `src/claude/agents/05-software-developer.md` | 3 | Comment-interleaved rewrite |
| 4 | `src/claude/agents/06-integration-tester.md` | 5 | Comment-interleaved rewrite |
| 5 | `src/claude/commands/provider.md` | 13 | Comment-interleaved rewrite (highest volume) |
| 6 | `src/claude/commands/discover.md` | 1 | Fence language change + split |
| 7 | `src/claude/commands/isdlc.md` | 1 | Comment-interleaved rewrite |

### 5.2 Per-File Details

#### CLAUDE.md (Order 1)
- **Action:** Add "### Single-Line Bash Convention" section after "### Git Commit Prohibition"
- **Content:** As specified in Section 2.1 of this document
- **Risk:** None -- additive change, no existing content modified

#### src/claude/CLAUDE.md.template (Order 2)
- **Action:** Add identical convention section in the corresponding location within the template
- **Content:** Identical to CLAUDE.md version (AC-004-02)
- **Risk:** None -- additive change

#### src/claude/agents/05-software-developer.md (Order 3)
- **Block 1 (lines 169-175):** Test command examples with comments. Split into 4 separate single-line blocks with prose labels ("npm:", "pytest:", "Go:")
- **Block 2 (lines 201-210):** CPU core detection for 3 OSes. Split into 3 single-line blocks under "Linux:", "macOS:", "Cross-platform Node.js:" labels
- **Block 3 (lines 392-400):** Test command discovery with comments. Split into separate single-line blocks with prose describing each step
- **Blocks 4-5 (lines 522-524, 566-568):** Already single-line. No change.

#### src/claude/agents/06-integration-tester.md (Order 4)
- **Block 1 (lines 128-136):** Command discovery protocol. Split 3 piped commands into separate blocks with step labels
- **Block 2 (lines 522-531):** Skip pattern scanning by language. Split into 3 single-line grep blocks under "JavaScript/TypeScript:", "Python:", "Java:" labels
- **Block 3 (lines 602-607):** Extract test names. Split 2 commands into separate blocks
- **Block 4 (lines 621-627):** Run acceptance tests. Split 2 commands with comments into separate blocks
- **Block 5 (lines 659-662):** Mutation test command. Move comment to prose, keep single command

#### src/claude/commands/provider.md (Order 5)
- **13 blocks** all follow the comment-interleaved pattern
- Each block: move `#` comments to Markdown prose, split commands into individual single-line code blocks
- Notable blocks:
  - Lines 88-102 (Quick Start): 4 numbered steps with comments become prose + 2 command blocks
  - Lines 125-142 (Manual setup): 5 numbered steps become prose + 5 command blocks
  - Lines 417-429 (Pull models): 4 commands become 4 separate code blocks

#### src/claude/commands/discover.md (Order 6)
- **Block 1 (lines 102-126):** Slash command examples. Change fence from ` ```bash ` to ` ```text ` or split into individual examples with prose labels. These are `/discover` invocations, not Bash commands.

#### src/claude/commands/isdlc.md (Order 7)
- **Block 1 (lines 665-674):** Discover quick start with 3 examples. Split into 3 separate single-line blocks with prose labels.

---

## 6. Validation Approach

### 6.1 Automated Verification

After implementation, verify zero multiline Bash blocks remain in affected files:

```bash
grep -Pzo '```bash\n.*\n.*\n' src/claude/agents/05-software-developer.md src/claude/agents/06-integration-tester.md src/claude/commands/provider.md src/claude/commands/discover.md src/claude/commands/isdlc.md
```

Expected result: no matches (every `bash` block is single-line).

### 6.2 Functional Equivalence (NFR-002)

Each rewritten block must preserve the same commands with the same arguments. The reviewer should verify:
1. No commands were omitted during rewrite
2. No command arguments were altered
3. The surrounding prose captures the information that was in the comments

### 6.3 Permission Prompt Test (NFR-001)

Run a feature workflow end-to-end and confirm zero Bash permission prompts for commands composed of auto-allowed primitives.

---

## 7. Traceability Matrix

| Requirement | Architecture Section | ADR |
|-------------|---------------------|-----|
| FR-001 (Rewrite blocks) | Section 3 (Rewrite Strategy), Section 5 (File-by-File Plan) | ADR-0016 |
| FR-002 (Convention in CLAUDE.md) | Section 2 (Convention Design) | ADR-0016 |
| FR-003 (bin/ extraction) | Section 4 (bin/ Decision) | ADR-0016 |
| FR-004 (Template update) | Section 5.2 (CLAUDE.md.template) | ADR-0016 |
| NFR-001 (Zero prompts) | Section 6.3 (Permission Prompt Test) | ADR-0016 |
| NFR-002 (No regression) | Section 6.2 (Functional Equivalence) | -- |
| NFR-003 (Enforceability) | Section 2.1 (Convention Text) | ADR-0016 |
| NFR-004 (Minimal surface) | Section 3 (uniform mechanical rewrite) | -- |
| CON-001 (Glob immutable) | Section 1 (Problem Summary) | ADR-0016 |
| CON-002 (Existing allow-list) | Section 4.3 (No new rules) | ADR-0016 |
| CON-003 (Prompt files as source) | Section 3.1 (Preserve documentation) | -- |
| CON-004 (Backward compat) | Section 3 (no logic changes) | -- |
