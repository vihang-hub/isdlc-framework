# Non-Functional Requirements Matrix: REQ-0022 Custom Skill Management

**Feature:** Custom Skill Management
**Created:** 2026-02-18

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Performance | Skill injection during phase delegation adds minimal latency | p95 < 100ms added latency | Instrumented timing around injection code path in STEP 3d | Must Have |
| NFR-002 | Scalability | System supports up to 50 registered external skills | Manifest parse + all skill file reads < 500ms for 50 skills | Load test with 50 mock skill files | Should Have |
| NFR-003 | Reliability | Injection failures never block workflow progression | Zero workflow failures from injection errors; all failures logged as warnings | Error injection testing (missing files, malformed manifest) | Must Have |
| NFR-004 | Compatibility | All operations work in single-project and monorepo modes | Correct path resolution in both modes | Unit tests with mocked monorepo config | Must Have |
| NFR-005 | Compatibility | Zero behavioral change for projects without external skills | All existing test suites pass unchanged | Run full test suite with feature code present but no manifest | Must Have |
| NFR-006 | Usability | Validation errors identify every missing/malformed field with examples | Users self-correct on first retry | Manual validation with intentionally broken frontmatter | Should Have |

## Constitutional References

- **NFR-003** traces to **Article X (Fail-Safe Defaults)**: The system must fail open — injection errors produce warnings, never blocks.
- **NFR-005** traces to **Article IX (Quality Gate Integrity)**: Existing quality gates must not be affected by the new feature.
- **NFR-006** traces to **Article IV (Explicit Over Implicit)**: Error messages must be specific and actionable, not vague.
