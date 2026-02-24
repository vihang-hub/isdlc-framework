# Test Data Plan: REQ-0037 Project Skills Distillation

**Status**: Approved
**Last Updated**: 2026-02-24
**Requirement**: REQ-0037 (GitHub #88)
**Testable Scope**: FR-007 only

---

## Overview

Test data for this feature is minimal because the testable scope is limited to verifying that Section 9 (DISCOVERY_CONTEXT) has been removed from `rebuildSessionCache()`. The test data consists of:

1. Discovery report files with known marker content (to verify they are NOT injected)
2. External skill files and manifest entries (to verify Section 7 still works)
3. The existing `createFullTestProject()` helper (reused for regression tests)

---

## Test Data Fixtures

### Discovery Report Files (for TC-BUILD-16, TC-BUILD-17)

These files are created in the test project to verify that `rebuildSessionCache()` no longer reads them.

**File 1: `docs/project-discovery-report.md`**
```markdown
# Project Discovery Report
DISCOVERY_MARKER_ALPHA
This is a test discovery report that should NOT appear in the cache.
```

**File 2: `docs/isdlc/test-evaluation-report.md`**
```markdown
# Test Evaluation Report
TESTREPORT_MARKER_BETA
This is a test evaluation report that should NOT appear in the cache.
```

**File 3: `docs/isdlc/reverse-engineer-report.md`**
```markdown
# Reverse Engineer Report
REVENG_MARKER_GAMMA
This is a reverse engineer report that should NOT appear in the cache.
```

**Purpose**: The unique marker strings (`DISCOVERY_MARKER_ALPHA`, `TESTREPORT_MARKER_BETA`, `REVENG_MARKER_GAMMA`) are searched for in the cache output. If any appear, Section 9 is still active.

### External Skills Fixture (for TC-BUILD-18)

**File: `.claude/skills/external/test-skill.md`**
```markdown
---
name: test-skill
description: Test project skill for verification
skill_id: PROJ-TEST
owner: discover-orchestrator
---
# Test Skill
EXTERNAL_SKILL_CONTENT
This verifies Section 7 EXTERNAL_SKILLS still functions.
```

**File: `docs/isdlc/external-skills-manifest.json`**
```json
{
  "skills": [
    {
      "name": "test-skill",
      "file": "test-skill.md",
      "source": "discover",
      "bindings": {
        "phases": ["all"]
      }
    }
  ]
}
```

**Purpose**: Verifies that external skills are still delivered via Section 7 after Section 9 removal. The `EXTERNAL_SKILL_CONTENT` marker is searched for in the EXTERNAL_SKILLS section.

---

## Boundary Values

Not applicable for this change. Section 9 removal is a binary change (present or absent). There are no boundary conditions related to file sizes, counts, or thresholds.

The only boundary consideration is:
- **Discovery report files exist but are empty**: Not tested because Section 9 is entirely removed. Whether files exist, are empty, or are missing is irrelevant -- the code that reads them is gone.

---

## Invalid Inputs

Not applicable in the traditional sense. The "invalid input" scenario for this change is:

- **Discovery report files present on disk**: After Section 9 removal, these files should be ignored. TC-BUILD-16 and TC-BUILD-17 verify this by creating discovery report files and confirming their content does NOT appear in the cache.

---

## Maximum-Size Inputs

Not applicable. Section 9 removal eliminates the path where large discovery reports (~22,700 chars combined) were injected. No maximum-size input testing is needed because the code path no longer exists.

---

## Test Data Generation Strategy

All test data is generated inline within each test case using the existing helper functions:

| Helper | Source | Purpose |
|--------|--------|---------|
| `createTestProject()` | Lines 35-39 | Creates minimal temp dir with `.isdlc/` |
| `createFullTestProject()` | Lines 42-111 | Creates complete project with all sections |
| `createSkillFile()` | Lines 113-118 | Creates a SKILL.md with frontmatter |
| `cleanup()` | Lines 120-122 | Removes temp directory |

New tests extend the project setup by adding discovery report files and external skill files as needed. No external test data files or fixtures directories are required.

---

## Data Cleanup

Each test creates its own temp directory and cleans it up in a `finally` block. No shared state exists between tests. No database, network, or external service dependencies.
