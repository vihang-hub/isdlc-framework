# Component Specification: Unified SessionStart Cache

**REQ-0001** | Phase 04 - Design | 2026-02-23

---

## 1. Component Overview

This specification defines the interfaces, contracts, and data formats for all components in the Unified SessionStart Cache system.

---

## 2. Function Interfaces

### 2.1 rebuildSessionCache(options?)

**Module**: `src/claude/hooks/lib/common.cjs`
**Export**: Public (`module.exports.rebuildSessionCache`)

**Signature**:

```typescript
interface RebuildOptions {
    projectRoot?: string;   // Override project root (for testing)
    verbose?: boolean;      // Log progress to stderr (default: false)
}

interface RebuildResult {
    path: string;           // Absolute path to .isdlc/session-cache.md
    size: number;           // Total character count of cache file
    hash: string;           // 8-character hex source hash
    sections: string[];     // Names of included sections (e.g., ["CONSTITUTION", "WORKFLOW_CONFIG", ...])
    skipped: string[];      // Names of skipped sections with reasons
}

function rebuildSessionCache(options?: RebuildOptions): RebuildResult;
```

**Contract**:

| Precondition | Behavior |
|-------------|----------|
| `.isdlc/` directory exists | Returns RebuildResult |
| `.isdlc/` directory missing | Throws `Error("No .isdlc/ directory at {root}")` |
| Source file missing | Section skipped, added to `result.skipped` |
| Source file unreadable | Section skipped, added to `result.skipped` |
| Total size > 128K chars | Writes file with warning to stderr |
| All source files missing | Returns result with `sections: []`, `skipped: [all sections]` |

**Side effects**:
- Writes `.isdlc/session-cache.md`
- If `options.verbose`, writes progress to `process.stderr`

**Thread safety**: Not applicable (single-threaded Node.js). Safe to call from any context.

**Idempotency**: Calling twice with same inputs produces identical output.

### 2.2 _buildSkillPathIndex()

**Module**: `src/claude/hooks/lib/common.cjs`
**Export**: Test-only (`module.exports._buildSkillPathIndex` when `NODE_ENV=test`)

**Signature**:

```typescript
function _buildSkillPathIndex(): Map<string, string>;
// Key: skill ID (e.g., "DEV-001")
// Value: relative path to SKILL.md (e.g., "src/claude/skills/development/code-implementation/SKILL.md")
```

**Contract**:

| Precondition | Behavior |
|-------------|----------|
| Skills directory exists | Returns populated Map |
| Skills directory missing | Returns empty Map |
| SKILL.md without skill_id frontmatter | File skipped |
| Cached index still valid (mtime check) | Returns cached Map (no I/O) |
| Directory mtime changed | Rebuilds index |

**Caching behavior**:
- First call: scans directory, builds index, caches in `_skillPathIndex`
- Subsequent calls: returns cached index if skills directory mtime unchanged
- Reset via `_resetCaches()`

### 2.3 _collectSourceMtimes(projectRoot)

**Module**: `src/claude/hooks/lib/common.cjs`
**Export**: Test-only

**Signature**:

```typescript
interface SourceMtimeEntry {
    path: string;       // Absolute file path
    mtimeMs: number;    // File modification time in milliseconds
}

interface MtimeResult {
    sources: SourceMtimeEntry[];  // Sorted by path
    hash: string;                  // 8-char hex hash
    count: number;                 // Total source file count
}

function _collectSourceMtimes(projectRoot: string): MtimeResult;
```

**Contract**:
- Returns deterministic hash for identical file states
- Skips missing files silently
- Array is sorted by path (lexicographic) for hash determinism

### 2.4 getAgentSkillIndex(agentName) -- Refactored

**Module**: `src/claude/hooks/lib/common.cjs`
**Export**: Public (existing)

**Signature** (unchanged):

```typescript
interface SkillEntry {
    id: string;          // e.g., "DEV-001"
    name: string;        // e.g., "code-implementation"
    description: string; // Extracted from SKILL.md
    path: string;        // e.g., "src/claude/skills/development/code-implementation/SKILL.md"
}

function getAgentSkillIndex(agentName: string): SkillEntry[];
```

**Contract changes**:

| Aspect | Before | After |
|--------|--------|-------|
| Path resolution | `manifest.path_lookup` reverse index | `_buildSkillPathIndex()` direct lookup |
| Path format in result | `.claude/skills/{cat}/{skill}/SKILL.md` or `src/claude/skills/...` | Consistent relative path from `_buildSkillPathIndex()` |
| First-call cost | Negligible | ~50-100ms (directory scan, cached afterward) |
| `path_lookup` dependency | Required | Removed |

**Output format**: Identical `Array<SkillEntry>`. Behavioral equivalence with existing implementation for all agents.

---

## 3. Hook Interface

### 3.1 inject-session-cache.cjs

**Type**: SessionStart hook
**Trigger**: Session startup and session resume events

**Input**: None (no tool_input, no arguments)

**Output**: Cache file content written to `process.stdout`

**Exit codes**:

| Code | Meaning |
|------|---------|
| 0 | Success (content output) or fail-open (no content) |

**Environment variables used**:

| Variable | Usage | Required |
|----------|-------|----------|
| `CLAUDE_PROJECT_DIR` | Resolve cache file path | No (falls back to `process.cwd()`) |

**Registration** (in `settings.json`):

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": { "type": "event", "event": "startup" },
        "hooks": [{ "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/inject-session-cache.cjs", "timeout": 5000 }]
      },
      {
        "matcher": { "type": "event", "event": "resume" },
        "hooks": [{ "type": "command", "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/inject-session-cache.cjs", "timeout": 5000 }]
      }
    ]
  }
}
```

**Matcher constraint**: Uses two separate entries (startup + resume), NOT compact matcher (bug #15174 avoidance, CON-004).

---

## 4. CLI Interface

### 4.1 bin/rebuild-cache.js

**Usage**:

```
node bin/rebuild-cache.js [--verbose|-v]
```

**Arguments**:

| Flag | Description |
|------|-------------|
| `--verbose` / `-v` | Print progress to stderr during cache build |

**Exit codes**:

| Code | Meaning |
|------|---------|
| 0 | Cache rebuilt successfully |
| 1 | Cache rebuild failed (no .isdlc/ directory, write error) |

**stdout output** (on success):

```
Session cache rebuilt successfully.
  Path: /path/to/.isdlc/session-cache.md
  Size: 127500 characters
  Hash: a1b2c3d4
  Sections: CONSTITUTION, WORKFLOW_CONFIG, ITERATION_REQUIREMENTS, ARTIFACT_PATHS, SKILLS_MANIFEST, SKILL_INDEX, EXTERNAL_SKILLS, ROUNDTABLE_CONTEXT
```

**stderr output** (on failure):

```
Failed to rebuild session cache: No .isdlc/ directory at /path/to/project
```

---

## 5. Cache File Format

### 5.1 File Location

`.isdlc/session-cache.md` (gitignored)

### 5.2 Header Format

```
<!-- SESSION CACHE: Generated {ISO-8601} | Sources: {count} | Hash: {hex8} -->
```

**Fields**:
- `Generated`: ISO-8601 timestamp of cache build (e.g., `2026-02-23T20:30:00.000Z`)
- `Sources`: Integer count of source files used
- `Hash`: 8-character lowercase hexadecimal hash of source file mtimes

**Parse regex**: `<!-- SESSION CACHE: Generated (.+) \| Sources: (\d+) \| Hash: ([0-9a-f]{8}) -->`

### 5.3 Section Format

**Included section**:

```
<!-- SECTION: {NAME} -->
{content}
<!-- /SECTION: {NAME} -->
```

**Skipped section**:

```
<!-- SECTION: {NAME} SKIPPED: {reason} -->
```

### 5.4 Section Registry

| Name | Content Type | Source | Consumer |
|------|-------------|--------|----------|
| `CONSTITUTION` | Markdown | `docs/isdlc/constitution.md` | GATE REQUIREMENTS INJECTION (step 4) |
| `WORKFLOW_CONFIG` | JSON | `src/isdlc/config/workflows.json` | Phase-loop controller (workflow definitions) |
| `ITERATION_REQUIREMENTS` | JSON | `.claude/hooks/config/iteration-requirements.json` | GATE REQUIREMENTS INJECTION (step 1) |
| `ARTIFACT_PATHS` | JSON | `.claude/hooks/config/artifact-paths.json` | GATE REQUIREMENTS INJECTION (step 3) |
| `SKILLS_MANIFEST` | JSON (filtered) | `src/claude/hooks/config/skills-manifest.json` | Skill validation consumers |
| `SKILL_INDEX` | Formatted text | Per-agent `getAgentSkillIndex()` output | SKILL INJECTION STEP A |
| `EXTERNAL_SKILLS` | Formatted text | External manifest + skill files | SKILL INJECTION STEP B |
| `ROUNDTABLE_CONTEXT` | Markdown | 3 persona + 6 topic files | Analyze handler (roundtable dispatch) |

### 5.5 SKILL_INDEX Sub-Structure

Within the `SKILL_INDEX` section, each agent's block is prefixed with a Markdown heading:

```markdown
## Agent: {agent-name}
AVAILABLE SKILLS (consult when relevant using Read tool):
  {SKILL_ID}: {skill-name} -- {description}
    -> {relative/path/to/SKILL.md}
  ...
```

Consumers locate a specific agent's block by searching for `## Agent: {agent_name}` within the section boundaries.

### 5.6 ROUNDTABLE_CONTEXT Sub-Structure

Within the `ROUNDTABLE_CONTEXT` section, content is organized with `###` headings:

```markdown
### Persona: Business Analyst
{raw content of persona-business-analyst.md}

### Persona: Solutions Architect
{raw content of persona-solutions-architect.md}

### Persona: System Designer
{raw content of persona-system-designer.md}

### Topic: problem-discovery
{raw content of topic file}

### Topic: requirements-definition
{raw content of topic file}

### Topic: technical-analysis
{raw content of topic file}

### Topic: architecture
{raw content of topic file}

### Topic: specification
{raw content of topic file}

### Topic: security
{raw content of topic file}
```

---

## 6. Settings.json Schema Addition

### 6.1 SessionStart Hook Schema

The `SessionStart` key is a new top-level key in the `hooks` object:

```json
{
  "hooks": {
    "PreToolUse": [...],
    "PostToolUse": [...],
    "Stop": [...],
    "SessionStart": [
      {
        "matcher": {
          "type": "event",
          "event": "startup" | "resume"
        },
        "hooks": [
          {
            "type": "command",
            "command": "string",
            "timeout": number
          }
        ]
      }
    ]
  }
}
```

---

## 7. External Manifest Schema Addition (FR-009)

### 7.1 Source Field

New optional field `source` on each skill entry:

```json
{
  "skills": [
    {
      "name": "string",
      "file": "string",
      "source": "discover" | "skills.sh" | "user" | "unknown",
      "bindings": { ... }
    }
  ]
}
```

**Default**: `"unknown"` when field is absent (backward compatibility).

---

## 8. Consumer Contract: Session Context Lookup

### 8.1 Lookup Pattern (Markdown instruction for isdlc.md)

All consumers follow the same two-step pattern:

```
Step 1: Check if session context contains <!-- SECTION: {NAME} -->
  - If found: extract content between opening and closing delimiters
  - Use extracted content instead of reading from disk

Step 2: If section not found (cache absent, section missing, or section skipped):
  - Fall back to reading from disk (existing behavior, unchanged)
```

### 8.2 Fail-Open Guarantee

| Scenario | Behavior |
|----------|----------|
| Cache loaded, section present | Use cached content (zero disk reads) |
| Cache loaded, section missing | Fall back to disk read |
| Cache loaded, section skipped | Fall back to disk read |
| Cache not loaded (first install) | Fall back to disk read (identical to current) |
| Cache not loaded (hook disabled) | Fall back to disk read (identical to current) |
| Cache corrupt (parse error) | Fall back to disk read |

In every failure scenario, the system behaves identically to its current implementation -- just slower.
