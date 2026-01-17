# Project Constitution Template
## Guide to Creating Immutable Architectural Principles

**Purpose**: This template helps you create a project-specific constitution that establishes immutable principles for your development process.

**How to Use**: Copy this template to your project's `.isdlc/constitution.md` and customize the articles to match your project's needs, technology choices, and organizational requirements.

---

## Instructions

1. **Review the example articles** below
2. **Keep articles that apply** to your project
3. **Remove or modify articles** that don't fit
4. **Add custom articles** specific to your domain (e.g., healthcare compliance, real-time requirements)
5. **Get team agreement** - the constitution should reflect shared principles
6. **Make it immutable** - these principles should rarely change once established

**Note**: The iSDLC agents will read this constitution and validate compliance at quality gates. Clear, specific articles lead to better enforcement.

---

## Preamble (Customize This)

This constitution establishes the fundamental principles governing all development activities within the **[PROJECT NAME]** project. These articles guide all 13 SDLC phases and all agent interactions.

All agents (01-13) and the SDLC Orchestrator (00) will read and enforce these principles throughout the project lifecycle.

---

## Example Articles (Customize, Remove, or Keep as Needed)

### Article I: Specification Primacy

**Principle**: Specifications are the source of truth. Code serves specifications.

**Why Include This**: Prevents implementation drift and ensures code matches requirements.

**Requirements**:
1. Code MUST implement specifications exactly as defined
2. Any deviation from specifications MUST be documented and justified
3. Specifications MUST be updated before code changes
4. Implementation MUST NOT assume requirements beyond what is specified

**Validation**:
- Agent 01 ensures specifications are complete
- Agent 05 implements only specified features
- Agent 07 validates code matches specifications

**Customize**:
- Change if you prefer code-first or exploratory development
- Adjust if using rapid prototyping approaches

---

### Article II: Test-First Development

**Principle**: Tests MUST be written before implementation.

**Why Include This**: Ensures testability, reduces bugs, enforces design thinking.

**Requirements**:
1. Test cases MUST be designed during Phase 04 (before implementation)
2. Unit tests MUST be written before production code in Phase 05
3. Integration tests MUST be defined before integration in Phase 06
4. Code without tests CANNOT pass quality gates

**Validation**:
- GATE-04: Test strategy approved
- GATE-05: Unit test coverage ≥80% (or your threshold)
- Agent 05 follows TDD: Red → Green → Refactor

**Customize**:
- Adjust coverage thresholds (e.g., 70%, 90%)
- Modify if test-after is acceptable in your context
- Remove if tests aren't required for prototypes

---

### Article III: Library-First Design

**Principle**: Prefer well-tested libraries over custom implementations.

**Why Include This**: Reduces maintenance burden, leverages community expertise.

**Requirements**:
1. Use established libraries for common functionality (auth, validation, utilities)
2. Custom implementations require explicit justification in ADRs
3. "Not Invented Here" syndrome MUST be avoided
4. Dependency selection MUST consider: security, maintenance, community support

**Validation**:
- Agent 02 evaluates and selects libraries during architecture phase
- ADRs document library choices and custom implementation justifications

**Customize**:
- Adjust for industries with unique requirements (embedded systems, research)
- Modify for proprietary/competitive advantage scenarios

---

### Article IV: Security by Design

**Principle**: Security considerations MUST precede implementation decisions.

**Why Include This**: Prevents security being an afterthought, reduces vulnerabilities.

**Requirements**:
1. Security architecture MUST be defined in Phase 02
2. Threat modeling MUST occur before design finalization
3. Security gates at Phase 02, 05, and 08
4. Critical/High vulnerabilities MUST be resolved before production deployment

**Validation**:
- GATE-02: Security architecture approved
- GATE-05: No secrets in code, dependency scans clean
- GATE-08: SAST/DAST/penetration testing complete

**Customize**:
- Add specific security frameworks (OWASP, NIST)
- Add compliance requirements (SOC2, ISO 27001)
- Adjust for low-security internal tools

---

### Article V: Explicit Over Implicit

**Principle**: No assumptions. Uncertainty MUST be marked and resolved.

**Why Include This**: Prevents miscommunication and implementation errors.

**Requirements**:
1. Ambiguous requirements MUST be marked with `[NEEDS CLARIFICATION]`
2. Assumptions MUST be documented in ADRs or design documents
3. "We'll figure it out later" is FORBIDDEN
4. All decisions MUST be traceable and justified

**Validation**:
- Agent 01 identifies and resolves ambiguities before GATE-01
- All `[NEEDS CLARIFICATION]` markers MUST be resolved before implementation
- Orchestrator fails gates if unresolved ambiguities exist

**Customize**:
- Adjust marker syntax (e.g., `TODO:`, `DECIDE:`)
- Relax for experimental/prototype phases

---

### Article VI: Simplicity First

**Principle**: Implement the simplest solution that satisfies requirements.

**Why Include This**: Reduces complexity, improves maintainability.

**Requirements**:
1. Avoid over-engineering and premature optimization
2. YAGNI (You Aren't Gonna Need It) - no speculative features
3. Complexity MUST be justified by requirements
4. Refactor for simplicity, not cleverness

**Validation**:
- Agent 02 selects appropriate (not excessive) technology
- Agent 07 reviews for unnecessary complexity

**Customize**:
- Adjust for performance-critical systems
- Modify for research/innovation projects

---

### Article VII: Artifact Traceability

**Principle**: Every code element MUST trace back to a requirement.

**Why Include This**: Enables impact analysis, prevents scope creep.

**Requirements**:
1. Maintain traceability matrix: Requirements → Design → Tests → Code
2. No orphan code (code without corresponding requirement)
3. No orphan requirements (requirements without implementation)
4. Traceability MUST be verifiable at any phase

**Validation**:
- Agent 01 creates initial traceability matrix
- Agent 05 references requirement IDs in code/commits
- GATE-07 verifies complete traceability

**Customize**:
- Choose traceability format (CSV, tools like Jira)
- Adjust granularity (feature-level vs line-level)

---

### Article VIII: Documentation Currency

**Principle**: Documentation MUST be updated with code changes.

**Why Include This**: Prevents documentation rot, aids onboarding.

**Requirements**:
1. Code changes MUST include corresponding documentation updates
2. Documentation MUST be co-located with code when possible
3. API documentation MUST be generated from source (OpenAPI, JSDoc, etc.)
4. README, architecture docs, runbooks MUST reflect current state

**Validation**:
- Agent 05 updates inline documentation during implementation
- Agent 07 verifies documentation during code review

**Customize**:
- Define what "documentation" means for your project
- Adjust for different doc types (API, user, operational)

---

### Article IX: Quality Gate Integrity

**Principle**: Quality gates cannot be skipped. Failures require remediation.

**Why Include This**: Ensures quality standards are maintained.

**Requirements**:
1. All 13 quality gates MUST be validated before phase advancement
2. Gate failures MUST be remediated (cannot be waived)
3. "Move fast and break things" is FORBIDDEN
4. Orchestrator enforces: Gate fails twice → Escalate to human

**Validation**:
- Orchestrator validates all gate criteria before advancement
- `gate-validation.json` MUST show PASS status

**Customize**:
- Adjust escalation rules (fail once, fail three times, etc.)
- Modify for rapid prototyping phases
- Define which gates are "soft" vs "hard"

---

### Article X: Fail-Safe Defaults

**Principle**: Systems MUST default to secure, safe, and conservative behaviors.

**Why Include This**: Reduces security vulnerabilities and system failures.

**Requirements**:
1. Security: Deny by default, allow explicitly
2. Data: Validate all inputs, sanitize all outputs
3. Errors: Fail securely (no sensitive data in error messages)
4. Permissions: Least privilege by default

**Validation**:
- Agent 02 designs fail-safe architecture
- Agent 08 validates fail-safe behaviors in security testing

**Customize**:
- Adjust for specific security contexts
- Define what "fail-safe" means for your domain

---

## Additional Article Ideas (Add Your Own)

Consider adding articles specific to your project:

### Example: Real-Time Performance Requirements
```
**Principle**: All API endpoints MUST respond within 100ms (p95).

**Requirements**:
1. Performance budgets defined in NFR matrix
2. Load testing required before production
3. Monitoring alerts on p95 > 100ms

**Validation**: GATE-08 includes performance testing
```

### Example: Accessibility First
```
**Principle**: All UI components MUST meet WCAG 2.1 AA standards.

**Requirements**:
1. Accessibility testing in Phase 06
2. Screen reader compatibility required
3. Keyboard navigation fully supported

**Validation**: GATE-06 includes accessibility audit
```

### Example: Multi-Tenancy Isolation
```
**Principle**: Tenant data MUST be completely isolated.

**Requirements**:
1. Row-level security enforced in database
2. No cross-tenant queries permitted
3. Tenant ID required in all API requests

**Validation**: GATE-08 includes tenant isolation testing
```

### Example: Regulatory Compliance (Healthcare/Finance)
```
**Principle**: System MUST comply with [HIPAA/PCI-DSS/GDPR].

**Requirements**:
1. Compliance checklist completed in Phase 01
2. Data encryption at rest and in transit
3. Audit logging for all access
4. Annual penetration testing

**Validation**: GATE-08 validates compliance requirements
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

## Example: Minimal Constitution

For a simple internal tool, you might only need:

```markdown
# Project Constitution - [PROJECT NAME]

## Article I: Test Coverage
Unit test coverage MUST be ≥70%.

## Article II: Code Review
All code MUST be reviewed by one other developer.

## Article III: Security Basics
No secrets in code. Use environment variables.
```

---

## Example: Comprehensive Constitution

For a regulated enterprise system, you might need:

```markdown
# Project Constitution - [PROJECT NAME]

## Article I: Specification Primacy
[Full specification primacy requirements]

## Article II: Test-First Development
[Full TDD requirements]

## Article III: Security by Design
[Full security requirements]

## Article IV: GDPR Compliance
[GDPR-specific requirements]

## Article V: Performance Requirements
[Performance SLAs and monitoring]

## Article VI: High Availability
[Uptime requirements, disaster recovery]

## Article VII: Data Retention
[Data retention and deletion policies]

... (8-12 articles total)
```

---

## Resources

- **Framework Documentation**: See `docs/FRAMEWORK-COMPARISON-ANALYSIS.md` for the rationale behind project constitutions
- **Inspiration**: GitHub Spec Kit, BMAD-METHOD documentation
- **Best Practices**: Architectural Decision Records (ADRs), RFC processes

---

**Template Version**: 1.0.0
**Last Updated**: 2026-01-17
**Framework Compatibility**: iSDLC v1.0.0+
