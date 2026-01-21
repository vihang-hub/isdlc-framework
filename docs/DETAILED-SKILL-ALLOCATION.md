# Detailed Skill Allocation to 14 Agents

## Complete 1-to-1 Phase-Agent-Skills Mapping

---

## Agent 00: SDLC Orchestrator
**Phase**: ALL (Cross-phase coordination)
**Skill Category**: orchestration/
**Skills**: 8

1. `workflow-management` - Manage SDLC phases, gates, dependencies
2. `task-decomposition` - Break down requirements into agent tasks
3. `progress-tracking` - Monitor completion, blockers, timelines
4. `gate-validation` - Verify phase completion criteria
5. `conflict-resolution` - Handle agent disagreements
6. `priority-management` - Determine task urgency
7. `communication-routing` - Route information between agents
8. `risk-assessment` - Identify and mitigate risks

---

## Agent 01: Requirements Analyst
**Phase**: 01 - Requirements Capture & Clarification
**Skill Category**: requirements/
**Skills**: 10

1. `elicitation` - Extract requirements from natural language
2. `user-stories` - Create well-formed user stories
3. `classification` - Categorize as functional, NFR, constraint
4. `ambiguity-detection` - Identify vague or conflicting requirements
5. `prioritization` - Apply MoSCoW prioritization
6. `dependency-mapping` - Identify requirement dependencies
7. `change-impact` - Assess impact of requirement changes
8. `traceability` - Maintain requirement IDs and relationships
9. `acceptance-criteria` - Define testable acceptance criteria
10. `nfr-quantification` - Convert vague NFRs to measurable targets

---

## Agent 02: Solution Architect
**Phase**: 02 - Architecture & Blueprint
**Skill Category**: architecture/
**Skills**: 12

1. `architecture-pattern-selection` - Choose monolith, microservices, etc.
2. `technology-evaluation` - Assess and compare tech options
3. `database-design` - Design schemas, select database types
4. `api-architecture` - Design API structure and contracts
5. `infrastructure-design` - Cloud architecture, containerization
6. `security-architecture` - Auth flows, encryption, access control
7. `scalability-planning` - Design for growth and load handling
8. `integration-architecture` - External service integration patterns
9. `cost-estimation` - Estimate infrastructure and tooling costs
10. `adr-writing` - Document architecture decisions
11. `diagram-generation` - Create C4, sequence, ER diagrams
12. `environment-design` - Define dev, test, staging, prod environments

---

## Agent 03: System Designer
**Phase**: 03 - Design & API Contracts
**Skill Category**: design/
**Skills**: 10

1. `module-design` - Break architecture into implementable modules
2. `api-contracts` - Create OpenAPI specifications
3. `ui-ux` - Design user interfaces and flows
4. `components` - Design reusable UI and backend components
5. `data-flow` - Design data transformations and flows
6. `error-handling` - Design error taxonomy and handling
7. `state-management` - Design application state architecture
8. `integration-design` - Design external API integrations
9. `validation` - Design input validation rules
10. `wireframing` - Create UI wireframes and mockups

---

## Agent 04: Test Design Engineer
**Phase**: 04 - Test Strategy & Design
**Skill Categories**: testing/ (planning subset)
**Skills**: 5

1. `test-strategy` - Create comprehensive test strategies
2. `test-case-design` - Write test cases from requirements
3. `test-data` - Create appropriate test data
4. `traceability-management` - Link tests to requirements
5. `coverage-analysis` (planning) - Define coverage targets

---

## Agent 05: Software Developer
**Phase**: 05 - Implementation
**Skill Category**: development/
**Skills**: 13

1. `code-implementation` - Write production code from designs
2. `unit-testing` - Write comprehensive unit tests (TDD)
3. `api-implementation` - Implement REST/GraphQL endpoints
4. `database-integration` - Implement data access layer
5. `frontend-development` - Implement UI components
6. `authentication` - Implement auth flows
7. `integration-implementation` - Implement external integrations
8. `error-handling` - Implement error handling patterns
9. `refactoring` - Improve code quality
10. `bug-fixing` - Diagnose and fix defects
11. `code-documentation` - Write code documentation
12. `migration-writing` - Write database migrations
13. `performance-optimization` - Optimize code performance

---

## Agent 06: Integration Tester
**Phase**: 06 - Integration & Testing
**Skill Categories**: testing/ (execution subset)
**Skills**: 8

1. `integration-testing` (execution) - Execute integration tests
2. `e2e-testing` (execution) - Execute end-to-end tests
3. `api-contract-testing` - Verify API against OpenAPI spec
4. `coverage-analysis` (execution) - Measure actual coverage
5. `defect-analysis` - Analyze test failures and patterns
6. `regression-management` - Maintain regression test suites
7. `test-data` (management) - Manage test data fixtures
8. `reporting` - Generate test status reports

---

## Agent 07: QA Engineer
**Phase**: 07 - Code Review & QA
**Skill Category**: development/ (quality subset)
**Skills**: 4

1. `code-review` - Review code for quality, security, performance
2. `static-analysis` - Run linters, type checkers, complexity analysis
3. `quality-metrics` - Measure and report code quality metrics
4. `technical-debt-analysis` - Identify and document technical debt

---

## Agent 08: Security & Compliance Auditor
**Phase**: 08 - Independent Validation
**Skill Category**: security/
**Skills**: 13

1. `security-architecture-review` - Review architecture for security
2. `threat-modeling` - Identify threats and mitigations
3. `vulnerability-scanning` - Run automated security scans (SAST/DAST)
4. `dependency-auditing` - Check dependencies for vulnerabilities
5. `code-security-review` - Review code for security issues
6. `authentication-testing` - Test auth flows for weaknesses
7. `authorization-testing` - Test permission boundaries
8. `input-validation-testing` - Test for injection vulnerabilities
9. `security-configuration` - Review and harden configurations
10. `compliance-checking` - Verify compliance requirements
11. `penetration-testing` - Conduct security testing
12. `security-reporting` - Generate security reports
13. `incident-analysis` - Analyze security incidents

---

## Agent 09: CI/CD Engineer
**Phase**: 09 - Version Control & CI/CD
**Skill Category**: devops/ (pipeline subset)
**Skills**: 8

1. `cicd-pipeline` - Configure CI/CD pipelines
2. `build-automation` - Create reproducible builds
3. `artifact-management` - Configure artifact registry
4. `containerization` - Docker, container orchestration
5. `infrastructure-as-code` - Terraform, Pulumi, CloudFormation
6. `deployment-strategy` - Blue-green, canary, rolling
7. `monitoring-setup` (pipeline) - Pipeline monitoring
8. `log-management` (pipeline) - Pipeline log aggregation

---

## Agent 10: Dev Environment Engineer
**Phase**: 10 - Local Development & Testing
**Skill Categories**: devops/ (local subset) + documentation/
**Skills**: 6

**From devops/**:
1. `environment-configuration` (local) - Configure local environments
2. `containerization` (local) - Docker Compose for local dev
3. `database-operations` (local) - Local database setup

**From documentation/**:
4. `technical-writing` (dev guide) - Write developer guides
5. `onboarding-documentation` - Create setup documentation
6. `code-documentation` (examples) - Example code and usage

---

## Agent 11: Deployment Engineer (Staging)
**Phase**: 11 - Test Environment Deployment
**Skill Category**: devops/ (staging subset)
**Skills**: 6

1. `deployment-strategy` (staging) - Execute staging deployments
2. `smoke-testing` - Verify critical functionality post-deploy
3. `rollback-procedures` - Test and execute rollbacks
4. `monitoring-setup` (staging) - Configure staging monitoring
5. `load-balancing` (staging) - Configure load balancers
6. `ssl-management` (staging) - Manage SSL certificates

---

## Agent 12: Release Manager
**Phase**: 12 - Production Deployment
**Skill Categories**: devops/ (production subset) + documentation/
**Skills**: 6

**From devops/**:
1. `deployment-strategy` (production) - Execute production deployments
2. `backup-recovery` - Ensure backups before deployment
3. `auto-scaling` (production) - Configure auto-scaling
4. `performance-tuning` (production) - Production performance optimization

**From documentation/**:
5. `changelog-management` - Maintain changelogs
6. `technical-writing` (release notes) - Write release notes

---

## Agent 13: Site Reliability Engineer
**Phase**: 13 - Production Operations
**Skill Categories**: operations/ + documentation/
**Skills**: 14

**From operations/**:
1. `system-monitoring` - Monitor system health continuously
2. `performance-monitoring` - Track performance metrics
3. `security-monitoring` - Monitor for security issues
4. `log-analysis` - Analyze logs for issues
5. `alerting-management` - Configure alerts and thresholds
6. `incident-response` - Respond to alerts and incidents
7. `capacity-planning` - Plan for system growth
8. `sla-management` - Monitor and report SLA compliance
9. `availability-management` - Ensure high availability
10. `disaster-recovery` - Implement DR procedures
11. `change-management` - Manage production changes
12. `reporting` - Generate operational reports

**From documentation/**:
13. `runbook-writing` - Create operational runbooks
14. `compliance-documentation` - Document compliance procedures

---

## Skill Distribution Summary Table

| Agent ID | Agent Name | Skills | Primary Categories |
|----------|------------|--------|-------------------|
| 00 | SDLC Orchestrator | 8 | orchestration/ |
| 01 | Requirements Analyst | 10 | requirements/ |
| 02 | Solution Architect | 12 | architecture/ |
| 03 | System Designer | 10 | design/ |
| 04 | Test Design Engineer | 5 | testing/ (planning) |
| 05 | Software Developer | 13 | development/ |
| 06 | Integration Tester | 8 | testing/ (execution) |
| 07 | QA Engineer | 4 | development/ (quality) |
| 08 | Security & Compliance Auditor | 13 | security/ |
| 09 | CI/CD Engineer | 8 | devops/ (pipelines) |
| 10 | Dev Environment Engineer | 6 | devops/ (local) + documentation/ |
| 11 | Deployment Engineer (Staging) | 6 | devops/ (staging) |
| 12 | Release Manager | 6 | devops/ (production) + documentation/ |
| 13 | Site Reliability Engineer | 14 | operations/ + documentation/ |
| **TOTAL** | **14 Agents** | **123** | **10 Categories** |

---

## Category-to-Agent Mapping

### Complete Categories (1 agent gets all skills)
- **orchestration/** (8) → Agent 00
- **requirements/** (10) → Agent 01
- **architecture/** (12) → Agent 02
- **design/** (10) → Agent 03
- **security/** (13) → Agent 08
- **operations/** (12) → Agent 13

### Split Categories (multiple agents)

**testing/** (13 skills) → 2 agents:
- Agent 04 (Test Design): 5 skills - planning/strategy
- Agent 06 (Integration Tester): 8 skills - execution/analysis

**development/** (14 skills) → 2 agents:
- Agent 05 (Developer): 13 skills - implementation
- Agent 07 (QA Engineer): 4 skills - quality/review
- *(some skills like code-documentation used by both)*

**devops/** (14 skills) → 4 agents:
- Agent 09 (CI/CD): 8 skills - pipelines/automation
- Agent 10 (Dev Environment): 3 skills - local setup
- Agent 11 (Staging Deploy): 6 skills - staging deployment
- Agent 12 (Release Manager): 4 skills - production deployment
- *(deployment-strategy used by both 11 & 12)*

**documentation/** (10 skills) → Distributed to 4 agents:
- Agent 10 (Dev Environment): 3 skills - dev guides
- Agent 12 (Release Manager): 2 skills - release notes
- Agent 13 (SRE): 2 skills - runbooks
- *(3 skills remain general: api-documentation, architecture-documentation, user-guides)*

---

## Notes

1. **Skills directory unchanged**: All skills remain in `.claude/skills/` for backward compatibility
2. **Skills referenced by agents**: Agent files reference their allocated skills
3. **Some skills shared**: Documentation and deployment skills used by multiple agents appropriately
4. **Total unique skills**: 116 original skills
5. **Total skill allocations**: 123 (some skills allocated to multiple agents)
6. **Average skills per agent**: 8.8 skills

---

## Implementation Status

✅ **Skill mapping complete**
✅ **Detailed allocation documented**
⏳ **Agent file updates** (next step)
⏳ **Validation and testing** (final step)
