# Non-Functional Requirements Matrix: REQ-0010

## Blast Radius Coverage Validation

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Performance | Hook execution time | < 2 seconds end-to-end (parse + git diff + validation) | Measure wall-clock time of `check()` function with 50-file impact analysis | Must Have |
| NFR-002 | Reliability | Fail-open on internal errors | 100% of internal errors result in `decision: "allow"` | Unit tests for file I/O failures, git command failures, parse errors, missing state | Must Have |
| NFR-003 | Backward Compatibility | No regression to existing tests | 0 existing test failures introduced | Run `npm run test:all` before and after; diff results must show zero new failures | Must Have |
| NFR-004 | Test Coverage | New hook test coverage | >= 80% line coverage of blast-radius-validator.cjs | node:test + coverage report for the new hook file | Must Have |
| NFR-005 | Cross-Platform | Path operations use path.join() | 0 hardcoded path separators in hook code | Static analysis / code review grep for `/` or `\\` in path construction | Must Have |

## Compliance Mapping

| NFR ID | Constitutional Article | Compliance Notes |
|--------|----------------------|-----------------|
| NFR-001 | Article V (Simplicity First) | Simple parse + diff approach, no over-engineering |
| NFR-002 | Article X (Fail-Safe Defaults) | Fail-open is mandatory for all hooks |
| NFR-003 | Article II (Test-First Development) | Regression threshold: total tests must not decrease |
| NFR-004 | Article II (Test-First Development) | >= 80% unit test coverage required |
| NFR-005 | Article XII (Cross-Platform Compatibility) | path.join() for all path operations |
