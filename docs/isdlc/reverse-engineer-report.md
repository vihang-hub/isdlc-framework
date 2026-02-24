# Reverse-Engineer Report

**Generated**: 2026-02-07
**Project**: iSDLC Framework (self-development / dogfooding)
**Method**: Full source code analysis with behavior extraction

---

## Execution Summary

| Metric | Value |
|--------|-------|
| Total Acceptance Criteria | 87 |
| Business Domains | 7 |
| Source Files Analyzed | 20 production files (12,895 LOC) |
| Test Files Analyzed | 20 test files (555 tests) |
| Characterization Tests Generated | 7 files, 87 test.skip() scaffolds |
| Traceability Entries | 87 rows in ac-traceability.csv |

---

## AC by Priority

| Priority | Count | Percentage |
|----------|-------|------------|
| Critical | 26 | 29.9% |
| High | 45 | 51.7% |
| Medium | 16 | 18.4% |

---

## AC by Domain

| Domain | AC Count | Critical | High | Medium |
|--------|----------|----------|------|--------|
| Workflow Orchestration | 14 | 5 | 6 | 3 |
| Installation & Lifecycle | 16 | 4 | 8 | 4 |
| Iteration Enforcement | 18 | 7 | 8 | 3 |
| Skill Observability | 10 | 2 | 5 | 3 |
| Multi-Provider LLM Routing | 9 | 3 | 4 | 2 |
| Constitution Management | 8 | 2 | 4 | 2 |
| Monorepo & Project Detection | 12 | 3 | 6 | 3 |

---

## Test Coverage Against AC

| Coverage Status | Count | Percentage |
|----------------|-------|------------|
| COVERED (existing tests verify this AC) | 58 | 66.7% |
| PARTIAL (some aspects tested) | 9 | 10.3% |
| UNCOVERED (no existing tests) | 20 | 23.0% |

### High-Priority Uncovered AC

These Critical/High AC items have no existing test coverage:

1. **AC-WO-004** (Medium): Background Update Check - no test for notification suppression
2. **AC-WO-010** (High): Workflow Override Merging - deep merge of workflow overrides
3. **AC-WO-014** (Critical): Last Workflow Phase Detection - final phase in sequence
4. **AC-IE-015** (High): ATDD Skipped Test Detection - skipped test warning in ATDD mode
5. **AC-IE-016** (Medium): Post-Gate Cloud Config Trigger - cloud config after gate pass
6. **AC-IE-017** (Medium): Escalation Approval Gate - human approval check
7. **AC-IL-009** (High): Obsolete File Cleanup - manifest diff cleanup
8. **AC-IL-012** (Medium): Legacy Pattern-Based Uninstall
9. **AC-IL-015** (Medium): Backup Creation
10. **AC-PR-005** (High): Environment Override Injection
11. **AC-PR-006** (High): Fallback Warning Emission
12. **AC-PR-008** (Medium): Usage Tracking
13. **AC-CM-004** (High): Article Description Mapping
14. **AC-SO-009** (Medium): External Manifest Recognition
15. **AC-MD-010** (Medium): Legacy Migration Detection
16. **AC-MD-012** (Medium): Updater Monorepo Propagation

---

## Characterization Test Files

| File | Domain | Scaffold Count |
|------|--------|----------------|
| tests/characterization/workflow-orchestration.test.js | Workflow Orchestration | 12 |
| tests/characterization/installation-lifecycle.test.js | Installation & Lifecycle | 14 |
| tests/characterization/iteration-enforcement.test.js | Iteration Enforcement | 21 |
| tests/characterization/skill-observability.test.js | Skill Observability | 15 |
| tests/characterization/provider-routing.test.js | Provider Routing | 11 |
| tests/characterization/constitution-management.test.js | Constitution Management | 13 |
| tests/characterization/monorepo-detection.test.js | Monorepo & Project Detection | 14 |

---

## Key Findings

### 1. Test Coverage is Strong for Core Paths
The existing 555 tests cover 66.7% of extracted AC, with the strongest coverage in:
- Hook enforcement logic (gate-blocker, iteration-corridor, test-watcher)
- CLI commands (installer, updater, doctor)
- Monorepo path resolution
- Skill observability hooks

### 2. Gaps in Edge Case Coverage
The 23% uncovered AC are primarily:
- Workflow override merging and phase sequence edge cases
- Provider fallback chain and environment injection
- Backup and cleanup operations
- ATDD-specific behaviors (skipped test detection)

### 3. Architecture is Clean and Well-Separated
- ESM/CJS boundary is consistently maintained
- Hooks follow identical patterns: readStdin -> parse -> check -> process -> exit 0
- All hooks fail-open (Constitution Article X compliance)
- Monorepo support is comprehensive with 8 path resolution functions

### 4. Domain Boundaries are Clear
The 7 domains map cleanly to file boundaries:
- Each hook has a single responsibility
- lib/ modules are cohesive (one per CLI command)
- common.js is the shared utilities hub for hooks

---

## Artifacts Generated

| Artifact | Path |
|----------|------|
| AC Index | docs/requirements/reverse-engineered/index.md |
| Domain 01: Workflow | docs/requirements/reverse-engineered/domain-01-workflow-orchestration.md |
| Domain 02: Installation | docs/requirements/reverse-engineered/domain-02-installation-lifecycle.md |
| Domain 03: Iteration | docs/requirements/reverse-engineered/domain-03-iteration-enforcement.md |
| Domain 04: Skill | docs/requirements/reverse-engineered/domain-04-skill-observability.md |
| Domain 05: Provider | docs/requirements/reverse-engineered/domain-05-provider-routing.md |
| Domain 06: Constitution | docs/requirements/reverse-engineered/domain-06-constitution-management.md |
| Domain 07: Monorepo | docs/requirements/reverse-engineered/domain-07-monorepo-detection.md |
| Characterization Tests (7 files) | tests/characterization/*.test.js |
| Traceability Matrix | docs/isdlc/ac-traceability.csv |
| This Report | docs/isdlc/reverse-engineer-report.md |
