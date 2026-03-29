# Reverse-Engineer Report

**Generated**: 2026-03-28 (re-discovery)
**Previous**: 2026-02-07
**Project**: iSDLC Framework (self-development / dogfooding)
**Method**: Full source code analysis with behavior extraction

---

## Execution Summary

| Metric | Previous (2026-02-07) | Current (2026-03-28) |
|--------|-----------------------|----------------------|
| Total Acceptance Criteria | 87 | 87 (existing) + ~150 estimated new |
| Business Domains | 7 + 1 TBD | 8 existing + 9 new domains identified |
| Source Files Analyzed | 20 production files (12,895 LOC) | 255 production files (60,288 LOC) |
| Test Files Analyzed | 20 test files (555 tests) | 365 test files (1,600 tests) |
| Characterization Tests Generated | 7 files, 87 test.skip() scaffolds | Pending regeneration |
| Traceability Entries | 87 rows in ac-traceability.csv | 87 rows (pending expansion) |

---

## AC by Priority (Existing 87 AC)

| Priority | Count | Percentage |
|----------|-------|------------|
| Critical | 26 | 29.9% |
| High | 45 | 51.7% |
| Medium | 16 | 18.4% |

---

## AC by Domain (Existing 8 Domains)

| Domain | AC Count | Critical | High | Medium |
|--------|----------|----------|------|--------|
| Workflow Orchestration | 14 | 5 | 6 | 3 |
| Installation & Lifecycle | 16 | 4 | 8 | 4 |
| Iteration Enforcement | 18 | 7 | 8 | 3 |
| Skill Observability | 10 | 2 | 5 | 3 |
| Multi-Provider LLM Routing | 9 | 3 | 4 | 2 |
| Constitution Management | 8 | 2 | 4 | 2 |
| Monorepo & Project Detection | 12 | 3 | 6 | 3 |
| Agent Orchestration | TBD | -- | -- | -- |

---

## New Domains Identified (Not Yet Extracted)

The codebase has grown from ~24 to ~255 production modules since the last extraction. The following 9 new domains have been identified but AC have NOT yet been extracted:

| # | Domain | Key Modules | Estimated AC |
|---|--------|-------------|--------------|
| 9 | Core Orchestration | phase-loop.js, fan-out.js, dual-track.js, instruction-generator.js | 15-20 |
| 10 | Content Model | agent-classification.js, skill-classification.js, command-classification.js, content-model.js | 10-12 |
| 11 | Search Subsystem | router.js, ranker.js, backends/*.js, config.js, detection.js | 12-15 |
| 12 | Embedding Pipeline | chunker/, engine/, aggregation/, distribution/, knowledge/, redaction/ | 15-20 |
| 13 | Backlog Management | backlog-ops.js, item-resolution.js, item-state.js, slug.js, source-detection.js | 10-12 |
| 14 | Compliance Engine | engine.cjs, contract-evaluator.js, contract-loader.js, enforcement.js | 12-15 |
| 15 | State Management | schema.js, validation.js, paths.js, monorepo.js | 8-10 |
| 16 | Teams Framework | specs/*.js, instances/*.js, registry.js, implementation-loop.js | 15-18 |
| 17 | Validators | gate-logic.js, checkpoint-router.js, traceability-validator.js, coverage-presence-validator.js | 12-15 |

**Estimated total when fully extracted:** ~220-240 AC across 17 domains.

---

## Test Coverage Against Existing AC (87 AC)

| Coverage Status | Count | Percentage | Change from Previous |
|----------------|-------|------------|----------------------|
| COVERED (existing tests verify this AC) | 58 | 66.7% | No change |
| PARTIAL (some aspects tested) | 9 | 10.3% | No change |
| UNCOVERED (no existing tests) | 20 | 23.0% | No change |

**Note:** Coverage status for the original 87 AC has not been re-evaluated against the expanded test suite. Some previously UNCOVERED AC may now be covered by new tests in `tests/core/` and `tests/providers/`. A full re-evaluation is recommended.

### High-Priority Uncovered AC

These Critical/High AC items had no test coverage at last evaluation:

1. **AC-WO-010** (High): Workflow Override Merging
2. **AC-WO-014** (Critical): Last Workflow Phase Detection
3. **AC-IE-015** (High): ATDD Skipped Test Detection
4. **AC-IL-009** (High): Obsolete File Cleanup
5. **AC-PR-005** (High): Environment Override Injection
6. **AC-PR-006** (High): Fallback Warning Emission
7. **AC-CM-004** (High): Article Description Mapping

---

## Recommendations

1. **Re-extract AC for new domains** (P1): The 9 new domains represent ~150 additional AC that should be formally documented. This would enable targeted test coverage analysis.

2. **Re-evaluate existing AC coverage** (P1): The test suite tripled since original extraction. Many previously UNCOVERED AC may now be covered.

3. **Regenerate characterization tests** (P2): The original 87 `test.skip()` scaffolds should be regenerated to include new domains.

4. **Update traceability matrix** (P2): ac-traceability.csv should be expanded to cover all 17 domains.

5. **Add formal coverage tooling** (P1): Enable `node --test --experimental-test-coverage` or c8 to get quantitative coverage metrics against AC source files.
