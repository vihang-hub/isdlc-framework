# Test Cases: Three-Verb Backlog Model (REQ-0023)

**Phase**: 05-test-strategy
**Version**: 1.0
**Created**: 2026-02-18
**Traces to**: FR-001 through FR-009, NFR-001 through NFR-006, Error Taxonomy (28 error codes)

---

## Test File 1: test-three-verb-utils.test.cjs (NEW)

### 1.1 generateSlug() -- FR-001, VR-SLUG-001..004

| TC ID | Description | Type | Input | Expected Output | Traces |
|-------|-------------|------|-------|-----------------|--------|
| TC-SLUG-01 | Basic description to slug | positive | `"Add payment processing"` | `"add-payment-processing"` | FR-001, AC-001-01, VR-SLUG-001 |
| TC-SLUG-02 | Uppercase conversion | positive | `"Build Auth Module"` | `"build-auth-module"` | VR-SLUG-001 |
| TC-SLUG-03 | Special characters stripped | positive | `"Fix bug #42 (urgent!)"` | `"fix-bug-42-urgent"` | VR-SLUG-001 |
| TC-SLUG-04 | Multiple spaces collapsed | positive | `"add   multiple   spaces"` | `"add-multiple-spaces"` | VR-SLUG-001 |
| TC-SLUG-05 | Leading/trailing hyphens trimmed | positive | `"--leading-trailing--"` | `"leading-trailing"` | VR-SLUG-001 |
| TC-SLUG-06 | Max 50 characters truncation | boundary | `"a-very-long-description-that-exceeds-the-fifty-character-limit-by-far"` | 50 chars max, no trailing hyphen | VR-SLUG-002 |
| TC-SLUG-07 | Exactly 50 characters | boundary | String of exactly 50 valid chars | Unchanged (50 chars) | VR-SLUG-002 |
| TC-SLUG-08 | Empty string defaults to untitled | negative | `""` | `"untitled-item"` | VR-SLUG-003 |
| TC-SLUG-09 | Whitespace-only defaults to untitled | negative | `"   "` | `"untitled-item"` | VR-SLUG-003 |
| TC-SLUG-10 | All special chars defaults to untitled | negative | `"!@#$%^&*()"` | `"untitled-item"` | VR-SLUG-003 |
| TC-SLUG-11 | Path traversal attempt sanitized | negative | `"../../etc/passwd"` | `"etcpasswd"` | VR-SLUG-001, Security |
| TC-SLUG-12 | Consecutive hyphens collapsed | positive | `"foo---bar"` | `"foo-bar"` | VR-SLUG-001 |

### 1.2 deriveAnalysisStatus() -- FR-009, VR-PHASE-003

| TC ID | Description | Type | Input | Expected Output | Traces |
|-------|-------------|------|-------|-----------------|--------|
| TC-STATUS-01 | Zero phases = raw | positive | `[]` | `"raw"` | AC-009-01, VR-PHASE-003 |
| TC-STATUS-02 | One phase = partial | positive | `["00-quick-scan"]` | `"partial"` | AC-002-02, VR-PHASE-003 |
| TC-STATUS-03 | Four phases = partial | positive | `["00-quick-scan", "01-requirements", "02-impact-analysis", "03-architecture"]` | `"partial"` | VR-PHASE-003 |
| TC-STATUS-04 | All five phases = analyzed | positive | All 5 phase keys | `"analyzed"` | AC-002-03, VR-PHASE-003 |
| TC-STATUS-05 | Invalid phase keys filtered | negative | `["00-quick-scan", "invalid-phase"]` | `"partial"` (only 1 valid) | VR-PHASE-002 |

### 1.3 deriveBacklogMarker() -- FR-007

| TC ID | Description | Type | Input | Expected Output | Traces |
|-------|-------------|------|-------|-----------------|--------|
| TC-MARKER-01 | Raw status -> space | positive | `"raw"` | `" "` | AC-007-01 |
| TC-MARKER-02 | Partial status -> tilde | positive | `"partial"` | `"~"` | AC-007-02 |
| TC-MARKER-03 | Analyzed status -> A | positive | `"analyzed"` | `"A"` | AC-007-03 |
| TC-MARKER-04 | Unknown status -> space (default) | negative | `"unknown"` | `" "` | VR-MARKER-001 |
| TC-MARKER-05 | Null status -> space (default) | negative | `null` | `" "` | VR-MARKER-001 |

### 1.4 Source Detection -- FR-001, VR-SOURCE-001..003

| TC ID | Description | Type | Input | Expected Source | Expected source_id | Traces |
|-------|-------------|------|-------|----------------|-------------------|--------|
| TC-SRC-01 | GitHub issue #N | positive | `"#42"` | `"github"` | `"GH-42"` | AC-001-03, VR-SOURCE-001 |
| TC-SRC-02 | GitHub issue #1 | positive | `"#1"` | `"github"` | `"GH-1"` | VR-SOURCE-001 |
| TC-SRC-03 | Jira ticket PROJECT-N | positive | `"PROJ-123"` | `"jira"` | `"PROJ-123"` | VR-SOURCE-002 |
| TC-SRC-04 | Jira with long project key | positive | `"MYPROJECT-9999"` | `"jira"` | `"MYPROJECT-9999"` | VR-SOURCE-002 |
| TC-SRC-05 | Manual description | positive | `"Add payment processing"` | `"manual"` | `null` | AC-001-01, VR-SOURCE-003 |
| TC-SRC-06 | Hash without digits (not GitHub) | negative | `"#abc"` | `"manual"` | `null` | VR-SOURCE-003 |

### 1.5 readMetaJson() -- Legacy Migration -- FR-009, AC-009-01..05

| TC ID | Description | Type | Input (meta.json content) | Expected Result | Traces |
|-------|-------------|------|--------------------------|-----------------|--------|
| TC-META-R01 | v2 schema read as-is | positive | `{ analysis_status: "partial", phases_completed: ["00-quick-scan"] }` | Returned unchanged | AC-009-01 |
| TC-META-R02 | v1 with phase_a_completed: true | positive | `{ phase_a_completed: true }` | `analysis_status: "analyzed"`, `phases_completed: [all 5]` | AC-009-03, VR-MIGRATE-002 |
| TC-META-R03 | v1 with phase_a_completed: false | positive | `{ phase_a_completed: false }` | `analysis_status: "raw"`, `phases_completed: []` | AC-009-04, VR-MIGRATE-003 |
| TC-META-R04 | v1 missing phase_a_completed | positive | `{ source: "manual" }` | `analysis_status: "raw"`, `phases_completed: []` | AC-009-04, VR-MIGRATE-003 |
| TC-META-R05 | Both v1 and v2 fields (v2 wins) | positive | `{ phase_a_completed: false, analysis_status: "analyzed", phases_completed: [all 5] }` | `analysis_status: "analyzed"` (v2 takes precedence) | VR-MIGRATE-004 |
| TC-META-R06 | File does not exist | negative | No file | Returns `null` | ERR-META-001 |
| TC-META-R07 | Corrupted JSON | negative | `"not valid json"` | Returns `null`, logs error | ERR-META-002 |
| TC-META-R08 | Missing source defaults to manual | positive | `{ analysis_status: "raw", phases_completed: [] }` | `source: "manual"` | VR-META-001 |
| TC-META-R09 | Missing created_at gets default | positive | `{ source: "manual", analysis_status: "raw" }` | `created_at` is set to a valid ISO-8601 string | VR-META-004 |
| TC-META-R10 | phases_completed not array defaults to [] | negative | `{ phases_completed: "not-array" }` | `phases_completed: []` | VR-META-006 |

### 1.6 writeMetaJson() -- FR-009, AC-009-01..02

| TC ID | Description | Type | Input | Expected File Content | Traces |
|-------|-------------|------|-------|-----------------------|--------|
| TC-META-W01 | v2 schema written correctly | positive | `{ source: "manual", analysis_status: "raw", phases_completed: [] }` | JSON with `analysis_status`, no `phase_a_completed` | AC-009-01 |
| TC-META-W02 | phase_a_completed stripped on write | positive | `{ phase_a_completed: true, analysis_status: "analyzed", phases_completed: [all 5] }` | File has no `phase_a_completed` key | AC-009-02 |
| TC-META-W03 | analysis_status derived from phases_completed | positive | `{ phases_completed: ["00-quick-scan"] }` | `analysis_status: "partial"` in file | VR-META-008 |
| TC-META-W04 | Empty phases -> raw status | positive | `{ phases_completed: [] }` | `analysis_status: "raw"` in file | VR-META-008 |
| TC-META-W05 | All 5 phases -> analyzed status | positive | `{ phases_completed: [all 5] }` | `analysis_status: "analyzed"` in file | VR-META-008 |
| TC-META-W06 | File written with LF line endings | positive | Any valid meta | No CRLF in output file | VR-CRLF-002 |

### 1.7 BACKLOG Marker Regex Parsing -- FR-007, VR-MARKER-001..004

| TC ID | Description | Type | Input Line | Match? | Captures | Traces |
|-------|-------------|------|------------|--------|----------|--------|
| TC-REGEX-01 | Raw marker | positive | `"- 16.2 [ ] Payment processing"` | Yes | prefix=`"- "`, number=`"16.2"`, marker=`" "`, desc=`"Payment processing"` | AC-007-05, VR-MARKER-002 |
| TC-REGEX-02 | Partial marker | positive | `"- 3.1 [~] Login feature"` | Yes | marker=`"~"` | AC-007-06, VR-MARKER-002 |
| TC-REGEX-03 | Analyzed marker | positive | `"- 8.4 [A] API redesign"` | Yes | marker=`"A"` | AC-007-06, VR-MARKER-002 |
| TC-REGEX-04 | Completed marker | positive | `"- 1.1 [x] Initial setup"` | Yes | marker=`"x"` | AC-007-05, VR-MARKER-002 |
| TC-REGEX-05 | Non-matching line (heading) | negative | `"## Open"` | No | -- | VR-MARKER-002 |
| TC-REGEX-06 | Non-matching line (no number) | negative | `"- [ ] Some item without number"` | No | -- | VR-MARKER-004 |
| TC-REGEX-07 | Unknown marker character treated as raw | negative | `"- 5.1 [?] Weird marker"` | No (regex rejects) | -- | VR-MARKER-001, ERR-BACKLOG-003 |
| TC-REGEX-08 | Indented item | positive | `"  - 16.2 [ ] Indented item"` | Yes | prefix includes indent | VR-MARKER-002 |

### 1.8 updateBacklogMarker() -- FR-007, AC-007-01..06

| TC ID | Description | Type | Input | Expected Result | Traces |
|-------|-------------|------|-------|-----------------|--------|
| TC-UBM-01 | Update raw to partial | positive | BACKLOG with `[ ]` item, newMarker=`"~"` | Line changes to `[~]` | AC-007-02 |
| TC-UBM-02 | Update partial to analyzed | positive | BACKLOG with `[~]` item, newMarker=`"A"` | Line changes to `[A]` | AC-007-03 |
| TC-UBM-03 | Update analyzed to completed | positive | BACKLOG with `[A]` item, newMarker=`"x"` | Line changes to `[x]` | AC-007-04 |
| TC-UBM-04 | No BACKLOG.md exists | negative | No file | Returns without error (silent) | ERR-BACKLOG-001 |
| TC-UBM-05 | Item not found in BACKLOG | negative | BACKLOG exists but no matching slug | Returns without error (silent) | ERR-BACKLOG-002 |
| TC-UBM-06 | CRLF line endings handled | positive | BACKLOG with CRLF, update marker | Marker updated correctly | VR-CRLF-001 |
| TC-UBM-07 | Multiple items, only target updated | positive | BACKLOG with 3 items, update middle one | Only middle item marker changes | FR-007 |
| TC-UBM-08 | Preserves other lines unchanged | positive | BACKLOG with headings and items | Non-item lines preserved exactly | FR-007 |

### 1.9 appendToBacklog() -- FR-001, AC-001-04

| TC ID | Description | Type | Input | Expected Result | Traces |
|-------|-------------|------|-------|-----------------|--------|
| TC-ATB-01 | Append to existing Open section | positive | BACKLOG with `## Open` section | New item added before next `##` heading | AC-001-04, AC-007-01 |
| TC-ATB-02 | Create BACKLOG.md if missing | positive | No BACKLOG.md | File created with `## Open`, `## Completed`, and new item | AC-001-04 |
| TC-ATB-03 | Append with raw marker | positive | marker=`" "` | Line has `[ ]` | AC-007-01 |
| TC-ATB-04 | Open section at end of file | positive | BACKLOG with `## Open` but no `## Completed` after | Item appended at end | AC-001-04 |
| TC-ATB-05 | Preserves existing items | positive | BACKLOG with 3 existing items | All 3 preserved, new item added | FR-001 |
| TC-ATB-06 | CRLF line endings | positive | BACKLOG with CRLF | New item appended correctly | VR-CRLF-001 |

### 1.10 resolveItem() Priority Chain -- ADR-0015, VR-RESOLVE-001..006

| TC ID | Description | Type | Input | Expected Strategy | Traces |
|-------|-------------|------|-------|-------------------|--------|
| TC-RESOLVE-01 | Exact slug match | positive | `"payment-processing"` (dir exists with meta.json) | Strategy 1: exact slug | VR-RESOLVE-002 |
| TC-RESOLVE-02 | Partial slug match (suffix) | positive | `"processing"` (dir `add-payment-processing/` exists) | Strategy 2: partial slug | VR-RESOLVE-002 |
| TC-RESOLVE-03 | Item number match | positive | `"16.2"` (BACKLOG has item 16.2) | Strategy 3: item number | VR-RESOLVE-003 |
| TC-RESOLVE-04 | GitHub ref match | positive | `"#42"` (meta.json has source_id: GH-42) | Strategy 4: external ref | VR-RESOLVE-004 |
| TC-RESOLVE-05 | Jira ref match | positive | `"PROJ-123"` (meta.json has source_id: PROJ-123) | Strategy 4: external ref | VR-RESOLVE-005 |
| TC-RESOLVE-06 | Fuzzy description match (single) | positive | `"payment"` (one BACKLOG item contains "payment") | Strategy 5: fuzzy | VR-RESOLVE-006 |
| TC-RESOLVE-07 | Fuzzy match multiple results | positive | `"feature"` (multiple items contain "feature") | Returns multiple matches for disambiguation | ERR-RESOLVE-002 |
| TC-RESOLVE-08 | No match found | negative | `"nonexistent-slug"` | Returns null | ERR-RESOLVE-001 |
| TC-RESOLVE-09 | Empty input | negative | `""` | Returns null or error | VR-RESOLVE-001 |
| TC-RESOLVE-10 | Whitespace-only input | negative | `"   "` | Returns null or error | VR-RESOLVE-001 |
| TC-RESOLVE-11 | Priority order: slug before number | positive | Input `"3.2"` matches both slug dir `3.2/` and item number | Strategy 1 (slug) takes priority | ADR-0015 |
| TC-RESOLVE-12 | BACKLOG.md unreadable | negative | BACKLOG.md missing, slug dir also missing | Returns null, no crash | ERR-RESOLVE-003 |

### 1.11 Error Code Coverage -- Error Taxonomy

Each error code from the error taxonomy must be triggerable in at least one test.

| TC ID | Error Code | Severity | Trigger Condition | Traces |
|-------|-----------|----------|-------------------|--------|
| TC-ERR-01 | ERR-ADD-001 | WARNING | Slug directory already exists | AC-001-07 |
| TC-ERR-02 | ERR-ADD-002 | FATAL | BACKLOG.md write permission denied (mocked) | AC-001-04 |
| TC-ERR-03 | ERR-ADD-003 | SILENT | state.json unreadable for counter peek | AC-001-05 |
| TC-ERR-04 | ERR-ADD-004 | FATAL | Empty description provided | AC-001-01 |
| TC-ERR-05 | ERR-ADD-005 | SILENT | Git HEAD unavailable | - |
| TC-ERR-06 | ERR-ADD-006 | FATAL | Directory creation fails (mocked) | AC-001-01 |
| TC-ERR-07 | ERR-ANALYZE-001 | WARNING | Item not found, no resolveItem match | AC-002-08 |
| TC-ERR-08 | ERR-ANALYZE-002 | FATAL | meta.json corrupted (malformed JSON) | AC-002-03 |
| TC-ERR-09 | ERR-ANALYZE-003 | INFO | Analysis complete, codebase unchanged | AC-002-03 |
| TC-ERR-10 | ERR-ANALYZE-004 | WARNING | Codebase hash mismatch | AC-002-09 |
| TC-ERR-11 | ERR-ANALYZE-005 | WARNING | Phase agent delegation fails | AC-002-01 |
| TC-ERR-12 | ERR-ANALYZE-006 | WARNING | meta.json write fails | AC-002-02 |
| TC-ERR-13 | ERR-ANALYZE-007 | INFO | Folder exists but no meta.json | AC-002-08 |
| TC-ERR-14 | ERR-BUILD-001 | FATAL | Item not found (reference-type input) | AC-003-04 |
| TC-ERR-15 | ERR-BUILD-002 | FATAL | Active workflow exists | AC-003-05 |
| TC-ERR-16 | ERR-BUILD-003 | FATAL | Constitution missing or template | AC-003-01 |
| TC-ERR-17 | ERR-BUILD-004 | FATAL | Orchestrator delegation fails | AC-003-01 |
| TC-ERR-18 | ERR-BUILD-005 | FATAL | Branch creation fails | AC-003-02 |
| TC-ERR-19 | ERR-BUILD-006 | WARNING | Item not found, description input (offer add) | AC-003-04 |
| TC-ERR-20 | ERR-RESOLVE-001 | FATAL | No match found (reference input) | ADR-0015 |
| TC-ERR-21 | ERR-RESOLVE-002 | INFO | Multiple fuzzy matches | ADR-0015 |
| TC-ERR-22 | ERR-RESOLVE-003 | WARNING | BACKLOG.md unreadable | ADR-0015 |
| TC-ERR-23 | ERR-RESOLVE-004 | WARNING | meta.json scan fails | ADR-0015 |
| TC-ERR-24 | ERR-META-001 | SILENT | meta.json missing (expected) | AC-009-04 |
| TC-ERR-25 | ERR-META-002 | FATAL | Malformed JSON | AC-009-03 |
| TC-ERR-26 | ERR-META-003 | SILENT | Legacy migration applied | AC-009-03, AC-009-04 |
| TC-ERR-27 | ERR-META-004 | WARNING | Write failure | AC-009-01 |
| TC-ERR-28 | ERR-BACKLOG-001 | SILENT | BACKLOG.md missing during update | AC-007-01 |
| TC-ERR-29 | ERR-BACKLOG-002 | SILENT | Item not found in BACKLOG (update) | AC-007-02 |
| TC-ERR-30 | ERR-BACKLOG-003 | SILENT | Unexpected marker character | AC-007-05 |
| TC-ERR-31 | ERR-BACKLOG-004 | WARNING | Write failure | AC-007-02 |
| TC-ERR-32 | ERR-HOOK-001 | SILENT | Unknown action in EXEMPT_ACTIONS check | AC-008-01 |
| TC-ERR-33 | ERR-HOOK-002 | SILENT | Action regex parse fails | AC-008-02 |
| TC-ERR-34 | ERR-HOOK-003 | SILENT | state.json unavailable | AC-008-03 |

### 1.12 Integration Tests -- Cross-Function Data Flows

| TC ID | Description | Type | Flow | Traces |
|-------|-------------|------|------|--------|
| TC-INT-01 | Add manual item end-to-end | positive | detect source -> generate slug -> write meta.json -> append to BACKLOG | FR-001, US-001 |
| TC-INT-02 | Add GitHub reference end-to-end | positive | detect source (#42) -> slug from desc -> meta.json with GH-42 -> BACKLOG append | FR-001, US-002 |
| TC-INT-03 | Add Jira reference end-to-end | positive | detect source (PROJ-123) -> slug -> meta.json with jira source -> BACKLOG append | FR-001, US-002 |
| TC-INT-04 | Add with existing slug (collision) | negative | slug exists -> ERR-ADD-001 raised | AC-001-07 |
| TC-INT-05 | Analyze resume from partial | positive | meta has 2 phases -> next phase is "02-impact-analysis" -> after update: 3 phases, status "partial" | FR-002, AC-002-04, US-004 |
| TC-INT-06 | Analyze completes all phases | positive | meta has 4 phases -> run phase 04 -> status "analyzed" -> marker [A] | FR-002, AC-002-03 |
| TC-INT-07 | Analyze with implicit add | positive | resolve fails -> add runs -> analysis proceeds | FR-002, AC-002-08 |
| TC-INT-08 | Legacy meta migration round-trip | positive | read v1 (phase_a_completed: true) -> get analyzed -> write v2 -> re-read -> still analyzed | FR-009, ADR-0013 |
| TC-INT-09 | Marker progression full lifecycle | positive | `[ ]` -> `[~]` -> `[A]` -> `[x]` | FR-007, VR-MARKER-003 |
| TC-INT-10 | Marker progression with re-analysis | positive | `[A]` -> re-analyze -> `[ ]` -> `[~]` -> `[A]` | FR-007 |
| TC-INT-11 | Add does NOT write state.json | positive | Run add flow -> verify state.json unchanged | NFR-002, AC-001-05 |
| TC-INT-12 | Analyze does NOT create workflow | positive | Run analyze flow -> verify active_workflow is null | NFR-002, AC-002-05 |
| TC-INT-13 | meta.json consistency after write | positive | Write with mismatched status/phases -> read back -> status re-derived correctly | VR-META-008 |
| TC-INT-14 | BACKLOG with CRLF add and update | positive | Create BACKLOG with CRLF -> add item -> update marker -> verify correct | VR-CRLF-001 |

---

## Test File 2: test-skill-delegation-enforcer.test.cjs (EXTEND)

### 2.1 REQ-0023: Three-Verb Model EXEMPT_ACTIONS Updates

These tests are added to the existing BUG-0021 section (renamed to "REQ-0023: Three-verb model inline carve-out").

| TC ID | Description | Type | Input | Expected Result | Traces |
|-------|-------------|------|-------|-----------------|--------|
| TC-SDE-01 | `add` action exempt from delegation | positive | `args: 'add "Add payment processing"'` | Exit 0, no MANDATORY message, no pending_delegation written | AC-008-01 |
| TC-SDE-02 | `add` with leading flags still exempt | positive | `args: '--verbose add "#42"'` | Exit 0, no MANDATORY message | AC-008-01 |
| TC-SDE-03 | `build` action NOT exempt (requires delegation) | negative | `args: 'build "payment-processing"'` | Exit 0, MANDATORY message output, pending_delegation marker written | AC-008-02 |

### 2.2 Regression: Existing analyze tests still pass

All 11 existing tests in the BUG-0021 section remain unchanged and must continue to pass.

---

## Test File 3: test-delegation-gate.test.cjs (EXTEND)

### 3.1 REQ-0023: Three-Verb Model EXEMPT_ACTIONS Defense-in-Depth

These tests are added to the existing BUG-0021 section (renamed to "REQ-0023: Three-verb model inline carve-out").

| TC ID | Description | Type | Input State | Expected Result | Traces |
|-------|-------------|------|-------------|-----------------|--------|
| TC-DG-01 | Pending delegation for `add` auto-clears | positive | pending_delegation with `args: 'add "payment processing"'` | No block, marker cleared | AC-008-01 |
| TC-DG-02 | Pending delegation for `build` NOT auto-cleared | negative | pending_delegation with `args: 'build "payment-processing"'` | Block decision | AC-008-02 |
| TC-DG-03 | ADD in uppercase auto-clears (case insensitive) | positive | pending_delegation with `args: 'ADD "#42"'` | No block, marker cleared | AC-008-01 |

### 3.2 Regression: Existing analyze tests still pass

All 13 existing tests in the BUG-0021 section remain unchanged and must continue to pass.

---

## Test File 4: Manual Verification Tests (Not Automatable)

These tests verify markdown file content changes (CLAUDE.md, isdlc.md, orchestrator). They are checked during code review, not via automated tests.

### 4.1 Intent Detection (FR-004) -- Manual Review

| TC ID | Description | Type | Verification Method | Traces |
|-------|-------------|------|-------------------|--------|
| TC-INTENT-01 | CLAUDE.md has Add intent row | positive | Grep CLAUDE.md for "Add" intent with signal words | AC-004-01, AC-004-02 |
| TC-INTENT-02 | CLAUDE.md has Analyze intent row | positive | Grep for "Analyze" with signal words | AC-004-01, AC-004-03 |
| TC-INTENT-03 | CLAUDE.md has Build intent row | positive | Grep for "Build" with signal words | AC-004-01, AC-004-04 |
| TC-INTENT-04 | CLAUDE.md Fix intent unchanged | positive | Grep for "Fix" row, verify same signal words | AC-004-05 |
| TC-INTENT-05 | CLAUDE.md.template mirrors changes | positive | Compare template intent table with CLAUDE.md | AC-004-06 |
| TC-INTENT-06 | Other intents unchanged | positive | Verify Upgrade, Test, Discovery rows preserved | AC-004-07 |
| TC-INTENT-07 | Disambiguation rule documented | positive | Grep for "Disambiguation" paragraph | AC-004-08 |
| TC-INTENT-08 | No "Feature" intent row | positive | Grep confirms no "Feature" as intent name | FR-004 |

### 4.2 Command Surface (FR-005) -- Manual Review

| TC ID | Description | Type | Verification Method | Traces |
|-------|-------------|------|-------------------|--------|
| TC-CMD-01 | Zero "Phase A" in isdlc.md | positive | `grep -c "Phase A" isdlc.md` returns 0 | AC-005-01 |
| TC-CMD-02 | Zero "Phase B" in isdlc.md | positive | `grep -c "Phase B" isdlc.md` returns 0 | AC-005-01 |
| TC-CMD-03 | `/isdlc add` documented | positive | Grep for `add` action definition | AC-005-02 |
| TC-CMD-04 | `/isdlc analyze` has new semantics | positive | Verify analyze section matches design spec (interactive analysis, not Phase A) | AC-005-03 |
| TC-CMD-05 | `/isdlc build` documented | positive | Grep for `build` action definition | AC-005-04 |
| TC-CMD-06 | `/isdlc start` removed | positive | `grep -c "/isdlc start" isdlc.md` returns 0 | AC-005-05 |
| TC-CMD-07 | Action routing updated | positive | Verify routing block handles add, analyze, build | AC-005-06 |
| TC-CMD-08 | All meta.json refs use analysis_status | positive | `grep -c "phase_a_completed" isdlc.md` returns 0 | AC-005-07 |
| TC-CMD-09 | QUICK REFERENCE table updated | positive | Verify add, analyze, build in reference table | AC-005-08 |

### 4.3 Orchestrator (FR-006) -- Manual Review

| TC ID | Description | Type | Verification Method | Traces |
|-------|-------------|------|-------------------|--------|
| TC-ORCH-01 | Zero "BACKLOG PICKER" | positive | `grep -c "BACKLOG PICKER" orchestrator.md` returns 0 | AC-006-01 |
| TC-ORCH-02 | SCENARIO 3 has Add/Analyze/Build/Fix | positive | Verify menu options in SCENARIO 3 | AC-006-02 |
| TC-ORCH-03 | COMMANDS includes add, analyze, build | positive | Grep COMMANDS YOU SUPPORT section | AC-006-03 |
| TC-ORCH-04 | `/isdlc fix` remains | positive | Verify fix command still documented | AC-006-04 |
| TC-ORCH-05 | Jira metadata parsing removed | positive | Grep for Jira metadata in orchestrator, returns 0 | AC-006-05 |

### 4.4 Hook Cleanup (FR-008) -- Manual Review

| TC ID | Description | Type | Verification Method | Traces |
|-------|-------------|------|-------------------|--------|
| TC-HOOK-01 | Zero "Phase A" in all hook files | positive | `grep -rn "Phase A" src/claude/hooks/` returns 0 (excluding test files) | AC-008-03 |
| TC-HOOK-02 | Zero "Phase B" in all hook files | positive | `grep -rn "Phase B" src/claude/hooks/` returns 0 (excluding test files) | AC-008-03 |
| TC-HOOK-03 | All existing hook tests pass | positive | `npm run test:hooks` passes | AC-008-04 |

---

## Test Priority Summary

| Priority | Count | Description |
|----------|-------|-------------|
| P0 (Critical) | 34 | Hook EXEMPT_ACTIONS (6), meta.json migration (10), BACKLOG marker core (8), error codes for FATAL severity (10) |
| P1 (High) | 42 | Source detection (6), slug generation (12), item resolution (12), integration flows (12) |
| P2 (Medium) | 38 | Error codes for WARNING/INFO severity (14), CRLF handling (4), remaining integration (6), manual review tests (14) |
| P3 (Low) | 14 | Performance benchmarks (5), edge case error codes SILENT (9) |
| **Total** | **128** | |
