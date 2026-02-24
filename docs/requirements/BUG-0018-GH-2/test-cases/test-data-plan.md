# Test Data Plan: BUG-0018-GH-2 -- Backlog Picker Pattern Mismatch

**Phase**: 05-test-strategy
**Created**: 2026-02-16

---

## 1. Overview

This bug fix targets **markdown agent instructions**, not executable code. Test data consists of:
1. **Source file paths** -- the actual markdown files that the tests read and validate
2. **Expected content patterns** -- strings and regex patterns the tests assert are present in the markdown
3. **Example BACKLOG.md lines** -- reference formats used to validate the documented patterns

No mock data, database fixtures, or API stubs are needed.

---

## 2. Source Files Under Test

| File | Role | Read as |
|------|------|---------|
| `src/claude/agents/00-sdlc-orchestrator.md` | Primary fix target -- BACKLOG PICKER section | UTF-8 text |
| `src/claude/commands/isdlc.md` | Phase A format definition + start action | UTF-8 text |
| `.isdlc/config/workflows.json` | Verify no `start` entry | JSON |

All paths are relative to project root. Tests resolve them using `path.resolve(__dirname, '..', '..', '..', '..', '<relative-path>')`.

---

## 3. Expected Content Patterns

### 3.1 Orchestrator Suffix Stripping (FR-1)

Tests search the BACKLOG PICKER section for these content indicators:

| Pattern ID | Regex / String | What it validates |
|-----------|----------------|-------------------|
| PAT-01 | `/-> \[requirements\]/` | References link suffix in stripping context |
| PAT-02 | `/-> \[design\]/` | References design link suffix |
| PAT-03 | `/-> \[/` or `/strip.*-> \[/i` | Generic suffix stripping instruction |
| PAT-04 | `- N.N [ ] <text>` (literal) | Original scan pattern preserved |

### 3.2 Format Handling (FR-2)

| Pattern ID | Regex / String | What it validates |
|-----------|----------------|-------------------|
| PAT-05 | `/- \d+\.\d+ \[ \]/` or `N.N [ ]` | Numbered checkbox pattern |
| PAT-06 | `/\[x\]/` or `checked` (in exclusion context) | Checked items excluded |
| PAT-07 | `/\[ \]/` | Unchecked items included |

### 3.3 Jira Metadata (FR-3)

| Pattern ID | Regex / String | What it validates |
|-----------|----------------|-------------------|
| PAT-08 | `**Jira:**` | Jira sub-bullet parsing |
| PAT-09 | `[Jira:` | Jira tag in display format |
| PAT-10 | `no Jira tag` or similar | Non-Jira item display |

### 3.4 Start Action (FR-5)

| Pattern ID | Regex / String | What it validates |
|-----------|----------------|-------------------|
| PAT-11 | `/start.*feature/i` or `reuse` | Start action reuses feature workflow |
| PAT-12 | `"start"` key absent in workflows JSON | No start entry in workflows.json |

### 3.5 Backward Compatibility (NFR-1)

| Pattern ID | Regex / String | What it validates |
|-----------|----------------|-------------------|
| PAT-13 | `CLAUDE.md` in fallback context | Fallback when no BACKLOG.md |
| PAT-14 | `does not exist` or `fall back` | Fallback trigger condition |

### 3.6 Cross-Reference (CROSS)

| Pattern ID | What it validates |
|-----------|-------------------|
| PAT-15 | Phase A template in isdlc.md contains `-> [requirements]` |
| PAT-16 | Orchestrator strip instruction targets `-> [requirements]` |
| PAT-15 == PAT-16 | The suffix generated equals the suffix stripped |

---

## 4. Example BACKLOG.md Lines (Reference Only)

These lines are NOT test inputs (since no runtime parsing occurs). They are reference data used to validate the documented patterns are correct:

```markdown
# Old format (no suffix) -- should parse, no stripping needed
- 3.1 [ ] Parallel workflow support

# New format with requirements link -- should parse, strip suffix
- 3.1 [ ] Parallel workflow support -> [requirements](docs/requirements/3.1-parallel-workflow-support/)

# New format with design link -- should parse, strip suffix
- 3.1 [ ] API design -> [design](docs/design/3.1-api-design/)

# Checked item -- should be excluded from picker
- 3.1 [x] ~~Completed feature~~

# Jira-backed item with suffix -- strip suffix, add Jira tag
- 3.1 [ ] Backlog management integration -> [requirements](docs/requirements/3.1-backlog/)
  - **Jira:** PROJ-1234
  - **Confluence:** https://wiki.example.com/pages/spec

# Section header -- not an item
### 3. Parallel Workflows

# Sub-bullet metadata -- not an item
  - **Priority:** High
  - **Status:** Ready
```

---

## 5. Test Data Generation Strategy

No data generation is needed. All test data is:
1. **Static file paths** -- resolved at test time from the project root
2. **Hardcoded patterns** -- embedded in test assertions
3. **File content** -- read from disk using `fs.readFileSync()`

The test file (`test-backlog-picker-content.test.cjs`) will:
1. Resolve the path to each source file
2. Read the file content as UTF-8 string
3. Extract the relevant section (e.g., BACKLOG PICKER section between section markers)
4. Assert expected patterns are present using `assert.match()` or `assert.ok(content.includes(...))`

---

## 6. Test Environment Requirements

- Node.js 18+ (for `node:test` built-in)
- Project source tree intact (tests read real files, not mocked copies)
- No temp directory setup needed (unlike hook tests that use `setupTestEnv`)
- No network access needed
- No environment variables needed
