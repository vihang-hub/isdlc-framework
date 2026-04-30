# Test Strategy: Live Workflow Dashboard (REQ-GH-258)

**Phase**: 05-test-strategy
**Task**: T001
**Traces**: FR-004, FR-005, FR-006, FR-008, FR-010, NFR-001, NFR-003

---

## Existing Infrastructure

- **Framework**: `node:test` (native Node.js test runner)
- **Test file**: `tests/core/dashboard/server.test.js` (16 existing tests: DS-01 through DS-AI-08)
- **Pattern**: Integration tests via `startDashboardServer()` on ephemeral port, temp directory fixtures, `afterEach` cleanup
- **Naming**: `DS-` prefix for dashboard server tests, `DS-AI-` for analysis index tests
- **Approach**: Extend existing test suite -- do NOT replace

## Strategy

All new tests are added to `tests/core/dashboard/server.test.js` following the established pattern:
- `setupTempState()` creates temp `.isdlc/` directory with `state.json`
- New helper functions write additional fixture files (persona files, hook log, meta.json, skill manifests)
- Each `describe` block covers one new server function
- Test ID prefix: `DS-` continues from existing numbering

### Test ID Allocation

| Range | Coverage Area |
|-------|--------------|
| DS-01 through DS-08 | Existing: server start, /api/state, /api/history, security, port fallback |
| DS-AI-01 through DS-AI-08 | Existing: analysis-index.json in /api/state |
| DS-P-01 through DS-P-06 | NEW: scanPersonas() — persona discovery (FR-010) |
| DS-HL-01 through DS-HL-06 | NEW: scanHookLog() — hook activity log parsing (FR-005) |
| DS-AM-01 through DS-AM-05 | NEW: readActiveMeta() — active analysis meta.json (FR-006) |
| DS-SK-01 through DS-SK-05 | NEW: getAgentSkills() — built-in + external skills (FR-004) |
| DS-HP-01 through DS-HP-03 | NEW: HTML path resolution / dashboard location (FR-008) |
| DS-FO-01 through DS-FO-04 | NEW: Fail-open cross-cutting (NFR-003) |
| DS-INT-01 through DS-INT-03 | NEW: Integration — all new fields coexist in /api/state (FR-006) |

---

## Test Cases

### 1. scanPersonas() — Persona Discovery (FR-010, FR-006)

Tests scan of `src/claude/agents/persona-*.md` files, frontmatter extraction of `role_type`.

| ID | Description | Type | Traces |
|----|------------|------|--------|
| DS-P-01 | Returns persona list with name and role_type extracted from frontmatter | positive | FR-010, FR-006 |
| DS-P-02 | Personas without `role_type` in frontmatter default to "core" | positive | FR-010 |
| DS-P-03 | Empty persona directory returns empty array | negative | FR-010, NFR-003 |
| DS-P-04 | Malformed frontmatter (no YAML delimiters) returns persona with null role_type | negative | FR-010, NFR-003 |
| DS-P-05 | Persona list is cached (second call returns same reference without re-reading files) | positive | FR-010 |
| DS-P-06 | Persona list appears in /api/state response as `personas` field | positive | FR-010, FR-006 |

**Fixture approach**: Create temp `persona-*.md` files in the temp directory with controlled frontmatter. Pass the persona directory path to the server via options.

```
DS-P-01 fixture:
  persona-business-analyst.md  → frontmatter: name: business-analyst (no role_type)
  persona-security-reviewer.md → frontmatter: role_type: contributing
  persona-domain-expert.md     → frontmatter: role_type: contributing

DS-P-03 fixture:
  Empty directory (no persona-*.md files)

DS-P-04 fixture:
  persona-broken.md → content: "no yaml delimiters here, just text"
```

### 2. scanHookLog() — Hook Activity Log Parsing (FR-005, FR-006)

Tests reading of `.isdlc/hook-activity.log` (JSONL format), filtering to current phase.

| ID | Description | Type | Traces |
|----|------------|------|--------|
| DS-HL-01 | Returns recent hook events from JSONL log, most recent last | positive | FR-005, FR-006 |
| DS-HL-02 | Filters events to current phase from state.json `current_phase` | positive | FR-005 |
| DS-HL-03 | Limits to last 50 lines (tail behavior) | positive | FR-005 |
| DS-HL-04 | Missing hook-activity.log returns empty array | negative | FR-005, NFR-003 |
| DS-HL-05 | Corrupt JSONL lines (invalid JSON) are skipped, valid lines returned | negative | FR-005, NFR-003 |
| DS-HL-06 | Hook events appear in /api/state response as `hook_events` field | positive | FR-005, FR-006 |

**Fixture approach**: Write `.isdlc/hook-activity.log` in temp directory with JSONL entries.

```
DS-HL-01 fixture:
  3 lines, each: {"ts":"...","hook":"gate-blocker","event":"allow","phase":"06-implementation","reason":"..."}

DS-HL-02 fixture:
  5 lines: 2 with phase "05-test-strategy", 3 with phase "06-implementation"
  state.json current_phase: "06-implementation"
  Expected: only the 3 lines for "06-implementation"

DS-HL-03 fixture:
  100 JSONL lines → only last 50 returned

DS-HL-05 fixture:
  3 lines: valid, "NOT JSON {{{", valid → returns 2 valid entries
```

### 3. readActiveMeta() — Active Analysis Meta Reading (FR-006, FR-002)

Tests resolution of active analysis slug from analysis-index.json, then reading that slug's `meta.json`.

| ID | Description | Type | Traces |
|----|------------|------|--------|
| DS-AM-01 | Returns full meta.json content for active analysis slug | positive | FR-006, FR-002 |
| DS-AM-02 | Returns null when no active analysis exists | negative | FR-006 |
| DS-AM-03 | Returns null when meta.json is missing for the active slug | negative | FR-006, NFR-003 |
| DS-AM-04 | Returns null when meta.json is corrupt JSON | negative | FR-006, NFR-003 |
| DS-AM-05 | Active meta appears in /api/state response as `active_meta` field | positive | FR-006 |

**Fixture approach**: Create `docs/requirements/{slug}/meta.json` in temp directory structure. The server resolves the slug from `analysis-index.json` → looks up the meta.json path.

```
DS-AM-01 fixture:
  analysis-index.json: items: [{ slug: "BUG-GH-277-dashboard-fix", analysis_status: "partial", last_activity_at: "<recent>" }]
  docs/requirements/BUG-GH-277-dashboard-fix/meta.json: { analysis_status: "partial", acceptance: { domains: ["requirements"] } }

DS-AM-03 fixture:
  analysis-index.json has active slug, but no meta.json file exists on disk
```

### 4. getAgentSkills() — Skills Display (FR-004, FR-006)

Tests reading of built-in skills from `skills-manifest.json` and external skills from `external-skills-manifest.json`.

| ID | Description | Type | Traces |
|----|------------|------|--------|
| DS-SK-01 | Returns built-in skills for active agent from skills manifest | positive | FR-004, FR-006 |
| DS-SK-02 | Returns external skills from external-skills-manifest.json | positive | FR-004, FR-006 |
| DS-SK-03 | Missing skills-manifest.json returns empty built_in array | negative | FR-004, NFR-003 |
| DS-SK-04 | Missing external-skills-manifest.json returns empty external array | negative | FR-004, NFR-003 |
| DS-SK-05 | Agent skills appear in /api/state response as `agent_skills` field with `built_in` and `external` sub-arrays | positive | FR-004, FR-006 |

**Fixture approach**: Write controlled manifest files in temp directory.

```
DS-SK-01 fixture:
  skills-manifest.json (subset): { agents: { "software-developer": { skills: [{ skill_id: "DEV-001", name: "code-implementation" }] } } }
  state.json active_workflow.sub_agent_log last entry: { agent: "software-developer" }

DS-SK-02 fixture:
  external-skills-manifest.json: { skills: [{ name: "custom-linter", file: "skills/custom-linter.md" }] }
```

### 5. HTML Path Resolution — Dashboard Location (FR-008)

Tests that the server serves `.isdlc/dashboard.html` as primary and falls back to `src/dashboard/index.html`.

| ID | Description | Type | Traces |
|----|------------|------|--------|
| DS-HP-01 | Serves .isdlc/dashboard.html when it exists | positive | FR-008 |
| DS-HP-02 | Falls back to src/dashboard/index.html when .isdlc/dashboard.html is missing | positive | FR-008 |
| DS-HP-03 | Returns 404 when neither dashboard file exists | negative | FR-008 |

**Fixture approach**: Create/omit `dashboard.html` in temp `.isdlc/` directory to test path resolution.

```
DS-HP-01 fixture:
  .isdlc/dashboard.html: "<html>NEW DASHBOARD</html>"
  GET / → response body contains "NEW DASHBOARD"

DS-HP-02 fixture:
  No .isdlc/dashboard.html; src/dashboard/index.html exists
  GET / → response body from fallback

DS-HP-03 fixture:
  Neither file exists
  GET / → 404
```

### 6. Fail-Open Cross-Cutting (NFR-003)

Validates that every new function degrades gracefully rather than crashing the server.

| ID | Description | Type | Traces |
|----|------------|------|--------|
| DS-FO-01 | /api/state returns 200 with defaults when ALL optional files are missing (no hook log, no personas, no skills manifest, no meta.json) | negative | NFR-003 |
| DS-FO-02 | /api/state returns 200 when hook-activity.log has zero-byte content | negative | NFR-003 |
| DS-FO-03 | /api/state returns 200 when persona files have binary/unreadable content | negative | NFR-003 |
| DS-FO-04 | Server does not crash on rapid sequential requests during file I/O failures | negative | NFR-003 |

**Fixture approach**: Minimal temp directory with only state.json -- no other optional files.

### 7. Integration — All New Fields in /api/state (FR-006)

End-to-end validation that all new fields coexist correctly in the response alongside existing fields.

| ID | Description | Type | Traces |
|----|------------|------|--------|
| DS-INT-01 | /api/state includes all new fields: active_meta, hook_events, agent_skills, personas | positive | FR-006 |
| DS-INT-02 | Existing fields unchanged when new fields are present (active_workflow, phases, topology, timestamp, analysis_items, active_analysis) | positive | FR-006 |
| DS-INT-03 | New fields have correct types: active_meta is object-or-null, hook_events is array, agent_skills is object with built_in/external, personas is array | positive | FR-006 |

---

## Task-to-Test Traceability

Maps Phase 06 implementation tasks to the test cases that validate them.

| Task | File Under Test | Test IDs | Traces | Scenarios |
|------|----------------|----------|--------|-----------|
| T002 | src/dashboard/server.js (getAgentSkills) | DS-SK-01..05 | FR-004, FR-006 | Built-in skills, external skills, missing manifests, response shape |
| T003 | src/dashboard/server.js (scanHookLog) | DS-HL-01..06 | FR-005, FR-006 | JSONL parsing, phase filtering, tail 50, missing file, corrupt lines |
| T004 | src/dashboard/server.js (readActiveMeta) | DS-AM-01..05 | FR-002, FR-006 | Slug resolution, meta reading, missing file, corrupt JSON |
| T005 | src/dashboard/server.js (scanPersonas) | DS-P-01..06 | FR-010, FR-006 | Frontmatter extraction, role_type default, empty dir, caching |
| T006 | src/dashboard/server.js (HTML path) | DS-HP-01..03 | FR-008 | Primary path, fallback, neither exists |
| T007 | src/dashboard/dashboard.html | Manual visual review | FR-001..005, FR-007, NFR-001..002 | Layout, panels, poll interval, no controls |
| T008 | init-project.sh | Manual verification | FR-008 | Copy step adds dashboard.html to .isdlc/ |

---

## Test Implementation Notes

### Helper Functions to Add

```javascript
// Write persona fixture files
function writePersonaFile(dir, name, frontmatter) {
  const content = `---\n${Object.entries(frontmatter).map(([k,v]) => `${k}: ${v}`).join('\n')}\n---\n# ${name}\n`;
  writeFileSync(join(dir, `persona-${name}.md`), content);
}

// Write hook activity log (JSONL)
function writeHookLog(dir, entries) {
  const content = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
  writeFileSync(join(dir, 'hook-activity.log'), content);
}

// Write meta.json for a slug
function writeMetaJson(baseDir, slug, meta) {
  const metaDir = join(baseDir, 'docs', 'requirements', slug);
  mkdirSync(metaDir, { recursive: true });
  writeFileSync(join(metaDir, 'meta.json'), JSON.stringify(meta));
}

// Write skills manifest
function writeSkillsManifest(dir, content) {
  writeFileSync(join(dir, 'skills-manifest.json'), JSON.stringify(content));
}

// Write external skills manifest
function writeExternalSkillsManifest(dir, content) {
  writeFileSync(join(dir, 'external-skills-manifest.json'), JSON.stringify(content));
}
```

### Server Options Extension

The server will need new options to accept configurable paths for persona directory, hook log, skills manifests, and docs base directory. This enables testing without touching real project files.

Expected new options for `startDashboardServer()`:
- `personaDir` -- path to directory containing `persona-*.md` files
- `hookLogPath` -- path to `hook-activity.log`
- `skillsManifestPath` -- path to `skills-manifest.json`
- `externalSkillsManifestPath` -- path to `external-skills-manifest.json`
- `docsBasePath` -- base path for resolving `docs/requirements/{slug}/meta.json`

### Coverage Target

- **New test count**: 32 tests (DS-P: 6, DS-HL: 6, DS-AM: 5, DS-SK: 5, DS-HP: 3, DS-FO: 4, DS-INT: 3)
- **Existing test count**: 16 tests
- **Total after**: 48 tests for dashboard server
- **All new server functions**: 100% requirement coverage via traceability matrix above

### Test Execution

```bash
node --test tests/core/dashboard/server.test.js
```

No additional configuration needed -- uses existing `node:test` runner.

---

## Requirement Coverage Matrix

| Requirement | Test IDs | Coverage |
|-------------|----------|----------|
| FR-002 (Analysis Panel) | DS-AM-01, DS-AM-05 | Partial (meta.json data; visual rendering is manual) |
| FR-004 (Skills Display) | DS-SK-01..05 | Full (API-level) |
| FR-005 (Hooks Display) | DS-HL-01..06 | Full (API-level) |
| FR-006 (Server API Expansion) | DS-INT-01..03, DS-P-06, DS-HL-06, DS-AM-05, DS-SK-05 | Full |
| FR-008 (Dashboard Location) | DS-HP-01..03 | Full |
| FR-010 (Persona Discovery) | DS-P-01..06 | Full |
| NFR-001 (Poll Interval) | Manual / HTML review | N/A for server tests |
| NFR-003 (Fail-Open) | DS-FO-01..04, DS-P-03..04, DS-HL-04..05, DS-AM-03..04, DS-SK-03..04 | Full |

### Not Covered by Automated Tests (Manual Review Required)

- **FR-001** (Two-Panel Layout): Visual HTML review
- **FR-003** (Build Panel): Visual HTML review
- **FR-007** (Remove Manual Controls): Visual HTML review -- verify no Play/Next buttons
- **FR-009** (Preserve Static Demo): Verify docs/index.html is unmodified (`git diff docs/index.html`)
- **NFR-001** (Poll Interval): HTML JS review for 2s/10s logic
- **NFR-002** (Zero Dependencies): HTML inspection for no external imports
