# Test Data Plan: Bug-Aware Analyze Flow

**Status**: Complete
**Requirement**: REQ-0061 / GH-119
**Last Updated**: 2026-03-11

---

## 1. Issue Description Test Data

Crafted GitHub issue descriptions for testing bug classification (FR-001).

### 1.1 Clear Bug Description

```markdown
Title: /isdlc fix crashes with ENOENT when artifact folder has spaces

Labels: bug

Body:
When running `/isdlc fix "some feature"` on a project where the artifact folder
path contains spaces (e.g., `docs/requirements/REQ 0042 some feature/`), the
command crashes with:

```
Error: ENOENT: no such file or directory, open 'docs/requirements/REQ'
```

Expected: The fix workflow should start normally regardless of spaces in paths.
Actual: Crash at path.resolve() in three-verb-utils.cjs line 142.

Reproduction:
1. Create a requirement with spaces in the slug
2. Run `/isdlc fix "the slug with spaces"`
3. Observe ENOENT crash
```

**Expected classification**: Bug (symptoms, error message, stack trace, repro steps)

### 1.2 Clear Feature Description

```markdown
Title: Add support for custom workflow definitions via YAML

Labels: enhancement

Body:
Users should be able to define their own workflow phase sequences by creating
YAML files in `.isdlc/workflows/`. This would allow teams to customize which
phases are included in their feature/fix/test workflows.

Proposed format:
```yaml
name: lightweight-feature
phases:
  - 05-test-strategy
  - 06-implementation
  - 08-code-review
```

This enables teams with different process needs to adapt the framework.
```

**Expected classification**: Feature (new capability, enhancement proposal)

### 1.3 Mislabeled Bug (label says "bug", content is feature)

```markdown
Title: Framework should support Python projects

Labels: bug

Body:
It would be great if the framework could detect and work with Python projects
in addition to Node.js. Currently the project detector only recognizes
package.json and node_modules.

Suggested additions:
- Detect requirements.txt, setup.py, pyproject.toml
- Support pytest as test framework
- Support pip for dependency management
```

**Expected classification**: Feature (despite "bug" label -- content describes new capability)

### 1.4 Mislabeled Feature (label says "enhancement", content is bug)

```markdown
Title: Improve installer reliability

Labels: enhancement

Body:
The installer crashes when the target directory doesn't exist. Running
`isdlc install /some/new/path` gives:

```
Error: ENOENT: no such file or directory, symlink '/Users/me/.isdlc/src' -> '/some/new/path/src'
```

The installer should create the directory if it doesn't exist, or at minimum
give a clear error message instead of crashing.
```

**Expected classification**: Bug (despite "enhancement" label -- content describes crash with error)

### 1.5 Ambiguous Description

```markdown
Title: Search results show 10 per page

Labels: (none)

Body:
The search results page shows 10 results per page. Should this be 20?
```

**Expected classification**: Ambiguous (ERR-BGA-001 -- system should ask user)

---

## 2. Boundary Values

### 2.1 Minimal Issue Description

```markdown
Title: Something is wrong
Labels: bug
Body: (empty)
```

**Expected behavior**: ERR-BGA-003 -- agent asks for more detail

### 2.2 Maximum-Size Issue Description

A 10,000-character issue description with extensive logs, stack traces, and reproduction steps.

**Expected behavior**: Agent processes successfully; extracts key information without truncation of critical details

### 2.3 Issue with Only Labels, No Description

```markdown
Title: Bug fix needed
Labels: bug, critical
Body: (empty)
```

**Expected behavior**: Labels alone are insufficient for classification; system asks user for more context or falls through to roundtable

### 2.4 Issue with Non-English Description

```markdown
Title: Error in login
Labels: bug
Body: El sistema muestra un error 500 cuando intento iniciar sesion con credenciales validas.
```

**Expected behavior**: LLM can classify from non-English content; classification should still work

---

## 3. Invalid Inputs

### 3.1 Analyze with No Issue Reference

User says: "analyze this" without specifying an issue number or slug.

**Expected behavior**: Existing analyze handler behavior (prompt for what to analyze)

### 3.2 Analyze with Non-Existent Issue

User says: "analyze #99999" where issue does not exist.

**Expected behavior**: Existing error handling ("Issue not found")

### 3.3 Analyze with Already-Analyzed Item

User says: "analyze #42" where #42 already has a complete analysis (meta.json shows analysis_complete).

**Expected behavior**: Existing re-analysis handling; bug classification should still run on the description

### 3.4 Bug-Gather Agent Receives Empty DRAFT_CONTENT

Dispatch prompt has `DRAFT_CONTENT: (No draft available)`.

**Expected behavior**: Agent falls back to reading issue from META_CONTEXT source_id; if no content available, asks user to describe the bug

---

## 4. Artifact Format Test Data

### 4.1 Valid bug-report.md (for integration tests)

```markdown
# Bug Report: ENOENT crash on spaced paths

**Source**: github GH-42
**Severity**: high
**Generated**: 2026-03-11

## Expected Behavior
The fix workflow should start normally regardless of spaces in artifact folder paths.

## Actual Behavior
The command crashes with ENOENT error at path.resolve() in three-verb-utils.cjs.

## Symptoms
- Crash on `/isdlc fix` when paths have spaces
- Error message references truncated path

## Error Messages
```
Error: ENOENT: no such file or directory, open 'docs/requirements/REQ'
```

## Reproduction Steps
1. Create a requirement with spaces in the slug
2. Run `/isdlc fix "the slug with spaces"`
3. Observe ENOENT crash

## Affected Area
- **Files**: src/claude/hooks/lib/three-verb-utils.cjs (line 142)
- **Modules**: Path resolution in workflow utilities

## Additional Context
Only occurs when artifact folder name contains spaces.
```

### 4.2 Valid requirements-spec.md (bug variant, for integration tests)

```markdown
# Requirements Specification: Fix ENOENT on spaced paths

**Status**: Complete (bug analysis)
**Source**: GH-42

## 1. Business Context

### Problem Statement
The fix workflow crashes with ENOENT when the artifact folder path contains spaces.

## 6. Functional Requirements

### FR-001: Handle spaces in artifact folder paths

- **AC-001-01**: Given an artifact folder with spaces in its name, when the fix workflow resolves the path, then path.resolve() handles the spaces correctly
- **AC-001-02**: Given a spaced path, when the workflow starts, then all subsequent phases can read/write artifacts at the correct path
```

### 4.3 Invalid bug-report.md (missing required sections)

```markdown
# Bug Report: Some bug

**Source**: github GH-42

## Symptoms
- Something is broken
```

**Expected validation result**: FAIL -- missing "Expected Behavior" and "Actual Behavior" sections

### 4.4 Valid meta.json (with Phase 01 completion for computeStartPhase)

```json
{
  "slug": "BUG-0042-enoent-spaced-paths",
  "source": "github",
  "source_id": "GH-42",
  "phases_completed": ["01-requirements"],
  "analysis_status": "partial",
  "bug_classification": {
    "classification": "bug",
    "reasoning": "Description contains crash, error message, stack trace",
    "confirmed_by_user": true
  }
}
```

### 4.5 Invalid meta.json (no phases_completed for computeStartPhase fallback)

```json
{
  "slug": "BUG-0042-enoent-spaced-paths",
  "source": "github",
  "source_id": "GH-42"
}
```

**Expected computeStartPhase result**: status 'raw', startPhase null (fix starts from Phase 01)

---

## 5. Maximum-Size Inputs

### 5.1 Large Issue Description (10K chars)

A bug report with extensive stack traces, multiple error messages, and detailed reproduction steps totaling ~10,000 characters.

**Purpose**: Verify agent handles large input without truncation of critical information.

### 5.2 Large Codebase Scan Results

Bug description with common keywords (e.g., "error", "state") that match 100+ files in codebase.

**Purpose**: Verify agent filters and prioritizes results rather than presenting all 100+ matches.

### 5.3 Multiple User Addition Rounds

User provides additional context 3 times before saying "that's all".

**Purpose**: Verify agent accumulates all user additions and incorporates them into final artifacts.

---

## 6. Codebase Scan Test Data

### 6.1 High-Signal Scan (many relevant matches)

Bug mentioning "gate-blocker", "phases", "state.json" -- terms that appear in specific files.

**Expected**: Agent identifies gate-blocker.js, state.json-related code, phase handling logic.

### 6.2 Low-Signal Scan (no matches)

Bug mentioning "GraphQL", "Redis", "MongoDB" -- terms not in this codebase.

**Expected**: ERR-BGA-002 -- agent asks user for guidance on where to look.

### 6.3 Partial-Signal Scan (some matches, some noise)

Bug mentioning "error" and "handler" -- common terms with many matches.

**Expected**: Agent filters to most relevant matches based on context, not just keyword frequency.
