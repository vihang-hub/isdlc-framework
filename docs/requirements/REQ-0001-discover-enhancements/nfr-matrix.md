# Non-Functional Requirements Matrix: REQ-0001

**Feature**: Discover Command Enhancements (DE-001 through DE-005)

## Matrix

| NFR ID | Category | Requirement | Threshold | Validation | Constitutional Article |
|--------|----------|-------------|-----------|------------|----------------------|
| NFR-001 | Module Compatibility | Hook changes (iteration-corridor.js, test-watcher.js) MUST use CommonJS syntax only | 0 ESM imports in hook files | GATE-05: module system boundary check | Article XIII |
| NFR-002 | State Integrity | New state.json fields (iteration_config, discovery_context) MUST be additive only | No removed/renamed fields | GATE-05: schema compatibility test | Article XIV |
| NFR-003 | Fail-Open | Hooks MUST exit 0 and produce no output on error | All error paths exit 0 | GATE-05: error path tests | Article X |
| NFR-004 | Test Baseline | Total test count MUST NOT decrease below 555 | >= 555 tests passing | GATE-05: test count check | Article II |
| NFR-005 | Cross-Platform | All file operations MUST use path.join()/path.resolve() | 0 hardcoded path separators | GATE-07: code review check | Article XII |
| NFR-006 | Backward Compat | Existing /discover behavior MUST work for users who have never used --shallow | No regression in default flow | GATE-06: integration test | Article IX |
| NFR-007 | Graceful Degradation | Missing discovery_context in state.json MUST NOT cause errors | Workflows proceed without error | GATE-06: no-context integration test | Article X |

## Traceability

| NFR | Impacted Enhancements | Impacted Files |
|-----|----------------------|----------------|
| NFR-001 | DE-002 | iteration-corridor.js, test-watcher.js |
| NFR-002 | DE-002, DE-003 | state.json schema |
| NFR-003 | DE-002 | iteration-corridor.js, test-watcher.js |
| NFR-004 | All | test suite |
| NFR-005 | DE-002 | iteration-corridor.js, test-watcher.js |
| NFR-006 | DE-004 | discover-orchestrator.md, feature-mapper.md |
| NFR-007 | DE-003 | 00-sdlc-orchestrator.md, agents 01/02/03 |
