# Non-Functional Requirements Matrix: REQ-0012

| ID | Category | Requirement | Threshold | Validation Method |
|----|----------|-------------|-----------|-------------------|
| NFR-01 | Reliability | Intent detection false positive rate | <5% | Consent step acts as safety net; manual review of edge cases |
| NFR-02 | Backward Compat | Slash commands work unchanged | 100% | Existing slash command tests continue to pass |
| NFR-03 | Maintainability | Intent mapping is a readable table | Editable in CLAUDE.md | Code review validates readability |
| NFR-04 | Consistency | Template and dogfooding copy match | Identical Workflow-First section | Diff check during implementation |
