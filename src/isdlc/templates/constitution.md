# Project Constitution - [PROJECT_NAME]

**Created**: [DATE]
**Version**: 1.0.0

---

## Preamble

This constitution establishes the fundamental principles governing all development activities within this project. These articles are **immutable** once established and guide all SDLC workflows and agent interactions, whether the workflow includes all 13 phases or a subset (e.g., feature, fix, test workflows).

All agents (01-13) and the SDLC Orchestrator (00) MUST read and enforce these principles throughout the project lifecycle.

---

## Universal Articles (Apply to All Projects)

These 10 articles are mandatory for all projects. They represent industry best practices that ensure quality, security, and maintainability.

---

### Article I: Specification Primacy

**Principle**: Specifications are the source of truth. Code serves specifications.

**Requirements**:
1. Code MUST implement specifications exactly as defined
2. Any deviation from specifications MUST be documented and justified in an ADR
3. Specifications MUST be updated BEFORE code changes
4. Implementation MUST NOT assume requirements beyond what is specified

**Validation**:
- Agent 01 ensures specifications are complete
- Agent 05 implements only specified features
- Agent 07 validates code matches specifications

---

### Article II: Test-First Development

**Principle**: Tests MUST be written before implementation.

**Requirements**:
1. Test cases MUST be designed during Phase 04 (before implementation)
2. Unit tests MUST be written before production code in Phase 05
3. Integration tests MUST be defined before integration in Phase 06
4. Code without tests CANNOT pass quality gates

**Coverage Thresholds**:
- Unit test coverage: ≥95%
- Integration test coverage: ≥85%
- Critical paths: 100% coverage required

**Validation**:
- GATE-04: Test strategy approved
- GATE-05: Unit test coverage ≥95%
- Agent 05 follows TDD: Red → Green → Refactor

---

### Article III: Security by Design

**Principle**: Security considerations MUST precede implementation decisions.

**Requirements**:
1. No secrets/credentials in code or version control - use environment variables
2. All inputs MUST be validated at system boundaries
3. All outputs MUST be sanitized
4. Dependencies MUST be scanned for vulnerabilities before use
5. Critical/High vulnerabilities MUST be resolved before deployment
6. Least privilege principle for all access control

**Validation**:
- GATE-02: Security architecture approved
- GATE-05: No secrets in code, dependency scans clean
- GATE-08: SAST/DAST testing complete

---

### Article IV: Explicit Over Implicit

**Principle**: No assumptions. Uncertainty MUST be marked and resolved.

**Requirements**:
1. Ambiguous requirements MUST be marked with `[NEEDS CLARIFICATION]`
2. Assumptions MUST be documented in ADRs or design documents
3. "We'll figure it out later" is FORBIDDEN
4. All decisions MUST be traceable and justified

**Validation**:
- Agent 01 identifies and resolves ambiguities before GATE-01
- All `[NEEDS CLARIFICATION]` markers MUST be resolved before implementation
- Orchestrator fails gates if unresolved ambiguities exist

---

### Article V: Simplicity First

**Principle**: Implement the simplest solution that satisfies requirements.

**Requirements**:
1. Avoid over-engineering and premature optimization
2. YAGNI (You Aren't Gonna Need It) - no speculative features
3. Complexity MUST be justified by requirements
4. Refactor for simplicity, not cleverness
5. Three similar lines of code is better than a premature abstraction

**Validation**:
- Agent 02 selects appropriate (not excessive) technology
- Agent 07 reviews for unnecessary complexity

---

### Article VI: Code Review Required

**Principle**: All code MUST be reviewed before merging.

**Requirements**:
1. All code MUST be reviewed by at least one other developer (or agent)
2. Reviews MUST check: correctness, security, maintainability
3. Self-merges prohibited on shared branches
4. Review comments MUST be addressed before merge

**Validation**:
- GATE-07: Code review completed
- Agent 07 performs automated review checks

---

### Article VII: Artifact Traceability

**Principle**: Every code element MUST trace back to a requirement.

**Requirements**:
1. Maintain traceability matrix: Requirements → Design → Tests → Code
2. No orphan code (code without corresponding requirement)
3. No orphan requirements (requirements without implementation)
4. Commit messages MUST reference requirement IDs

**Validation**:
- Agent 01 creates initial traceability matrix
- Agent 05 references requirement IDs in code/commits
- GATE-07 verifies complete traceability

---

### Article VIII: Documentation Currency

**Principle**: Documentation MUST be updated with code changes.

**Requirements**:
1. Code changes MUST include corresponding documentation updates
2. README MUST reflect current setup/run instructions
3. API contracts (OpenAPI/Swagger) MUST match implementation
4. Architecture decisions MUST be recorded in ADRs

**Validation**:
- Agent 05 updates inline documentation during implementation
- Agent 07 verifies documentation during code review

---

### Article IX: Quality Gate Integrity

**Principle**: Quality gates cannot be skipped. Failures require remediation. Gate enforcement applies to all workflow types.

**Requirements**:
1. All quality gates MUST be validated before phase advancement
2. Gate failures MUST be remediated (cannot be waived)
3. "Move fast and break things" is FORBIDDEN
4. Gate fails twice → Escalate to human
5. Workflow phase sequences are fixed — phases cannot be skipped or reordered
6. Gate requirements may vary by workflow type (e.g., lighter elicitation for bug fixes) but gates themselves cannot be bypassed

**Validation**:
- Orchestrator validates all gate criteria before advancement
- `gate-validation.json` MUST show PASS status
- Gate enforcement applies to all workflows: feature, fix, test-run, test-generate, upgrade

---

### Article X: Fail-Safe Defaults

**Principle**: Systems MUST default to secure, safe, and conservative behaviors.

**Requirements**:
1. Security: Deny by default, allow explicitly
2. Data: Validate all inputs, sanitize all outputs
3. Errors: Fail securely (no sensitive data in error messages)
4. Permissions: Least privilege by default
5. Failures MUST leave system in safe state

**Validation**:
- Agent 02 designs fail-safe architecture
- Agent 08 validates fail-safe behaviors in security testing

---

### Article XI: Integration Testing Integrity

**Principle**: Integration tests MUST validate real system behavior, not mocked assumptions.

**Requirements**:

1. **Mutation Testing Required**
   - All test suites MUST include mutation testing to validate test quality
   - Mutation score threshold: ≥80%
   - Tests that don't catch mutations are ineffective tests

2. **Real URLs Only (No Stubs in Integration Tests)**
   - Integration tests MUST call actual service endpoints
   - Mocking/stubbing of external services is FORBIDDEN in integration tests
   - Use test environments, not mocked responses
   - Stubs are only permitted in unit tests

3. **No Assertions in Integration Tests**
   - Integration tests validate behavior through execution success/failure
   - Tests MUST verify system state changes, not assert intermediate values
   - Use contract validation and schema verification instead of assertions
   - Test outcomes are determined by actual system responses

4. **Adversarial Testing Required**
   - Property-based testing MUST be used for input validation
   - Fuzz testing MUST be applied to all public interfaces
   - Edge cases MUST be generated dynamically, not hardcoded
   - Boundary conditions MUST be tested with generated data

5. **Execution-Based Reporting**
   - Test reports MUST reflect actual execution results
   - No assertion-count-based metrics
   - Report: executed, passed, failed, skipped, mutation score
   - Include actual response data in failure reports

**Validation**:
- GATE-06: Mutation testing configured and passing (≥80% score)
- GATE-06: Integration tests use real URLs (no stub detection)
- GATE-06: Adversarial testing tools installed and executed
- Agent 06 enforces these rules during test execution

---

## Domain-Specific Articles (Customize Based on Project)

Add articles below based on your project's specific needs. These are optional but recommended for their respective domains.

---

### Article XII: [DOMAIN SPECIFIC - CUSTOMIZE OR REMOVE]

**Examples to consider:**

**For Web Applications:**
```markdown
### Article XII: Performance Requirements
1. API response time p95 < 200ms
2. Page load LCP < 2.5s
3. Load testing required before production
```

**For SaaS Products:**
```markdown
### Article XII: Multi-Tenancy Isolation
1. Row-level security enforced in database
2. No cross-tenant queries permitted
3. Tenant ID required in all API requests
```

**For Healthcare (HIPAA):**
```markdown
### Article XII: HIPAA Compliance
1. All PHI encrypted at rest and in transit
2. Audit logging for all PHI access
3. Role-based access control enforced
```

**For Finance (PCI-DSS):**
```markdown
### Article XII: PCI-DSS Compliance
1. No credit card data stored unencrypted
2. Tokenization for all payment data
3. Security scans before each deployment
```

**For Accessibility:**
```markdown
### Article XII: Accessibility Requirements
1. All UI components MUST meet WCAG 2.1 AA standards
2. Screen reader compatibility required
3. Keyboard navigation fully supported
```

---

## Monorepo: Shared and Per-Project Constitutions

In monorepo setups, this constitution serves as the **shared constitution** applying to all projects. Individual projects can create **override constitutions** at `docs/isdlc/projects/{project-id}/constitution.md`.

### Override Rules

1. A per-project constitution **inherits all articles** from the shared constitution
2. Per-project constitutions can **add** project-specific articles (e.g., "Article XII: PCI-DSS Compliance (api-service only)")
3. Per-project constitutions can **tighten** thresholds (e.g., raise coverage from 80% to 95%) but cannot weaken shared requirements
4. If no per-project constitution exists, the shared constitution applies in full

### Example Per-Project Override

```markdown
# Project Constitution Override: api-service

Inherits all articles from the shared constitution at `docs/isdlc/constitution.md`.

## Additional Articles

### Article XII: PCI-DSS Compliance
(Applies to api-service only — handles payment processing)
1. No credit card data stored unencrypted
2. Tokenization for all payment data
3. Security scans before each deployment

### Article XIII: API Performance SLAs
1. API response time p95 < 200ms
2. Error rate < 0.1% under normal load
```

---

## Constitutional Enforcement

### How Enforcement Works

1. **Orchestrator Reads Constitution**: At project start, Agent 00 reads this file
2. **Agents Apply Principles**: Each agent applies relevant articles to their work
3. **Gate Validation**: Orchestrator checks constitutional compliance at each gate
4. **Violation Handling**:
   - First violation: Agent remediates
   - Second violation: Escalate to human
   - Persistent violations: Constitution may need amendment

### Amending the Constitution

1. Propose amendment with justification
2. Discuss with team
3. Update this file
4. Communicate changes to all stakeholders
5. Version the change (e.g., "Constitution v2.0.0")

**Important**: Agents don't automatically detect constitution changes mid-project. Inform the orchestrator if major amendments occur.

---

## Amendment Log

| Version | Date | Amendment | Reason |
|---------|------|-----------|--------|
| 1.0.0 | [DATE] | Initial constitution | Project initialization |

---

**Framework Version**: 2.0.0
