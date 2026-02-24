# Non-Functional Requirements Matrix — BUG-0018

| ID | Category | Requirement | Validation Method |
|----|----------|-------------|-------------------|
| NFR-1 | Backward Compatibility | Picker works with old CLAUDE.md format when BACKLOG.md absent | Test with BACKLOG.md absent, verify CLAUDE.md fallback |
| NFR-2 | Regression Safety | All existing tests (ESM + CJS) pass without modification to unrelated files | `npm run test:all` |
| NFR-3 | Performance | Pattern matching changes add no measurable latency | Manual verification (prompt file changes only) |
