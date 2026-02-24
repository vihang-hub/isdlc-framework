# Test Cases: Plan-Surfacer Hook Enhancement (TC-PS-11 through TC-PS-17)

**Component**: `src/claude/hooks/plan-surfacer.cjs`
**Test File**: `src/claude/hooks/tests/plan-surfacer.test.cjs`
**Traces**: FR-08 (AC-08a, AC-08b, AC-08c), NFR-02
**Method**: CJS hook tests using existing `setupTestEnv()`/`writeState()`/`runHook()` pattern

---

## Existing Tests (Unchanged -- Regression Baseline)

| Test ID | Description | Status |
|---------|-------------|--------|
| TC-PS-01 | Blocks when impl phase and no tasks.md | PRESERVE |
| TC-PS-02 | Allows when impl phase and tasks.md exists | PRESERVE |
| TC-PS-03 | Allows early phase (01-requirements) | PRESERVE |
| TC-PS-04 | Allows early phase (04-design) | PRESERVE |
| TC-PS-05 | Allows non-Task tool calls | PRESERVE |
| TC-PS-06 | Allows when no active_workflow | PRESERVE |
| TC-PS-07 | Fail-open on missing state.json | PRESERVE |
| TC-PS-08 | Fail-open on empty stdin | PRESERVE |
| TC-PS-09 | Fail-open on invalid JSON | PRESERVE |
| TC-PS-10 | Block message includes phase name and path | PRESERVE |

---

## New Test Cases

### TC-PS-11: v2.0 format with file-level tasks -- no warnings

**Traces**: AC-08b
**Priority**: P0 (core validation path)
**Preconditions**: tasks.md exists with `Format: v2.0` header, Phase 06 section has `files:` sub-lines and `| traces:` annotations
**Input**:
- State: `{ active_workflow: { current_phase: '06-implementation' } }`
- tasks.md: v2.0 complete format with `Format: v2.0` header, Phase 06 tasks with `files:` and `| traces:` annotations
- Tool: `{ tool_name: 'Task', tool_input: { ... } }`

**Steps**:
1. Setup temp directory with `setupTestEnv()`
2. Write state with implementation phase
3. Create v2.0 tasks.md with all annotations present
4. Run hook with Task tool input

**Expected**:
- Exit code: 0
- stdout: empty (no block)
- stderr: empty (no warnings)
- Decision: allow

**Assertions**:
```javascript
assert.equal(result.exitCode, 0);
assert.equal(result.stdout, '');
// No stderr warnings when all annotations present
```

---

### TC-PS-12: v2.0 format without file-level tasks -- warning

**Traces**: AC-08b, AC-08c
**Priority**: P0 (warning behavior)
**Preconditions**: tasks.md exists with `Format: v2.0` header, Phase 06 section has tasks but NO `files:` sub-lines
**Input**:
- State: `{ active_workflow: { current_phase: '06-implementation' } }`
- tasks.md: v2.0 format, Phase 06 tasks without `files:` sub-lines
- Tool: `{ tool_name: 'Task' }`

**Steps**:
1. Setup temp directory
2. Write state with implementation phase
3. Create v2.0 tasks.md WITHOUT `files:` sub-lines in Phase 06
4. Run hook

**Expected**:
- Exit code: 0
- stdout: empty (no block -- allow)
- stderr: contains warning about missing file-level annotations
- Decision: allow (NEVER block on format issues per AC-08c)

**Assertions**:
```javascript
assert.equal(result.exitCode, 0);
assert.equal(result.stdout, '');  // Not blocked
// stderr should contain format warning (captured from hook stderr)
```

---

### TC-PS-13: v2.0 format without traceability -- warning

**Traces**: AC-08b, AC-08c
**Priority**: P1 (secondary validation)
**Preconditions**: tasks.md exists with `Format: v2.0`, Phase 06 tasks have NO `| traces:` annotations
**Input**:
- State: `{ active_workflow: { current_phase: '06-implementation' } }`
- tasks.md: v2.0 format with `files:` but no `| traces:` annotations
- Tool: `{ tool_name: 'Task' }`

**Steps**:
1. Setup temp directory
2. Write state with implementation phase
3. Create v2.0 tasks.md with `files:` sub-lines but NO `| traces:` annotations
4. Run hook

**Expected**:
- Exit code: 0
- stdout: empty (no block)
- stderr: contains warning about missing traceability annotations
- Decision: allow

**Assertions**:
```javascript
assert.equal(result.exitCode, 0);
assert.equal(result.stdout, '');  // Not blocked
```

---

### TC-PS-14: v1.0 format (no Format header) -- no validation

**Traces**: AC-08a, NFR-02
**Priority**: P0 (backward compatibility critical)
**Preconditions**: tasks.md exists WITHOUT `Format: v2.0` header (legacy v1.0 format)
**Input**:
- State: `{ active_workflow: { current_phase: '06-implementation' } }`
- tasks.md: Legacy v1.0 format (plain checkboxes, no annotations, no Format header)
- Tool: `{ tool_name: 'Task' }`

**Steps**:
1. Setup temp directory
2. Write state with implementation phase
3. Create LEGACY tasks.md (reuse existing `createTasksPlan()` helper) -- no `Format: v2.0` line
4. Run hook

**Expected**:
- Exit code: 0
- stdout: empty (no block)
- stderr: empty (NO warnings -- validation completely skipped for v1.0)
- Decision: allow

**Assertions**:
```javascript
assert.equal(result.exitCode, 0);
assert.equal(result.stdout, '');
// Critical: NO stderr output -- v1.0 files must not trigger any validation
```

**Rationale**: This is the most critical backward compatibility test. The existing `createTasksPlan()` helper writes a minimal v1.0 tasks.md. After the hook enhancement, this MUST continue to produce zero warnings.

---

### TC-PS-15: Dependency cycle detected -- warning

**Traces**: AC-08c
**Priority**: P1 (cycle detection)
**Preconditions**: tasks.md with `Format: v2.0`, Phase 06 tasks with circular `blocked_by` references
**Input**:
- State: `{ active_workflow: { current_phase: '06-implementation' } }`
- tasks.md: v2.0 format with `T0010 blocked_by: [T0011]` and `T0011 blocked_by: [T0010]`
- Tool: `{ tool_name: 'Task' }`

**Steps**:
1. Setup temp directory
2. Write state with implementation phase
3. Create v2.0 tasks.md with circular dependency: T0010 depends on T0011, T0011 depends on T0010
4. Run hook

**Expected**:
- Exit code: 0
- stdout: empty (no block)
- stderr: contains "cycle" warning message
- Decision: allow (cycle is a warning, NEVER a block)

**Assertions**:
```javascript
assert.equal(result.exitCode, 0);
assert.equal(result.stdout, '');
// Cycle warning should appear in stderr
```

---

### TC-PS-16: Validation during non-implementation phase -- skipped

**Traces**: AC-08b
**Priority**: P1 (phase gating)
**Preconditions**: tasks.md with `Format: v2.0`, current_phase is `05-test-strategy` (not implementation)
**Input**:
- State: `{ active_workflow: { current_phase: '05-test-strategy' } }`
- tasks.md: v2.0 format (even with missing annotations)
- Tool: `{ tool_name: 'Task' }`

**Steps**:
1. Setup temp directory
2. Write state with test-strategy phase (an EARLY_PHASE)
3. Create v2.0 tasks.md (could have missing annotations)
4. Run hook

**Expected**:
- Exit code: 0
- stdout: empty (no block -- early phases never blocked)
- stderr: empty (no validation run -- not implementation phase)
- Decision: allow

**Assertions**:
```javascript
assert.equal(result.exitCode, 0);
assert.equal(result.stdout, '');
// No format validation for non-implementation phases
```

---

### TC-PS-17: Validation error in format check -- fail-open

**Traces**: AC-08c
**Priority**: P1 (error resilience)
**Preconditions**: tasks.md with `Format: v2.0` but content is severely malformed (triggers exception in validation)
**Input**:
- State: `{ active_workflow: { current_phase: '06-implementation' } }`
- tasks.md: Contains `Format: v2.0` header but rest is garbage/binary content
- Tool: `{ tool_name: 'Task' }`

**Steps**:
1. Setup temp directory
2. Write state with implementation phase
3. Write a tasks.md that has `Format: v2.0` in the first few lines but the rest is malformed content that would cause regex or string parsing to fail
4. Run hook

**Expected**:
- Exit code: 0
- stdout: empty (no block)
- stderr: empty (error caught internally, fail-open)
- Decision: allow

**Assertions**:
```javascript
assert.equal(result.exitCode, 0);
assert.equal(result.stdout, '');
// Fail-open: internal errors do not produce warnings or blocks
```

**Rationale**: Per Article X and AC-08c, the hook must NEVER block on format validation errors. The try/catch in `validateTasksFormat()` silently catches and returns an empty warnings array.
