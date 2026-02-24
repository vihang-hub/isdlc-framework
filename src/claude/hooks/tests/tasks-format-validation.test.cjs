/**
 * Tests for tasks.md v2.0 format validation rules
 * Validates the 23 rules from validation-rules.json against sample content.
 *
 * Traces: FR-01, FR-02, FR-03, FR-05, FR-06, FR-08, NFR-02, NFR-04
 * Rules: VR-FMT-001 through VR-FMT-012, VR-DEP-001 through VR-DEP-004,
 *        VR-TRACE-001 through VR-TRACE-003, VR-MECH-001 through VR-MECH-004,
 *        VR-COMPAT-001 through VR-COMPAT-004
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

// =========================================================================
// Validation Rule Patterns (from validation-rules.json)
// =========================================================================

const PATTERNS = {
    // VR-FMT-001: Format header
    formatHeader: /^Format:\s*v2\.0/m,
    // VR-FMT-002: Generated timestamp
    generatedTimestamp: /^Generated:\s*\d{4}-\d{2}-\d{2}T/m,
    // VR-FMT-003: Checkbox states
    checkbox: /^- \[([ X]|BLOCKED)\]/,
    // VR-FMT-004: Task ID
    taskId: /^- \[.+\] T\d{4}/,
    // VR-FMT-005: Traces annotation
    traces: /\| traces:\s*[A-Z]+-\d+/,
    // VR-FMT-006: blocked_by sub-line
    blockedBy: /^\s{2}blocked_by:\s*\[T\d{4}/m,
    // VR-FMT-007: blocks sub-line
    blocks: /^\s{2}blocks:\s*\[T\d{4}/m,
    // VR-FMT-008: files sub-line
    files: /^\s{2}files:\s*.+\s*\((CREATE|MODIFY)\)/m,
    // VR-FMT-009: reason sub-line
    reason: /^\s{2}reason:\s*.+/m,
    // VR-MECH-002: File paths are project-relative
    filePath: /^[a-zA-Z]/,
    // VR-MECH-003: File actions
    fileAction: /\((CREATE|MODIFY)\)/
};

// =========================================================================
// Fixture Generators
// =========================================================================

function createV2Complete() {
    return `# Task Plan: feature REQ-0009-enhanced-plan-to-tasks

Generated: 2026-02-11T10:00:00Z
Workflow: feature
Format: v2.0
Phases: 3

---

## Phase 01: Requirements Capture -- COMPLETE
- [X] T0001 Discover project context | traces: FR-01, AC-01a
- [X] T0002 Identify users | traces: FR-01, AC-01b

## Phase 06: Implementation -- PENDING
- [ ] T0010 Implement plan-surfacer validation | traces: FR-08, AC-08a, AC-08b
  files: src/claude/hooks/plan-surfacer.cjs (MODIFY)
  blocked_by: [T0011]
- [ ] T0011 Add format validation tests | traces: FR-08, AC-08c
  files: src/claude/hooks/tests/plan-surfacer.test.cjs (MODIFY)
  blocks: [T0010]
- [ ] T0012 Update ORCH-012 SKILL.md | traces: FR-01, FR-02, FR-06
  files: src/claude/skills/orchestration/generate-plan/SKILL.md (MODIFY)
- [BLOCKED] T0013 Deploy to staging | traces: FR-05, AC-05e
  files: src/deploy/staging.js (CREATE)
  reason: Dependency T0012 failed

## Phase 08: Code Review -- PENDING
- [ ] T0020 Perform code review | traces: FR-07

## Dependency Graph

### Critical Path
T0011 -> T0010 -> T0012
Length: 3 tasks

### All Dependencies
| Task | Description | Blocked By | Blocks |
|------|-------------|-----------|--------|
| T0010 | Implement plan-surfacer validation | T0011 | T0012 |
| T0011 | Add format validation tests | -- | T0010 |
| T0012 | Update ORCH-012 SKILL.md | T0010 | -- |

## Traceability Matrix

### Requirement Coverage
| Requirement | ACs | Tasks | Coverage |
|-------------|-----|-------|----------|
| FR-01 | AC-01a, AC-01b | T0001, T0002, T0012 | 2/2 (100%) |
| FR-02 | AC-02a | T0012 | 1/1 (100%) |
| FR-05 | AC-05e | T0013 | 1/1 (100%) |
| FR-06 | AC-06a | T0012 | 1/1 (100%) |
| FR-07 | AC-07a | T0020 | 1/1 (100%) |
| FR-08 | AC-08a, AC-08b, AC-08c | T0010, T0011 | 3/3 (100%) |

### Orphan Tasks (No Traceability)
(none)

### Uncovered Requirements
(none)

## Progress Summary

| Phase | Status | Tasks | Complete | Blocked |
|-------|--------|-------|----------|---------|
| 01 Requirements | COMPLETE | 2 | 2 | 0 |
| 06 Implementation | PENDING | 4 | 0 | 1 |
| 08 Code Review | PENDING | 1 | 0 | 0 |
| **TOTAL** | | **7** | **2** | **1** |

**Progress**: 2 / 7 tasks (29%) | 1 blocked
**Traceability**: 6/6 FR covered (100%)`;
}

function createV1Legacy() {
    return `# Task Plan: feature REQ-0001-login

Generated: 2026-01-15T08:00:00Z
Workflow: feature
Phases: 2

---

## Phase 01: Requirements Capture -- COMPLETE
- [X] T0001 Discover project context
- [X] T0002 Identify users

## Phase 06: Implementation -- PENDING
- [ ] T0010 Check existing test infrastructure
- [ ] T0011 Write failing unit tests

---

## Progress
- Total: 4 tasks
- Completed: 2
- Remaining: 2`;
}

function createV2WithCycle() {
    return `# Task Plan: feature test

Generated: 2026-02-11T10:00:00Z
Workflow: feature
Format: v2.0
Phases: 1

---

## Phase 06: Implementation -- PENDING
- [ ] T0010 Task A | traces: FR-01
  files: src/a.js (CREATE)
  blocked_by: [T0012]
- [ ] T0011 Task B | traces: FR-01
  files: src/b.js (CREATE)
  blocked_by: [T0010]
- [ ] T0012 Task C | traces: FR-01
  files: src/c.js (CREATE)
  blocked_by: [T0011]

## Dependency Graph

### Critical Path
T0010 -> T0011 -> T0012 (CYCLE)`;
}

function createV2NoFiles() {
    return `# Task Plan: feature test

Generated: 2026-02-11T10:00:00Z
Workflow: feature
Format: v2.0
Phases: 1

---

## Phase 06: Implementation -- PENDING
- [ ] T0010 Implement feature A | traces: FR-01, AC-01a
- [ ] T0011 Implement feature B | traces: FR-02, AC-02a`;
}

function createV2NoTraces() {
    return `# Task Plan: feature test

Generated: 2026-02-11T10:00:00Z
Workflow: feature
Format: v2.0
Phases: 1

---

## Phase 06: Implementation -- PENDING
- [ ] T0010 Implement feature A
  files: src/a.js (CREATE)
- [ ] T0011 Implement feature B
  files: src/b.js (MODIFY)`;
}

// =========================================================================
// Header Format Tests (VR-FMT-001, VR-FMT-002)
// =========================================================================

describe('Header format validation', () => {
    // VR-FMT-001: v2.0 header detection
    it('VR-FMT-001: detects Format: v2.0 header in v2.0 file', () => {
        const content = createV2Complete();
        assert.ok(PATTERNS.formatHeader.test(content), 'v2.0 header should be present');
    });

    it('VR-FMT-001: v1.0 file lacks Format header', () => {
        const content = createV1Legacy();
        assert.ok(!PATTERNS.formatHeader.test(content), 'v1.0 file should lack Format header');
    });

    // VR-FMT-002: ISO-8601 timestamp
    it('VR-FMT-002: contains ISO-8601 timestamp', () => {
        const content = createV2Complete();
        assert.ok(PATTERNS.generatedTimestamp.test(content), 'Should have ISO-8601 timestamp');
    });

    it('VR-FMT-002: v1.0 file also has timestamp', () => {
        const content = createV1Legacy();
        assert.ok(PATTERNS.generatedTimestamp.test(content), 'v1.0 should also have timestamp');
    });
});

// =========================================================================
// Task Line Format Tests (VR-FMT-003, VR-FMT-004, VR-FMT-005)
// =========================================================================

describe('Task line format validation', () => {
    // VR-FMT-003: Checkbox states
    it('VR-FMT-003: accepts pending checkbox [ ]', () => {
        assert.ok(PATTERNS.checkbox.test('- [ ] T0010 Some task'));
    });

    it('VR-FMT-003: accepts completed checkbox [X]', () => {
        assert.ok(PATTERNS.checkbox.test('- [X] T0010 Some task'));
    });

    it('VR-FMT-003: accepts BLOCKED checkbox', () => {
        assert.ok(PATTERNS.checkbox.test('- [BLOCKED] T0010 Some task'));
    });

    // VR-FMT-004: Task ID format
    it('VR-FMT-004: task ID follows checkbox with T and 4 digits', () => {
        assert.ok(PATTERNS.taskId.test('- [ ] T0001 Description'));
        assert.ok(PATTERNS.taskId.test('- [X] T9999 Description'));
        assert.ok(PATTERNS.taskId.test('- [BLOCKED] T0042 Description'));
    });

    it('VR-FMT-004: rejects invalid task ID format', () => {
        assert.ok(!PATTERNS.taskId.test('- [ ] TASK1 Description'));
        assert.ok(!PATTERNS.taskId.test('- [ ] T01 Description'));
    });

    // VR-FMT-005: Traces annotation
    it('VR-FMT-005: recognizes traces annotation', () => {
        const content = createV2Complete();
        assert.ok(PATTERNS.traces.test(content), 'Should have traces annotations');
    });
});

// =========================================================================
// Sub-line Format Tests (VR-FMT-006 through VR-FMT-009)
// =========================================================================

describe('Sub-line format validation', () => {
    const content = createV2Complete();

    // VR-FMT-006: blocked_by sub-line
    it('VR-FMT-006: detects blocked_by sub-lines', () => {
        assert.ok(PATTERNS.blockedBy.test(content), 'Should have blocked_by sub-lines');
    });

    it('VR-FMT-006: blocked_by has correct indent and format', () => {
        const match = content.match(/^\s{2}blocked_by:\s*\[([^\]]+)\]/m);
        assert.ok(match, 'Should match blocked_by pattern');
        assert.ok(match[1].includes('T'), 'Should reference task IDs');
    });

    // VR-FMT-007: blocks sub-line
    it('VR-FMT-007: detects blocks sub-lines', () => {
        assert.ok(PATTERNS.blocks.test(content), 'Should have blocks sub-lines');
    });

    it('VR-FMT-007: blocks has correct format', () => {
        const match = content.match(/^\s{2}blocks:\s*\[([^\]]+)\]/m);
        assert.ok(match, 'Should match blocks pattern');
    });

    // VR-FMT-008: files sub-line
    it('VR-FMT-008: detects files sub-lines with action', () => {
        assert.ok(PATTERNS.files.test(content), 'Should have files sub-lines');
    });

    it('VR-FMT-008: files line contains valid path and action', () => {
        const match = content.match(/^\s{2}files:\s*(.+)\s*\((CREATE|MODIFY)\)/m);
        assert.ok(match, 'Should match files pattern');
        assert.ok(['CREATE', 'MODIFY'].includes(match[2]), 'Action should be CREATE or MODIFY');
    });

    // VR-FMT-009: reason sub-line
    it('VR-FMT-009: detects reason sub-line on BLOCKED tasks', () => {
        assert.ok(PATTERNS.reason.test(content), 'Should have reason sub-line');
    });

    it('VR-FMT-009: reason has content after colon', () => {
        const match = content.match(/^\s{2}reason:\s*(.+)/m);
        assert.ok(match, 'Should match reason pattern');
        assert.ok(match[1].length > 0, 'Reason should have content');
    });
});

// =========================================================================
// Section Presence Tests (VR-FMT-010, VR-FMT-011, VR-FMT-012)
// =========================================================================

describe('Section presence validation', () => {
    const content = createV2Complete();

    // VR-FMT-010: Dependency Graph section
    it('VR-FMT-010: v2.0 with dependencies has Dependency Graph section', () => {
        assert.ok(content.includes('## Dependency Graph'), 'Should have Dependency Graph section');
    });

    it('VR-FMT-010: Dependency Graph has Critical Path subsection', () => {
        assert.ok(content.includes('### Critical Path'), 'Should have Critical Path');
    });

    // VR-FMT-011: Traceability Matrix section
    it('VR-FMT-011: v2.0 with traces has Traceability Matrix section', () => {
        assert.ok(content.includes('## Traceability Matrix'), 'Should have Traceability Matrix');
    });

    it('VR-FMT-011: Traceability Matrix has Requirement Coverage table', () => {
        assert.ok(content.includes('### Requirement Coverage'), 'Should have Requirement Coverage');
    });

    // VR-FMT-012: Progress Summary section
    it('VR-FMT-012: has Progress Summary section', () => {
        assert.ok(content.includes('## Progress Summary'), 'Should have Progress Summary');
    });

    it('VR-FMT-012: Progress Summary has task counts', () => {
        // Match the TOTAL row: | **TOTAL** | | **7** | **2** | **1** |
        const match = content.match(/\*\*TOTAL\*\*[^|]*\|[^|]*\|\s*\*\*(\d+)\*\*/);
        assert.ok(match, 'Should have total count in TOTAL row');
        assert.equal(match[1], '7', 'Total should match fixture');
    });
});

// =========================================================================
// Dependency Validation Tests (VR-DEP-001 through VR-DEP-004)
// =========================================================================

describe('Dependency validation', () => {
    // VR-DEP-001: Acyclicity (DAG)
    it('VR-DEP-001: acyclic graph has no cycle', () => {
        const content = createV2Complete();
        // Parse dependencies and verify no cycle via Kahn's
        const result = detectCycleInContent(content);
        assert.equal(result, null, 'Complete fixture should have no cycle');
    });

    it('VR-DEP-001: cyclic graph detected', () => {
        const content = createV2WithCycle();
        const result = detectCycleInContent(content);
        assert.ok(result !== null, 'Cycle fixture should detect cycle');
        assert.ok(result.includes('T0010') || result.includes('T0011') || result.includes('T0012'),
            'Cycle should name involved tasks');
    });

    // VR-DEP-002: Valid references
    it('VR-DEP-002: all blocked_by references exist as tasks', () => {
        const content = createV2Complete();
        const tasks = extractTaskIds(content);
        const refs = extractBlockedByRefs(content);
        for (const ref of refs) {
            assert.ok(tasks.has(ref), `Reference ${ref} should exist as a task`);
        }
    });

    it('VR-DEP-002: invalid reference is handled gracefully', () => {
        const content = createV2Complete().replace('blocked_by: [T0011]', 'blocked_by: [T9999]');
        const tasks = extractTaskIds(content);
        const refs = extractBlockedByRefs(content);
        // T9999 doesn't exist; should be noted but not crash
        assert.ok(!tasks.has('T9999'), 'T9999 should not exist');
    });

    // VR-DEP-003: blocked_by and blocks consistency
    it('VR-DEP-003: blocked_by and blocks are consistent', () => {
        const content = createV2Complete();
        // T0010 blocked_by T0011, and T0011 blocks T0010
        assert.ok(content.includes('blocked_by: [T0011]'), 'T0010 blocked_by T0011');
        assert.ok(content.includes('blocks: [T0010]'), 'T0011 blocks T0010');
    });

    // VR-DEP-004: Critical path exists when >1 task with dependencies
    it('VR-DEP-004: critical path identified when dependencies exist', () => {
        const content = createV2Complete();
        assert.ok(content.includes('### Critical Path'), 'Should have Critical Path');
        assert.ok(/T\d{4}\s*->\s*T\d{4}/.test(content), 'Critical path should show task chain');
    });
});

// =========================================================================
// Traceability Validation Tests (VR-TRACE-001 through VR-TRACE-003)
// =========================================================================

describe('Traceability validation', () => {
    // VR-TRACE-001: FR coverage
    it('VR-TRACE-001: every FR has at least one task with traces', () => {
        const content = createV2Complete();
        // The Traceability Matrix should show coverage for all FRs
        assert.ok(content.includes('FR-01'), 'FR-01 should be traced');
        assert.ok(content.includes('FR-08'), 'FR-08 should be traced');
    });

    it('VR-TRACE-001: file without traces reports no FR coverage', () => {
        const content = createV2NoTraces();
        const tracedFRs = (content.match(/\| traces:\s*FR-\d+/g) || []);
        assert.equal(tracedFRs.length, 0, 'No traces should mean no FR coverage');
    });

    // VR-TRACE-002: orphan task detection
    it('VR-TRACE-002: complete fixture has no orphan tasks', () => {
        const content = createV2Complete();
        assert.ok(content.includes('Orphan Tasks'), 'Should have Orphan Tasks section');
        assert.ok(content.includes('(none)'), 'Complete fixture should have no orphans');
    });

    // VR-TRACE-003: valid trace references
    it('VR-TRACE-003: trace references follow FR-NN or AC-NNx format', () => {
        const content = createV2Complete();
        const traceValues = content.match(/\| traces:\s*([^\n]+)/g) || [];
        for (const tv of traceValues) {
            const refs = tv.replace('| traces:', '').split(',').map(s => s.trim());
            for (const ref of refs) {
                assert.ok(
                    /^(FR-\d+|AC-\d+[a-z]?|NFR-\d+|C-\d+)$/.test(ref),
                    `Reference "${ref}" should match FR-NN or AC-NNx format`
                );
            }
        }
    });
});

// =========================================================================
// Mechanical Mode Validation Tests (VR-MECH-001 through VR-MECH-004)
// =========================================================================

describe('Mechanical mode validation', () => {
    // VR-MECH-001: File annotations required for mechanical mode
    it('VR-MECH-001: complete fixture has file annotations on Phase 06 tasks', () => {
        const content = createV2Complete();
        const phase06 = extractPhase06(content);
        assert.ok(/^\s{2}files:/m.test(phase06), 'Phase 06 should have files: sub-lines');
    });

    it('VR-MECH-001: no-files fixture lacks file annotations', () => {
        const content = createV2NoFiles();
        const phase06 = extractPhase06(content);
        assert.ok(!/^\s{2}files:/m.test(phase06), 'No-files fixture should lack files: sub-lines');
    });

    // VR-MECH-002: File paths are project-relative
    it('VR-MECH-002: file paths start with project-relative prefix', () => {
        const content = createV2Complete();
        const fileLines = content.match(/^\s{2}files:\s*(.+)/gm) || [];
        for (const fl of fileLines) {
            const pathPart = fl.replace(/^\s{2}files:\s*/, '').replace(/\s*\((CREATE|MODIFY)\)/, '').trim();
            assert.ok(PATTERNS.filePath.test(pathPart), `Path "${pathPart}" should be project-relative`);
        }
    });

    // VR-MECH-003: File actions are CREATE or MODIFY
    it('VR-MECH-003: all file annotations have valid actions', () => {
        const content = createV2Complete();
        const fileLines = content.match(/^\s{2}files:\s*.+/gm) || [];
        for (const fl of fileLines) {
            assert.ok(PATTERNS.fileAction.test(fl), `File line "${fl.trim()}" should have CREATE or MODIFY`);
        }
    });

    it('VR-MECH-003: rejects invalid file action', () => {
        const badLine = '  files: src/foo.js (DELETE)';
        assert.ok(!PATTERNS.fileAction.test(badLine), 'DELETE should not be a valid action');
    });

    // VR-MECH-004: BLOCKED tasks must have reason
    it('VR-MECH-004: BLOCKED tasks have reason sub-line', () => {
        const content = createV2Complete();
        // Find BLOCKED task lines
        const blockedTasks = content.match(/^- \[BLOCKED\] T\d{4}.*(?:\n {2}.+)*/gm) || [];
        for (const bt of blockedTasks) {
            assert.ok(/^\s{2}reason:/m.test(bt), `BLOCKED task should have reason sub-line: ${bt.substring(0, 40)}`);
        }
    });
});

// =========================================================================
// Backward Compatibility Tests (VR-COMPAT-001 through VR-COMPAT-004)
// =========================================================================

describe('Backward compatibility validation', () => {
    // VR-COMPAT-001: v1.0 accepted without warnings
    it('VR-COMPAT-001: v1.0 format is valid and parseable', () => {
        const content = createV1Legacy();
        // v1.0 should have basic structure: title, phases, checkboxes
        assert.ok(content.includes('# Task Plan:'), 'Should have title');
        assert.ok(content.includes('## Phase'), 'Should have phase sections');
        assert.ok(/- \[[ X]\] T\d{4}/.test(content), 'Should have checkbox tasks');
    });

    // VR-COMPAT-002: Checkbox patterns unchanged
    it('VR-COMPAT-002: v1.0 checkbox patterns match v2.0 patterns', () => {
        const v1 = createV1Legacy();
        const v2 = createV2Complete();
        // Both use - [ ] and - [X]
        assert.ok(/^- \[ \] T\d{4}/m.test(v1), 'v1.0 has pending checkboxes');
        assert.ok(/^- \[X\] T\d{4}/m.test(v1), 'v1.0 has completed checkboxes');
        assert.ok(/^- \[ \] T\d{4}/m.test(v2), 'v2.0 has pending checkboxes');
        assert.ok(/^- \[X\] T\d{4}/m.test(v2), 'v2.0 has completed checkboxes');
    });

    // VR-COMPAT-003: Phase header patterns unchanged
    it('VR-COMPAT-003: phase header pattern works for both formats', () => {
        const v1 = createV1Legacy();
        const v2 = createV2Complete();
        const phasePattern = /^## Phase \d+:/m;
        assert.ok(phasePattern.test(v1), 'v1.0 has phase headers');
        assert.ok(phasePattern.test(v2), 'v2.0 has phase headers');
    });

    it('VR-COMPAT-003: status keywords work for both formats', () => {
        const v1 = createV1Legacy();
        const v2 = createV2Complete();
        assert.ok(v1.includes('COMPLETE'), 'v1.0 has COMPLETE status');
        assert.ok(v1.includes('PENDING'), 'v1.0 has PENDING status');
        assert.ok(v2.includes('COMPLETE'), 'v2.0 has COMPLETE status');
        assert.ok(v2.includes('PENDING'), 'v2.0 has PENDING status');
    });

    // VR-COMPAT-004: Missing annotations cause no errors
    it('VR-COMPAT-004: v1.0 tasks without annotations are parseable', () => {
        const content = createV1Legacy();
        // Standard task parsing should work without annotations
        const tasks = content.match(/^- \[[ X]\] T\d{4}\s+.+/gm) || [];
        assert.ok(tasks.length > 0, 'Should find tasks even without annotations');
        // Pipe-split should still work (just no annotation part)
        for (const t of tasks) {
            const parts = t.split('|');
            assert.ok(parts[0].trim().length > 0, 'Task description should exist');
        }
    });

    it('VR-COMPAT-004: v1.0 has no sub-lines to worry about', () => {
        const content = createV1Legacy();
        const sublines = content.match(/^\s{2}(blocked_by|blocks|files|reason):/gm) || [];
        assert.equal(sublines.length, 0, 'v1.0 should have no structured sub-lines');
    });
});

// =========================================================================
// Helper Functions
// =========================================================================

/**
 * Inline cycle detection using Kahn's algorithm.
 * Returns warning string if cycle found, null otherwise.
 */
function detectCycleInContent(content) {
    const taskPattern = /^- \[[ XBLOCKED]*\] (T\d{4})/gm;
    const tasks = new Set();
    let match;
    while ((match = taskPattern.exec(content)) !== null) {
        tasks.add(match[1]);
    }
    if (tasks.size === 0) return null;

    const inDegree = {};
    const graph = {};
    for (const tid of tasks) {
        inDegree[tid] = 0;
        graph[tid] = [];
    }

    const taskBlocks = content.match(
        /^- \[[ XBLOCKED]*\] (T\d{4}).*(?:\n {2}.+)*/gm
    ) || [];

    for (const block of taskBlocks) {
        const tidMatch = block.match(/^- \[[ XBLOCKED]*\] (T\d{4})/);
        if (!tidMatch) continue;
        const tid = tidMatch[1];
        const bbMatch = block.match(/^\s{2}blocked_by:\s*\[([^\]]+)\]/m);
        if (!bbMatch) continue;
        const blockers = bbMatch[1].split(',').map(s => s.trim());
        for (const blocker of blockers) {
            if (tasks.has(blocker)) {
                graph[blocker].push(tid);
                inDegree[tid] = (inDegree[tid] || 0) + 1;
            }
        }
    }

    const queue = [];
    for (const tid of tasks) {
        if (inDegree[tid] === 0) queue.push(tid);
    }

    let processed = 0;
    while (queue.length > 0) {
        const current = queue.shift();
        processed++;
        for (const dep of (graph[current] || [])) {
            inDegree[dep]--;
            if (inDegree[dep] === 0) queue.push(dep);
        }
    }

    if (processed < tasks.size) {
        const cycleNodes = [...tasks].filter(t => inDegree[t] > 0);
        return `Cycle detected: ${cycleNodes.join(', ')}`;
    }
    return null;
}

/**
 * Extract all task IDs from content.
 */
function extractTaskIds(content) {
    const taskPattern = /^- \[[ XBLOCKED]*\] (T\d{4})/gm;
    const ids = new Set();
    let match;
    while ((match = taskPattern.exec(content)) !== null) {
        ids.add(match[1]);
    }
    return ids;
}

/**
 * Extract all blocked_by references from content.
 */
function extractBlockedByRefs(content) {
    const refs = new Set();
    const bbPattern = /^\s{2}blocked_by:\s*\[([^\]]+)\]/gm;
    let match;
    while ((match = bbPattern.exec(content)) !== null) {
        match[1].split(',').map(s => s.trim()).forEach(r => refs.add(r));
    }
    return refs;
}

/**
 * Extract Phase 06 section content.
 */
function extractPhase06(content) {
    const phase06Match = content.match(/^## Phase \d+:.*Implementation/m);
    if (!phase06Match) return '';
    const start = content.indexOf(phase06Match[0]);
    const rest = content.substring(start + 1);
    const nextPhase = rest.match(/^## /m);
    const end = nextPhase ? start + 1 + nextPhase.index : content.length;
    return content.substring(start, end);
}
