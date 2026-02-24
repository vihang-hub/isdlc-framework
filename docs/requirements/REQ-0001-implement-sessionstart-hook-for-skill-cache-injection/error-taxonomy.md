# Error Taxonomy: Unified SessionStart Cache

**Feature**: REQ-0001
**Phase**: 04-Design
**Version**: 1.0
**Created**: 2026-02-23

---

## 1. Error Categories

### 1.1 Cache Build Errors (rebuildSessionCache)

| Error Code | Severity | Trigger Condition | Description | Handling | FR |
|-----------|----------|-------------------|-------------|----------|-----|
| CACHE-001 | FATAL | `.isdlc/` directory does not exist | No project directory found at resolved root | Throw Error; caller handles | FR-001 |
| CACHE-002 | WARNING | Total cache size exceeds 128K characters | Cache file written but exceeds context window budget | Write file, emit warning to stderr | FR-001 |
| CACHE-003 | INFO | Individual source file missing | A source file for a cache section does not exist on disk | Skip section, add SKIPPED marker | FR-001 |
| CACHE-004 | INFO | Individual source file unreadable | A source file exists but cannot be read (permissions) | Skip section, add SKIPPED marker | FR-001 |
| CACHE-005 | FATAL | Cache file write failure | Cannot write to `.isdlc/session-cache.md` (disk full, permissions) | Throw Error; caller handles | FR-001 |
| CACHE-006 | WARNING | Skills manifest JSON parse failure | `skills-manifest.json` exists but contains invalid JSON | Skip SKILLS_MANIFEST and SKILL_INDEX sections | FR-001 |
| CACHE-007 | WARNING | External manifest parse failure | `external-skills-manifest.json` contains invalid JSON | Skip EXTERNAL_SKILLS section | FR-001 |

### 1.2 Hook Execution Errors (inject-session-cache.cjs)

| Error Code | Severity | Trigger Condition | Description | Handling | FR |
|-----------|----------|-------------------|-------------|----------|-----|
| HOOK-001 | SILENT | Cache file does not exist | `.isdlc/session-cache.md` not found (first install, cache not yet built) | No output, exit 0 (fail-open) | FR-002 |
| HOOK-002 | SILENT | Cache file unreadable | Permissions error on cache file | No output, exit 0 (fail-open) | FR-002 |
| HOOK-003 | SILENT | `CLAUDE_PROJECT_DIR` not set and `process.cwd()` does not contain `.isdlc/` | Cannot resolve project root | No output, exit 0 (fail-open) | FR-002 |

### 1.3 CLI Errors (bin/rebuild-cache.js)

| Error Code | Severity | Trigger Condition | Description | Handling | FR |
|-----------|----------|-------------------|-------------|----------|-----|
| CLI-001 | ERROR | No `.isdlc/` directory | Script run outside an iSDLC project | Print error to stderr, exit 1 | FR-004 |
| CLI-002 | ERROR | `rebuildSessionCache()` throws | Cache build failed for any reason | Print error to stderr, exit 1 | FR-004 |
| CLI-003 | ERROR | `common.cjs` not loadable | ESM/CJS bridge fails or common.cjs missing | Print error to stderr, exit 1 | FR-004 |

### 1.4 Consumer Fallback Events (isdlc.md)

| Event Code | Severity | Trigger Condition | Description | Handling | FR |
|-----------|----------|-------------------|-------------|----------|-----|
| FALLBACK-001 | SILENT | Session context missing CONSTITUTION section | Cache not loaded or section was skipped | Read `constitution.md` from disk | FR-005 |
| FALLBACK-002 | SILENT | Session context missing WORKFLOW_CONFIG section | Cache not loaded or section was skipped | Read `workflows.json` from disk | FR-005 |
| FALLBACK-003 | SILENT | Session context missing ITERATION_REQUIREMENTS section | Cache not loaded or section was skipped | Read `iteration-requirements.json` from disk | FR-005 |
| FALLBACK-004 | SILENT | Session context missing ARTIFACT_PATHS section | Cache not loaded or section was skipped | Read `artifact-paths.json` from disk | FR-005 |
| FALLBACK-005 | SILENT | Session context missing SKILL_INDEX section or agent block | Cache not loaded or agent not in index | Run `getAgentSkillIndex()` via Bash | FR-005 |
| FALLBACK-006 | SILENT | Session context missing EXTERNAL_SKILLS section | Cache not loaded or section was skipped | Read external manifest from disk | FR-005 |
| FALLBACK-007 | SILENT | Session context missing ROUNDTABLE_CONTEXT section | Cache not loaded or section was skipped | Read persona and topic files from disk | FR-006 |

### 1.5 Trigger Integration Errors

| Error Code | Severity | Trigger Condition | Description | Handling | FR |
|-----------|----------|-------------------|-------------|----------|-----|
| TRIGGER-001 | WARNING | Cache rebuild fails after `isdlc init` | Installation succeeds but cache not available | Log warning, continue installation | FR-007 |
| TRIGGER-002 | WARNING | Cache rebuild fails after `isdlc update` | Update succeeds but cache may be stale | Log warning, continue update | FR-007 |
| TRIGGER-003 | WARNING | Cache rebuild fails after `/discover` | Discovery succeeds but cache may be stale | Log warning, continue | FR-007 |
| TRIGGER-004 | WARNING | Cache rebuild fails after skill mutation | Skill operation succeeds but cache may be stale | Log warning, continue | FR-007 |

### 1.6 Skill Path Index Errors

| Error Code | Severity | Trigger Condition | Description | Handling | FR |
|-----------|----------|-------------------|-------------|----------|-----|
| INDEX-001 | SILENT | Skills directory does not exist | No `src/claude/skills/` or `.claude/skills/` | Return empty Map | FR-008 |
| INDEX-002 | SILENT | SKILL.md file missing `skill_id` frontmatter | File found but no skill_id extractable | Skip file, continue scan | FR-008 |
| INDEX-003 | SILENT | Directory scan failure (permissions) | Cannot read directory contents | Return empty Map (fail-open) | FR-008 |

---

## 2. Severity Definitions

| Severity | Meaning | User Impact | System Impact |
|----------|---------|-------------|---------------|
| FATAL | Operation cannot continue | Error message displayed | Function throws; caller must handle |
| ERROR | CLI operation failed | Error message on stderr, non-zero exit | Process exits with code 1 |
| WARNING | Degraded functionality | Warning message logged | Operation continues with reduced capability |
| INFO | Expected missing resource | No user-visible impact | Section skipped, marker added to cache |
| SILENT | Normal fail-open behavior | No user-visible impact | Falls back to disk read transparently |

---

## 3. Fail-Open Design Principle

**Every error in the cache system is either FATAL (infrastructure missing) or results in a transparent fallback to disk reads.** There are no errors that degrade the workflow itself -- only errors that degrade performance (by falling back to individual file reads).

### 3.1 Fail-Open Hierarchy

```
Level 1: Cache file missing entirely
  -> All consumers fall back to disk reads
  -> Workflow executes identically to pre-cache behavior
  -> Performance: identical to baseline (no improvement)

Level 2: Cache file present but section missing/skipped
  -> That specific consumer falls back to disk read
  -> Other consumers use their cached sections normally
  -> Performance: partial improvement

Level 3: Cache file present, all sections loaded
  -> All consumers use session context
  -> No disk reads for static content
  -> Performance: full improvement (~200-340 reads eliminated)
```

### 3.2 Error Propagation Rules

1. Hook errors (HOOK-*) NEVER propagate -- they are silently swallowed with exit code 0
2. Cache build errors for individual sections (CACHE-003, CACHE-004) NEVER propagate -- the section is skipped
3. Cache build infrastructure errors (CACHE-001, CACHE-005) propagate to the caller
4. Trigger integration errors (TRIGGER-*) are logged as warnings but NEVER block the triggering operation
5. Consumer fallback events (FALLBACK-*) are invisible to the user -- they just read from disk

---

## 4. Error Monitoring

### 4.1 Observable Indicators

| Indicator | How to Detect | Action |
|-----------|--------------|--------|
| Stale cache | Compare cache header hash with current `_collectSourceMtimes()` hash | Run `node bin/rebuild-cache.js` |
| Missing cache | `.isdlc/session-cache.md` does not exist | Run `node bin/rebuild-cache.js` |
| Oversized cache | Cache build warning on stderr | Review content, adjust budget mitigations |
| Section skipped | `<!-- SECTION: {NAME} SKIPPED: {reason} -->` in cache file | Check source file at the indicated path |
| Build failure | `bin/rebuild-cache.js` exits with code 1 | Check `.isdlc/` directory and file permissions |

### 4.2 No Runtime Logging

The SessionStart hook produces no log output (no stderr, no file logging). This is intentional -- the hook runs at every session start and must not add noise. Cache build functions may optionally log to stderr when `verbose: true` is set.
