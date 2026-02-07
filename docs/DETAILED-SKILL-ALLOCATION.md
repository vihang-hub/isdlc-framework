# Detailed Skill Allocation to 36 Agents

## Complete 1-to-1 Phase-Agent-Skills Mapping

**Total Skills**: 229 | **Total Agents**: 36 | **Manifest Version**: 4.0.0

---

## Core SDLC Agents (15)

### Agent 00: SDLC Orchestrator
**Phase**: ALL (Cross-phase coordination)
**Skill Category**: orchestration/
**Skills**: 12

| ID | Skill |
|----|-------|
| ORCH-001 | workflow-management |
| ORCH-002 | task-decomposition |
| ORCH-003 | progress-tracking |
| ORCH-004 | gate-validation |
| ORCH-005 | conflict-resolution |
| ORCH-006 | priority-management |
| ORCH-007 | communication-routing |
| ORCH-008 | risk-assessment |
| ORCH-009 | complexity-assessment |
| ORCH-010 | track-selection |
| ORCH-011 | phase-orchestration |
| ORCH-012 | generate-plan |

---

### Agent 01: Requirements Analyst
**Phase**: 01-requirements
**Skill Category**: requirements/
**Skills**: 11

| ID | Skill |
|----|-------|
| REQ-001 | elicitation |
| REQ-002 | user-stories |
| REQ-003 | classification |
| REQ-004 | ambiguity-detection |
| REQ-005 | prioritization |
| REQ-006 | dependency-mapping |
| REQ-007 | change-impact |
| REQ-008 | traceability |
| REQ-009 | acceptance-criteria |
| REQ-010 | nfr-quantification |
| REQ-011 | bug-report-analysis |

---

### Agent 02: Solution Architect
**Phase**: 03-architecture
**Skill Category**: architecture/
**Skills**: 13

| ID | Skill |
|----|-------|
| ARCH-001 | architecture-pattern-selection |
| ARCH-002 | technology-evaluation |
| ARCH-003 | database-design |
| ARCH-004 | api-architecture |
| ARCH-005 | infrastructure-design |
| ARCH-006 | security-architecture |
| ARCH-007 | scalability-planning |
| ARCH-008 | integration-architecture |
| ARCH-009 | cost-estimation |
| ARCH-010 | adr-writing |
| ARCH-011 | diagram-generation |
| ARCH-012 | environment-design |
| ARCH-013 | architecture-documentation |

---

### Agent 03: System Designer
**Phase**: 04-design
**Skill Category**: design/
**Skills**: 11

| ID | Skill |
|----|-------|
| DES-001 | module-design |
| DES-002 | api-contracts |
| DES-003 | ui-ux |
| DES-004 | components |
| DES-005 | data-flow |
| DES-006 | error-handling |
| DES-007 | state-management |
| DES-008 | integration-design |
| DES-009 | validation |
| DES-010 | wireframing |
| DES-011 | design-documentation |

---

### Agent 04: Test Design Engineer
**Phase**: 05-test-strategy
**Skill Category**: testing/ (planning)
**Skills**: 9

| ID | Skill |
|----|-------|
| TEST-001 | test-strategy |
| TEST-002 | test-case-design |
| TEST-003 | test-data |
| TEST-004 | traceability-management |
| TEST-005 | coverage-analysis-planning |
| TEST-006 | mutation-test-planning |
| TEST-007 | adversarial-test-design |
| TEST-008 | atdd-scenario-design |
| TEST-009 | test-infrastructure-setup |

---

### Agent 05: Software Developer
**Phase**: 06-implementation
**Skill Category**: development/
**Skills**: 14

| ID | Skill |
|----|-------|
| DEV-001 | code-implementation |
| DEV-002 | unit-testing |
| DEV-003 | api-implementation |
| DEV-004 | database-integration |
| DEV-005 | frontend-development |
| DEV-006 | authentication |
| DEV-007 | integration-implementation |
| DEV-008 | error-handling |
| DEV-009 | refactoring |
| DEV-010 | bug-fixing |
| DEV-011 | code-documentation |
| DEV-012 | migration-writing |
| DEV-013 | performance-optimization |
| DEV-014 | dependency-management |

---

### Agent 06: Integration Tester
**Phase**: 07-testing
**Skill Category**: testing/ (execution)
**Skills**: 8

| ID | Skill |
|----|-------|
| TEST-101 | integration-testing |
| TEST-102 | e2e-testing |
| TEST-103 | api-contract-testing |
| TEST-104 | coverage-analysis-execution |
| TEST-105 | defect-analysis |
| TEST-106 | regression-management |
| TEST-107 | test-data-management |
| TEST-108 | test-reporting |

---

### Agent 07: QA Engineer
**Phase**: 08-code-review
**Skill Category**: development/ (quality)
**Skills**: 1

| ID | Skill |
|----|-------|
| DEV-101 | code-review |

---

### Agent 08: Security & Compliance Auditor
**Phase**: 09-validation
**Skill Category**: security/
**Skills**: 13

| ID | Skill |
|----|-------|
| SEC-001 | security-architecture-review |
| SEC-002 | threat-modeling |
| SEC-003 | vulnerability-scanning |
| SEC-004 | dependency-auditing |
| SEC-005 | code-security-review |
| SEC-006 | authentication-testing |
| SEC-007 | authorization-testing |
| SEC-008 | input-validation-testing |
| SEC-009 | security-configuration |
| SEC-010 | compliance-checking |
| SEC-011 | penetration-testing |
| SEC-012 | security-reporting |
| SEC-013 | incident-analysis |

---

### Agent 09: CI/CD Engineer
**Phase**: 10-cicd
**Skill Category**: devops/ (pipelines)
**Skills**: 6

| ID | Skill |
|----|-------|
| OPS-001 | cicd-pipeline |
| OPS-002 | build-automation |
| OPS-003 | artifact-management |
| OPS-004 | containerization |
| OPS-005 | infrastructure-as-code |
| OPS-006 | deployment-strategy |

---

### Agent 10: Environment Builder
**Phase**: 11-local-testing
**Skill Category**: devops/ + documentation/
**Skills**: 7

| ID | Skill |
|----|-------|
| OPS-101 | environment-configuration |
| OPS-102 | local-containerization |
| OPS-103 | database-operations |
| OPS-104 | technical-writing |
| OPS-105 | onboarding-documentation |
| OPS-106 | code-examples |
| OPS-107 | developer-tooling |

---

### Agent 11: Deployment Engineer (Staging)
**Phase**: 12-test-deploy
**Skill Category**: devops/ (staging)
**Skills**: 4

| ID | Skill |
|----|-------|
| OPS-201 | staging-deployment |
| OPS-202 | smoke-testing |
| OPS-203 | rollback-procedures |
| OPS-204 | staging-monitoring |

---

### Agent 12: Release Manager
**Phase**: 13-production
**Skill Category**: devops/ (production) + documentation/
**Skills**: 5

| ID | Skill |
|----|-------|
| OPS-301 | production-deployment |
| OPS-302 | backup-recovery |
| OPS-303 | auto-scaling |
| OPS-304 | changelog-management |
| OPS-305 | release-notes |

---

### Agent 13: Site Reliability Engineer
**Phase**: 14-operations
**Skill Category**: operations/ + documentation/
**Skills**: 14

| ID | Skill |
|----|-------|
| SRE-001 | system-monitoring |
| SRE-002 | performance-monitoring |
| SRE-003 | security-monitoring |
| SRE-004 | log-analysis |
| SRE-005 | alerting-management |
| SRE-006 | incident-response |
| SRE-007 | capacity-planning |
| SRE-008 | sla-management |
| SRE-009 | availability-management |
| SRE-010 | disaster-recovery |
| SRE-011 | change-management |
| SRE-012 | operational-reporting |
| SRE-013 | runbook-writing |
| SRE-014 | compliance-documentation |

---

### Agent 14: Upgrade Engineer
**Phase**: 15-upgrade
**Skill Category**: upgrade/
**Skills**: 6

| ID | Skill |
|----|-------|
| UPG-001 | dependency-upgrade |
| UPG-002 | breaking-change-analysis |
| UPG-003 | migration-automation |
| UPG-004 | compatibility-testing |
| UPG-005 | rollback-planning |
| UPG-006 | upgrade-documentation |

---

## Discovery Agents (13)

### Discover Orchestrator (D0)
**Phase**: setup | **Skills**: 4

| ID | Skill |
|----|-------|
| DISC-001 | discovery-orchestration |
| DISC-002 | phase-coordination |
| DISC-003 | context-assembly |
| DISC-004 | report-generation |

### Architecture Analyzer (D1)
**Phase**: setup | **Skills**: 6

| ID | Skill |
|----|-------|
| DISC-101 | architecture-detection |
| DISC-102 | pattern-identification |
| DISC-103 | dependency-analysis |
| DISC-104 | infrastructure-detection |
| DISC-105 | stack-profiling |
| DISC-106 | architecture-reporting |

### Test Evaluator (D2)
**Phase**: setup | **Skills**: 6

| ID | Skill |
|----|-------|
| DISC-201 | test-framework-detection |
| DISC-202 | coverage-analysis |
| DISC-203 | test-pattern-evaluation |
| DISC-204 | gap-identification |
| DISC-205 | test-quality-scoring |
| DISC-206 | test-reporting |

### Constitution Generator (D3)
**Phase**: setup | **Skills**: 4

| ID | Skill |
|----|-------|
| DISC-301 | principle-extraction |
| DISC-302 | article-drafting |
| DISC-303 | constitution-validation |
| DISC-304 | interactive-refinement |

### Skills Researcher (D4)
**Phase**: setup | **Skills**: 4

| ID | Skill |
|----|-------|
| DISC-401 | best-practice-research |
| DISC-402 | tool-evaluation |
| DISC-403 | skill-customization |
| DISC-404 | skills-reporting |

### Data Model Analyzer (D5)
**Phase**: setup | **Skills**: 4

| ID | Skill |
|----|-------|
| DISC-501 | schema-detection |
| DISC-502 | relationship-mapping |
| DISC-503 | data-flow-analysis |
| DISC-504 | data-model-reporting |

### Feature Mapper (D6)
**Phase**: setup | **Skills**: 12

| ID | Skill |
|----|-------|
| DISC-601 | feature-inventory |
| DISC-602 | api-surface-mapping |
| DISC-603 | ui-flow-mapping |
| DISC-604 | feature-dependency-graph |
| DISC-701 | behavior-extraction |
| DISC-702 | interaction-mapping |
| DISC-703 | state-transition-analysis |
| DISC-704 | side-effect-detection |
| DISC-705 | invariant-discovery |
| DISC-706 | boundary-identification |
| DISC-707 | error-path-cataloging |
| DISC-708 | behavior-reporting |

### Product Analyst (D7)
**Phase**: setup | **Skills**: 4

| ID | Skill |
|----|-------|
| DISC-801 | user-workflow-analysis |
| DISC-802 | business-rule-extraction |
| DISC-803 | domain-modeling |
| DISC-804 | product-reporting |

### Architecture Designer (D8)
**Phase**: setup | **Skills**: 4

| ID | Skill |
|----|-------|
| DISC-901 | modernization-assessment |
| DISC-902 | target-architecture-design |
| DISC-903 | migration-path-planning |
| DISC-904 | architecture-design-reporting |

### Characterization Test Generator (R2)
**Phase**: setup | **Skills**: 7

| ID | Skill |
|----|-------|
| RE-201 | behavior-to-test-conversion |
| RE-202 | golden-master-generation |
| RE-203 | boundary-test-creation |
| RE-204 | error-path-test-creation |
| RE-205 | interaction-test-creation |
| RE-206 | test-coverage-mapping |
| RE-207 | test-suite-organization |

### Artifact Integration (R3)
**Phase**: setup | **Skills**: 3

| ID | Skill |
|----|-------|
| RE-301 | discovery-artifact-merge |
| RE-302 | traceability-matrix-generation |
| RE-303 | constitution-augmentation |

### ATDD Bridge (R4)
**Phase**: setup | **Skills**: 3

| ID | Skill |
|----|-------|
| RE-401 | behavior-to-acceptance-criteria |
| RE-402 | sdlc-phase-seeding |
| RE-403 | atdd-readiness-report |

---

## Utility Agents (8)

### Quick-Scan Agent (QS)
**Phase**: 00-quick-scan | **Skills**: 3

| ID | Skill |
|----|-------|
| QS-001 | rapid-scope-estimation |
| QS-002 | complexity-classification |
| QS-003 | track-recommendation |

### Impact Analysis Orchestrator (IA0)
**Phase**: 02-impact-analysis | **Skills**: 3

| ID | Skill |
|----|-------|
| IA-001 | impact-orchestration |
| IA-002 | scope-determination |
| IA-003 | impact-reporting |

### Impact Analyzer (IA1)
**Phase**: 02-impact-analysis | **Skills**: 4

| ID | Skill |
|----|-------|
| IA-101 | code-impact-analysis |
| IA-102 | dependency-impact-tracing |
| IA-103 | behavioral-impact-assessment |
| IA-104 | change-risk-scoring |

### Entry Point Finder (IA2)
**Phase**: 02-impact-analysis | **Skills**: 4

| ID | Skill |
|----|-------|
| IA-201 | entry-point-detection |
| IA-202 | call-graph-analysis |
| IA-203 | data-flow-tracing |
| IA-204 | boundary-identification |

### Risk Assessor (IA3)
**Phase**: 02-impact-analysis | **Skills**: 4

| ID | Skill |
|----|-------|
| IA-301 | risk-classification |
| IA-302 | blast-radius-estimation |
| IA-303 | mitigation-recommendation |
| IA-304 | risk-reporting |

### Tracing Orchestrator (T0)
**Phase**: 02-tracing | **Skills**: 3

| ID | Skill |
|----|-------|
| TRACE-001 | tracing-orchestration |
| TRACE-002 | evidence-collection |
| TRACE-003 | diagnosis-reporting |

### Symptom Analyzer (T1)
**Phase**: 02-tracing | **Skills**: 4

| ID | Skill |
|----|-------|
| TRACE-101 | symptom-classification |
| TRACE-102 | error-pattern-matching |
| TRACE-103 | log-analysis |
| TRACE-104 | symptom-correlation |

### Execution Path Tracer (T2)
**Phase**: 02-tracing | **Skills**: 5

| ID | Skill |
|----|-------|
| TRACE-201 | call-stack-analysis |
| TRACE-202 | data-flow-tracing |
| TRACE-203 | state-mutation-tracking |
| TRACE-204 | async-flow-analysis |
| TRACE-205 | execution-path-reconstruction |

### Root Cause Identifier (T3)
**Phase**: 02-tracing | **Skills**: 4

| ID | Skill |
|----|-------|
| TRACE-301 | hypothesis-generation |
| TRACE-302 | evidence-evaluation |
| TRACE-303 | root-cause-classification |
| TRACE-304 | fix-recommendation |

---

## Skill Distribution Summary

| Group | Agent | ID | Phase | Skills |
|-------|-------|----|-------|--------|
| **Core SDLC** | SDLC Orchestrator | 00 | all | 12 |
| | Requirements Analyst | 01 | 01-requirements | 11 |
| | Solution Architect | 02 | 03-architecture | 13 |
| | System Designer | 03 | 04-design | 11 |
| | Test Design Engineer | 04 | 05-test-strategy | 9 |
| | Software Developer | 05 | 06-implementation | 14 |
| | Integration Tester | 06 | 07-testing | 8 |
| | QA Engineer | 07 | 08-code-review | 1 |
| | Security & Compliance Auditor | 08 | 09-validation | 13 |
| | CI/CD Engineer | 09 | 10-cicd | 6 |
| | Environment Builder | 10 | 11-local-testing | 7 |
| | Deployment Engineer (Staging) | 11 | 12-test-deploy | 4 |
| | Release Manager | 12 | 13-production | 5 |
| | Site Reliability Engineer | 13 | 14-operations | 14 |
| | Upgrade Engineer | 14 | 15-upgrade | 6 |
| **Discovery** | Discover Orchestrator | D0 | setup | 4 |
| | Architecture Analyzer | D1 | setup | 6 |
| | Test Evaluator | D2 | setup | 6 |
| | Constitution Generator | D3 | setup | 4 |
| | Skills Researcher | D4 | setup | 4 |
| | Data Model Analyzer | D5 | setup | 4 |
| | Feature Mapper | D6 | setup | 12 |
| | Product Analyst | D7 | setup | 4 |
| | Architecture Designer | D8 | setup | 4 |
| | Characterization Test Generator | R2 | setup | 7 |
| | Artifact Integration | R3 | setup | 3 |
| | ATDD Bridge | R4 | setup | 3 |
| **Utility** | Quick-Scan Agent | QS | 00-quick-scan | 3 |
| | Impact Analysis Orchestrator | IA0 | 02-impact-analysis | 3 |
| | Impact Analyzer | IA1 | 02-impact-analysis | 4 |
| | Entry Point Finder | IA2 | 02-impact-analysis | 4 |
| | Risk Assessor | IA3 | 02-impact-analysis | 4 |
| | Tracing Orchestrator | T0 | 02-tracing | 3 |
| | Symptom Analyzer | T1 | 02-tracing | 4 |
| | Execution Path Tracer | T2 | 02-tracing | 5 |
| | Root Cause Identifier | T3 | 02-tracing | 4 |
| **TOTAL** | **36 Agents** | | | **229** |

---

## Skill Categories

| Category | Skills | Agents |
|----------|--------|--------|
| orchestration/ | 12 | 00 |
| requirements/ | 11 | 01 |
| architecture/ | 13 | 02 |
| design/ | 11 | 03 |
| testing/ (planning) | 9 | 04 |
| development/ | 15 | 05, 07 |
| testing/ (execution) | 8 | 06 |
| security/ | 13 | 08 |
| devops/ | 22 | 09, 10, 11, 12 |
| operations/ | 14 | 13 |
| upgrade/ | 6 | 14 |
| discovery/ | 61 | D0-D8, R2-R4 |
| quick-scan/ | 3 | QS |
| impact-analysis/ | 15 | IA0-IA3 |
| tracing/ | 16 | T0-T3 |

---

**Manifest Version**: 4.0.0
**Last Updated**: 2026-02-07
