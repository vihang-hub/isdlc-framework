# Non-Functional Requirements Matrix: GH-64

**Issue:** GH-64
**Artifact Folder:** gh-64-agents-ignore-injected-gate-requirements
**Status:** Draft
**Created:** 2026-02-20

---

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Performance | Gate requirements block generation must not add significant overhead | `buildGateRequirementsBlock()` completes in < 50ms (p95) | Unit test timing with `performance.now()` across 100 iterations | Must Have |
| NFR-002 | Backward Compatibility | All existing workflows must continue to function without modification | Zero regression in existing workflow completion; all existing tests pass | Run full test suite (`npm run test:all`) | Must Have |
| NFR-003 | Maintainability | New prohibited actions must be addable via config without code changes | A prohibition added to JSON config appears in generated block without code changes | Add test prohibition to config, regenerate block, confirm it appears | Should Have |
| NFR-004 | Observability | Injection success and failure must be logged for debugging | Every injection attempt produces a log entry in `.isdlc/hook-activity.log` | Grep hook activity log after running a workflow | Should Have |
| NFR-005 | Fail-Open Safety | Injection failures must never block agent delegation | `buildGateRequirementsBlock()` returns empty string on any error | Unit tests with corrupt/missing config files | Must Have |
| NFR-006 | Conciseness | Gate requirements block must remain compact | Total block length <= 30 lines with all features enabled | Unit test assertion on line count | Must Have |
| NFR-007 | Readability | Gate requirements block must be visually distinguishable | Block uses separator characters not used by any other injection block | Automated test checking for unique separator pattern | Must Have |
| NFR-008 | Agent Compatibility | Changes to agent files must not alter agent frontmatter or break loading | All agent files continue to load successfully | Verify agents load by running a workflow | Must Have |
