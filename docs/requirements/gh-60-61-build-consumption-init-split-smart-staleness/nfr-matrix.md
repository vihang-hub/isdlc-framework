# Non-Functional Requirements Matrix

**Feature**: GH-60 + GH-61 (Build Consumption: Init Split & Smart Staleness)
**Phase**: 01-requirements
**Status**: Draft
**Created**: 2026-02-20

---

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Backward Compatibility | All existing workflows (feature, fix, test-run, test-generate, upgrade) function without modification. MODE: init-and-phase-01 remains operational. | 0 regressions in existing workflow execution paths | Run full feature and fix workflow end-to-end after changes; verify MODE: init-and-phase-01 produces identical output | Must Have |
| NFR-002 | Performance | Blast-radius-aware staleness check adds negligible latency. `git diff --name-only` on large repos completes quickly. | git diff completes in < 2 seconds for 500+ commit range; impact-analysis parsing < 100ms for 50+ files | Benchmark git diff on test repositories with varying commit depths; time extractFilesFromImpactAnalysis with sample impact-analysis.md files | Should Have |
| NFR-003 | Resilience | Graceful degradation when blast-radius staleness cannot be performed (missing impact-analysis.md, git errors). | Fallback to naive hash comparison in 100% of failure scenarios; 0 uncaught exceptions | Unit tests for each failure mode: missing file, git error, unparseable table, empty content | Must Have |
| NFR-004 | Testability | New utility functions are pure or have injectable dependencies. | extractFilesFromImpactAnalysis is pure (string -> array); staleness check accepts pre-computed file lists for testing | Code review of function signatures; unit test suite runs without git or filesystem dependencies | Must Have |
| NFR-005 | Maintainability | Single execution path for all phase delegations via Phase-Loop Controller. | 1 execution path for all phases (no dual-path architecture); MODE: init-only performs 0 agent delegations | Architecture review: trace execution flow for feature workflow; verify Phase-Loop Controller handles phases 01-08 uniformly | Should Have |
