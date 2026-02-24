# Non-Functional Requirements Matrix: REQ-0009

| ID | Category | Requirement | Threshold | Validation Method |
|----|----------|-------------|-----------|-------------------|
| NFR-01 | Performance | Task refinement step completes within 60s | <60s for 100 reqs, 500 design elements | Time measurement during Phase 06 |
| NFR-01a | Performance | Plan-surfacer hook latency unchanged | <100ms (existing budget) | Hook performance profiling |
| NFR-02 | Backward Compatibility | Existing tasks.md files continue to work | Zero breakage | Regression tests against old-format tasks.md |
| NFR-02a | Backward Compatibility | Agents checking only [X]/[ ] are unaffected | Zero changes to existing agent parsing | Integration test with existing PLAN INTEGRATION PROTOCOL |
| NFR-02b | Backward Compatibility | Plan-surfacer hook does not block on missing annotations | fail-open on format validation | Hook unit tests |
| NFR-02c | Backward Compatibility | Fix workflow (no design phase) generates valid tasks.md | Tasks.md generated without file-level tasks | Workflow integration test |
| NFR-03 | Maintainability | Enhanced format documented in ORCH-012 SKILL.md | Schema reference section exists | Documentation review |
| NFR-03a | Maintainability | Annotation syntax is consistent across all task types | Pipe-delimited `\| key: value` format | Format validation |
| NFR-04 | Extensibility | Format supports future extensions without breaking | New keys parseable, unknown keys ignored | Schema validation test |
| NFR-04a | Extensibility | Pipe-delimited annotations are order-independent | Any annotation order parses correctly | Unit test |

## Constitutional Compliance

| Article | Relevant NFR | How Addressed |
|---------|-------------|---------------|
| I (Specification Primacy) | All FRs | tasks.md becomes the specification for implementation |
| II (Test-First) | NFR-02, C-04 | Existing 1229+ tests preserved, new tests added first |
| V (Simplicity) | NFR-04 | Pipe-delimited format is simplest extensible approach |
| VII (Traceability) | FR-02, NFR-03 | Every task traces to a requirement |
| VIII (Documentation) | NFR-03 | Schema documented in skill definition |
| IX (Gate Integrity) | FR-04 | Refinement step integrated into gate pipeline |
| XIII (Module System) | C-03 | Hooks remain CJS, lib remains ESM |
| XIV (State Management) | C-02 | Single tasks.md file, no shadow state |
