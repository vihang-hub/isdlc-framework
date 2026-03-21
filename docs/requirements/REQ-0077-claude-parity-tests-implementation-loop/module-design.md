# Design Specification: Claude Parity Tests

**Item**: REQ-0077 | **GitHub**: #141

---

## 1. Test Files

| File | Tests |
|------|-------|
| `tests/core/teams/implementation-loop.test.js` | Loop state management, file ordering, verdict routing |
| `tests/core/state/state-store.test.js` | Read/write/atomic, project root resolution |
| `tests/core/teams/contracts.test.js` | Schema validation for all 3 contracts |
| `tests/core/teams/implementation-loop-parity.test.js` | Full loop parity against fixture sequences |

## 2. Key Test Cases

### implementation-loop.test.js
- `initFromPlan()` with 3 production files → correct ordering
- `initFromPlan()` with TDD ordering → test file before production file
- `computeNextFile()` returns correct file at each index
- `computeNextFile()` returns null when complete
- `processVerdict(PASS)` → advances to next file
- `processVerdict(REVISE)` → stays on same file, increments cycle
- `processVerdict(REVISE)` at max cycles → returns `fail` action
- `buildWriterContext()` matches expected shape
- `buildReviewContext()` matches expected shape
- `buildUpdateContext()` matches expected shape

### implementation-loop-parity.test.js
- Basic 3-file loop with all PASS → complete
- TDD ordering with 2 features → test, prod, test, prod
- Mixed verdicts: PASS, REVISE+PASS, PASS → correct cycle tracking
- Max cycles exceeded on file 2 → fail action
- Single file loop → trivial case

### state-store.test.js
- readState() reads valid state.json
- readState() throws on missing file
- writeState() atomic (temp + rename)
- writeState() preserves existing fields
- getProjectRoot() walks up directories

## 3. Fixture Generation

Fixtures are captured from the CURRENT implementation by:
1. Running the loop with mock verdicts in the current codebase
2. Snapshotting WRITER_CONTEXT, REVIEW_CONTEXT, UPDATE_CONTEXT at each step
3. Snapshotting state.json at each checkpoint
4. Saving as fixture files

This ensures parity tests compare against actual current behavior, not assumed behavior.
