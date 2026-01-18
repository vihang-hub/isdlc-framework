---
name: test-strategy-design
description: Create comprehensive test strategies aligned with requirements
skill_id: TEST-001
owner: test-design-engineer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Project start, major releases, test planning
dependencies: []
---

# Test Strategy Design

## Purpose
Create a comprehensive test strategy that defines testing objectives, scope, types, tools, environments, and success criteria aligned with project requirements and quality goals.

## When to Use
- Project initiation
- Major release planning
- Test approach changes
- Quality gate definition

## Prerequisites
- Requirements documented
- NFRs defined
- Architecture understood
- Risk assessment available

## Process

### Step 1: Define Test Objectives
```
Objectives:
- Quality goals
- Risk mitigation
- Compliance requirements
- Coverage targets
```

### Step 2: Determine Test Scope
```
In scope:
- Features to test
- Test types required
- Environments needed

Out of scope:
- Explicitly excluded items
- Deferred testing
```

### Step 3: Select Test Types
```
Test pyramid:
- Unit tests (70%)
- Integration tests (20%)
- E2E tests (10%)

Additional:
- Security testing
- Performance testing
- Accessibility testing
- Compatibility testing
```

### Step 4: Define Test Environment
```
Environments:
- Local development
- CI/CD pipeline
- Staging
- Production smoke
```

### Step 5: Create Strategy Document
```
Document includes:
- Objectives and scope
- Test types and coverage
- Tools and frameworks
- Environment strategy
- Success criteria
- Roles and responsibilities
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements_spec | Markdown | Yes | Requirements |
| nfr_matrix | Markdown | Yes | Non-functional requirements |
| risk_assessment | Markdown | Optional | Project risks |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| test_strategy.md | Markdown | Complete strategy |
| coverage_targets.md | Markdown | Coverage goals |
| tool_selection.md | Markdown | Test tools |

## Project-Specific Considerations
- GDPR compliance testing required
- External API mocking essential
- OAuth2 flow testing
- Multi-step form testing
- Document upload testing

## Integration Points
- **Orchestrator**: Gate validation input
- **Developer Agent**: Test implementation coordination
- **Security Agent**: Security test planning

## Examples
```
Test Strategy - SDLC Framework

1. OBJECTIVES
   - Ensure 80% code coverage minimum
   - Zero critical/high severity bugs in production
   - GDPR compliance verification
   - Performance meets NFRs (page load <3s, API <500ms)
   - Accessibility WCAG 2.1 AA compliance

2. TEST SCOPE

   In Scope:
   - All user-facing features
   - API endpoints
   - Database operations
   - Authentication flows
   - External API integrations
   - GDPR features
   
   Out of Scope:
   - Third-party library internals
   - External API internal behavior
   - Admin features (Phase 2)

3. TEST TYPES

   Test Pyramid:
   ┌─────────────┐
   │    E2E     │ 10% - Critical user journeys
   │    (10)    │
   ├─────────────┤
   │ Integration │ 20% - API, database, services
   │    (50)     │
   ├─────────────┤
   │    Unit     │ 70% - Components, functions
   │   (200+)    │
   └─────────────┘

   Additional Testing:
   - Security: OWASP Top 10, auth testing
   - Performance: Load testing (10K concurrent)
   - Accessibility: Automated + manual audit
   - Compatibility: Chrome, Firefox, Safari, Edge

4. TEST TOOLS

   | Type | Tool | Purpose |
   |------|------|---------|
   | Unit | Jest | JS/TS unit tests |
   | Component | Testing Library | React components |
   | Integration | Supertest | API testing |
   | E2E | Playwright | Browser automation |
   | Security | OWASP ZAP | Security scanning |
   | Performance | k6 | Load testing |
   | Accessibility | axe-core | A11y testing |
   | Mocking | MSW | API mocking |

5. ENVIRONMENTS

   | Env | Purpose | Data |
   |-----|---------|------|
   | Local | Development | Fixtures |
   | CI | Automated tests | Fixtures |
   | Staging | Integration | Anonymized |
   | Prod | Smoke tests | Production |

6. SUCCESS CRITERIA

   Gate Requirements:
   - GATE-5: 80% unit coverage, all unit tests pass
   - GATE-6: All integration/E2E pass, security scan clean
   - GATE-7: Performance NFRs met, accessibility audit pass

7. ROLES

   - Test Manager: Strategy, planning, reporting
   - Developer Agent: Unit tests, integration tests
   - Security Agent: Security test execution
   - DevOps Agent: CI/CD test integration
```

## Validation
- All requirements have test approach
- Coverage targets defined
- Tools selected and justified
- Environments specified
- Success criteria measurable