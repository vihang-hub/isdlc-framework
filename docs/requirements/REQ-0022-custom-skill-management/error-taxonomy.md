# Error Taxonomy: Custom Skill Management (REQ-0022)

**Phase**: 04-design
**Version**: 1.0
**Created**: 2026-02-18
**Traces to**: FR-001 through FR-009, NFR-003, NFR-006, Security Architecture 7.0

---

## 1. Error Classification

All errors in the custom skill management feature fall into two categories:

| Category | Behavior | User Impact | Examples |
|----------|----------|------------|---------|
| **User-facing** | Displayed to user with guidance | Operation aborted; user can retry | Validation errors, not-found errors |
| **Fail-open** | Logged as warning, operation continues | None (workflow proceeds without injection) | Missing skill file at injection time, malformed manifest |

**Governing principle**: No error in the external skill system will ever prevent a workflow phase from executing (NFR-003, Article X).

---

## 2. User-Facing Errors (Skill Commands)

These errors occur during interactive skill management commands (`skill add`, `skill wire`, `skill remove`). They are displayed to the user and the command is aborted.

### 2.1 File Validation Errors (FR-001)

| Error Code | Error Message | Trigger | Guidance Shown | Traces |
|-----------|---------------|---------|----------------|--------|
| SKL-E001 | `File not found: {filePath}` | `fs.existsSync(filePath)` returns false | "Check the path and try again." | FR-001, V-001 |
| SKL-E002 | `Only .md files are supported. Got: {ext}` | File does not end with `.md` | "Rename the file with a .md extension." | FR-001, V-002 |
| SKL-E003 | `No YAML frontmatter found. Expected file to start with '---'` | Content does not match frontmatter regex | Show example frontmatter format | FR-001, V-003 |
| SKL-E004 | `Missing required frontmatter field: name` | `name` field absent or empty | Show example with `name: my-skill` | FR-001, V-004, NFR-006 |
| SKL-E005 | `Missing required frontmatter field: description` | `description` field absent or empty | Show example with `description: ...` | FR-001, V-005, NFR-006 |
| SKL-E006 | `Skill name must be lowercase alphanumeric with hyphens, 2+ chars` | Name fails regex `/^[a-z0-9][a-z0-9-]*[a-z0-9]$/` | "Example: 'nestjs-conventions', 'my-skill'" | FR-001, V-006, NFR-006 |
| SKL-E007 | `Skill filename must not contain path separators or '..' sequences` | `file` contains `/`, `\`, or `..` | "Use a simple filename like 'my-skill.md'" | Security T1 |

### 2.2 Manifest Operation Errors

| Error Code | Error Message | Trigger | Guidance Shown | Traces |
|-----------|---------------|---------|----------------|--------|
| SKL-E010 | `Skill '{name}' already exists. Overwrite? [Y/N]` | Duplicate name in manifest on `skill add` | Prompt (not an error, but a decision point) | FR-001 |
| SKL-E011 | `Skill '{name}' not found in registry.` | Name not in manifest on `skill wire` or `skill remove` | "Run '/isdlc skill list' to see registered skills." | FR-003, FR-007 |
| SKL-E012 | `Failed to write manifest: {error}` | `writeExternalManifest` returns `success: false` | "Check filesystem permissions on {path}" | FR-004 |
| SKL-E013 | `Manifest validation failed after write` | Re-read after write does not parse as valid JSON | "Try again. If persistent, delete manifest and re-add skills." | FR-004 |

### 2.3 Wiring Session Errors

| Error Code | Error Message | Trigger | Guidance Shown | Traces |
|-----------|---------------|---------|----------------|--------|
| SKL-E020 | `Wiring session cancelled by user` | User selects [X] Cancel | "Skill file was copied but no bindings saved. Use 'skill wire {name}' to bind later." | FR-003 |
| SKL-E021 | `No phases selected` | User deselects all phases and tries to save | "Select at least one phase to bind the skill to." | FR-003 |

---

## 3. Fail-Open Errors (Runtime Injection)

These errors occur during STEP 3d runtime injection. They are logged as warnings but NEVER block workflow progression. The delegation prompt continues without the failed skill's content.

### 3.1 Fail-Open Error Hierarchy

```
Level 1 (broadest): Outer try/catch around entire injection block
  |
  +-- Level 2: Manifest-level (loadExternalManifest returns null)
  |
  +-- Level 3: Skills array missing or empty
  |
  +-- Level 4: Individual skill has no bindings (backward compat)
  |
  +-- Level 5: Individual skill file missing
  |
  +-- Level 6: Individual skill file read error
  |
  +-- Level 7: Individual skill format error
```

### 3.2 Runtime Warning Codes

| Warning Code | Warning Message | Trigger | Behavior | Traces |
|-------------|-----------------|---------|----------|--------|
| SKL-W001 | `External skills manifest not found or unparseable. Skipping injection.` | `loadExternalManifest()` returns null | Skip all injection (no-op) | NFR-003, NFR-005 |
| SKL-W002 | `External skills manifest has no skills array. Skipping injection.` | `manifest.skills` is not an array | Skip all injection | NFR-003 |
| SKL-W003 | `Skill '{name}' has no bindings. Skipping.` | `skill.bindings` is undefined | Skip this skill (backward compat) | NFR-005 |
| SKL-W004 | `Skill file not found: {path}. Skipping '{name}'.` | Skill .md file missing from disk | Skip this skill, continue others | NFR-003, Security T5 |
| SKL-W005 | `Skill file read error for '{name}': {error}. Skipping.` | `fs.readFileSync` throws | Skip this skill, continue others | NFR-003, Security T5 |
| SKL-W006 | `Skill '{name}' content truncated (>{MAX_CHARS} chars). Switched to reference delivery.` | Content exceeds 10,000 chars | Truncate + switch to reference | Security T3, ASM-002 |
| SKL-W007 | `External skill injection failed: {error}. Continuing without skill injection.` | Outer try/catch catches any error | Skip all injection, use unmodified prompt | NFR-003, Article X |

### 3.3 Warning Logging

All runtime warnings are logged to stderr (not stdout). They do not appear in the user's conversation unless the user explicitly checks the hook activity log.

**Log format**:
```
[WARN] [{timestamp}] {warning_code}: {warning_message}
```

**Implementation note**: Since the injection logic runs inside isdlc.md (a markdown prompt, not a Node.js file), "logging" means the orchestrating agent outputs the warning to its own context. The warnings are not written to the filesystem hook activity log (which is for hooks, not command prompts).

---

## 4. Error Display Format

### 4.1 User-Facing Error Display

```
Skill validation failed for: {filePath}

Errors:
  - {error_message_1}
  - {error_message_2}

{IF validation error}
Expected format:
  ---
  name: my-skill-name
  description: Brief description of the skill
  ---

  # Skill Content
  ...
{/IF}
```

**Design principle (NFR-006)**: Every validation error identifies the specific field that failed and includes a corrective example. Users should be able to self-correct 100% of validation errors on first retry.

### 4.2 Runtime Warning Display

Runtime warnings are NOT displayed to the user during normal workflow execution. They are only visible in debug/verbose mode. The user experiences zero interruption when skill injection fails.

---

## 5. Error Recovery Paths

| Error | Recovery Path | User Action Needed |
|-------|--------------|-------------------|
| SKL-E001 (file not found) | Check path, retry `skill add` | Yes |
| SKL-E002 (wrong extension) | Rename file, retry | Yes |
| SKL-E003 (no frontmatter) | Add frontmatter block, retry | Yes |
| SKL-E004/E005 (missing fields) | Add fields, retry | Yes |
| SKL-E006 (bad name format) | Fix name, retry | Yes |
| SKL-E007 (path traversal) | Fix filename, retry | Yes |
| SKL-E010 (duplicate) | Choose overwrite or cancel | Yes |
| SKL-E011 (not found) | Check name with `skill list` | Yes |
| SKL-E012/E013 (write failure) | Check permissions, retry | Yes |
| SKL-E020 (wiring cancelled) | Run `skill wire` later | Optional |
| SKL-W001-W007 (runtime) | None needed -- fail-open | No |

---

## 6. Error Traceability Matrix

| Error Code | FR | NFR | Security | ADR |
|-----------|-----|------|----------|-----|
| SKL-E001 | FR-001 | NFR-006 | - | - |
| SKL-E002 | FR-001 | NFR-006 | - | - |
| SKL-E003 | FR-001 | NFR-006 | - | ADR-0009 |
| SKL-E004 | FR-001 | NFR-006 | - | - |
| SKL-E005 | FR-001 | NFR-006 | - | - |
| SKL-E006 | FR-001 | NFR-006 | - | - |
| SKL-E007 | FR-001 | - | T1 | - |
| SKL-E010 | FR-001 | - | - | ADR-0011 |
| SKL-E011 | FR-003, FR-007 | - | - | - |
| SKL-E012 | FR-004 | - | T6 | ADR-0009 |
| SKL-E013 | FR-004 | - | T6 | ADR-0009 |
| SKL-E020 | FR-003 | - | - | ADR-0010 |
| SKL-E021 | FR-003 | - | - | ADR-0010 |
| SKL-W001 | FR-005 | NFR-003, NFR-005 | T4 | ADR-0008 |
| SKL-W002 | FR-005 | NFR-003 | T4 | ADR-0008 |
| SKL-W003 | FR-005 | NFR-005 | - | ADR-0011 |
| SKL-W004 | FR-005 | NFR-003 | T5 | ADR-0008 |
| SKL-W005 | FR-005 | NFR-003 | T5 | ADR-0008 |
| SKL-W006 | FR-005 | NFR-003 | T3 | ADR-0008 |
| SKL-W007 | FR-005 | NFR-003 | T4, T5 | ADR-0008 |
