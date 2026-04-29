# Test Strategy: Constitutional Quality Enforcement (GH-261)

**Requirement**: REQ-GH-261
**Phase**: 05 - Test Strategy
**Date**: 2026-04-24
**Traces**: FR-001, FR-002, FR-003, FR-004, FR-005, FR-006, FR-007

---

## 1. Existing Infrastructure

- **Framework**: node:test (native Node.js test runner)
- **Assertions**: node:assert/strict
- **Module format**: CJS for hooks (`.cjs` files), ESM for tests in `tests/hooks/` (`.test.js`), CJS for tests in `src/claude/hooks/tests/` (`.test.cjs`)
- **Test command**: `npm run test:hooks` runs `node --test src/claude/hooks/tests/*.test.cjs`
- **Existing hook test count**: 100+ test files in `src/claude/hooks/tests/`
- **Patterns**: Hooks export `check(ctx)` returning `{ decision, stopReason? }`. Tests either require the hook module directly and call `check()` with mock context, or use `execSync` with stdin piping for standalone execution.

## 2. Strategy: Extend Existing Test Suite

All new tests will:
- Follow the `.test.cjs` naming convention in `src/claude/hooks/tests/`
- Use `node:test` (describe/it) + `node:assert/strict`
- Use `createRequire(import.meta.url)` or direct `require()` for CJS hook loading
- Follow the existing `check(ctx)` testing pattern from `phase-loop-controller.test.cjs`
- Run via `npm run test:hooks`

## 3. Test Pyramid

```
                    /\
                   /  \     Integration (3f loop): 1 file, ~25 tests
                  /    \
                 /------\
                / System \   End-to-end hook execution via execSync: included per-hook
               /----------\
              /   Unit      \  Per-hook + shared utilities: 8 files, ~180 tests
             /________________\
```

| Level | Scope | Count (est.) | Location |
|---|---|---|---|
| Unit | Shared utilities in common.cjs | ~50 tests | `src/claude/hooks/tests/common-quality-utilities.test.cjs` |
| Unit | deferral-detector.cjs | ~25 tests | `src/claude/hooks/tests/deferral-detector.test.cjs` |
| Unit | test-quality-validator.cjs | ~25 tests | `src/claude/hooks/tests/test-quality-validator.test.cjs` |
| Unit | spec-trace-validator.cjs | ~25 tests | `src/claude/hooks/tests/spec-trace-validator.test.cjs` |
| Unit | security-depth-validator.cjs | ~20 tests | `src/claude/hooks/tests/security-depth-validator.test.cjs` |
| Unit | review-depth-validator.cjs | ~20 tests | `src/claude/hooks/tests/review-depth-validator.test.cjs` |
| Unit | Constitution text validation | ~10 tests | `src/claude/hooks/tests/constitution-quality-articles.test.cjs` |
| Integration | 3f corrective loop + regression | ~25 tests | `src/claude/hooks/tests/quality-enforcement-integration.test.cjs` |
| **Total** | | **~200 tests** | |

## 4. Test Case Specifications

### 4.1 Shared Utilities — `common-quality-utilities.test.cjs`

Tests for the 7 new functions added to `src/claude/hooks/lib/common.cjs`.

#### 4.1.1 `extractACsFromSpec(specContent)` — traces: AC-003-02

| ID | Type | Description | Input | Expected |
|---|---|---|---|---|
| CQU-01 | positive | Extracts AC-NNN-NN identifiers from standard format | Spec with `AC-001-01`, `AC-001-02` | `[{ id: 'AC-001-01', description: '...' }, { id: 'AC-001-02', description: '...' }]` |
| CQU-02 | positive | Extracts AC IDs from multi-FR spec | Spec with AC-001-01 through AC-007-07 | Array of 30+ AC objects |
| CQU-03 | negative | Returns empty array for spec with no ACs | Markdown with no AC- patterns | `[]` |
| CQU-04 | boundary | Handles AC IDs at start/end of line | `AC-001-01: description` as first/last line | Correctly extracted |
| CQU-05 | negative | Does not extract malformed AC IDs | `AC-1-1`, `AC1-01`, `AC-001` | `[]` |
| CQU-06 | positive | Captures description text after AC ID | `AC-001-01: Given X, then Y` | description includes "Given X, then Y" |

#### 4.1.2 `scanTestTraces(testContent, acIds)` — traces: AC-003-03

| ID | Type | Description | Input | Expected |
|---|---|---|---|---|
| CQU-07 | positive | Finds trace annotations in test descriptions | `it('AC-001-01: should ...')` | `{ covered: ['AC-001-01'], uncovered: [] }` |
| CQU-08 | positive | Finds trace annotations in comments | `// traces: AC-001-01, AC-001-02` | Both covered |
| CQU-09 | negative | Detects uncovered ACs | Tests trace AC-001-01 but not AC-001-02 | `uncovered: ['AC-001-02']` |
| CQU-10 | positive | Handles mixed trace formats | `traces: AC-001-01` and `AC-001-02:` in `it()` | Both covered |
| CQU-11 | boundary | Empty test content | `''` | All ACs uncovered |
| CQU-12 | boundary | Empty AC ID list | Any test content, `[]` | `{ covered: [], uncovered: [] }` |

#### 4.1.3 `countAssertions(testContent)` — traces: AC-003-05

| ID | Type | Description | Input | Expected |
|---|---|---|---|---|
| CQU-13 | positive | Counts assert.* calls | `assert.equal(a, b); assert.ok(c)` | Count >= 2 |
| CQU-14 | positive | Counts assert/strict patterns | `assert.strictEqual`, `assert.deepStrictEqual` | Counted correctly |
| CQU-15 | positive | Counts expect() patterns | `expect(x).toBe(y)` | Counted |
| CQU-16 | negative | Flags test block with zero assertions | `it('test', () => { const x = 1; })` | `[{ testName: 'test', line: N, count: 0 }]` |
| CQU-17 | positive | Counts assertions per describe/it block | Multiple `it()` blocks with varying counts | Per-block counts |
| CQU-18 | boundary | Handles .should assertions | `x.should.equal(1)` | Counted |
| CQU-19 | negative | Does not count assertions in comments | `// assert.ok(true)` | Not counted |

#### 4.1.4 `detectErrorPaths(sourceContent)` — traces: AC-003-06

| ID | Type | Description | Input | Expected |
|---|---|---|---|---|
| CQU-20 | positive | Detects try/catch blocks | `try { ... } catch (e) { ... }` | `[{ line: N, pattern: 'try/catch' }]` |
| CQU-21 | positive | Detects throw statements | `throw new Error('x')` | Detected |
| CQU-22 | positive | Detects Promise .catch handlers | `.catch(err => ...)` | Detected |
| CQU-23 | negative | Returns empty for code without error paths | `const x = 1 + 2;` | `[]` |
| CQU-24 | positive | Detects reject callbacks | `reject(new Error(...))` | Detected |

#### 4.1.5 `detectExternalInputs(sourceContent)` — traces: AC-005-02

| ID | Type | Description | Input | Expected |
|---|---|---|---|---|
| CQU-25 | positive | Detects req.body | `const data = req.body` | `[{ line: N, pattern: 'req.body', type: 'http' }]` |
| CQU-26 | positive | Detects req.params | `req.params.id` | Detected as http |
| CQU-27 | positive | Detects req.query | `const q = req.query.search` | Detected as http |
| CQU-28 | positive | Detects process.argv | `const arg = process.argv[2]` | `type: 'cli'` |
| CQU-29 | positive | Detects JSON.parse on external data | `JSON.parse(externalData)` | Detected |
| CQU-30 | positive | Detects process.env | `process.env.SECRET` | Detected as env |
| CQU-31 | positive | Detects fs.readFileSync with user path | `fs.readFileSync(userPath)` | Detected as filesystem |
| CQU-32 | negative | Returns empty for internal-only code | `const x = { a: 1 }; JSON.stringify(x)` | `[]` |

#### 4.1.6 `checkValidationProximity(content, inputLine, radius)` — traces: AC-005-03

| ID | Type | Description | Input | Expected |
|---|---|---|---|---|
| CQU-33 | positive | Finds validation within 15 lines (default radius) | Validation 10 lines after input | `true` |
| CQU-34 | negative | No validation within radius | Input on line 5, no validation within 20 lines | `false` |
| CQU-35 | positive | Detects typeof check | `if (typeof x === 'string')` | `true` |
| CQU-36 | positive | Detects schema validation | `schema.validate(data)` | `true` |
| CQU-37 | positive | Detects assertion-style validation | `assert(data, 'required')` | `true` |
| CQU-38 | positive | Detects null/undefined checks | `if (data == null) throw` | `true` |
| CQU-39 | boundary | Custom radius parameter | radius=5, validation at line 6 | `false` |
| CQU-40 | boundary | Validation at exactly radius boundary | radius=15, validation at line 15 | `true` |

#### 4.1.7 `parseDeferralPatterns(content)` — traces: AC-002-02

| ID | Type | Description | Input | Expected |
|---|---|---|---|---|
| CQU-41 | positive | Detects "TODO later" | `// TODO later: add rate limiting` | `[{ line: 1, text: '...', pattern: 'TODO later' }]` |
| CQU-42 | positive | Detects "FIXME next" | `// FIXME next iteration` | Detected |
| CQU-43 | positive | Detects "will handle later" | `// will handle later` | Detected |
| CQU-44 | positive | Detects "add later" | `// add later` | Detected |
| CQU-45 | positive | Detects "implement later" | `// implement later` | Detected |
| CQU-46 | positive | Detects "future work" | `// future work: refactor this` | Detected |
| CQU-47 | negative | Does not flag bare TODO | `// TODO: implement validation` | `[]` (bare TODO without "later" is legitimate) |
| CQU-48 | negative | Does not flag bare FIXME | `// FIXME: broken regex` | `[]` (bare FIXME without "next" is legitimate) |
| CQU-49 | positive | Case insensitive matching | `// todo LATER` | Detected |
| CQU-50 | positive | Multiple deferrals in one file | 3 deferral lines | Array of 3 results |

---

### 4.2 Deferral Detector — `deferral-detector.test.cjs`

Tests for `src/claude/hooks/deferral-detector.cjs` (PreToolUse on Write/Edit).
Traces: FR-002, AC-002-01 through AC-002-06.

#### Pattern Matching (AC-002-01, AC-002-02)

| ID | Type | Description | Expected |
|---|---|---|---|
| DD-01 | positive | Blocks Write with "TODO later" in content | `decision: 'block'` |
| DD-02 | positive | Blocks Edit with "FIXME next iteration" in new_string | `decision: 'block'` |
| DD-03 | positive | Blocks "will handle later" in production code | `decision: 'block'` |
| DD-04 | positive | Blocks "add later" pattern | `decision: 'block'` |
| DD-05 | positive | Blocks "implement later" pattern | `decision: 'block'` |
| DD-06 | positive | Blocks "future work" pattern | `decision: 'block'` |
| DD-07 | negative | Allows bare "TODO:" without "later" | `decision: 'allow'` |
| DD-08 | negative | Allows bare "FIXME:" without "next" | `decision: 'allow'` |
| DD-09 | negative | Allows clean production code | `decision: 'allow'` |
| DD-10 | positive | Case insensitive deferral detection | `decision: 'block'` |

#### Exemptions (AC-002-03)

| ID | Type | Description | Expected |
|---|---|---|---|
| DD-11 | positive | Allows deferral in test file (tests/ path) | `decision: 'allow'` |
| DD-12 | positive | Allows deferral in ADR document | `decision: 'allow'` |
| DD-13 | positive | Allows deferral with `deferral-exempt` marker | `decision: 'allow'` |
| DD-14 | positive | Allows deferral in BACKLOG.md | `decision: 'allow'` |
| DD-15 | positive | Allows deferral in tasks.md | `decision: 'allow'` |
| DD-16 | negative | Blocks deferral in src/ path (not exempt) | `decision: 'block'` |

#### Block Message Quality (AC-002-04)

| ID | Type | Description | Expected |
|---|---|---|---|
| DD-17 | positive | Block message includes line numbers | stopReason contains `line` |
| DD-18 | positive | Block message includes deferral text | stopReason contains the matched pattern |
| DD-19 | positive | Block message includes remediation options | stopReason contains "implement now" or "ADR" or "out-of-scope" |

#### Fail-Open Behavior

| ID | Type | Description | Expected |
|---|---|---|---|
| DD-20 | negative | Returns allow on null input | `decision: 'allow'` |
| DD-21 | negative | Returns allow on non-Write/Edit tool | `decision: 'allow'` |
| DD-22 | negative | Returns allow on malformed input | `decision: 'allow'` |

#### Performance (NFR)

| ID | Type | Description | Expected |
|---|---|---|---|
| DD-23 | nfr | Processes 1000-line file in under 50ms | Elapsed < 50ms |

#### No Retry Counter (AC-002-06)

| ID | Type | Description | Expected |
|---|---|---|---|
| DD-24 | positive | Hook has no retry/iteration counter logic | Source code does not contain `retry` counter state mutation |
| DD-25 | positive | Hook is inline-only (PreToolUse, not Notification) | check() does not read iteration state |

---

### 4.3 Test Quality Validator — `test-quality-validator.test.cjs`

Tests for `src/claude/hooks/test-quality-validator.cjs` (Notification on phase 06/16 completion).
Traces: FR-003, AC-003-01 through AC-003-08.

#### AC Coverage Detection (AC-003-02, AC-003-03, AC-003-04)

| ID | Type | Description | Expected |
|---|---|---|---|
| TQV-01 | positive | Detects all ACs covered by tests | `decision: 'allow'` |
| TQV-02 | negative | Blocks when AC has no matching test | `decision: 'block'`, stopReason lists uncovered AC |
| TQV-03 | negative | Blocks when multiple ACs missing | stopReason lists all uncovered ACs with descriptions |
| TQV-04 | positive | Handles AC traces in test descriptions | Correctly identifies coverage |
| TQV-05 | positive | Handles AC traces in comment annotations | `// traces: AC-001-01` recognized |

#### Assertion Count (AC-003-05)

| ID | Type | Description | Expected |
|---|---|---|---|
| TQV-06 | negative | Blocks test file with zero-assertion test block | `decision: 'block'`, lists file and test name |
| TQV-07 | positive | Allows test file with assertions in all blocks | `decision: 'allow'` |
| TQV-08 | negative | Identifies specific zero-assertion blocks | stopReason names the test and line |

#### Error Path Tests (AC-003-06)

| ID | Type | Description | Expected |
|---|---|---|---|
| TQV-09 | negative | Flags source with try/catch but no negative test | `decision: 'block'` |
| TQV-10 | positive | Allows when error paths have negative tests | `decision: 'allow'` |
| TQV-11 | positive | Matches error paths to tests with "error"/"fail"/"invalid" keywords | Correctly identifies negative tests |

#### Block Message Quality (AC-003-07)

| ID | Type | Description | Expected |
|---|---|---|---|
| TQV-12 | positive | Block message includes fix instructions | stopReason includes "Write test for" or "Add assertion" |
| TQV-13 | positive | Block message includes file paths | stopReason includes specific file paths |

#### Phase Gating (AC-003-01)

| ID | Type | Description | Expected |
|---|---|---|---|
| TQV-14 | positive | Fires on phase 06-implementation completion | Hook activates |
| TQV-15 | positive | Fires on phase 16-quality-loop completion | Hook activates |
| TQV-16 | negative | Does not fire on phase 05 or other phases | `decision: 'allow'` |

#### Fail-Open

| ID | Type | Description | Expected |
|---|---|---|---|
| TQV-17 | negative | Returns allow on null input | `decision: 'allow'` |
| TQV-18 | negative | Returns allow on missing requirements-spec.md | `decision: 'allow'` (fail-open) |
| TQV-19 | negative | Returns allow on exception in check logic | `decision: 'allow'` |

#### Signal for 3f Loop (AC-003-08)

| ID | Type | Description | Expected |
|---|---|---|---|
| TQV-20 | positive | Block message contains "TEST QUALITY INCOMPLETE" signal | stopReason includes the 3f dispatch signal |

---

### 4.4 Spec Trace Validator — `spec-trace-validator.test.cjs`

Tests for `src/claude/hooks/spec-trace-validator.cjs` (Notification on phase 06 completion).
Traces: FR-004, AC-004-01 through AC-004-07.

#### Untraced File Detection (AC-004-02, AC-004-03, AC-004-04)

| ID | Type | Description | Expected |
|---|---|---|---|
| STV-01 | positive | Allows when all modified files trace to tasks | `decision: 'allow'` |
| STV-02 | negative | Blocks when modified file not in tasks.md | `decision: 'block'`, lists untraced file |
| STV-03 | negative | Blocks multiple untraced files | All listed in stopReason |
| STV-04 | positive | Exempts config files from tracing | `.eslintrc`, `package.json` allowed |
| STV-05 | positive | Exempts test files from tracing | `tests/` directory files allowed |
| STV-06 | positive | Exempts docs/requirements/ files | Requirements artifacts allowed |

#### Unimplemented AC Detection (AC-004-05)

| ID | Type | Description | Expected |
|---|---|---|---|
| STV-07 | negative | Blocks when AC has no corresponding file modification | `decision: 'block'`, lists unimplemented AC |
| STV-08 | positive | Allows when all ACs have file modifications | `decision: 'allow'` |
| STV-09 | negative | Lists all unimplemented ACs in block message | stopReason includes AC IDs and descriptions |

#### Git Diff Parsing (AC-004-02)

| ID | Type | Description | Expected |
|---|---|---|---|
| STV-10 | positive | Parses standard git diff output | Correct file list |
| STV-11 | boundary | Handles renamed files in diff | Both old and new names captured |
| STV-12 | boundary | Handles binary file changes in diff | Binary files included |

#### Tasks.md Mapping (AC-004-03)

| ID | Type | Description | Expected |
|---|---|---|---|
| STV-13 | positive | Builds file-to-AC map from tasks.md format | Correct mapping |
| STV-14 | positive | Handles multiple files per task | All files mapped |
| STV-15 | boundary | Handles tasks with no files listed | Skipped without error |

#### Block Message and 3f (AC-004-06, AC-004-07)

| ID | Type | Description | Expected |
|---|---|---|---|
| STV-16 | positive | Block message lists untraced files | File paths in stopReason |
| STV-17 | positive | Block message lists unimplemented ACs | AC IDs in stopReason |
| STV-18 | positive | Block message contains "SPEC TRACE INCOMPLETE" signal | 3f dispatch signal present |

#### Fail-Open

| ID | Type | Description | Expected |
|---|---|---|---|
| STV-19 | negative | Returns allow on null input | `decision: 'allow'` |
| STV-20 | negative | Returns allow on missing tasks.md | `decision: 'allow'` |
| STV-21 | negative | Returns allow on git diff failure | `decision: 'allow'` |

---

### 4.5 Security Depth Validator — `security-depth-validator.test.cjs`

Tests for `src/claude/hooks/security-depth-validator.cjs` (Notification on phase 06 completion).
Traces: FR-005, AC-005-01 through AC-005-06.

#### External Input Detection (AC-005-02)

| ID | Type | Description | Expected |
|---|---|---|---|
| SDV-01 | positive | Detects req.body without validation | `decision: 'block'` |
| SDV-02 | positive | Detects process.argv without validation | `decision: 'block'` |
| SDV-03 | positive | Detects JSON.parse on external data | `decision: 'block'` |
| SDV-04 | positive | Allows req.body with validation within 15 lines | `decision: 'allow'` |
| SDV-05 | positive | Allows process.argv with typeof check nearby | `decision: 'allow'` |

#### Validation Proximity (AC-005-03)

| ID | Type | Description | Expected |
|---|---|---|---|
| SDV-06 | positive | Finds validation within 15-line radius | `decision: 'allow'` |
| SDV-07 | negative | No validation within radius | `decision: 'block'` |
| SDV-08 | positive | Recognizes schema.validate() as validation | Allowed |
| SDV-09 | positive | Recognizes type guards as validation | `typeof x === 'string'` recognized |
| SDV-10 | positive | Recognizes null checks as validation | `if (x == null)` recognized |

#### Generic Claim Flagging (AC-005-05)

| ID | Type | Description | Expected |
|---|---|---|---|
| SDV-11 | negative | Flags "security is handled" without file references | `decision: 'block'` |
| SDV-12 | positive | Allows specific security claims with file:line | `decision: 'allow'` |

#### Block Message and 3f (AC-005-04, AC-005-06)

| ID | Type | Description | Expected |
|---|---|---|---|
| SDV-13 | positive | Block message includes file, line, input source | All present in stopReason |
| SDV-14 | positive | Block message contains "SECURITY DEPTH INCOMPLETE" | 3f dispatch signal present |

#### Fail-Open

| ID | Type | Description | Expected |
|---|---|---|---|
| SDV-15 | negative | Returns allow on null input | `decision: 'allow'` |
| SDV-16 | negative | Returns allow on exception | `decision: 'allow'` |

---

### 4.6 Review Depth Validator — `review-depth-validator.test.cjs`

Tests for `src/claude/hooks/review-depth-validator.cjs` (Notification on phase 08 completion).
Traces: FR-006, AC-006-01 through AC-006-05.

#### File Reference Counting (AC-006-02)

| ID | Type | Description | Expected |
|---|---|---|---|
| RDV-01 | positive | Allows review with 3+ file references | `decision: 'allow'` |
| RDV-02 | negative | Blocks review with fewer than 3 file references | `decision: 'block'` |
| RDV-03 | positive | Counts unique file paths (no duplicates) | Correct unique count |
| RDV-04 | positive | Recognizes various path formats | `src/foo.js`, `./src/foo.js`, `/abs/path` all counted |

#### Generic Approval Detection (AC-006-03)

| ID | Type | Description | Expected |
|---|---|---|---|
| RDV-05 | negative | Flags "LGTM" with no file references | `decision: 'block'` |
| RDV-06 | negative | Flags "looks good" with insufficient file references | `decision: 'block'` |
| RDV-07 | negative | Flags "no issues found" with no specifics | `decision: 'block'` |
| RDV-08 | positive | Allows detailed review with findings | `decision: 'allow'` |

#### Finding Density (AC-006-03 extended)

| ID | Type | Description | Expected |
|---|---|---|---|
| RDV-09 | negative | Flags review of large diff with zero findings | `decision: 'block'` |
| RDV-10 | positive | Allows review proportional to diff size | `decision: 'allow'` |

#### Block Message and 3f (AC-006-04, AC-006-05)

| ID | Type | Description | Expected |
|---|---|---|---|
| RDV-11 | positive | Block message instructs re-review | "re-review" in stopReason |
| RDV-12 | positive | Block message contains "REVIEW DEPTH INCOMPLETE" | 3f dispatch signal present |

#### Fail-Open

| ID | Type | Description | Expected |
|---|---|---|---|
| RDV-13 | negative | Returns allow on null input | `decision: 'allow'` |
| RDV-14 | negative | Returns allow on exception | `decision: 'allow'` |
| RDV-15 | negative | Returns allow on non-phase-08 | `decision: 'allow'` |

---

### 4.7 Constitution Text Validation — `constitution-quality-articles.test.cjs`

Tests that `docs/isdlc/constitution.md` contains the strengthened article language.
Traces: FR-001, AC-001-01 through AC-001-05.

| ID | Type | Description | Expected |
|---|---|---|---|
| CON-01 | positive | Article I contains "Every modified file MUST trace to at least one AC" | Text present |
| CON-02 | positive | Article I contains "Untraced modifications are blocked" | Text present |
| CON-03 | positive | Article II contains "Each AC MUST have at least one test" | Text present |
| CON-04 | positive | Article II contains "Tests MUST contain at least one assertion per test block" | Text present |
| CON-05 | positive | Article II contains "Error paths...MUST have corresponding negative tests" | Text present |
| CON-06 | positive | Article III contains "Functions processing external input MUST have input validation" | Text present |
| CON-07 | positive | Article III contains "reference specific code locations" | Text present |
| CON-08 | positive | Article IV contains "Deferral language...blocked at write time" | Text present |
| CON-09 | positive | Article VI contains "Review output MUST reference specific files" | Text present |
| CON-10 | positive | Article VI contains "Generic approval without file references is blocked" | Text present |

---

### 4.8 Integration Tests — `quality-enforcement-integration.test.cjs`

#### 3f Corrective Loop Dispatch (AC-007-01 through AC-007-07)

| ID | Type | Description | Expected |
|---|---|---|---|
| INT-01 | positive | "TEST QUALITY INCOMPLETE" signal dispatches to 3f handler | Correct handler invoked |
| INT-02 | positive | "SPEC TRACE INCOMPLETE" signal dispatches to 3f handler | Correct handler invoked |
| INT-03 | positive | "SECURITY DEPTH INCOMPLETE" signal dispatches to 3f handler | Correct handler invoked |
| INT-04 | positive | "REVIEW DEPTH INCOMPLETE" signal dispatches to 3f handler | Correct handler invoked |
| INT-05 | positive | "DEFERRAL LANGUAGE DETECTED" signal dispatches as fallback | Correct handler invoked |

#### Max Retry Enforcement (AC-007-06)

| ID | Type | Description | Expected |
|---|---|---|---|
| INT-06 | positive | Re-delegation increments retry counter | Counter increases by 1 |
| INT-07 | positive | Max 5 retries before escalation | 6th attempt escalates to user |
| INT-08 | boundary | Retry counter at exactly 5 | Still attempts re-delegation |
| INT-09 | boundary | Retry counter at 6 | Escalates |

#### Deferral Detector Inline + Fallback (AC-007-07)

| ID | Type | Description | Expected |
|---|---|---|---|
| INT-10 | positive | Deferral detector fires inline as PreToolUse | Blocks the Write/Edit call |
| INT-11 | positive | Deferral detector has gate-check fallback entry | 3f dispatch table has the signal |

#### Hook Isolation (Regression)

| ID | Type | Description | Expected |
|---|---|---|---|
| INT-12 | regression | Existing gate-blocker still functions | check() returns expected result |
| INT-13 | regression | Existing test-watcher still functions | check() returns expected result |
| INT-14 | regression | Existing phase-loop-controller still functions | check() returns expected result |
| INT-15 | regression | Existing constitution-validator still functions | check() returns expected result |
| INT-16 | regression | Existing blast-radius-validator still functions | check() returns expected result |

#### Cross-Hook Compatibility

| ID | Type | Description | Expected |
|---|---|---|---|
| INT-17 | positive | New hooks load common.cjs without breaking existing exports | All existing exports still accessible |
| INT-18 | positive | New utility functions added to common.cjs exports | All 7 new functions exported |
| INT-19 | positive | settings.json hook registration includes new hooks | New hooks in correct event types |

#### Performance Budget

| ID | Type | Description | Expected |
|---|---|---|---|
| INT-20 | nfr | Deferral detector processes large file < 50ms | Elapsed < 50ms |
| INT-21 | nfr | Gate hooks (TQV, STV, SDV, RDV) complete < 500ms | Elapsed < 500ms each |

---

## 5. Flaky Test Mitigation

| Risk | Mitigation |
|---|---|
| File system timing in temp directory tests | Use `fs.mkdtempSync` for isolated temp dirs, clean up in `afterEach` |
| Git diff output variability | Mock git diff output as string fixtures rather than calling git |
| Regex edge cases across platforms | Test on exact string fixtures, not generated content |
| Hook module caching between tests | Use `delete require.cache[hookPath]` or fresh `createRequire` per test |
| Timestamp comparison in state assertions | Use `getTimestamp()` mock or compare only structural fields |

## 6. Performance Test Plan

| Hook | Budget | Method |
|---|---|---|
| deferral-detector | < 50ms | Time `check()` on 1000-line file input, assert elapsed < 50 |
| test-quality-validator | < 500ms | Time `check()` with 30 ACs + 10 test files, assert elapsed < 500 |
| spec-trace-validator | < 500ms | Time `check()` with 20 modified files + tasks.md, assert elapsed < 500 |
| security-depth-validator | < 500ms | Time `check()` with 15 source files containing external inputs, assert < 500 |
| review-depth-validator | < 500ms | Time `check()` with review output of 200 lines, assert < 500 |

## 7. Test Data Plan

### Boundary Values

- Empty file content (`''`)
- Single-line files
- Files with 10,000+ lines (performance boundary)
- AC IDs at exactly the min/max format boundary (`AC-000-00`, `AC-999-99`)
- Validation proximity at exactly radius boundary (line 15 for default radius 15)

### Invalid Inputs

- `null` input to `check()`
- `undefined` tool_input
- Non-string content fields
- Malformed JSON in stdin (standalone execution)
- Missing required context fields (no state, no requirements, no manifest)

### Maximum-Size Inputs

- 1000-line source file for deferral detector (performance test)
- 30 AC IDs across 10 test files for test quality validator
- 50 modified files for spec trace validator
- 20 source files with external inputs for security depth validator
- 500-line review output for review depth validator

## 8. Task-to-Test Traceability

| Task | File Under Test | Test File | Traces | Scenarios |
|---|---|---|---|---|
| T002 | `docs/isdlc/constitution.md` | `constitution-quality-articles.test.cjs` | FR-001, AC-001-01..05 | CON-01 through CON-10 |
| T003 | `src/claude/hooks/deferral-detector.cjs` | `deferral-detector.test.cjs` | FR-002, AC-002-01..06 | DD-01 through DD-25 |
| T004 | (T003 test implementation) | `deferral-detector.test.cjs` | FR-002 | DD-01 through DD-25 |
| T005 | `src/claude/hooks/test-quality-validator.cjs`, `common.cjs` | `test-quality-validator.test.cjs`, `common-quality-utilities.test.cjs` | FR-003, AC-003-01..08 | TQV-01..20, CQU-01..24 |
| T006 | (T005 test implementation) | `test-quality-validator.test.cjs` | FR-003 | TQV-01..20 |
| T007 | `src/claude/hooks/spec-trace-validator.cjs` | `spec-trace-validator.test.cjs` | FR-004, AC-004-01..07 | STV-01..21 |
| T008 | (T007 test implementation) | `spec-trace-validator.test.cjs` | FR-004 | STV-01..21 |
| T009 | `src/claude/hooks/security-depth-validator.cjs` | `security-depth-validator.test.cjs` | FR-005, AC-005-01..06 | SDV-01..16 |
| T010 | (T009 test implementation) | `security-depth-validator.test.cjs` | FR-005 | SDV-01..16 |
| T011 | `src/claude/hooks/review-depth-validator.cjs` | `review-depth-validator.test.cjs` | FR-006, AC-006-01..05 | RDV-01..15 |
| T012 | (T011 test implementation) | `review-depth-validator.test.cjs` | FR-006 | RDV-01..15 |
| T013 | `src/claude/commands/isdlc.md`, `iteration-requirements.json` | `quality-enforcement-integration.test.cjs` | FR-007, AC-007-01..07 | INT-01..21 |

## 9. Coverage Targets

| Module | Target | Rationale |
|---|---|---|
| common.cjs (7 new utilities) | 100% | Critical enforcement functions, all branches must be tested |
| deferral-detector.cjs | 100% | Inline blocker, false positives are high-impact |
| test-quality-validator.cjs | 100% | Gate enforcement, false negatives defeat the purpose |
| spec-trace-validator.cjs | 95% | Git diff parsing may have edge cases |
| security-depth-validator.cjs | 95% | Validation proximity heuristic has edge cases |
| review-depth-validator.cjs | 95% | Finding density threshold is configurable |
| Phase-Loop 3f integration | 90% | Integration paths depend on full orchestrator context |

## 10. GATE-04 Checklist

- [x] Test strategy covers unit, integration, E2E (via standalone execution), security (SDV tests), performance (budget tests)
- [x] Test cases exist for all 7 FRs (FR-001 through FR-007)
- [x] Traceability matrix complete: 30 ACs mapped to ~200 test cases
- [x] Coverage targets defined per module (95-100%)
- [x] Test data strategy documented (boundary, invalid, maximum-size)
- [x] Critical paths identified: deferral detection precision, AC coverage completeness, 3f loop retry/escalation
