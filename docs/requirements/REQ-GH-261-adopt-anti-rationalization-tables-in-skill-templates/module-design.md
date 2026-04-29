# Module Design: Constitutional Quality Enforcement (GH-261)

## Module 1: Deferral Detector (`src/claude/hooks/deferral-detector.cjs`)
- **Responsibility**: Block Write/Edit calls containing deferral language
- **Type**: PreToolUse (Write, Edit)
- **Patterns**: TODO later, FIXME next, will handle later, add later, implement later, future work
- **Exemptions**: test files, ADR docs, deferral-exempt marker, BACKLOG.md, tasks.md
- **Performance**: <50ms (regex only, no file reads)

## Module 2: Test Quality Validator (`src/claude/hooks/test-quality-validator.cjs`)
- **Responsibility**: Verify test quality at phase gate — AC coverage, assertions, error path tests
- **Type**: Notification (phase completion for 06, 16)
- **Checks**: AC trace coverage, assertion count per test block, error path negative tests
- **Performance**: <500ms

## Module 3: Spec Trace Validator (`src/claude/hooks/spec-trace-validator.cjs`)
- **Responsibility**: Verify file-to-AC traceability at phase gate
- **Type**: Notification (phase completion for 06)
- **Checks**: Untraced modifications, unimplemented ACs
- **Exemptions**: config files, test files, docs/requirements/

## Module 4: Security Depth Validator (`src/claude/hooks/security-depth-validator.cjs`)
- **Responsibility**: Verify external input handling has validation
- **Type**: Notification (phase completion for 06)
- **Checks**: External input detection, validation proximity, generic claim flagging

## Module 5: Review Depth Validator (`src/claude/hooks/review-depth-validator.cjs`)
- **Responsibility**: Verify code review output is substantive
- **Type**: Notification (phase completion for 08)
- **Checks**: File reference count, generic approval detection, finding density

## Module 6: Shared Utilities (additions to `src/claude/hooks/lib/common.cjs`)
- extractACsFromSpec(specPath) → [{ id, description }]
- scanTestTraces(testDir, acIds) → { covered[], uncovered[] }
- countAssertions(testContent) → [{ testName, line, count }]
- detectErrorPaths(sourceContent) → [{ line, pattern }]
- detectExternalInputs(sourceContent) → [{ line, pattern, type }]
- checkValidationProximity(content, inputLine, radius) → boolean
- parseDeferralPatterns(content) → [{ line, text, pattern }]

## Module 7: Phase-Loop Controller Updates (`src/claude/commands/isdlc.md`)
- 5 new block signals in 3f dispatch table
- Max 5 retries for all new hooks
- Re-delegation prompt templates per hook type

## Module 8: Constitution Updates (`docs/isdlc/constitution.md`)
- Article I: untraced modifications blocked
- Article II: AC test coverage, assertions, error path tests
- Article III: input validation, specific file references
- Article IV: deferral language blocked at write time
- Article VI: review depth, file references required

## Dependency Diagram

```
Existing infrastructure (unchanged):
  settings.json → hook registration
  gate-blocker.cjs → phase gate
  Phase-Loop Controller → 3f dispatch
  common.cjs → shared utilities

New hooks:
  deferral-detector.cjs ─── PreToolUse (Write/Edit) ─── inline block
  test-quality-validator.cjs ─┐
  spec-trace-validator.cjs   ─┤── Notification (phase completion) ─── 3f loop (5 retries)
  security-depth-validator.cjs─┤
  review-depth-validator.cjs ──┘

Modified:
  constitution.md ─── strengthened articles
  iteration-requirements.json ─── new hook configs
  isdlc.md ─── 5 new 3f handlers
  common.cjs ─── 7 new utility functions
```
