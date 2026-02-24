# Test Data Plan: BUG-0019-GH-1

## Overview

This document defines the test data requirements and generation strategy for the blast-radius STEP 3f tests. All fixtures follow the existing pattern in `test-blast-radius-validator.test.cjs` -- string constants defined at the top of the test file.

---

## 1. Block Message Fixtures

Generated using the existing `formatBlockMessage()` function from `blast-radius-validator.cjs` to guarantee format consistency.

### BLOCK_MSG_SINGLE_FILE

```javascript
const BLOCK_MSG_SINGLE_FILE = formatBlockMessage({
    total: 3,
    covered: [{ filePath: 'src/a.cjs' }, { filePath: 'src/b.cjs' }],
    deferred: [],
    unaddressed: [{ filePath: 'src/hooks/missing.cjs', changeType: 'MODIFY' }]
});
```

**Used by**: TC-PARSE-01

### BLOCK_MSG_MULTI_FILE

```javascript
const BLOCK_MSG_MULTI_FILE = formatBlockMessage({
    total: 5,
    covered: [{ filePath: 'src/a.cjs' }, { filePath: 'src/b.cjs' }],
    deferred: [],
    unaddressed: [
        { filePath: 'src/hooks/a.cjs', changeType: 'MODIFY' },
        { filePath: 'src/agents/b.md', changeType: 'CREATE' },
        { filePath: 'src/commands/c.md', changeType: 'DELETE' }
    ]
});
```

**Used by**: TC-PARSE-02, TC-PARSE-03, TC-INT-01, TC-INT-02, TC-INT-03, TC-INT-04

### BLOCK_MSG_WITH_DEFERRALS

```javascript
const BLOCK_MSG_WITH_DEFERRALS = formatBlockMessage({
    total: 5,
    covered: [{ filePath: 'src/a.cjs' }],
    deferred: [{ filePath: 'src/d.cjs', notes: 'Deferred: reason' }],
    unaddressed: [
        { filePath: 'src/hooks/x.cjs', changeType: 'MODIFY' },
        { filePath: 'src/agents/y.md', changeType: 'CREATE' },
        { filePath: 'src/commands/z.md', changeType: 'MODIFY' }
    ]
});
```

**Used by**: TC-INT-07, TC-INT-08

### NON_BLAST_RADIUS_BLOCK

```javascript
const NON_BLAST_RADIUS_BLOCK = 'GATE BLOCKED: Phase 06 gate check failed. ' +
    'Required artifacts missing: test-strategy.md, traceability-matrix.csv';
```

**Used by**: TC-PARSE-05, TC-INT-09

---

## 2. tasks.md Fixtures

### TASKS_MD_MATCHING

```javascript
const TASKS_MD_MATCHING = `## Tasks

- [ ] T0004a -- Phase 06: Implementation -- Modify src/hooks/a.cjs for blast radius parsing
  files: src/hooks/a.cjs
- [ ] T0004b -- Phase 06: Implementation -- Create src/agents/b.md agent definition
  files: src/agents/b.md
- [ ] T0004c -- Phase 06: Implementation -- Update src/commands/c.md for new STEP
  files: src/commands/c.md
- [X] T0004d -- Phase 06: Implementation -- Update README.md
  files: README.md
`;
```

**Used by**: TC-TASK-01, TC-TASK-02, TC-INT-01, TC-INT-02, TC-INT-03

### TASKS_MD_PARTIAL_MATCH

```javascript
const TASKS_MD_PARTIAL_MATCH = `## Tasks

- [ ] T0004a -- Phase 06: Implementation -- Modify src/hooks/a.cjs for blast radius parsing
  files: src/hooks/a.cjs
- [ ] T0004b -- Phase 06: Implementation -- General cleanup tasks
`;
```

**Used by**: TC-TASK-03 (second file has no matching task)

### TASKS_MD_COMPLETED_DISCREPANCY

```javascript
const TASKS_MD_COMPLETED_DISCREPANCY = `## Tasks

- [X] T0004a -- Phase 06: Implementation -- Modify src/hooks/a.cjs for blast radius parsing
  files: src/hooks/a.cjs
`;
```

**Used by**: TC-TASK-04

### TASKS_MD_EMPTY

```javascript
const TASKS_MD_EMPTY = '';
```

**Used by**: TC-TASK-06

---

## 3. requirements-spec.md Fixtures

### REQ_SPEC_WITH_DEFERRALS

```javascript
const REQ_SPEC_WITH_DEFERRALS = `# Requirements Specification

## Functional Requirements

### FR-01: Some feature
...

## Deferred Files

| File | Justification |
|------|---------------|
| \`src/agents/b.md\` | Not needed for MVP; will address in REQ-0012 |
| \`src/commands/z.md\` | Blocked by upstream dependency |
`;
```

**Used by**: TC-DEF-01, TC-INT-07, TC-INT-10

### REQ_SPEC_NO_DEFERRALS

```javascript
const REQ_SPEC_NO_DEFERRALS = `# Requirements Specification

## Functional Requirements

### FR-01: Some feature
...

## Out of Scope

- UI changes
`;
```

**Used by**: TC-DEF-02, TC-DEF-03, TC-INT-08

### REQ_SPEC_MALFORMED_DEFERRALS

```javascript
const REQ_SPEC_MALFORMED_DEFERRALS = `# Requirements Specification

## Deferred Files

This section has text but no table format.
Some files might be listed but not in a parseable table.
`;
```

**Used by**: TC-DEF-04

---

## 4. state.json Fixtures

### STATE_FEATURE_PHASE06

```javascript
function featurePhase06State(overrides = {}) {
    return {
        active_workflow: {
            type: 'feature',
            id: 'REQ-0010',
            current_phase: '06-implementation',
            artifact_folder: 'REQ-0010-test-feature',
            ...overrides
        },
        blast_radius_retries: 0,
        blast_radius_retry_log: [],
        ...overrides
    };
}
```

**Used by**: TC-RETRY-01, TC-RETRY-02, TC-INT-01, TC-INT-05

### STATE_RETRIES_AT_LIMIT

```javascript
function stateRetriesAtLimit() {
    return featurePhase06State({
        blast_radius_retries: 3,
        blast_radius_retry_log: [
            { iteration: 1, unaddressed_count: 5, matched_tasks: 3, timestamp: '2026-02-16T10:00:00Z' },
            { iteration: 2, unaddressed_count: 3, matched_tasks: 2, timestamp: '2026-02-16T10:05:00Z' },
            { iteration: 3, unaddressed_count: 2, matched_tasks: 1, timestamp: '2026-02-16T10:10:00Z' }
        ]
    });
}
```

**Used by**: TC-RETRY-03, TC-INT-06

---

## 5. Markdown Content Fixtures (Post-Implementation)

These fixtures represent the expected post-implementation content of `isdlc.md` STEP 3f. They are used by markdown validation tests to verify that the implementation added the required instruction patterns.

**Generation approach**: The markdown validation tests read the *actual* source files after implementation. No fixture is needed -- the tests scan `src/claude/commands/isdlc.md` and `src/claude/agents/00-sdlc-orchestrator.md` directly.

**Search patterns used by markdown tests**:

| Test ID | Pattern to Match |
|---------|-----------------|
| TC-MD-01 | `/blast.radius.validator/i` in STEP 3f section |
| TC-MD-02 | `/unaddressed.*(file|path)/i` in blast-radius branch |
| TC-MD-03 | `/tasks\.md/i` in blast-radius branch |
| TC-MD-04 | `/re.?delegat.*implementation/i` or `/Phase.06/i` in blast-radius branch |
| TC-MD-05 | `/max.*3/i` or `/3.*retr/i` in blast-radius branch |
| TC-MD-06 | `/escalat/i` in blast-radius branch |
| TC-MD-07 | `/MUST NOT.*modify.*impact.analysis/i` in blast-radius branch |
| TC-MD-08 | `/requirements.spec.*defer/i` or `/Deferred Files/i` in blast-radius branch |
| TC-MD-09 | `/Retry.*Skip.*Cancel/i` still present outside blast-radius branch |
| TC-MD-10 | `/blast.radius/i` in orchestrator file |
| TC-MD-11 | `/impact.analysis.*read.only/i` or `/immutable/i` in orchestrator file |

---

## 6. Data Generation Strategy

All test data is defined as **inline constants** within the test file, following the established pattern in `test-blast-radius-validator.test.cjs`. No external fixture files or data generation scripts are needed.

**Rationale**:
- The existing blast-radius-validator tests use this same pattern (see lines 48-161 of the existing test file)
- Inline constants are self-contained, making tests readable and maintainable
- Block message fixtures use the actual `formatBlockMessage()` function to guarantee format consistency
- State fixtures use factory functions with override support (matching existing `featureWorkflowState()` pattern)
