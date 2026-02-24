# Architecture Overview: REQ-0010 Blast Radius Coverage Validation

**Version**: 1.0.0
**Date**: 2026-02-12
**Phase**: 03-architecture
**Status**: Accepted

---

## 1. Executive Summary

This architecture extends the existing iSDLC hook dispatcher system with a new `blast-radius-validator.cjs` hook that enforces implementation coverage against impact analysis findings. The hook follows all established patterns (CJS module, `check(ctx)` contract, fail-open design, `shouldActivate` guard) and integrates as the 9th entry in the `pre-task-dispatcher.cjs` HOOKS array.

**Architecture Pattern**: Extension of existing hook dispatcher consolidation pattern (no new patterns introduced).

**Key Decisions**:
1. Standalone dispatcher hook (not a gate-blocker check type) -- ADR-0001
2. Regex-based markdown table parser with fail-open on parse errors -- ADR-0002
3. Synchronous `execSync` for git diff (reuses test-watcher pattern) -- ADR-0003
4. Hook validates only; agent generates the coverage artifact -- ADR-0004
5. Hook placed AFTER gate-blocker in dispatcher HOOKS array -- ADR-0005

---

## 2. System Context

The blast-radius-validator operates within the existing iSDLC hook enforcement pipeline:

```
User invokes Task tool (gate advancement attempt)
    |
    v
pre-task-dispatcher.cjs (PreToolUse[Task])
    |
    +-- [1] iteration-corridor
    +-- [2] skill-validator
    +-- [3] phase-loop-controller
    +-- [4] plan-surfacer
    +-- [5] phase-sequence-guard
    +-- [6] gate-blocker            <-- existing gate checks
    +-- [7] constitution-validator
    +-- [8] test-adequacy-blocker
    +-- [9] blast-radius-validator   <-- NEW (this feature)
    |
    v
Dispatcher outputs: allow | block (short-circuits on first block)
```

### Why Position 9 (After Gate-Blocker)?

The blast-radius-validator runs AFTER gate-blocker (position 6) because:
- Gate-blocker checks fundamental requirements (test iteration, constitutional validation, agent delegation) that MUST be satisfied first
- Blast radius validation is only meaningful when the developer has completed implementation and is attempting to advance
- Running after gate-blocker means the hook only activates when all other gate prerequisites are met, reducing unnecessary processing
- If gate-blocker blocks, the dispatcher short-circuits and blast-radius-validator never runs (correct behavior -- no point checking blast radius if tests are not passing)

---

## 3. Component Architecture

### 3.1 New Components

#### blast-radius-validator.cjs

**Responsibility**: Validate that implementation covers all files from impact analysis.

**Exported Functions**:
- `check(ctx)` -- Main validation entry point (dispatcher contract)
- `shouldActivate(ctx)` -- Guard function for conditional activation

**Internal Functions**:
- `parseImpactAnalysis(content)` -- Extract file paths from markdown tables
- `parseBlastRadiusCoverage(content)` -- Extract deferred files with rationale
- `getModifiedFiles(projectRoot)` -- Run git diff to get changed files
- `buildCoverageReport(affected, modified, deferred)` -- Compare and classify

**File Location**: `src/claude/hooks/blast-radius-validator.cjs`

**Dependencies** (all existing, no new):
- `./lib/common.cjs` -- `debugLog`, `getProjectRoot`, `getTimestamp`
- `fs` (Node.js builtin) -- Read impact-analysis.md, blast-radius-coverage.md
- `path` (Node.js builtin) -- Cross-platform path joining
- `child_process` (Node.js builtin) -- `execSync` for git diff

### 3.2 Modified Components

#### pre-task-dispatcher.cjs

**Change**: Add 1 new `require()` import and 1 new HOOKS array entry.

```javascript
// NEW import (line ~50)
const { check: blastRadiusValidatorCheck } = require('../blast-radius-validator.cjs');

// NEW HOOKS array entry (position 9, after test-adequacy-blocker)
{
    name: 'blast-radius-validator',
    check: blastRadiusValidatorCheck,
    shouldActivate: (ctx) => {
        if (!ctx.state?.active_workflow) return false;
        if (ctx.state.active_workflow.type !== 'feature') return false;
        const phase = ctx.state.active_workflow.current_phase || '';
        return phase === '06-implementation';
    }
}
```

**Lines Changed**: ~5-8 (additive only).

#### 05-software-developer.md

**Change**: Add two new sections (additive, no existing content modified per CON-004):

1. **Pre-implementation step**: "Blast Radius Acknowledgement" -- reads impact-analysis.md and lists affected files in implementation plan
2. **Post-implementation step**: "Blast Radius Coverage Checklist" -- generates blast-radius-coverage.md after implementation

**Lines Added**: ~50-80 lines of markdown instructions.

#### iteration-requirements.json (Optional)

**Change**: No change needed. The blast-radius-validator is a standalone hook in the dispatcher, not a gate-blocker check type. It does not need registration in iteration-requirements.json. The hook self-activates via `shouldActivate` guard in the dispatcher and performs its own blocking logic independently of gate-blocker.

**Decision Rationale**: See ADR-0001. Keeping blast radius validation as a standalone hook avoids coupling to gate-blocker's check type registry and keeps the gate-blocker's scope focused on iteration requirements (test, constitutional, elicitation, delegation, artifact).

---

## 4. Data Flow

### 4.1 Hook Activation Flow

```
pre-task-dispatcher receives Task tool call
    |
    v
shouldActivate(ctx) checks:
    [1] ctx.state?.active_workflow exists?          -- NO -> skip
    [2] active_workflow.type === 'feature'?          -- NO -> skip
    [3] active_workflow.current_phase === '06-implementation'? -- NO -> skip
    |
    v (all YES)
check(ctx) executes
```

### 4.2 Validation Flow

```
check(ctx)
    |
    +-- Read impact-analysis.md from docs/requirements/{artifact_folder}/
    |   |
    |   +-- File missing? -> return { decision: 'allow' } (graceful degradation)
    |   +-- File exists? -> parseImpactAnalysis(content)
    |       |
    |       +-- Parse error? -> return { decision: 'allow' } + log to stderr
    |       +-- No affected files? -> return { decision: 'allow' } + warning
    |       +-- Affected files extracted -> continue
    |
    +-- Run git diff --name-only main...HEAD
    |   |
    |   +-- Git error? -> return { decision: 'allow' } + log to stderr
    |   +-- Success -> Set of modified file paths
    |
    +-- Read blast-radius-coverage.md (if exists)
    |   |
    |   +-- File missing? -> No deferred files (empty set)
    |   +-- File exists? -> parseBlastRadiusCoverage(content)
    |       |
    |       +-- Extract files with status 'deferred' + rationale
    |
    +-- Compare: for each affected file
    |   |
    |   +-- In git diff? -> 'covered'
    |   +-- In blast-radius-coverage.md with rationale? -> 'deferred'
    |   +-- Neither? -> 'unaddressed'
    |
    +-- Decision:
        |
        +-- All covered/deferred -> { decision: 'allow' }
        +-- Any unaddressed -> { decision: 'block', stopReason: list of unaddressed files }
```

### 4.3 Artifact Flow

```
Phase 02 (Impact Analysis)          Phase 06 (Implementation)
    |                                    |
    v                                    v
impact-analysis.md -----> [blast-radius-validator.cjs] <----- git diff main...HEAD
    (input: affected files)       |                           (input: modified files)
                                  |
                                  v
                        blast-radius-coverage.md <----- software-developer agent
                            (generated by agent,           (generates checklist)
                             read by hook for
                             deferred files)
```

---

## 5. Markdown Parser Design (REQ-006)

### 5.1 Input Format

Impact analysis markdown tables follow this format (consistent across REQ-0005 through REQ-0009):

```markdown
#### REQ-001: Some Requirement

| File | Change Type | Change Description |
|------|-------------|-------------------|
| `src/claude/hooks/blast-radius-validator.cjs` | CREATE | New hook file... |
| `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` | MODIFY | Add import... |
| `src/claude/hooks/gate-blocker.cjs` | NO CHANGE | Not modified... |
```

### 5.2 Parser Strategy

**Approach**: Line-by-line regex matching on markdown table rows.

```
For each line in content:
    1. Skip header rows (containing '---' separator)
    2. Match table row pattern: | `path` | CHANGE_TYPE | description |
    3. Extract:
       - filePath: content between first pair of backticks
       - changeType: second column value (MODIFY, CREATE, DELETE, NO CHANGE)
    4. Filter: exclude entries where changeType === 'NO CHANGE'
    5. Deduplicate: use Map keyed by filePath (same file in multiple sections)
```

**Regex Pattern**:
```javascript
// Match table rows with backtick-wrapped file paths
const TABLE_ROW_PATTERN = /^\|\s*`([^`]+)`\s*\|\s*(CREATE|MODIFY|DELETE|NO CHANGE)\s*\|/;
```

**Edge Cases Handled**:
- Multiple table sections (one per requirement) -- deduplication via Map
- Extra whitespace around delimiters -- `\s*` in pattern
- Missing backticks -- row skipped (fail-open, logged to stderr)
- Empty tables -- returns empty array, hook allows (REQ-002)
- NO CHANGE entries -- excluded from validation (REQ-006 AC-006-04)

### 5.3 Blast Radius Coverage Parser

The blast-radius-coverage.md checklist follows this format:

```markdown
| File Path | Expected Change | Coverage Status | Notes |
|-----------|----------------|-----------------|-------|
| `src/hooks/foo.cjs` | MODIFY | covered | Modified in commit abc1234 |
| `src/hooks/bar.cjs` | MODIFY | deferred | Deferred to REQ-0011 |
```

**Parser Strategy**: Same regex approach, extracting rows where Coverage Status = 'deferred' and capturing Notes column as rationale.

---

## 6. Git Diff Integration (REQ-001 AC-001-02)

### 6.1 Approach

Use `child_process.execSync` with `git diff --name-only main...HEAD` (same pattern as test-watcher.cjs).

```javascript
function getModifiedFiles(projectRoot) {
    try {
        const result = execSync('git diff --name-only main...HEAD', {
            cwd: projectRoot,
            encoding: 'utf8',
            timeout: 5000  // 5s timeout (generous, typically < 1s)
        });
        return new Set(
            result.trim().split('\n').filter(line => line.trim())
        );
    } catch (e) {
        // Fail-open: git errors should never block the workflow
        debugLog('blast-radius-validator: git diff failed:', e.message);
        return null;  // null signals failure (distinct from empty Set)
    }
}
```

### 6.2 Error Handling

| Error Scenario | Behavior | Rationale |
|----------------|----------|-----------|
| Not a git repo | `return null` -> hook allows | Fail-open (Article X) |
| No `main` branch | `return null` -> hook allows | Fail-open (Article X) |
| Timeout (>5s) | `return null` -> hook allows | NFR-001 performance |
| Detached HEAD | `return null` -> hook allows | Fail-open (Article X) |
| Empty diff (no files changed) | `return new Set()` -> normal flow | Valid state (developer might defer all files) |

---

## 7. shouldActivate Guard Design (REQ-007 AC-007-02)

The guard implements three conditions, all of which must be true:

```javascript
shouldActivate: (ctx) => {
    // Condition 1: Active workflow exists
    if (!ctx.state?.active_workflow) return false;

    // Condition 2: Feature workflow only (CON-005)
    if (ctx.state.active_workflow.type !== 'feature') return false;

    // Condition 3: Phase 06 implementation
    const phase = ctx.state.active_workflow.current_phase || '';
    return phase === '06-implementation';
}
```

**Note**: The guard does NOT check `isGateAdvancementAttempt()` -- that check is performed inside `check()` itself (same pattern as gate-blocker.cjs). The `shouldActivate` guard controls WHEN the hook runs (phase/workflow scope), while `check()` controls WHAT it validates (gate advancement attempts only).

---

## 8. Fail-Open Design (Article X, NFR-002)

Every error path in the hook returns `{ decision: 'allow' }`:

| Error Path | Return | Diagnostic Output |
|-----------|--------|-------------------|
| No active_workflow | `{ decision: 'allow' }` | None (silent) |
| Not feature workflow | `{ decision: 'allow' }` | None (silent via shouldActivate) |
| Not Phase 06 | `{ decision: 'allow' }` | None (silent via shouldActivate) |
| impact-analysis.md missing | `{ decision: 'allow' }` | debugLog: "file not found" |
| impact-analysis.md empty/no tables | `{ decision: 'allow' }` | stderr: warning |
| impact-analysis.md parse error | `{ decision: 'allow' }` | stderr: parse error |
| git diff failure | `{ decision: 'allow' }` | stderr: git error |
| blast-radius-coverage.md missing | Continue (no deferred files) | debugLog: "no coverage file" |
| blast-radius-coverage.md parse error | Continue (no deferred files) | stderr: parse error |
| Any uncaught exception in check() | `{ decision: 'allow' }` | debugLog: error message |

---

## 9. Architecture Decision Records

### ADR-0001: Standalone Dispatcher Hook (Not Gate-Blocker Check Type)

**Status**: Accepted

**Context**: The blast-radius-validator could be implemented as either: (a) a new check type inside gate-blocker.cjs (alongside test_iteration, constitutional_validation, etc.), or (b) a standalone hook in the pre-task-dispatcher HOOKS array.

**Decision**: Standalone dispatcher hook.

**Consequences**:
- **Positive**: Keeps gate-blocker focused on iteration requirements. Avoids coupling. Simpler to test (isolated hook file). Follows single-responsibility principle.
- **Positive**: No changes to iteration-requirements.json schema. No new check function in gate-blocker.cjs.
- **Negative**: One more hook in the dispatcher (9th). Mitigated by shouldActivate guard that skips the hook entirely outside Phase 06 feature workflows.
- **Traces to**: REQ-007 (dispatcher integration), NFR-003 (backward compatibility), CON-003 (no new state.json fields)

### ADR-0002: Regex-Based Markdown Table Parser

**Status**: Accepted

**Context**: Need to extract file paths from markdown tables in impact-analysis.md. Options: (a) full markdown parser library (e.g., marked, remark), (b) custom regex-based parser.

**Decision**: Custom regex-based line-by-line parser.

**Consequences**:
- **Positive**: Zero new dependencies (CON-002). Simple, fast, testable. Handles the specific format used by impact-analysis-orchestrator.
- **Negative**: Brittle if impact-analysis.md format changes significantly. Mitigated by: fail-open on parse errors (Article X), documented format assumption (ASM-001), and test cases covering edge cases.
- **Traces to**: REQ-006 (file path extraction), CON-002 (no external dependencies), NFR-001 (performance)

### ADR-0003: Synchronous execSync for Git Diff

**Status**: Accepted

**Context**: Need to get list of modified files from git. Options: (a) async exec with callback, (b) sync execSync, (c) read from state.json if available.

**Decision**: Synchronous `execSync('git diff --name-only main...HEAD')` with timeout.

**Consequences**:
- **Positive**: Matches existing pattern in test-watcher.cjs. Simple. The dispatcher runs hooks synchronously anyway (check functions are synchronous).
- **Positive**: `--name-only` minimizes output (NFR-001).
- **Negative**: Blocks the Node.js event loop for the duration of the git command. Mitigated by 5-second timeout and the fact that `git diff --name-only` is typically <100ms.
- **Traces to**: REQ-001 AC-001-02, NFR-001 (performance), NFR-005 (cross-platform)

### ADR-0004: Agent Generates Coverage Artifact, Hook Only Validates

**Status**: Accepted

**Context**: The blast-radius-coverage.md artifact could be generated by: (a) the hook itself during validation, or (b) the software-developer agent after implementation.

**Decision**: The software-developer agent generates blast-radius-coverage.md. The hook only reads it for deferred file rationales.

**Consequences**:
- **Positive**: Hooks remain side-effect-free (no file writes). Agent has better context for generating meaningful rationales. Separation of concerns.
- **Positive**: The agent can generate the artifact before the hook runs, giving the developer a chance to add deferral rationales before gate check.
- **Negative**: Requires agent modification (05-software-developer.md). Mitigated by additive-only changes (CON-004).
- **Traces to**: REQ-003 (checklist generation), REQ-004 (agent integration), ASM-004

### ADR-0005: Hook Placement After Gate-Blocker in Dispatcher

**Status**: Accepted

**Context**: The blast-radius-validator could be placed: (a) before gate-blocker (runs first, may block before other checks), (b) after gate-blocker (runs only when all other gate checks pass).

**Decision**: Place after gate-blocker (and after test-adequacy-blocker) as the 9th and final hook in the HOOKS array.

**Consequences**:
- **Positive**: Blast radius check only runs when all other prerequisites (tests, constitutional validation, delegation) are met. Avoids confusing the developer with blast radius failures when they have not even passed tests yet.
- **Positive**: If gate-blocker blocks (short-circuit), blast-radius-validator never executes (no wasted processing).
- **Negative**: Developer sees blast radius failures only after fixing all other gate issues (delayed feedback). Acceptable because blast radius is a final validation, not an iterative process.
- **Traces to**: REQ-007 AC-007-03, NFR-001 (performance via short-circuit)

---

## 10. File Inventory

### New Files

| File | Type | Size Estimate | Traces To |
|------|------|---------------|-----------|
| `src/claude/hooks/blast-radius-validator.cjs` | CJS hook | ~200-300 lines | REQ-001, REQ-002, REQ-005, REQ-006, REQ-007 |
| `src/claude/hooks/tests/test-blast-radius-validator.test.cjs` | CJS test | ~300-500 lines | NFR-004 |

### Modified Files

| File | Change Type | Lines Changed | Traces To |
|------|-------------|---------------|-----------|
| `src/claude/hooks/dispatchers/pre-task-dispatcher.cjs` | MODIFY | ~5-8 lines | REQ-007 AC-007-03 |
| `src/claude/agents/05-software-developer.md` | MODIFY | ~50-80 lines | REQ-003, REQ-004 |

### Unchanged Files

| File | Reason |
|------|--------|
| `src/claude/hooks/gate-blocker.cjs` | Blast radius is standalone hook, not gate-blocker check type |
| `src/claude/hooks/lib/common.cjs` | Uses existing utilities, no new ones needed |
| `src/claude/hooks/config/iteration-requirements.json` | No new check type registration needed |
| `src/claude/settings.json` | Dispatcher already registered, no new hook command |

---

## 11. Security Considerations (Article III)

1. **Path Traversal**: File paths from impact-analysis.md are used only for comparison against git diff output (string matching). No file system operations are performed on these paths. The hook reads only two known files (impact-analysis.md and blast-radius-coverage.md) at known locations.

2. **Command Injection**: The git diff command is hardcoded (`git diff --name-only main...HEAD`). No user input is interpolated into the command string. The `execSync` call uses `cwd` option (not shell expansion).

3. **Denial of Service**: The `execSync` call has a 5-second timeout. Malformed markdown files are handled gracefully (fail-open). The shouldActivate guard prevents the hook from running outside its narrow scope.

4. **Information Disclosure**: Error messages logged to stderr contain only file paths and generic error descriptions. No secrets, credentials, or sensitive data are exposed.

---

## 12. Scalability and Performance (NFR-001)

**Expected execution time**: < 500ms under normal conditions.

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Read impact-analysis.md | < 10ms | Typical file < 50KB |
| Parse markdown tables | < 5ms | Regex on ~100-200 lines |
| Run git diff --name-only | < 200ms | Typical feature branch < 100 changed files |
| Read blast-radius-coverage.md | < 10ms | Typical file < 10KB |
| Compare and decide | < 1ms | Set operations on ~10-50 files |
| **Total** | **< 250ms** | Well within 2s NFR-001 budget |

The shouldActivate guard ensures the hook is completely skipped (0ms overhead) for non-Phase-06, non-feature workflows.

---

## 13. Backward Compatibility (NFR-003)

1. **Existing workflows without impact-analysis.md**: Hook returns `allow` silently. Zero impact.
2. **Bug-fix workflows**: shouldActivate returns `false` (workflow type is 'fix', not 'feature'). Hook never runs.
3. **Existing hook behavior**: No modifications to any existing hook. The new hook is additive in the dispatcher array.
4. **Existing tests**: No modifications to existing test files. All existing tests continue to pass.
5. **State.json schema**: No new top-level fields added (CON-003).

---

## 14. Traceability Matrix (Architecture -> Requirements)

| Architecture Decision | Requirements Addressed |
|----------------------|----------------------|
| Standalone dispatcher hook (ADR-0001) | REQ-007, NFR-003, CON-003 |
| Regex markdown parser (ADR-0002) | REQ-006, CON-002, NFR-001 |
| Synchronous git diff (ADR-0003) | REQ-001 AC-001-02, NFR-001, NFR-005 |
| Agent generates artifact (ADR-0004) | REQ-003, REQ-004, ASM-004, CON-004 |
| Hook after gate-blocker (ADR-0005) | REQ-007 AC-007-03, NFR-001 |
| shouldActivate guard | REQ-007 AC-007-02, CON-005 |
| Fail-open on all errors | REQ-002, NFR-002, Article X |
| No new state.json fields | CON-003, Article XIV |
| No new npm dependencies | CON-002 |
| CJS module format | CON-001, Article XIII |
| path.join for all paths | NFR-005, Article XII |

---

## 15. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Impact-analysis.md format changes | Low | Medium | Fail-open parser, documented assumption (ASM-001), format consistency verified across REQ-0005-0009 |
| Git diff command fails on some platforms | Low | Low | Fail-open, 5s timeout, cross-platform tested (NFR-005) |
| Developer forgets to generate blast-radius-coverage.md | Medium | Low | Hook treats missing coverage file as "no deferred files" -- unaddressed files will block, prompting the developer to either modify files or create the coverage artifact |
| Regex parser misses edge cases | Medium | Low | Comprehensive test suite (NFR-004 >=80%), fail-open on parse errors |
| Dispatcher hook count growing (now 9) | Low | Low | shouldActivate guard prevents unnecessary execution. Architecture supports this pattern. |
