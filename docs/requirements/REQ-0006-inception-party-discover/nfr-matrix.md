# Non-Functional Requirements Matrix — REQ-0006

| ID | Category | Requirement | Target | Validation Method |
|----|----------|------------|--------|-------------------|
| NFR-001 | Performance | Party mode total wall-clock time should be less than classic mode | <80% of classic mode duration | Benchmark comparison (manual) |
| NFR-002 | Scalability | Inter-agent message volume per phase should be bounded | Max 10 SendMessage calls per parallel phase | Message count audit in team logs |
| NFR-003 | Maintainability | Persona definitions must be declarative and extensible | JSON/YAML config, not hardcoded | Code review — verify config file exists |
| NFR-004 | Quality | All party mode artifacts must pass the same quality gates as classic mode | Same GATE validation criteria | GATE-01 through GATE-08 pass |

## Constraints

| ID | Constraint | Rationale |
|----|-----------|-----------|
| CON-001 | No new npm dependencies | Uses only Claude Code built-in team features |
| CON-002 | Backward compatible | Classic mode unchanged, discovery_context envelope schema unchanged |
| CON-003 | Existing agent reuse | Reuse D8 and adapt D5 rather than creating entirely new agents |
| CON-004 | Article XIII compliance | New agent .md files follow module system conventions |
