---
name: atdd-checklist
description: Manage docs/isdlc/atdd-checklist.json for tracking RED→GREEN test transitions
skill_id: TEST-016
owner: test-design-engineer
collaborators: [software-developer, integration-tester]
project: sdlc-framework
version: 1.0.0
when_to_use: ATDD mode - when tracking acceptance test implementation progress
dependencies: [TEST-014]
---

# ATDD Checklist Management

## Purpose
Create and maintain the ATDD checklist that tracks acceptance test implementation progress, RED→GREEN transitions, and priority-based coverage metrics.

## When to Use
- ATDD mode is active
- After scenario mapping to initialize checklist (Phase 04)
- During implementation to update test status (Phase 05)
- At gate validation to verify completion (Phase 06)

## Prerequisites
- Acceptance criteria mapped to test scenarios
- Tests have priority assignments (P0-P3)
- Test file locations known

## Checklist Schema

### Full Schema Definition

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "version": { "type": "string" },
    "created_at": { "type": "string", "format": "date-time" },
    "updated_at": { "type": "string", "format": "date-time" },
    "requirement_id": { "type": "string" },
    "requirement_name": { "type": "string" },
    "workflow_type": { "type": "string", "enum": ["feature", "fix"] },
    "acceptance_criteria": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "ac_id": { "type": "string" },
          "description": { "type": "string" },
          "given_when_then": {
            "type": "object",
            "properties": {
              "given": { "type": "string" },
              "when": { "type": "string" },
              "then": {
                "oneOf": [
                  { "type": "string" },
                  { "type": "array", "items": { "type": "string" } }
                ]
              }
            }
          },
          "priority": { "type": "string", "enum": ["P0", "P1", "P2", "P3"] },
          "test_file": { "type": "string" },
          "test_name": { "type": "string" },
          "status": { "type": "string", "enum": ["skip", "red", "pass"] },
          "implemented": { "type": "boolean" },
          "red_at": { "type": ["string", "null"], "format": "date-time" },
          "green_at": { "type": ["string", "null"], "format": "date-time" },
          "iterations_to_green": { "type": ["integer", "null"] }
        },
        "required": ["ac_id", "description", "priority", "test_file", "test_name", "status"]
      }
    },
    "coverage_summary": {
      "type": "object",
      "properties": {
        "total_ac": { "type": "integer" },
        "tests_generated": { "type": "integer" },
        "tests_skipped": { "type": "integer" },
        "tests_red": { "type": "integer" },
        "tests_passing": { "type": "integer" },
        "by_priority": {
          "type": "object",
          "properties": {
            "P0": { "$ref": "#/definitions/priorityStats" },
            "P1": { "$ref": "#/definitions/priorityStats" },
            "P2": { "$ref": "#/definitions/priorityStats" },
            "P3": { "$ref": "#/definitions/priorityStats" }
          }
        }
      }
    }
  },
  "definitions": {
    "priorityStats": {
      "type": "object",
      "properties": {
        "total": { "type": "integer" },
        "passing": { "type": "integer" }
      }
    }
  }
}
```

## Process

### Step 1: Initialize Checklist (Phase 04)

Create `docs/isdlc/atdd-checklist.json` after scenario mapping:

```json
{
  "version": "1.0.0",
  "created_at": "2026-02-02T10:00:00Z",
  "updated_at": "2026-02-02T10:00:00Z",
  "requirement_id": "REQ-0042",
  "requirement_name": "User Authentication",
  "workflow_type": "feature",
  "acceptance_criteria": [
    {
      "ac_id": "AC1",
      "description": "Successful login redirects to dashboard",
      "given_when_then": {
        "given": "a registered user with valid credentials",
        "when": "they submit the login form with correct email and password",
        "then": ["they are redirected to the dashboard", "a session token is created"]
      },
      "priority": "P0",
      "test_file": "tests/acceptance/auth.test.ts",
      "test_name": "[P0] AC1: should redirect to dashboard on successful login",
      "status": "skip",
      "implemented": false,
      "red_at": null,
      "green_at": null,
      "iterations_to_green": null
    }
  ],
  "coverage_summary": {
    "total_ac": 5,
    "tests_generated": 5,
    "tests_skipped": 5,
    "tests_red": 0,
    "tests_passing": 0,
    "by_priority": {
      "P0": { "total": 2, "passing": 0 },
      "P1": { "total": 2, "passing": 0 },
      "P2": { "total": 1, "passing": 0 },
      "P3": { "total": 0, "passing": 0 }
    }
  }
}
```

### Step 2: Update on RED (Phase 05)

When a test is unskipped and fails (RED phase):

```javascript
// Update checklist entry
function markTestAsRed(acId) {
  const checklist = readChecklist();
  const ac = checklist.acceptance_criteria.find(a => a.ac_id === acId);

  ac.status = 'red';
  ac.red_at = new Date().toISOString();
  ac.implemented = false;

  // Update summary
  checklist.coverage_summary.tests_skipped--;
  checklist.coverage_summary.tests_red++;
  checklist.updated_at = new Date().toISOString();

  writeChecklist(checklist);
}
```

### Step 3: Update on GREEN (Phase 05)

When a test passes (GREEN phase):

```javascript
function markTestAsGreen(acId, iterations) {
  const checklist = readChecklist();
  const ac = checklist.acceptance_criteria.find(a => a.ac_id === acId);

  ac.status = 'pass';
  ac.green_at = new Date().toISOString();
  ac.implemented = true;
  ac.iterations_to_green = iterations;

  // Update summary
  checklist.coverage_summary.tests_red--;
  checklist.coverage_summary.tests_passing++;

  // Update priority stats
  const priority = ac.priority;
  checklist.coverage_summary.by_priority[priority].passing++;

  checklist.updated_at = new Date().toISOString();

  writeChecklist(checklist);
}
```

### Step 4: Validate Checklist (Phase 06)

```javascript
function validateATDDCompletion() {
  const checklist = readChecklist();
  const errors = [];

  // Check for orphan skips
  const skipped = checklist.acceptance_criteria.filter(ac => ac.status === 'skip');
  if (skipped.length > 0) {
    errors.push(`${skipped.length} tests still skipped: ${skipped.map(s => s.ac_id).join(', ')}`);
  }

  // Check all priorities at 100%
  for (const [priority, stats] of Object.entries(checklist.coverage_summary.by_priority)) {
    if (stats.total > 0 && stats.passing < stats.total) {
      errors.push(`${priority}: ${stats.passing}/${stats.total} passing (${Math.round(stats.passing/stats.total*100)}%)`);
    }
  }

  // Verify sync with actual test results
  // (Run tests and compare with checklist status)

  return {
    valid: errors.length === 0,
    errors,
    summary: checklist.coverage_summary
  };
}
```

## Checklist Operations

### Read Checklist
```javascript
function readChecklist() {
  const path = 'docs/isdlc/atdd-checklist.json';
  if (!fs.existsSync(path)) {
    throw new Error('ATDD checklist not found - run Phase 04 first');
  }
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}
```

### Write Checklist
```javascript
function writeChecklist(checklist) {
  checklist.updated_at = new Date().toISOString();
  fs.writeFileSync('docs/isdlc/atdd-checklist.json', JSON.stringify(checklist, null, 2));
}
```

### Get Progress Report
```javascript
function getProgressReport() {
  const checklist = readChecklist();
  const { coverage_summary: cs } = checklist;

  return {
    overall: {
      total: cs.total_ac,
      passing: cs.tests_passing,
      percent: Math.round(cs.tests_passing / cs.total_ac * 100)
    },
    byPriority: Object.entries(cs.by_priority).map(([p, s]) => ({
      priority: p,
      total: s.total,
      passing: s.passing,
      percent: s.total > 0 ? Math.round(s.passing / s.total * 100) : 100
    })),
    currentPhase: cs.tests_skipped > 0 ? 'Phase 04 (scaffolding)' :
                  cs.tests_red > 0 ? 'Phase 05 (RED→GREEN)' : 'Phase 06 (validation)'
  };
}
```

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| scenario_mapping | JSON | Yes | Output from TEST-014 |
| test_results | JSON | When updating | Test execution results |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| docs/isdlc/atdd-checklist.json | JSON | Master checklist file |
| progress_report | Object | Current completion status |
| validation_result | Object | Gate validation result |

## State Transitions

```
SKIP ──┬── (unskip) ──→ RED ──┬── (implement) ──→ PASS
       │                      │
       │                      └── (still failing) ──→ RED (retry)
       │
       └── (never unskipped) ──→ ORPHAN SKIP (gate blocked)
```

## Validation

Before passing GATE-04:
- [ ] Checklist created with all ACs
- [ ] All entries have status "skip"
- [ ] All entries have priorities assigned
- [ ] Coverage summary is accurate

Before passing GATE-05:
- [ ] All "skip" → "red" → "pass" transitions recorded
- [ ] All priorities complete (passing === total)
- [ ] No entries remain in "skip" status

Before passing GATE-06:
- [ ] Checklist matches actual test results
- [ ] No orphan skips detected in test files
- [ ] 100% AC coverage verified

## Integration Points

- **Scenario Mapping (TEST-014)**: Provides initial checklist data
- **Priority Tagging (TEST-017)**: Provides priority assignments
- **Software Developer (05)**: Updates during RED→GREEN
- **Integration Tester (06)**: Validates at gate
- **test-watcher.js hook**: Auto-detects orphan skips
