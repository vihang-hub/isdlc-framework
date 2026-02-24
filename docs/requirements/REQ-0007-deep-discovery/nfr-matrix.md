# Non-Functional Requirements Matrix: REQ-0007 Deep Discovery

| NFR ID | Category | Requirement | Metric | Target | Validation |
|--------|----------|-------------|--------|--------|------------|
| NFR-001 | Performance | Parallel agent execution time | Wall clock time | <= current baseline + 30% (standard), +60% (full) | Phase 1 timing in orchestrator logs |
| NFR-001a | Performance | Debate round duration | Wall clock per round | <= 3 min (standard), <= 5 min (full) | Debate round timestamps |
| NFR-002 | Compatibility | Party personas preserved | JSON schema match | party-personas.json unchanged for new projects | Schema validation test |
| NFR-002a | Compatibility | discovery_context additive | No removed fields | All existing fields present + new ones added | Envelope schema test |
| NFR-003 | Test Regression | Existing test suite | Test count | >= 945 (current baseline) | npm run test:all |
| NFR-003a | Test Regression | New test coverage | New tests added | >= 20 new tests for debate/agent/flag/envelope changes | Test file count |
| NFR-004 | Documentation | Agent/command docs updated | Files updated | All new agents documented, AGENTS.md updated, README updated | Code review checklist |
| NFR-004a | Documentation | Module system compliance | No hook changes | New agents are markdown-only | File extension check |
