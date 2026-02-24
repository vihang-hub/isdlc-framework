# Technology Stack Decision: REQ-0010 Blast Radius Coverage Validation

**Version**: 1.0.0
**Date**: 2026-02-12
**Phase**: 03-architecture

---

## 1. Decision Summary

This feature requires NO new technology choices. All components extend the existing iSDLC technology stack without introducing new dependencies, frameworks, or tools.

**Rationale**: The blast-radius-validator is a pure enforcement hook that reads files, runs a git command, and compares strings. The existing stack (Node.js builtins + common.cjs utilities) fully satisfies all requirements.

---

## 2. Technology Stack (Existing -- Extended)

### 2.1 Runtime

**Choice**: Node.js 20+ (LTS)

**Rationale**: Existing project runtime. All hooks execute as standalone Node.js processes spawned by Claude Code. No change needed.

**Traces to**: CON-001 (CommonJS module system), NFR-005 (cross-platform)

### 2.2 Module System

**Choice**: CommonJS (.cjs extension)

**Rationale**: All hooks use CommonJS per Constitutional Article XIII. Hooks run as standalone Node.js processes outside the ESM package scope. The `.cjs` extension ensures CommonJS resolution regardless of the project's `"type": "module"` in package.json.

**Traces to**: CON-001, Article XIII

### 2.3 File I/O

**Choice**: Node.js `fs` builtin (`fs.readFileSync`, `fs.existsSync`)

**Rationale**: Synchronous file reads are appropriate because the hook runs synchronously within the dispatcher. The files read (impact-analysis.md, blast-radius-coverage.md) are small (<50KB). Using `fs.readFileSync` matches the pattern established by all existing hooks.

**Alternatives Considered**:
- `fs.promises` (async): Not suitable -- the `check(ctx)` contract is synchronous
- Streaming reads: Unnecessary for files under 50KB

**Traces to**: REQ-001, REQ-006, CON-002 (no new deps)

### 2.4 Path Operations

**Choice**: Node.js `path` builtin (`path.join`, `path.resolve`)

**Rationale**: Required by Constitutional Article XII for cross-platform compatibility. All file path construction must use `path.join()` instead of hardcoded separators.

**Traces to**: NFR-005, Article XII

### 2.5 Git Integration

**Choice**: Node.js `child_process.execSync` with `git diff --name-only main...HEAD`

**Rationale**: Synchronous execution matches the hook's synchronous contract. The `--name-only` flag minimizes output. A 5-second timeout prevents blocking. This is the same pattern used by `test-watcher.cjs` for detecting test commands.

**Alternatives Considered**:
- `simple-git` npm package: Adds a dependency (violates CON-002)
- `child_process.exec` (async): Not suitable for synchronous check() contract
- Reading from state.json: Git diff data is not stored in state

**Traces to**: REQ-001 AC-001-02, NFR-001, CON-002

### 2.6 Shared Utilities

**Choice**: `./lib/common.cjs` (existing shared library)

**Functions Used**:
- `debugLog(message)` -- Debug output (stderr when ISDLC_DEBUG=1)
- `getProjectRoot()` -- Resolve project root directory
- `getTimestamp()` -- ISO 8601 timestamp generation

**No new functions needed in common.cjs**.

**Traces to**: CON-002 (no new deps), existing codebase patterns

### 2.7 Markdown Parsing

**Choice**: Custom regex-based parser (no library)

**Rationale**: The impact-analysis.md format is well-defined and consistent (verified across 5 past workflows). A full markdown parsing library (marked, remark, markdown-it) would add an npm dependency (violates CON-002) and provide far more capability than needed. The custom parser handles the specific table format with ~30 lines of code.

**Pattern**:
```javascript
const TABLE_ROW_PATTERN = /^\|\s*`([^`]+)`\s*\|\s*(CREATE|MODIFY|DELETE|NO CHANGE)\s*\|/;
```

**Alternatives Considered**:
- `marked` (npm): Adds dependency, overkill for table extraction
- `remark` / `unified`: Heavy AST-based parser, overkill
- `markdown-it`: Adds dependency
- String split + indexOf: Less readable than regex, same fragility

**Traces to**: REQ-006, CON-002, ADR-0002

### 2.8 Testing

**Choice**: `node:test` + `node:assert/strict` (Node.js built-in test framework)

**Rationale**: Existing CJS hook test framework. All hook tests use this pattern. Test file will be `src/claude/hooks/tests/test-blast-radius-validator.test.cjs`.

**Test Utilities Used**:
- `hook-test-utils.cjs` -- `setupTestEnv()`, `runHook()`, `prepareHook()` for isolated hook execution in temp directories

**Traces to**: NFR-004, Article XIII (module system consistency)

---

## 3. Dependency Impact Analysis

### New Dependencies Added: ZERO

| Dependency Type | Count | Details |
|----------------|-------|---------|
| New npm packages | 0 | CON-002: No external dependencies |
| New Node.js builtins used | 0 | All builtins (fs, path, child_process) already used by existing hooks |
| New shared utility functions | 0 | All needed functions exist in common.cjs |
| New configuration files | 0 | No new config schemas or registration needed |

### Existing Dependencies Used

| Dependency | Version | Used By | Risk |
|-----------|---------|---------|------|
| Node.js fs | builtin | readFileSync, existsSync | None |
| Node.js path | builtin | join, resolve | None |
| Node.js child_process | builtin | execSync | None |
| common.cjs | 3.0.0 | debugLog, getProjectRoot, getTimestamp | None (stable API) |

---

## 4. Technology Evaluation Criteria

| Criterion | Score | Notes |
|-----------|-------|-------|
| Maturity | 10/10 | Node.js builtins, battle-tested |
| Team Familiarity | 10/10 | Identical to all other hooks in the codebase |
| Performance | 9/10 | Synchronous I/O is appropriate for hook scope |
| Security | 10/10 | No external code, no network calls |
| Licensing | 10/10 | Node.js MIT, no new packages |
| Total Cost of Ownership | 10/10 | Zero additional maintenance burden |
| Integration | 10/10 | Follows established patterns exactly |

---

## 5. Constraints Compliance

| Constraint | Compliant | Evidence |
|-----------|-----------|----------|
| CON-001: CJS module system | Yes | `.cjs` extension, `require`/`module.exports` |
| CON-002: No external dependencies | Yes | Only Node.js builtins + existing common.cjs |
| CON-003: State.json schema preservation | Yes | No new top-level state fields |
| CON-004: Additive-only agent changes | Yes | New sections in 05-software-developer.md, no existing sections modified |
| CON-005: Feature workflow only | Yes | shouldActivate guard checks workflow type |
