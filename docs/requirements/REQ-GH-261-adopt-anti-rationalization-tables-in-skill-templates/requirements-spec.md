# Requirements Specification: Constitutional Quality Enforcement (GH-261)

## 1. Business Context

**Problem**: Hooks enforce structural compliance (tests exist, files touched, phases run) but miss qualitative shortcuts — superficial tests, missing AC coverage, deferred work, rubber-stamp reviews. Agents can technically pass all gates while producing low-quality work.

**Solution**: Strengthen constitutional articles with verifiable quality criteria, then build enforcement hooks that detect qualitative gaps and drive corrective loops until gaps are closed.

**Pivot**: Originally proposed anti-rationalization tables (behavioral persuasion from addyosmani/agent-skills). Pivoted to constitutional enforcement because iSDLC has deterministic enforcement infrastructure that agent-skills lacks. Instead of persuading agents not to skip quality steps, we build hooks that catch them.

**Success Metric**: An agent cannot pass a phase gate with untested ACs, zero-assertion test files, TODO deferrals in code, or untraced file modifications.

## 2. Stakeholders and Personas

### The Framework
- **Role**: Quality enforcer for every project using iSDLC
- **Goals**: Ensure agents produce substantive, traceable, tested work — not just structurally compliant output

### Developer (indirect)
- **Role**: Benefits from higher quality agent output
- **Impact**: Fewer superficial tests to fix, fewer TODO deferrals to clean up, better AC coverage

## 3. User Journey

1. Software-developer implements Phase 06 — writes code and tests
2. Writes `// TODO: add rate limiting later` in a file
3. Deferral-detector fires inline — blocks the Write, tells agent to implement now or document in ADR
4. Agent rewrites without the TODO
5. Agent signals phase completion
6. test-quality-validator fires — finds AC-004-03 has no matching test, one test file has zero assertions
7. Phase-Loop Controller re-delegates: "Write test for AC-004-03, fix zero-assertion file"
8. Agent fixes, re-signals completion
9. spec-trace-validator fires — all files trace to ACs, all ACs have file modifications
10. Gate passes — Phase 06 complete

## 4. Technical Context

**Enforcement gap analysis** (rationalizations mapped to articles):

| Article | Rationalizations that bypass it | Current enforcement | Gap |
|---|---|---|---|
| I — Specification Primacy | 3 | blast-radius-validator | No AC-to-implementation trace verification |
| II — Test-First | 5 | test-watcher, coverage threshold | No test quality check (assertions, error paths, AC traceability) |
| III — Security | 3 | secret-scan, SAST | No input validation verification, self-reported compliance |
| IV — Explicit Over Implicit | 2 | None | Deferral forbidden but no hook enforces |
| VI — Code Review | 2 | gate-blocker ensures Phase 08 | No review depth verification |

**Hook infrastructure**: 38 existing hooks, CJS format, PreToolUse/PostToolUse/Notification types, `common.cjs` shared utilities, core bridge pattern.

## 5. Quality Attributes and Risks

| Attribute | Priority | Threshold |
|---|---|---|
| Precision | Critical | Zero false positives on legitimate code patterns |
| Performance | High | Deferral-detector <50ms, gate hooks <500ms |
| Fail-open | Critical | Hook crash does not block workflow |
| Specificity | High | Block messages drive automated fixes — file paths, line numbers, AC IDs |

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| False positives on deferral-detector | High | Medium | Comprehensive exemption list: test files, ADRs, deferral-exempt marker |
| AC extraction regex misses non-standard formats | Medium | Medium | Standardise AC format in constitution |
| Assertion count false negatives (custom helpers) | Medium | Low | Extensible pattern list |
| Performance on every Write/Edit | Medium | Low | Regex-only, no file reads |

## 6. Functional Requirements

### FR-001: Constitutional Article Strengthening — Must Have
**Confidence**: High

- AC-001-01: Given Article I, then it is updated with: "Every modified file MUST trace to at least one AC via tasks.md. Untraced modifications are blocked at gate."
- AC-001-02: Given Article II, then it is updated with: "Each AC MUST have at least one test with a trace annotation. Tests MUST contain at least one assertion per test block. Error paths (try/catch) MUST have corresponding negative tests."
- AC-001-03: Given Article III, then it is updated with: "Functions processing external input MUST have input validation. Constitutional validation MUST reference specific code locations, not generic compliance claims."
- AC-001-04: Given Article IV, then it is updated with: "Deferral language (TODO later, FIXME next iteration) in production code is blocked at write time. Deferred work MUST be documented in ADR or marked out-of-scope."
- AC-001-05: Given Article VI, then it is updated with: "Review output MUST reference specific files and findings. Generic approval without file references is blocked."

### FR-002: Deferral Detector Hook (Inline) — Must Have
**Confidence**: High

- AC-002-01: Given an agent Write/Edit call, when the hook fires as PreToolUse, then it inspects the content being written.
- AC-002-02: Given written content, when it contains deferral patterns (TODO later, FIXME next, will handle later, etc.), then the tool call is blocked.
- AC-002-03: Given a file in tests/, ADR docs, or with deferral-exempt marker, then the scan is skipped.
- AC-002-04: Given a block, then the message lists each deferral line with line number and options (implement now, ADR, out-of-scope, exempt marker).
- AC-002-05: Given a block, then the agent rewrites the file without deferral language.
- AC-002-06: Given the deferral-detector, then it has no retry counter — inline correction only.

### FR-003: Test Quality Validator Hook (Gate Check) — Must Have
**Confidence**: High

- AC-003-01: Given phase completion for 06-implementation or 16-quality-loop, when the hook fires, then it checks test quality.
- AC-003-02: Given requirements-spec.md, then the hook extracts all AC-NNN-NN identifiers.
- AC-003-03: Given test files, then the hook scans for trace annotations matching AC IDs.
- AC-003-04: Given untested ACs, then the block message lists each with description.
- AC-003-05: Given test blocks, then the hook counts assertions and flags blocks with zero.
- AC-003-06: Given modified source files with error paths, then the hook flags those without negative tests.
- AC-003-07: Given a block, then the message includes specific fix instructions.
- AC-003-08: Given a block, then the Phase-Loop Controller enters 3f corrective loop with max 5 retries.

### FR-004: Spec Trace Validator Hook (Gate Check) — Must Have
**Confidence**: High

- AC-004-01: Given phase completion for 06-implementation, when the hook fires, then it checks spec traceability.
- AC-004-02: Given the feature branch, then the hook reads git diff of modified files.
- AC-004-03: Given tasks.md, then the hook builds a map of file to AC traces.
- AC-004-04: Given modified files not in any task's files list, then they are flagged as untraced.
- AC-004-05: Given ACs with no corresponding file modification, then they are flagged as unimplemented.
- AC-004-06: Given a block, then the message lists untraced files and unimplemented ACs.
- AC-004-07: Given a block, then the Phase-Loop Controller enters 3f corrective loop with max 5 retries.

### FR-005: Security Depth Validator Hook (Gate Check) — Must Have
**Confidence**: High

- AC-005-01: Given phase completion for 06-implementation, when the hook fires, then it checks security depth.
- AC-005-02: Given modified files, then the hook scans for external input patterns (req.body, process.argv, JSON.parse on external data).
- AC-005-03: Given an external input pattern, then the hook checks for validation within 15 lines or in called functions.
- AC-005-04: Given unvalidated inputs, then the block message lists file, line, and input source.
- AC-005-05: Given agent output with generic security claims, then the hook flags claims without specific file:line references.
- AC-005-06: Given a block, then the Phase-Loop Controller enters 3f corrective loop with max 5 retries.

### FR-006: Review Depth Validator Hook (Gate Check) — Must Have
**Confidence**: High

- AC-006-01: Given phase completion for 08-code-review, when the hook fires, then it checks review depth.
- AC-006-02: Given QA agent output, then the hook counts unique file path references.
- AC-006-03: Given output with generic approval language and fewer than 3 file references, then it is flagged.
- AC-006-04: Given a block, then the message instructs re-review with file-level findings.
- AC-006-05: Given a block, then the Phase-Loop Controller enters 3f corrective loop with max 5 retries.

### FR-007: Phase-Loop Controller Integration — Must Have
**Confidence**: High

- AC-007-01: Given test-quality-validator block, then 3f dispatch handles "TEST QUALITY INCOMPLETE".
- AC-007-02: Given spec-trace-validator block, then 3f dispatch handles "SPEC TRACE INCOMPLETE".
- AC-007-03: Given security-depth-validator block, then 3f dispatch handles "SECURITY DEPTH INCOMPLETE".
- AC-007-04: Given review-depth-validator block, then 3f dispatch handles "REVIEW DEPTH INCOMPLETE".
- AC-007-05: Given deferral-detector block, then 3f dispatch handles "DEFERRAL LANGUAGE DETECTED" as fallback.
- AC-007-06: Given any new hook block, then max retries is 5 before escalating to user.
- AC-007-07: Given deferral-detector, then it fires inline (PreToolUse) with gate-check as fallback.

## 7. Out of Scope

| Item | Reason | Follow-up |
|---|---|---|
| Semantic code analysis (LLM-in-the-loop) | Too complex for pattern matching | #270 |
| Cross-file data flow analysis | Requires call graph analysis | #271 |
| Test mutation analysis | Requires mutation framework | #272 |
| Historical quality trend tracking | Nice-to-have, not enforcement | #273 |

## 8. MoSCoW Prioritization

| FR | Title | Priority | Rationale |
|---|---|---|---|
| FR-001 | Constitutional Strengthening | Must Have | Source of truth for quality criteria |
| FR-002 | Deferral Detector | Must Have | Catches Article IV violations inline |
| FR-003 | Test Quality Validator | Must Have | Biggest gap — 5 rationalizations bypass Article II |
| FR-004 | Spec Trace Validator | Must Have | Closes Article I traceability gap |
| FR-005 | Security Depth Validator | Must Have | Closes Article III self-report gap |
| FR-006 | Review Depth Validator | Must Have | Closes Article VI rubber-stamp gap |
| FR-007 | Phase-Loop Integration | Must Have | Wires hooks into corrective loop |

## Pending Sections

(none — all sections complete)
