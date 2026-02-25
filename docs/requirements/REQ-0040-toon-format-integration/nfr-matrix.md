# Non-Functional Requirements Matrix: TOON Format Integration

**Requirement ID:** REQ-0040
**Created:** 2026-02-25
**Status:** Draft

---

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Performance | Session cache token reduction | >=30% reduction on all 4 sections (baseline: ~18,500 tokens) | Token counting before/after on identical input data | Must Have |
| NFR-002 | Performance | State array token reduction | >=40% reduction on workflow_history, history, skill_usage_log injections | Token counting before/after on representative state.json | Must Have |
| NFR-003 | Performance | Encoding latency | TOON encoding adds <50ms to session cache rebuild time | Timestamp comparison in cache rebuild benchmarks | Should Have |
| NFR-004 | Reliability | JSON fallback on decode failure | 100% of TOON decode failures fall back to JSON without error propagation | Unit tests with malformed TOON input, integration tests with corrupted cache | Must Have |
| NFR-005 | Compatibility | CJS hook compatibility | TOON encoder/decoder works via require() in all CJS hook files | Load test on Node 20, 22, 24 with CJS require() | Must Have |
| NFR-006 | Compatibility | Node.js version support | Works on Node 20, 22, 24 (Article XII CI matrix) | CI matrix execution across all 3 versions | Must Have |
| NFR-007 | Maintainability | Test baseline preservation | Total test count >= 555 after implementation (Article II) | npm test count output | Must Have |
| NFR-008 | Integrity | State write atomicity | state.json written as full JSON only; TOON at read/injection time, not storage | Code review + integration test verifying state.json remains valid JSON | Must Have |
| NFR-009 | Accuracy | LLM parsing accuracy | No degradation in agent task completion with TOON data | Existing test suite passes with TOON-encoded context | Must Have |

---

## Constitutional Compliance

| NFR ID | Constitutional Article | Compliance Note |
|--------|----------------------|-----------------|
| NFR-004 | Article X (Fail-Safe Defaults) | All hooks fail-open; TOON failures never block workflows |
| NFR-005 | Article XIII (Module System Consistency) | CJS hooks use require(); ESM boundary maintained |
| NFR-006 | Article XII (Cross-Platform Compatibility) | Node 20, 22, 24 matrix coverage |
| NFR-007 | Article II (Test-First Development) | 555-test baseline regression threshold |
| NFR-008 | Article XIV (State Management Integrity) | state.json remains JSON; atomic writes preserved |
