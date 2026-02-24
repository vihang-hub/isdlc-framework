# Test Cases: REQ-0037 Project Skills Distillation

**Status**: Approved
**Last Updated**: 2026-02-24
**Requirement**: REQ-0037 (GitHub #88)
**Total Test Cases**: 4 new + 44 existing (regression)
**Testable Requirement**: FR-007 (Section 9 removal)
**Test File**: `src/claude/hooks/tests/test-session-cache-builder.test.cjs`

---

## Test Case Naming Convention

Following existing convention: `TC-BUILD-NN` prefix for `rebuildSessionCache()` tests. The existing file uses TC-BUILD-01 through TC-BUILD-15. New tests continue from TC-BUILD-16.

---

## New Test Cases (FR-007: Remove Section 9)

### TC-BUILD-16: cache output does not contain DISCOVERY_CONTEXT section delimiter

**Requirement**: FR-007, AC-007-01
**Test Type**: negative
**Priority**: P0 (Critical)
**Precondition**: Full test project created via `createFullTestProject()`

**Steps**:
1. Create a full test project with discovery report files present:
   - `docs/project-discovery-report.md` (with sample content)
   - `docs/isdlc/test-evaluation-report.md` (with sample content)
   - `docs/isdlc/reverse-engineer-report.md` (with sample content)
2. Call `rebuildSessionCache({ projectRoot: tmpDir })`
3. Read the generated cache file
4. Assert that the cache does NOT contain `<!-- SECTION: DISCOVERY_CONTEXT -->`
5. Assert that the cache does NOT contain `<!-- /SECTION: DISCOVERY_CONTEXT -->`
6. Assert that the cache does NOT contain `<!-- SECTION: DISCOVERY_CONTEXT SKIPPED:`

**Expected Result**: No DISCOVERY_CONTEXT section delimiter of any kind appears in the cache output, even when discovery report files exist on disk.

**Rationale**: This is the core verification that Section 9 code has been removed. By creating the discovery report files that Section 9 would have read, we confirm the section builder is entirely absent (not just producing empty output).

---

### TC-BUILD-17: raw discovery report content not injected into cache

**Requirement**: FR-007, AC-007-02
**Test Type**: negative
**Priority**: P0 (Critical)
**Precondition**: Full test project with discovery report files containing known marker strings

**Steps**:
1. Create a full test project
2. Write discovery report files with unique marker strings:
   - `docs/project-discovery-report.md`: contains `"DISCOVERY_MARKER_ALPHA"`
   - `docs/isdlc/test-evaluation-report.md`: contains `"TESTREPORT_MARKER_BETA"`
   - `docs/isdlc/reverse-engineer-report.md`: contains `"REVENG_MARKER_GAMMA"`
3. Call `rebuildSessionCache({ projectRoot: tmpDir })`
4. Read the generated cache file
5. Assert the cache does NOT contain `"DISCOVERY_MARKER_ALPHA"`
6. Assert the cache does NOT contain `"TESTREPORT_MARKER_BETA"`
7. Assert the cache does NOT contain `"REVENG_MARKER_GAMMA"`

**Expected Result**: None of the raw discovery report content appears anywhere in the cache output. The three report files are ignored by `rebuildSessionCache()`.

**Rationale**: Even though TC-BUILD-16 checks for the section delimiter, this test verifies the content itself is not injected through any other mechanism (e.g., if the content were moved to a different section).

---

### TC-BUILD-18: Section 7 EXTERNAL_SKILLS still functions after Section 9 removal

**Requirement**: FR-007, AC-007-03
**Test Type**: positive
**Priority**: P0 (Critical)
**Precondition**: Full test project with external skills manifest and skill files

**Steps**:
1. Create a full test project
2. Create external skills infrastructure:
   - `.claude/skills/external/test-skill.md` with content `"EXTERNAL_SKILL_CONTENT"`
   - `docs/isdlc/external-skills-manifest.json` with entry pointing to `test-skill.md`, `source: "discover"`
3. Call `rebuildSessionCache({ projectRoot: tmpDir })`
4. Read the generated cache file
5. Assert the cache contains `<!-- SECTION: EXTERNAL_SKILLS -->`
6. Assert the cache contains `<!-- /SECTION: EXTERNAL_SKILLS -->`
7. Assert the cache contains `"EXTERNAL_SKILL_CONTENT"` within the EXTERNAL_SKILLS section
8. Assert the cache contains `Source: discover`

**Expected Result**: Section 7 (EXTERNAL_SKILLS) is present, fully functional, and includes the external skill content and source attribution. This confirms EXTERNAL_SKILLS is the sole delivery mechanism for discovery knowledge.

**Rationale**: AC-007-03 requires that Section 7 continues to function as the sole delivery mechanism. This test was already partially covered by TC-SRC-01 but we add explicit verification that it works with discover-sourced skills in the context of Section 9 being absent.

---

### TC-BUILD-19: existing tests pass without modification (regression guard)

**Requirement**: FR-007, AC-007-04
**Test Type**: positive
**Priority**: P0 (Critical)
**Precondition**: Section 9 removed from `rebuildSessionCache()`

**Implementation Note**: This is not a single test case but a meta-requirement. AC-007-04 states "Existing tests for `rebuildSessionCache()` are updated to reflect the section removal." Since no existing test references DISCOVERY_CONTEXT, the "update" is to confirm they pass unchanged. This is validated by running the full test file:

```bash
node --test src/claude/hooks/tests/test-session-cache-builder.test.cjs
```

All 44 existing tests (TC-BUILD-01 through TC-BUILD-15, TC-INDEX-01 through TC-INDEX-10, TC-MTIME-01 through TC-MTIME-08, TC-SKILL-01 through TC-SKILL-08, TC-REG-01 through TC-REG-03, TC-MAN-01 through TC-MAN-03, TC-SRC-01, TC-SRC-03, TC-SEC-02) must pass with zero failures.

**Expected Result**: 44 existing tests pass. Zero regressions.

**Rationale**: The removal of 18 lines from `rebuildSessionCache()` must not break any existing functionality. Since `createFullTestProject()` never created discovery report files, Section 9 was always producing empty/skipped output in tests, so no test should fail.

---

## Existing Test Summary (Regression Baseline)

The following 44 tests must continue to pass unchanged:

### rebuildSessionCache() tests (15 tests)
| ID | Description | Traces To |
|----|------------|-----------|
| TC-BUILD-01 | Produces valid cache file with all sections | FR-001 (REQ-0001) |
| TC-BUILD-02 | Cache file contains section delimiters | FR-001 (REQ-0001) |
| TC-BUILD-03 | Cache header contains timestamp, source count, hash | FR-001 (REQ-0001) |
| TC-BUILD-04 | Missing source files produce SKIPPED markers | FR-001 (REQ-0001) |
| TC-BUILD-05 | Missing .isdlc/ directory throws | FR-001 (REQ-0001) |
| TC-BUILD-06 | Constitution section contains raw file content | FR-001 (REQ-0001) |
| TC-BUILD-07 | Workflow config section contains raw JSON | FR-001 (REQ-0001) |
| TC-BUILD-08 | Skills manifest excludes path_lookup and skill_paths | FR-008 (REQ-0001) |
| TC-BUILD-09 | Skill index section contains per-agent blocks | FR-001 (REQ-0001) |
| TC-BUILD-10 | All source files missing produces minimal valid cache | FR-001 (REQ-0001) |
| TC-BUILD-11 | Roundtable context includes persona files | FR-001 (REQ-0001) |
| TC-BUILD-12 | Roundtable context includes topic files | FR-001 (REQ-0001) |
| TC-BUILD-14 | Idempotent -- two calls produce same hash | NFR-007 (REQ-0001) |
| TC-BUILD-15 | External skills with missing manifest is skipped | FR-009 (REQ-0001) |

### _buildSkillPathIndex() tests (8 tests)
| ID | Description |
|----|------------|
| TC-INDEX-01 through TC-INDEX-10 | Skill path indexing, caching, hidden dir exclusion |

### _collectSourceMtimes() tests (5 tests)
| ID | Description |
|----|------------|
| TC-MTIME-01 through TC-MTIME-08 | Source file mtime collection, hash determinism |

### getAgentSkillIndex() tests (5 tests)
| ID | Description |
|----|------------|
| TC-SKILL-01 through TC-SKILL-08 | Agent skill resolution, path extraction |

### Hook Registration tests (3 tests)
| ID | Description |
|----|------------|
| TC-REG-01 through TC-REG-03 | SessionStart hook settings validation |

### Manifest Cleanup tests (3 tests)
| ID | Description |
|----|------------|
| TC-MAN-01 through TC-MAN-03 | Skills manifest key validation |

### External Manifest Source Field tests (2 tests)
| ID | Description |
|----|------------|
| TC-SRC-01, TC-SRC-03 | Source field in cache output |

### Security tests (1 test)
| ID | Description |
|----|------------|
| TC-SEC-02 | Cache does not contain credentials |

---

## Non-Testable Requirements (Manual Review in Phase 08)

The following requirements are verified through manual code review, not automated tests:

| Requirement | What to Verify |
|-------------|---------------|
| FR-001 (Distillation step) | Inline distillation instructions present in discover-orchestrator.md |
| FR-002 (Four skills) | Templates for all four PROJ-001 through PROJ-004 skills defined |
| FR-003 (Idempotent by source) | Clean-slate logic instructions present per source phase |
| FR-004 (Manifest registration) | Instructions include source: "discover" and correct bindings |
| FR-005 (Cache rebuild) | Single rebuildSessionCache() call instructed after all distillation |
| FR-006 (Fail-open) | Error handling instructions present at each failure point |
| FR-008 (LLM summarization) | Templates, character limits, provenance requirements in markdown |
