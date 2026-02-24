# ADR-0016: Single-Line Bash Convention for Agent Prompt Files

## Status
Accepted

## Context

Claude Code's permission auto-allow system uses `*` glob patterns (e.g., `Bash(grep *)`, `Bash(node *)`) to match Bash tool calls against a whitelist. The `*` glob matches any characters **except newlines**. When an agent generates a multiline Bash command (containing `\n`), the glob fails to match and the user receives an interactive permission prompt, even though every individual command within the multiline block is already auto-allowed.

Framework agent prompt files (`.md` files in `src/claude/agents/` and `src/claude/commands/`) contained 23 multiline Bash code blocks. The LLM reads these patterns and reproduces them as multiline Bash tool calls. This is the root cause of unnecessary permission prompts during autonomous workflow execution.

The dominant pattern (22 of 23 blocks) is "comment-interleaved": multiple commands in a single fenced code block with `#` comment lines between them. The remaining block contains slash command examples in a `bash` fence.

**Requirements addressed:** FR-001 through FR-004, NFR-001 (zero permission prompts), NFR-003 (convention enforceability)

**Constraints:** CON-001 (Claude Code's glob behavior is immutable), CON-002 (existing auto-allow rules must suffice)

## Decision

### 1. Establish a Single-Line Bash Convention

Add a shared protocol section to `CLAUDE.md` (and `CLAUDE.md.template`) under "Agent Framework Context" that:

- **Prohibits** multiline Bash code blocks in agent prompt files
- **Requires** every ` ```bash ` code block to contain exactly one line of executable command(s)
- **Allows** `&&` chaining for dependent commands on a single line
- **Requires** comments and labels to be placed in Markdown prose above the code block
- **Provides** an escape hatch: extract genuinely complex operations to script files in `bin/`

Agents reference this section with the standard one-line pointer: `> See **Single-Line Bash Convention** in CLAUDE.md.`

### 2. Uniform Mechanical Rewrite

All 23 multiline Bash blocks are rewritten using one uniform transformation:

1. Move `#` comment lines out of the code block into Markdown prose (bold labels, numbered steps, or plain text) placed above the corresponding command
2. Give each command its own single-line ` ```bash ` code block
3. Optionally join closely related commands with `&&` if the combined line stays under ~100 characters
4. For non-Bash content (slash command examples), change the fence language from `bash` to `text` or remove it

### 3. No bin/ Script Extraction

After examining all 23 blocks, no command requires extraction to a script file. Every command is individually single-line; the multiline nature came exclusively from interleaved comments and grouping multiple commands in one fence. The `node -e` pattern originally flagged as needing extraction (`node -e "console.log(require('os').cpus().length)"`) is already a single-line command.

The convention documents the bin/ extraction escape hatch for future use, but no scripts are created for this bug fix.

## Consequences

**Positive:**
- All framework-generated Bash commands match existing auto-allow glob patterns, eliminating permission prompts (NFR-001)
- Convention prevents regression -- new agent/command files follow the same pattern (NFR-003)
- Template update ensures downstream projects inherit the convention (FR-004)
- Mechanical transformation preserves functional equivalence -- same commands, same arguments (NFR-002)
- Minimal change surface -- only Bash code blocks and surrounding prose are modified (NFR-004)
- Documentation quality improves slightly -- prose labels are more readable than inline `#` comments

**Negative:**
- Agent files become slightly longer (each command gets its own fenced block instead of sharing one block)
- No automated enforcement (lint rule or hook) -- the convention relies on code review and the documented standard. Automated enforcement was explicitly placed out of scope.
- CLAUDE.md and CLAUDE.md.template must be kept manually in sync for this section

## Alternatives Considered

### A. Add multiline-aware glob patterns to settings.json
**Rejected.** Claude Code's glob semantics are a platform constraint (CON-001). We cannot change `*` to match newlines. Even if we could add regex-based rules, this would be fragile and require maintenance as agent commands evolve.

### B. Extract all multiline blocks to bin/ scripts
**Rejected.** Over-engineered for this case. All 23 blocks are multiline only due to comment interleaving, not because any single command is inherently multi-statement. Creating 23 script files for commands like `npm test` and `grep -rn` would add unnecessary complexity (violates Article V: Simplicity First).

### C. Add a pre-task hook to split multiline Bash at runtime
**Rejected.** A hook that intercepts Bash tool calls and splits them into single-line calls would be complex, fragile (would need to understand command boundaries), and would mask the root cause rather than fixing it. The correct fix is at the source: the prompt files.

### D. Use a different fence language (e.g., ```sh or ```shell)
**Rejected.** Does not solve the problem. The LLM generates Bash tool calls regardless of the fence language; it is the multiline pattern that matters, not the language tag. Additionally, ```sh and ```shell are treated identically by most renderers.
