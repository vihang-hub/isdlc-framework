# Module Design: REQ-GH-214 — PreToolUse Tool Routing

**Source**: GitHub Issue #214
**Status**: Accepted

---

## Module Overview

| Module | Type | Responsibility |
|--------|------|----------------|
| `tool-router.cjs` | New hook | Intercept Grep/Glob/Read, evaluate routing rules, block/warn/allow |
| `tool-routing.json` | New config | Declarative routing rules, inference probes, user overrides |
| `.isdlc/tool-routing-audit.jsonl` | New runtime file | Append-only audit log of routing decisions |

---

## Module Design

### tool-router.cjs

**Location**: `src/claude/hooks/tool-router.cjs`
**Type**: PreToolUse hook (CJS)
**Estimated size**: ~300 lines

#### Functions

- `main()` → reads stdin, evaluates rules, outputs block/warn or exits silently
- `loadRoutingRules(configPath, manifestPath)` → merges framework + inferred + skill + user rules, returns `Rule[]`
- `inferEnvironmentRules()` → probes MCP availability via filesystem heuristics, returns `Rule[]` at `warn` level
- `evaluateRule(rule, toolInput)` → checks availability, exemptions, returns `{ decision, exemption? }`
- `checkExemptions(exemptions, toolInput)` → evaluates pattern + context exemptions, returns first match or null
- `probeMcpAvailability(toolName, timeoutMs)` → filesystem/process heuristic check, returns boolean
- `formatBlockMessage(rule, toolInput)` → block output with preferred tool name and guidance
- `formatWarnMessage(rule, toolInput, configPath)` → warning with preferred tool, source, and config path
- `appendAuditEntry(entry)` → appends JSONL line to audit log

#### Data Structures

```
Rule {
  id: string
  operation: string
  intercept_tool: 'Grep' | 'Glob' | 'Read' | 'Write' | 'Bash'
  preferred_tool: string
  enforcement: 'block' | 'warn' | 'allow'
  source: 'framework' | 'inferred' | 'skill' | 'user'
  exemptions: Exemption[]
}

Exemption {
  type: 'pattern' | 'context'
  field?: string          — dot-path into tool_input (pattern type)
  regex?: string          — regex pattern (pattern type)
  condition?: string      — named condition (context type)
  signal?: string         — what to check (context type)
}

AuditEntry {
  ts: string, tool: string, preferred: string,
  enforcement: string, decision: string,
  exemption: string | null, rule_id: string, rule_source: string
}
```

#### Context-Based Exemption Logic

| Condition | Tool | Logic |
|-----------|------|-------|
| `edit_prep` | Read | `limit` exists AND `limit <= 200` |
| `targeted_read` | Read | `offset` exists |
| `targeted_file` | Grep | `path` has file extension AND no wildcards |
| `exact_filename` | Glob | Final segment of `pattern` has no wildcards |
| `non_mkdir` | Bash | `command` does not start with `mkdir` |

#### Error Handling

| Scenario | Behavior |
|----------|----------|
| Config missing | exit 0 (allow all) |
| Config malformed | stderr warning, exit 0 |
| Stdin malformed | exit 0 |
| MCP probe timeout | skip rule |
| Audit write failure | stderr warning, continue |
| Invalid exemption regex | stderr warning, skip exemption |
| Skill manifest missing | skip skill rules |

#### Dependencies
- `fs`, `path` (Node built-in)
- `./lib/common.cjs` — `readStdin`, `debugLog`, `logHookEvent`, `outputBlockResponse`

### tool-routing.json

**Location**: `src/claude/hooks/config/tool-routing.json`

#### Framework Default Rules

| ID | Intercept | Preferred | Enforcement | Exemptions |
|----|-----------|-----------|-------------|------------|
| `search-semantic` | Grep | `mcp__code-index-mcp__search_code_advanced` | block | targeted_file (path has extension) |
| `find-files` | Glob | `mcp__code-index-mcp__find_files` | block | exact_filename (no wildcards in basename) |
| `file-summary` | Read | `mcp__code-index-mcp__get_file_summary` | block | edit_prep (limit <= 200), targeted_read (offset present) |

#### Inference Probes

| Tool | Probe Method | Timeout |
|------|-------------|---------|
| `mcp__code-index-mcp__*` | tool_exists | 500ms |
| `mcp__bulk-fs-mcp__*` | tool_exists | 500ms |

---

## Changes to Existing

| File | Change | Reason |
|------|--------|--------|
| `src/claude/settings.json` | Add 3 PreToolUse entries (Grep, Glob, Read matchers) | Hook registration |
| `docs/isdlc/constitution.md` | Add Article XV: Tool Preference Enforcement | Governance principle |
| `docs/isdlc/external-skills-manifest.json` | Add `tool_preferences` to skill bindings schema | Skill-declared preferences (FR-005) |

---

## Wiring Summary

### Claude Provider
| File | Change |
|------|--------|
| `src/claude/hooks/tool-router.cjs` | CREATE — new PreToolUse hook |
| `src/claude/hooks/config/tool-routing.json` | CREATE — routing rules config |
| `src/claude/settings.json` | MODIFY — add Grep, Glob, Read PreToolUse matchers |

### Codex Provider
| File | Change |
|------|--------|
| Not applicable | Codex does not use Claude Code hooks — tool routing is Claude-provider-specific |

### Dogfooding (this project as consumer)
| File | Change |
|------|--------|
| `.claude/hooks/tool-router.cjs` | CREATE — copy of src/claude/hooks/tool-router.cjs |
| `.claude/hooks/config/tool-routing.json` | CREATE — copy of src/claude/hooks/config/tool-routing.json |
| `.claude/settings.json` | MODIFY — add Grep, Glob, Read PreToolUse matchers |

### Shared / Provider-Neutral
| File | Change |
|------|--------|
| `docs/isdlc/constitution.md` | MODIFY — Article XV |
| `docs/isdlc/external-skills-manifest.json` | MODIFY — tool_preferences schema |
