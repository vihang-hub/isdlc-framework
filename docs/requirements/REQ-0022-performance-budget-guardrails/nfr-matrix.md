# Non-Functional Requirements Matrix

**REQ ID**: REQ-0025
**Feature**: Performance Budget and Guardrail System

| NFR ID | Category | Requirement | Measurable Target | Validation Method |
|--------|----------|-------------|-------------------|-------------------|
| NFR-001 | Reliability | Zero workflow blocking | Budget checks NEVER block/halt workflow | Unit test: verify no blocking paths |
| NFR-002 | Accuracy | Timing accuracy | Within 1 minute for phases > 5 min | Integration test: compare computed vs actual |
| NFR-003 | Efficiency | State.json footprint | Max 2 KB per workflow | Unit test: measure serialized size |
| NFR-004 | Compatibility | Backward compatibility | All existing 1300+ tests pass | Full test suite regression run |
| NFR-005 | Observability | Output routing | All warnings to stderr, never stdout | Unit test: verify output channels |

## Cross-Reference to Functional Requirements

| NFR | Applies To FRs | Validation Phase |
|-----|----------------|-----------------|
| NFR-001 | FR-003, FR-004, FR-005, FR-006, FR-007 | Phase 16 (Quality Loop) |
| NFR-002 | FR-001 | Phase 06 (Implementation) |
| NFR-003 | FR-001, FR-003, FR-006 | Phase 06 (Implementation) |
| NFR-004 | All FRs | Phase 16 (Quality Loop) |
| NFR-005 | FR-003, FR-006, FR-008 | Phase 06 (Implementation) |
