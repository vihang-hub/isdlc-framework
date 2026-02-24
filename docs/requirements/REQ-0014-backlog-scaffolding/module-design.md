# Module Design: BACKLOG.md Scaffolding

**REQ ID**: REQ-0014
**Phase**: 04-design
**Created**: 2026-02-14
**Status**: Approved

---

## 1. Module Overview

This design specifies changes to a single existing module: `lib/installer.js`. No new modules are introduced. The change adds one pure helper function and one code block to the existing `install()` flow.

### Modified Module: lib/installer.js

**Current responsibilities** (unchanged):
- Detect project type, monorepo structure, and Claude Code
- Copy framework files (.claude/, .isdlc/, docs/)
- Merge settings files
- Generate state.json
- Create CLAUDE.md from template if missing

**New responsibility** (additive):
- Create BACKLOG.md with section scaffolding if missing

---

## 2. New Function: generateBacklogMd()

### 2.1 Responsibility

Returns the BACKLOG.md template string. This is a **zero-parameter pure function** with no I/O, no side effects, and no dependencies beyond the return value.

### 2.2 Function Signature

```javascript
/**
 * Generate the BACKLOG.md template content.
 * Follows the format convention documented in CLAUDE.md.template
 * (Backlog Management > BACKLOG.md Format Convention).
 *
 * @returns {string} BACKLOG.md content with preamble, ## Open, and ## Completed headers
 */
function generateBacklogMd() {
  return `# Project Backlog

> Backlog and completed items are tracked here.
> This file is NOT loaded into every conversation -- reference it explicitly when needed.

## Open

## Completed
`;
}
```

### 2.3 Design Decisions

| Decision | Rationale |
|----------|-----------|
| Zero parameters | Template is static -- no project-specific substitution needed (ADR-0003) |
| Module-private function (not exported) | Follows pattern of `generateDocsReadme()`, `generateConstitution()`, `generateState()` |
| Preamble matches existing BACKLOG.md | The existing project BACKLOG.md at the repo root uses this exact preamble style |
| `## Open` before `## Completed` | Matches the format convention in CLAUDE.md.template and AC-05 |
| No item format examples in template | Out of scope -- empty sections only (requirement spec Section 4) |
| Trailing newline | Standard for generated markdown files in this project |

### 2.4 Template Content Specification

The generated file MUST contain exactly these structural elements in order:

1. **Title line**: `# Project Backlog`
2. **Preamble**: A blockquote (`>`) explaining the file's purpose and that it is not auto-loaded into context
3. **Blank line separator**
4. **Open section header**: `## Open`
5. **Blank line separator**
6. **Completed section header**: `## Completed`
7. **Trailing newline**

### 2.5 Traceability

| Acceptance Criterion | How This Function Satisfies It |
|---------------------|-------------------------------|
| AC-02 (`## Open` header) | Hard-coded in template string |
| AC-03 (`## Completed` header) | Hard-coded in template string |
| AC-04 (preamble) | Blockquote section before `## Open` |
| AC-05 (`## Open` before `## Completed`) | String ordering in template literal |
| NFR-01 (format consistency) | Matches CLAUDE.md.template convention exactly |

---

## 3. New Code Block: BACKLOG.md Creation in install()

### 3.1 Responsibility

Creates BACKLOG.md at the project root during installation, respecting existence checks and dry-run mode.

### 3.2 Insertion Point

After the CLAUDE.md creation block (current line 569) and before the "Done!" section (current line 572). This is the same logical section where project-root files are scaffolded.

**Before (current code at lines 557-571):**
```javascript
  // Create CLAUDE.md if missing -- seed from template
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  if (!(await exists(claudeMdPath))) {
    if (!dryRun) {
      const templatePath = path.join(claudeTarget, 'CLAUDE.md.template');
      let content = '';
      if (await exists(templatePath)) {
        content = await readFile(templatePath, 'utf8');
      }
      await writeFile(claudeMdPath, content);
    }
    logger.warning('CLAUDE.md was missing - created from template in project root');
  }

  // Done!                    <-- line 572
```

**After (with new block inserted):**
```javascript
  // Create CLAUDE.md if missing -- seed from template
  const claudeMdPath = path.join(projectRoot, 'CLAUDE.md');
  if (!(await exists(claudeMdPath))) {
    if (!dryRun) {
      const templatePath = path.join(claudeTarget, 'CLAUDE.md.template');
      let content = '';
      if (await exists(templatePath)) {
        content = await readFile(templatePath, 'utf8');
      }
      await writeFile(claudeMdPath, content);
    }
    logger.warning('CLAUDE.md was missing - created from template in project root');
  }

  // Create BACKLOG.md if missing -- scaffold with section headers
  const backlogPath = path.join(projectRoot, 'BACKLOG.md');
  if (!(await exists(backlogPath))) {
    if (!dryRun) {
      await writeFile(backlogPath, generateBacklogMd());
    }
    logger.success('Created BACKLOG.md');
  } else {
    logger.info('BACKLOG.md already exists -- skipping');
  }

  // Done!
```

### 3.3 Control Flow

```
Entry: After CLAUDE.md block, before "Done!" section
  |
  v
const backlogPath = path.join(projectRoot, 'BACKLOG.md')
  |
  v
[exists(backlogPath)?]
  |           |
  YES         NO
  |           |
  v           v
logger.info   [dryRun?]
("already      |        |
exists --      YES       NO
skipping")     |        |
  |           v         v
  |       (skip write)  writeFile(backlogPath, generateBacklogMd())
  |           |         |
  |           v         v
  |       logger.success('Created BACKLOG.md')
  |           |
  v           v
[Continue to "Done!" section]
```

### 3.4 Dependencies (all already imported)

| Dependency | Import Source | Used For |
|-----------|-------------|----------|
| `path.join` | `path` (Node.js built-in) | Construct backlogPath |
| `exists` | `./utils/fs-helpers.js` | Check if BACKLOG.md exists |
| `writeFile` | `./utils/fs-helpers.js` | Write BACKLOG.md to disk |
| `logger` | `./utils/logger.js` | Log success/info messages |

**No new imports required.**

### 3.5 Traceability

| Acceptance Criterion | How This Block Satisfies It |
|---------------------|----------------------------|
| AC-01 (file created at projectRoot) | `path.join(projectRoot, 'BACKLOG.md')` + `writeFile()` |
| AC-06 (skip if exists) | `if (!(await exists(backlogPath)))` guard |
| AC-07 (log on skip) | `logger.info('BACKLOG.md already exists -- skipping')` |
| AC-08 (dry-run no write) | `if (!dryRun)` guard before `writeFile()` |
| AC-09 (dry-run log) | `logger.success('Created BACKLOG.md')` outside `if (!dryRun)` guard |
| NFR-02 (placement) | Inserted after CLAUDE.md block, before "Done!" section |

---

## 4. Uninstaller: No Changes Required

### 4.1 Verification

The uninstaller (`lib/uninstaller.js`) has been verified to contain zero references to BACKLOG.md:
- Not in `frameworkFiles` array (line 281)
- Not in `frameworkDirs` array (line 269)
- Not in `frameworkPatterns` regex array (lines 416-429)
- Not in any file removal loop
- `--purge-all` only removes `.isdlc/` directory (line 262), not project-root files

### 4.2 Preservation Mechanism

BACKLOG.md is protected by three layers:
1. **Not in manifest**: `installed-files.json` does not track project-root user files
2. **Not in removal patterns**: No regex matches BACKLOG.md
3. **Scope boundary**: `--purge-all` is scoped to `.isdlc/` directory only

### 4.3 Traceability

| Acceptance Criterion | How Uninstaller Satisfies It |
|---------------------|------------------------------|
| AC-10 (not in removal paths) | Zero references confirmed by grep |
| AC-11 (survives purge-all) | purge-all scoped to .isdlc/ only |
| AC-12 (no code references) | Zero string matches in uninstaller.js |

---

## 5. Configuration

No new configuration is needed. The feature uses existing installer options:
- `dryRun` (boolean): When true, skip file write
- `projectRoot` (string): Target directory path

---

## 6. Error Handling

See `error-taxonomy.md` for the complete error specification. Summary:

| Error Scenario | Handling | Rationale |
|---------------|----------|-----------|
| `writeFile()` throws (permissions, disk full) | Exception propagates to install() caller | Follows existing pattern -- CLAUDE.md writeFile has no try/catch either |
| `exists()` throws (path too long, invalid chars) | Exception propagates | Same as CLAUDE.md pattern |
| projectRoot is undefined/null | Caught upstream by CLI argument validation | install() is never called without a valid projectRoot |

The design intentionally does NOT add try/catch around the BACKLOG.md block. The existing CLAUDE.md creation block (the pattern being replicated) does not catch errors either. File system errors during installation are correctly treated as fatal -- the installer should fail loudly rather than silently skip file creation.

---

## 7. Testing Surface

The following test scenarios are required (detailed in test strategy phase):

| Category | Scenarios | Acceptance Criteria |
|----------|----------|---------------------|
| Happy path | BACKLOG.md created with correct content | AC-01 through AC-05 |
| Skip-if-exists | Pre-existing BACKLOG.md preserved | AC-06, AC-07 |
| Dry-run | No file written, log still emitted | AC-08, AC-09 |
| Uninstaller preservation | BACKLOG.md survives uninstall and purge-all | AC-10 through AC-12 |

---

## 8. Code Size Estimate

| Component | Estimated Lines | Notes |
|-----------|----------------|-------|
| `generateBacklogMd()` | ~12 lines | Function declaration + template literal |
| BACKLOG.md creation block | ~10 lines | exists check + dry-run guard + write + logging |
| **Total new code** | **~22 lines** | Within the ~30 line estimate from architecture |
