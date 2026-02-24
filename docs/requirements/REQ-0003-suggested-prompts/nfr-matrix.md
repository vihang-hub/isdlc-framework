# Non-Functional Requirements Matrix: REQ-0003

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Compatibility | Zero test regression | All 596+ tests pass | `npm run test:all` before and after | Must Have |
| NFR-002 | Maintainability | Additive agent file changes only | No existing sections modified | Code review: only new sections appended | Must Have |
| NFR-003 | Simplicity | No new npm dependencies | package.json unchanged | Dependency count check | Must Have |
| NFR-004 | Compatibility | Module system compliance | .cjs uses CommonJS, .js uses ESM | Automated lint check | Must Have |
| NFR-005 | Compatibility | Cross-platform output | ASCII-only prompt formatting | Test on macOS/Linux/Windows | Should Have |
| NFR-006 | Reliability | No state.json schema changes | Prompts are ephemeral output only | State schema diff | Must Have |
| NFR-007 | Performance | Minimal overhead | < 50ms added to agent completion | No new file I/O for prompts | Should Have |
