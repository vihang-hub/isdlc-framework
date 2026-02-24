# Test Data Plan: Three-Verb Backlog Model (REQ-0023)

**Phase**: 05-test-strategy
**Version**: 1.0
**Created**: 2026-02-18
**Traces to**: FR-001 through FR-009, NFR-005, Error Taxonomy

---

## 1. Slug Generation Test Data

### Valid Inputs

| Input | Expected Slug | Notes |
|-------|---------------|-------|
| `"Add payment processing"` | `"add-payment-processing"` | Standard description |
| `"Build Auth Module"` | `"build-auth-module"` | Mixed case |
| `"Fix bug #42 (urgent!)"` | `"fix-bug-42-urgent"` | Special chars stripped |
| `"Simple"` | `"simple"` | Single word |
| `"a"` | `"a"` | Minimum valid input |
| `"foo---bar"` | `"foo-bar"` | Consecutive hyphens |
| `"user authentication and authorization flow"` | `"user-authentication-and-authorization-flow"` | Long but under 50 |

### Boundary Values

| Input | Expected Slug | Boundary Condition |
|-------|---------------|-------------------|
| `"abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefg"` (50 chars) | Same (unchanged) | VR-SLUG-002: exactly 50 |
| `"abcdefghij-abcdefghij-abcdefghij-abcdefghij-abcdefgh"` (51 chars) | Truncated to 50 | VR-SLUG-002: one over limit |
| `"a very long description that when converted to a slug exceeds the maximum of fifty characters allowed"` | Truncated to 50 chars at safe boundary | VR-SLUG-002: natural language over limit |

### Invalid Inputs

| Input | Expected Slug | Error Condition |
|-------|---------------|----------------|
| `""` | `"untitled-item"` | VR-SLUG-003: empty |
| `"   "` | `"untitled-item"` | VR-SLUG-003: whitespace only |
| `"!@#$%^&*()"` | `"untitled-item"` | VR-SLUG-003: all special chars |
| `"../../etc/passwd"` | `"etcpasswd"` | Security: path traversal |
| `"--leading"` | `"leading"` | Leading hyphens stripped |
| `"trailing--"` | `"trailing"` | Trailing hyphens stripped |

### Maximum-Size Inputs

| Input | Expected Behavior | Notes |
|-------|-------------------|-------|
| 1000-char string of valid words | Truncated to 50 chars | VR-SLUG-002 |
| 10000-char string | Truncated to 50 chars, no crash | Stress test |
| String with 500 consecutive spaces | `"untitled-item"` (all spaces become hyphens, collapsed, then empty) | Edge case |

---

## 2. Source Detection Test Data

### Valid Inputs

| Input | Expected source | Expected source_id | Traces |
|-------|----------------|-------------------|--------|
| `"#42"` | `"github"` | `"GH-42"` | VR-SOURCE-001 |
| `"#1"` | `"github"` | `"GH-1"` | VR-SOURCE-001 |
| `"#99999"` | `"github"` | `"GH-99999"` | VR-SOURCE-001 |
| `"PROJ-123"` | `"jira"` | `"PROJ-123"` | VR-SOURCE-002 |
| `"MYPROJECT-9999"` | `"jira"` | `"MYPROJECT-9999"` | VR-SOURCE-002 |
| `"AB-1"` | `"jira"` | `"AB-1"` | VR-SOURCE-002, min key |
| `"Add payment processing"` | `"manual"` | `null` | VR-SOURCE-003 |
| `"simple"` | `"manual"` | `null` | VR-SOURCE-003 |

### Invalid Inputs

| Input | Expected source | Reason |
|-------|----------------|--------|
| `"#abc"` | `"manual"` | Hash but no digits |
| `"#"` | `"manual"` | Hash alone |
| `"PROJ-"` | `"manual"` | Jira format but no number |
| `"-123"` | `"manual"` | Number but no project key |
| `"proj-123"` | `"manual"` | Lowercase project key (Jira keys are uppercase) |
| `""` | Error (ERR-ADD-004) | Empty input |

### Boundary Values

| Input | Expected | Boundary Condition |
|-------|----------|-------------------|
| `"#0"` | `"github"`, `"GH-0"` | Minimum GitHub issue number |
| `"A-1"` | `"jira"`, `"A-1"` | Minimum Jira project key length |
| `"#2147483647"` | `"github"`, `"GH-2147483647"` | Max int-like issue number |

---

## 3. meta.json Test Fixtures

### v2 Schema (Current)

```json
{
  "source": "manual",
  "source_id": null,
  "slug": "payment-processing",
  "created_at": "2026-02-18T20:00:00Z",
  "analysis_status": "raw",
  "phases_completed": [],
  "codebase_hash": "abc1234"
}
```

### v2 Schema -- Partial Analysis

```json
{
  "source": "github",
  "source_id": "GH-42",
  "slug": "fix-login-bug",
  "created_at": "2026-02-17T10:00:00Z",
  "analysis_status": "partial",
  "phases_completed": ["00-quick-scan", "01-requirements"],
  "codebase_hash": "def5678"
}
```

### v2 Schema -- Fully Analyzed

```json
{
  "source": "jira",
  "source_id": "PROJ-123",
  "slug": "api-redesign",
  "created_at": "2026-02-16T08:00:00Z",
  "analysis_status": "analyzed",
  "phases_completed": [
    "00-quick-scan", "01-requirements", "02-impact-analysis",
    "03-architecture", "04-design"
  ],
  "codebase_hash": "aaa1111"
}
```

### v1 Schema -- Legacy (phase_a_completed: true)

```json
{
  "source": "manual",
  "source_id": null,
  "slug": "old-feature",
  "created_at": "2026-02-10T12:00:00Z",
  "phase_a_completed": true,
  "codebase_hash": "bbb2222"
}
```

### v1 Schema -- Legacy (phase_a_completed: false)

```json
{
  "source": "manual",
  "source_id": null,
  "slug": "newer-feature",
  "created_at": "2026-02-15T14:00:00Z",
  "phase_a_completed": false,
  "codebase_hash": "ccc3333"
}
```

### v1 Schema -- Legacy (no phase_a_completed)

```json
{
  "source": "backlog-migration",
  "source_id": null,
  "slug": "ancient-item",
  "created_at": "2026-01-01T00:00:00Z"
}
```

### Mixed v1+v2 Schema (v2 takes precedence)

```json
{
  "source": "manual",
  "source_id": null,
  "slug": "mixed-schema",
  "created_at": "2026-02-18T00:00:00Z",
  "phase_a_completed": false,
  "analysis_status": "analyzed",
  "phases_completed": [
    "00-quick-scan", "01-requirements", "02-impact-analysis",
    "03-architecture", "04-design"
  ],
  "codebase_hash": "ddd4444"
}
```

### Invalid meta.json

| Fixture | Content | Error Code |
|---------|---------|-----------|
| Corrupted JSON | `"{ invalid json"` | ERR-META-002 |
| Empty file | `""` | ERR-META-002 |
| Binary content | Random bytes | ERR-META-002 |
| Missing file | (does not exist) | ERR-META-001 |
| Non-array phases_completed | `{ "phases_completed": "not-array" }` | Defaults to `[]` |
| Invalid analysis_status | `{ "analysis_status": "bogus" }` | Defaults to `"raw"` |

---

## 4. BACKLOG.md Test Fixtures

### Standard BACKLOG with All Marker Types

```markdown
# Backlog

## Open

- 16.1 [ ] Three-verb backlog model
- 16.2 [~] Roundtable analysis agent
- 16.3 [A] Elaboration mode
- 16.4 [ ] Transparent Critic/Refiner
- 16.5 [ ] Build auto-detection

## Completed

- 14.1 [x] Artifact paths filename mismatch
- 12.1 [x] Jira MCP integration
```

### BACKLOG with CRLF Line Endings

Same content as above but with `\r\n` instead of `\n`. Tests VR-CRLF-001.

### Empty BACKLOG

```markdown
# Backlog

## Open

## Completed
```

### BACKLOG Missing Open Section

```markdown
# Backlog

## Completed

- 1.1 [x] Done item
```

### BACKLOG with Indented Items

```markdown
# Backlog

## Open

  - 16.1 [ ] Indented item with two spaces
    - 16.2 [ ] Deeper indentation
```

### BACKLOG with Hand-Edited Markers

```markdown
# Backlog

## Open

- 5.1 [?] Unknown marker character
- 5.2 [X] Uppercase X instead of lowercase
- 5.3 [ ] Normal item
```

### Maximum-Size BACKLOG (Performance Test)

500 items generated programmatically:
```
- N.M [ ] Item description N
```
where N ranges from 1 to 50 and M from 1 to 10.

---

## 5. Item Resolution Test Data

### Filesystem Setup for Resolution Tests

```
docs/requirements/
  payment-processing/
    meta.json     # { source: "manual", slug: "payment-processing", ... }
    draft.md
  add-login-page/
    meta.json     # { source: "github", source_id: "GH-42", slug: "add-login-page", ... }
    draft.md
  api-redesign/
    meta.json     # { source: "jira", source_id: "PROJ-123", slug: "api-redesign", ... }
    draft.md
```

### BACKLOG.md for Resolution Tests

```markdown
## Open

- 16.1 [ ] Three-verb backlog model
- 16.2 [~] Payment processing feature
- 16.3 [A] Login page improvements
- 16.4 [ ] API redesign and optimization
```

### Resolution Test Cases (Input -> Strategy -> Result)

| Input | Expected Strategy | Expected Slug | Reason |
|-------|-------------------|---------------|--------|
| `"payment-processing"` | 1 (exact slug) | `"payment-processing"` | Directory exists with meta.json |
| `"processing"` | 2 (partial slug) | `"payment-processing"` | Suffix match on `payment-processing` |
| `"16.2"` | 3 (item number) | From BACKLOG line | BACKLOG has item 16.2 |
| `"#42"` | 4 (external ref) | `"add-login-page"` | meta.json has source_id GH-42 |
| `"PROJ-123"` | 4 (external ref) | `"api-redesign"` | meta.json has source_id PROJ-123 |
| `"payment"` | 5 (fuzzy) | `"payment-processing"` | Substring match in BACKLOG title |
| `"nonexistent"` | None | null | No match |
| `""` | None | null/error | Empty input |

---

## 6. Hook Test Data

### skill-delegation-enforcer Input Fixtures

```json
// add action (exempt)
{
  "tool_name": "Skill",
  "tool_input": { "skill": "isdlc", "args": "add \"Add payment processing\"" }
}

// add with leading flags (exempt)
{
  "tool_name": "Skill",
  "tool_input": { "skill": "isdlc", "args": "--verbose add \"#42\"" }
}

// build action (NOT exempt)
{
  "tool_name": "Skill",
  "tool_input": { "skill": "isdlc", "args": "build \"payment-processing\"" }
}
```

### delegation-gate State Fixtures

```json
// Pending delegation for add (should auto-clear)
{
  "pending_delegation": {
    "skill": "isdlc",
    "required_agent": "sdlc-orchestrator",
    "invoked_at": "2026-02-18T10:00:00Z",
    "args": "add \"payment processing\""
  },
  "skill_usage_log": []
}

// Pending delegation for build (should block)
{
  "pending_delegation": {
    "skill": "isdlc",
    "required_agent": "sdlc-orchestrator",
    "invoked_at": "2026-02-18T10:00:00Z",
    "args": "build \"payment-processing\""
  },
  "skill_usage_log": []
}
```

---

## 7. Error Scenario Test Data

### ERR-ADD-001: Slug Collision

- Setup: Create `docs/requirements/payment-processing/` with meta.json before test
- Input: `add "payment processing"`
- Expected: Warning with overwrite/rename/cancel options

### ERR-ADD-004: Empty Description

- Input: `add ""`
- Expected: "Please provide a description for the backlog item."

### ERR-ANALYZE-002: Corrupted meta.json

- Setup: Write `"not valid json"` to `docs/requirements/test-item/meta.json`
- Input: `analyze "test-item"`
- Expected: "Corrupted meta.json" error

### ERR-ANALYZE-004: Stale Codebase Hash

- Setup: meta.json with `codebase_hash: "old1234"`, current HEAD is `"new5678"`
- Input: `analyze "test-item"` (all phases complete)
- Expected: Staleness warning with re-analyze option

### ERR-BUILD-002: Active Workflow Exists

- Setup: state.json with `active_workflow: { type: "feature", ... }`
- Input: `build "payment-processing"`
- Expected: "A workflow is already active" error

### ERR-RESOLVE-002: Multiple Fuzzy Matches

- Setup: BACKLOG with items containing "feature" in 3 different items
- Input: `analyze "feature"`
- Expected: Disambiguation menu with 3 options

---

## 8. Performance Benchmark Data

### Slug Generation Benchmark

- 100 iterations of `generateSlug("A moderately long description for benchmark testing")`
- Assert average < 10ms

### BACKLOG Marker Update Benchmark

- Create BACKLOG.md with 500 items: `"- N.M [ ] Item description for item N.M"`
- Update marker for item 250.5 (middle of file)
- Assert < 500ms

### meta.json Read with Migration Benchmark

- Create v1 meta.json with `phase_a_completed: true`
- 100 iterations of `readMetaJson()`
- Assert average < 50ms

---

## 9. Cross-Platform Test Data

### CRLF Fixtures

All BACKLOG.md fixtures should have a CRLF variant created by replacing `\n` with `\r\n`. The following tests use CRLF variants:

| Test | Fixture | Verification |
|------|---------|-------------|
| TC-UBM-06 | Standard BACKLOG with CRLF | Marker updated correctly |
| TC-ATB-06 | Empty BACKLOG with CRLF | Item appended correctly |
| TC-INT-14 | Standard BACKLOG with CRLF | Full add + update flow works |

### meta.json Line Ending Verification

After every `writeMetaJson()` call, verify the output file contains no `\r\n` sequences (VR-CRLF-002).
