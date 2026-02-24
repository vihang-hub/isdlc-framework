# BUG-0017: Non-Functional Requirements Matrix

| NFR ID | Category | Requirement | Validation Method |
|--------|----------|-------------|-------------------|
| NFR-1 | Reliability | Both fixes must maintain fail-open behavior for genuine edge cases (corrupt files, permission errors) | Test with corrupt JSON, missing files, permission-denied scenarios |
| NFR-2 | Usability | Error messages must be actionable — developer must understand what to do from the message alone | Review error message content in test assertions |
| NFR-3 | Compatibility | Both fixes must be backward compatible with existing hook test suites | Run full `npm run test:hooks` — zero regressions |
| NFR-4 | Maintainability | No new dependencies introduced | Verify package.json unchanged |

## Traceability

| NFR | Bug 0.9 (gate-blocker) | Bug 0.10 (state-write-validator) |
|-----|----------------------|-------------------------------|
| NFR-1 | N/A (already fail-open on unresolvable paths) | Applies — fail-open on corrupt disk, missing file |
| NFR-2 | Applies — error must list all valid variants | Applies — block message must explain version requirement |
| NFR-3 | Applies — existing gate-blocker tests must pass | Applies — existing state-write-validator tests must pass |
| NFR-4 | Applies | Applies |
