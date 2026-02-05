# Agent to Skill to Manifest Mapping

Generated: 2026-02-05T19:21:56.273Z

Total Agents: 37
Total Skills: 226
Total Rows: 229

## Legend

- **Agent ID**: Unique identifier from manifest
- **Agent Name**: Name from agent YAML frontmatter
- **Phase**: SDLC phase from manifest
- **Skill Name**: Name from skill SKILL.md frontmatter
- **Skill ID in Agent**: Skill ID as listed in agent's owned_skills
- **Skill ID in Skill Def**: Skill ID from SKILL.md frontmatter
- **Skill ID in Manifest**: Skill ID from skills-manifest.json

## Full Mapping

| Agent ID | Agent Name | Phase | Skill Name | Skill ID (Agent) | Skill ID (Skill Def) | Skill ID (Manifest) |
|----------|------------|-------|------------|------------------|----------------------|---------------------|
| 00 | sdlc-orchestrator | all | workflow-management | ORCH-001 | ORCH-001 | ORCH-001 |
| 00 | sdlc-orchestrator | all | task-decomposition | ORCH-002 | ORCH-002 | ORCH-002 |
| 00 | sdlc-orchestrator | all | progress-tracking | ORCH-003 | ORCH-003 | ORCH-003 |
| 00 | sdlc-orchestrator | all | gate-validation | ORCH-004 | ORCH-004 | ORCH-004 |
| 00 | sdlc-orchestrator | all | conflict-resolution | ORCH-005 | ORCH-005 | ORCH-005 |
| 00 | sdlc-orchestrator | all | priority-management | ORCH-006 | ORCH-006 | ORCH-006 |
| 00 | sdlc-orchestrator | all | communication-routing | ORCH-007 | ORCH-007 | ORCH-007 |
| 00 | sdlc-orchestrator | all | risk-assessment | ORCH-008 | ORCH-008 | ORCH-008 |
| 00 | sdlc-orchestrator | all | (not found) | ORCH-009 |  | ORCH-009 |
| 00 | sdlc-orchestrator | all | skill-validation | ORCH-010 | ORCH-010 | ORCH-010 |
| 00 | sdlc-orchestrator | all | (not found) | ORCH-011 |  | ORCH-011 |
| 00 | sdlc-orchestrator | all | generate-plan | ORCH-012 | ORCH-012 | ORCH-012 |
| 01 | requirements-analyst | 01-requirements | requirements-elicitation | REQ-001 | REQ-001 | REQ-001 |
| 01 | requirements-analyst | 01-requirements | user-story-writing | REQ-002 | REQ-002 | REQ-002 |
| 01 | requirements-analyst | 01-requirements | requirements-classification | REQ-003 | REQ-003 | REQ-003 |
| 01 | requirements-analyst | 01-requirements | ambiguity-detection | REQ-004 | REQ-004 | REQ-004 |
| 01 | requirements-analyst | 01-requirements | requirements-prioritization | REQ-005 | REQ-005 | REQ-005 |
| 01 | requirements-analyst | 01-requirements | dependency-mapping | REQ-006 | REQ-006 | REQ-006 |
| 01 | requirements-analyst | 01-requirements | change-impact-analysis | REQ-007 | REQ-007 | REQ-007 |
| 01 | requirements-analyst | 01-requirements | traceability-management | REQ-008 | REQ-008 | REQ-008 |
| 01 | requirements-analyst | 01-requirements | acceptance-criteria-writing | REQ-009 | REQ-009 | REQ-009 |
| 01 | requirements-analyst | 01-requirements | nfr-quantification | REQ-010 | REQ-010 | REQ-010 |
| 01 | requirements-analyst | 01-requirements | domain-research | REQ-011 | REQ-011 | REQ-011 |
| 02 | solution-architect | 03-architecture | architecture-pattern-selection | ARCH-001 | ARCH-001 | ARCH-001 |
| 02 | solution-architect | 03-architecture | technology-evaluation | ARCH-002 | ARCH-002 | ARCH-002 |
| 02 | solution-architect | 03-architecture | database-design | ARCH-003 | ARCH-003 | ARCH-003 |
| 02 | solution-architect | 03-architecture | api-architecture | ARCH-004 | ARCH-004 | ARCH-004 |
| 02 | solution-architect | 03-architecture | infrastructure-design | ARCH-005 | ARCH-005 | ARCH-005 |
| 02 | solution-architect | 03-architecture | security-architecture | ARCH-006 | ARCH-006 | ARCH-006 |
| 02 | solution-architect | 03-architecture | scalability-planning | ARCH-007 | ARCH-007 | ARCH-007 |
| 02 | solution-architect | 03-architecture | integration-architecture | ARCH-008 | ARCH-008 | ARCH-008 |
| 02 | solution-architect | 03-architecture | cost-estimation | ARCH-009 | ARCH-009 | ARCH-009 |
| 02 | solution-architect | 03-architecture | adr-writing | ARCH-010 | ARCH-010 | ARCH-010 |
| 02 | solution-architect | 03-architecture | diagram-generation | ARCH-011 | ARCH-011 | ARCH-011 |
| 02 | solution-architect | 03-architecture | environment-design | ARCH-012 | ARCH-012 | ARCH-012 |
| 02 | solution-architect | 03-architecture | architecture-documentation | DOC-009 | DOC-009 | DOC-009 |
| 03 | system-designer | 04-design | module-design | DES-001 | DES-001 | DES-001 |
| 03 | system-designer | 04-design | interface-contract-design | DES-002 | DES-002 | DES-002 |
| 03 | system-designer | 04-design | ui-ux-design | DES-003 | DES-003 | DES-003 |
| 03 | system-designer | 04-design | component-design | DES-004 | DES-004 | DES-004 |
| 03 | system-designer | 04-design | data-flow-design | DES-005 | DES-005 | DES-005 |
| 03 | system-designer | 04-design | error-handling-design | DES-006 | DES-006 | DES-006 |
| 03 | system-designer | 04-design | state-management-design | DES-007 | DES-007 | DES-007 |
| 03 | system-designer | 04-design | integration-design | DES-008 | DES-008 | DES-008 |
| 03 | system-designer | 04-design | validation-design | DES-009 | DES-009 | DES-009 |
| 03 | system-designer | 04-design | wireframing | DES-010 | DES-010 | DES-010 |
| 03 | system-designer | 04-design | user-guide-writing | DOC-010 | DOC-010 | DOC-010 |
| 04 | test-design-engineer | 05-test-strategy | test-strategy-design | TEST-001 | TEST-001 | TEST-001 |
| 04 | test-design-engineer | 05-test-strategy | test-case-design | TEST-002 | TEST-002 | TEST-002 |
| 04 | test-design-engineer | 05-test-strategy | test-data-generation | TEST-003 | TEST-003 | TEST-003 |
| 04 | test-design-engineer | 05-test-strategy | traceability-management | TEST-004 | TEST-004 | TEST-004 |
| 04 | test-design-engineer | 05-test-strategy | test-prioritization | TEST-005 | TEST-005 | TEST-005 |
| 04 | test-design-engineer | 05-test-strategy | atdd-scenario-mapping | TEST-014 | TEST-014 | TEST-014 |
| 04 | test-design-engineer | 05-test-strategy | atdd-fixture-generation | TEST-015 | TEST-015 | TEST-015 |
| 04 | test-design-engineer | 05-test-strategy | atdd-checklist | TEST-016 | TEST-016 | TEST-016 |
| 04 | test-design-engineer | 05-test-strategy | atdd-priority-tagging | TEST-017 | TEST-017 | TEST-017 |
| 05 | software-developer | 06-implementation | code-implementation | DEV-001 | DEV-001 | DEV-001 |
| 05 | software-developer | 06-implementation | unit-test-writing | DEV-002 | DEV-002 | DEV-002 |
| 05 | software-developer | 06-implementation | interface-implementation | DEV-003 | DEV-003 | DEV-003 |
| 05 | software-developer | 06-implementation | database-integration | DEV-004 | DEV-004 | DEV-004 |
| 05 | software-developer | 06-implementation | frontend-development | DEV-005 | DEV-005 | DEV-005 |
| 05 | software-developer | 06-implementation | authentication-implementation | DEV-006 | DEV-006 | DEV-006 |
| 05 | software-developer | 06-implementation | integration-implementation | DEV-007 | DEV-007 | DEV-007 |
| 05 | software-developer | 06-implementation | error-handling | DEV-008 | DEV-008 | DEV-008 |
| 05 | software-developer | 06-implementation | code-refactoring | DEV-009 | DEV-009 | DEV-009 |
| 05 | software-developer | 06-implementation | bug-fixing | DEV-010 | DEV-010 | DEV-010 |
| 05 | software-developer | 06-implementation | code-documentation | DEV-011 | DEV-011 | DEV-011 |
| 05 | software-developer | 06-implementation | migration-writing | DEV-012 | DEV-012 | DEV-012 |
| 05 | software-developer | 06-implementation | performance-optimization | DEV-013 | DEV-013 | DEV-013 |
| 05 | software-developer | 06-implementation | (not found) | DEV-014 |  | DEV-014 |
| 06 | integration-tester | 07-testing | coverage-analysis | TEST-006 | TEST-006 | TEST-006 |
| 06 | integration-tester | 07-testing | defect-analysis | TEST-007 | TEST-007 | TEST-007 |
| 06 | integration-tester | 07-testing | regression-management | TEST-008 | TEST-008 | TEST-008 |
| 06 | integration-tester | 07-testing | test-reporting | TEST-009 | TEST-009 | TEST-009 |
| 06 | integration-tester | 07-testing | test-environment-management | TEST-010 | TEST-010 | TEST-010 |
| 06 | integration-tester | 07-testing | impact-analysis | TEST-011 | TEST-011 | TEST-011 |
| 06 | integration-tester | 07-testing | performance-test-design | TEST-012 | TEST-012 | TEST-012 |
| 06 | integration-tester | 07-testing | security-test-design | TEST-013 | TEST-013 | TEST-013 |
| 07 | qa-engineer | 08-code-review | code-review | DEV-015 | DEV-015 | DEV-015 |
| 08 | security-compliance-auditor | 09-validation | security-architecture-review | SEC-001 | SEC-001 | SEC-001 |
| 08 | security-compliance-auditor | 09-validation | threat-modeling | SEC-002 | SEC-002 | SEC-002 |
| 08 | security-compliance-auditor | 09-validation | vulnerability-scanning | SEC-003 | SEC-003 | SEC-003 |
| 08 | security-compliance-auditor | 09-validation | dependency-auditing | SEC-004 | SEC-004 | SEC-004 |
| 08 | security-compliance-auditor | 09-validation | code-security-review | SEC-005 | SEC-005 | SEC-005 |
| 08 | security-compliance-auditor | 09-validation | authentication-testing | SEC-006 | SEC-006 | SEC-006 |
| 08 | security-compliance-auditor | 09-validation | authorization-testing | SEC-007 | SEC-007 | SEC-007 |
| 08 | security-compliance-auditor | 09-validation | input-validation-testing | SEC-008 | SEC-008 | SEC-008 |
| 08 | security-compliance-auditor | 09-validation | security-configuration | SEC-009 | SEC-009 | SEC-009 |
| 08 | security-compliance-auditor | 09-validation | compliance-checking | SEC-010 | SEC-010 | SEC-010 |
| 08 | security-compliance-auditor | 09-validation | penetration-testing | SEC-011 | SEC-011 | SEC-011 |
| 08 | security-compliance-auditor | 09-validation | security-reporting | SEC-012 | SEC-012 | SEC-012 |
| 08 | security-compliance-auditor | 09-validation | incident-analysis | SEC-013 | SEC-013 | SEC-013 |
| 09 | cicd-engineer | 10-cicd | cicd-pipeline-design | OPS-001 | OPS-001 | OPS-001 |
| 09 | cicd-engineer | 10-cicd | containerization | OPS-002 | OPS-002 | OPS-002 |
| 09 | cicd-engineer | 10-cicd | infrastructure-as-code | OPS-003 | OPS-003 | OPS-003 |
| 09 | cicd-engineer | 10-cicd | log-management | OPS-004 | OPS-004 | OPS-004 |
| 09 | cicd-engineer | 10-cicd | monitoring-setup | OPS-005 | OPS-005 | OPS-005 |
| 09 | cicd-engineer | 10-cicd | cost-optimization | OPS-006 | OPS-006 | OPS-006 |
| 10 | environment-builder | 11-local-testing | technical-writing | DOC-001 | DOC-001 | DOC-001 |
| 10 | environment-builder | 11-local-testing | onboarding-documentation | DOC-002 | DOC-002 | DOC-002 |
| 10 | environment-builder | 11-local-testing | code-documentation | DOC-003 | DOC-003 | DOC-003 |
| 10 | environment-builder | 11-local-testing | environment-configuration | OPS-007 | OPS-007 | OPS-007 |
| 10 | environment-builder | 11-local-testing | database-operations | OPS-008 | OPS-008 | OPS-008 |
| 10 | environment-builder | 11-local-testing | app-build-orchestration | OPS-015 | OPS-015 | OPS-015 |
| 10 | environment-builder | 11-local-testing | server-lifecycle-management | OPS-016 | OPS-016 | OPS-016 |
| 11 | deployment-engineer-staging | 12-test-deploy | diagram-creation | DOC-004 | DOC-004 | DOC-004 |
| 11 | deployment-engineer-staging | 12-test-deploy | deployment-strategy | OPS-009 | OPS-009 | OPS-009 |
| 11 | deployment-engineer-staging | 12-test-deploy | load-balancing | OPS-010 | OPS-010 | OPS-010 |
| 11 | deployment-engineer-staging | 12-test-deploy | ssl-tls-management | OPS-011 | OPS-011 | OPS-011 |
| 12 | release-manager | 13-production | changelog-management | DOC-005 | DOC-005 | DOC-005 |
| 12 | release-manager | 13-production | api-documentation | DOC-006 | DOC-006 | DOC-006 |
| 12 | release-manager | 13-production | backup-and-recovery | OPS-012 | OPS-012 | OPS-012 |
| 12 | release-manager | 13-production | auto-scaling-configuration | OPS-013 | OPS-013 | OPS-013 |
| 12 | release-manager | 13-production | performance-tuning | OPS-014 | OPS-014 | OPS-014 |
| 13 | site-reliability-engineer | 14-operations | runbook-writing | DOC-007 | DOC-007 | DOC-007 |
| 13 | site-reliability-engineer | 14-operations | compliance-documentation | DOC-008 | DOC-008 | DOC-008 |
| 13 | site-reliability-engineer | 14-operations | system-monitoring | SRE-001 | SRE-001 | SRE-001 |
| 13 | site-reliability-engineer | 14-operations | performance-monitoring | SRE-002 | SRE-002 | SRE-002 |
| 13 | site-reliability-engineer | 14-operations | security-monitoring | SRE-003 | SRE-003 | SRE-003 |
| 13 | site-reliability-engineer | 14-operations | log-analysis | SRE-004 | SRE-004 | SRE-004 |
| 13 | site-reliability-engineer | 14-operations | alerting-management | SRE-005 | SRE-005 | SRE-005 |
| 13 | site-reliability-engineer | 14-operations | incident-response | SRE-006 | SRE-006 | SRE-006 |
| 13 | site-reliability-engineer | 14-operations | capacity-planning | SRE-007 | SRE-007 | SRE-007 |
| 13 | site-reliability-engineer | 14-operations | sla-management | SRE-008 | SRE-008 | SRE-008 |
| 13 | site-reliability-engineer | 14-operations | availability-management | SRE-009 | SRE-009 | SRE-009 |
| 13 | site-reliability-engineer | 14-operations | disaster-recovery | SRE-010 | SRE-010 | SRE-010 |
| 13 | site-reliability-engineer | 14-operations | change-management | SRE-011 | SRE-011 | SRE-011 |
| 13 | site-reliability-engineer | 14-operations | operations-reporting | SRE-012 | SRE-012 | SRE-012 |
| 14 | upgrade-engineer | 15-upgrade | version-detection | UPG-001 | UPG-001 | UPG-001 |
| 14 | upgrade-engineer | 15-upgrade | registry-lookup | UPG-002 | UPG-002 | UPG-002 |
| 14 | upgrade-engineer | 15-upgrade | impact-analysis | UPG-003 | UPG-003 | UPG-003 |
| 14 | upgrade-engineer | 15-upgrade | migration-planning | UPG-004 | UPG-004 | UPG-004 |
| 14 | upgrade-engineer | 15-upgrade | upgrade-execution | UPG-005 | UPG-005 | UPG-005 |
| 14 | upgrade-engineer | 15-upgrade | regression-validation | UPG-006 | UPG-006 | UPG-006 |
| D0 | discover-orchestrator | setup | project-detection | DISC-001 | DISC-001 | DISC-001 |
| D0 | discover-orchestrator | setup | workflow-coordination | DISC-002 | DISC-002 | DISC-002 |
| D0 | discover-orchestrator | setup | state-initialization | DISC-003 | DISC-003 | DISC-003 |
| D0 | discover-orchestrator | setup | cloud-configuration | DISC-004 | DISC-004 | DISC-004 |
| D1 | architecture-analyzer | setup | directory-scan | DISC-101 | DISC-101 | DISC-101 |
| D1 | architecture-analyzer | setup | tech-detection | DISC-102 | DISC-102 | DISC-102 |
| D1 | architecture-analyzer | setup | dependency-analysis | DISC-103 | DISC-103 | DISC-103 |
| D1 | architecture-analyzer | setup | architecture-documentation | DISC-104 | DISC-104 | DISC-104 |
| D1 | architecture-analyzer | setup | deployment-topology-detection | DISC-105 | DISC-105 | DISC-105 |
| D1 | architecture-analyzer | setup | integration-point-mapping | DISC-106 | DISC-106 | DISC-106 |
| D2 | test-evaluator | setup | test-framework-detection | DISC-201 | DISC-201 | DISC-201 |
| D2 | test-evaluator | setup | coverage-analysis | DISC-202 | DISC-202 | DISC-202 |
| D2 | test-evaluator | setup | gap-identification | DISC-203 | DISC-203 | DISC-203 |
| D2 | test-evaluator | setup | test-report-generation | DISC-204 | DISC-204 | DISC-204 |
| D2 | test-evaluator | setup | critical-path-analysis | DISC-205 | DISC-205 | DISC-205 |
| D2 | test-evaluator | setup | test-quality-assessment | DISC-206 | DISC-206 | DISC-206 |
| D3 | constitution-generator | setup | research-coordination | DISC-301 | DISC-301 | DISC-301 |
| D3 | constitution-generator | setup | article-generation | DISC-302 | DISC-302 | DISC-302 |
| D3 | constitution-generator | setup | interactive-review | DISC-303 | DISC-303 | DISC-303 |
| D3 | constitution-generator | setup | domain-detection | DISC-304 | DISC-304 | DISC-304 |
| D4 | skills-researcher | setup | skills-search | DISC-401 | DISC-401 | DISC-401 |
| D4 | skills-researcher | setup | skill-evaluation | DISC-402 | DISC-402 | DISC-402 |
| D4 | skills-researcher | setup | skill-installation | DISC-403 | DISC-403 | DISC-403 |
| D4 | skills-researcher | setup | web-research-fallback | DISC-404 | DISC-404 | DISC-404 |
| D5 | data-model-analyzer | setup | data-store-detection | DISC-501 | DISC-501 | DISC-501 |
| D5 | data-model-analyzer | setup | schema-extraction | DISC-502 | DISC-502 | DISC-502 |
| D5 | data-model-analyzer | setup | relationship-mapping | DISC-503 | DISC-503 | DISC-503 |
| D5 | data-model-analyzer | setup | migration-analysis | DISC-504 | DISC-504 | DISC-504 |
| D6 | feature-mapper | setup | endpoint-discovery | DISC-601 | DISC-601 | DISC-601 |
| D6 | feature-mapper | setup | page-discovery | DISC-602 | DISC-602 | DISC-602 |
| D6 | feature-mapper | setup | job-discovery | DISC-603 | DISC-603 | DISC-603 |
| D6 | feature-mapper | setup | domain-mapping | DISC-604 | DISC-604 | DISC-604 |
| D7 | product-analyst | setup | vision-elicitation | DISC-701 | DISC-701 | DISC-701 |
| D7 | product-analyst | setup | solution-brainstorming | DISC-702 | DISC-702 | DISC-702 |
| D7 | product-analyst | setup | prd-generation | DISC-703 | DISC-703 | DISC-703 |
| D7 | product-analyst | setup | mvp-scoping | DISC-704 | DISC-704 | DISC-704 |
| D8 | architecture-designer | setup | architecture-pattern-selection | DISC-801 | DISC-801 | DISC-801 |
| D8 | architecture-designer | setup | data-model-design | DISC-802 | DISC-802 | DISC-802 |
| D8 | architecture-designer | setup | api-design | DISC-803 | DISC-803 | DISC-803 |
| D8 | architecture-designer | setup | directory-scaffolding | DISC-804 | DISC-804 | DISC-804 |
| IA0 | impact-analysis-orchestrator | 02-impact-analysis | impact-delegation | IA-001 | IA-001 | IA-001 |
| IA0 | impact-analysis-orchestrator | 02-impact-analysis | impact-consolidation | IA-002 | IA-002 | IA-002 |
| IA0 | impact-analysis-orchestrator | 02-impact-analysis | scope-refinement | IA-003 | IA-003 | IA-003 |
| IA1 | impact-analyzer | 02-impact-analysis | file-impact-detection | IA-101 | IA-101 | IA-101 |
| IA1 | impact-analyzer | 02-impact-analysis | module-dependency-mapping | IA-102 | IA-102 | IA-102 |
| IA1 | impact-analyzer | 02-impact-analysis | coupling-analysis | IA-103 | IA-103 | IA-103 |
| IA1 | impact-analyzer | 02-impact-analysis | change-propagation-estimation | IA-104 | IA-104 | IA-104 |
| IA2 | entry-point-finder | 02-impact-analysis | api-endpoint-discovery | IA-201 | IA-201 | IA-201 |
| IA2 | entry-point-finder | 02-impact-analysis | ui-component-discovery | IA-202 | IA-202 | IA-202 |
| IA2 | entry-point-finder | 02-impact-analysis | job-handler-discovery | IA-203 | IA-203 | IA-203 |
| IA2 | entry-point-finder | 02-impact-analysis | event-listener-discovery | IA-204 | IA-204 | IA-204 |
| IA3 | risk-assessor | 02-impact-analysis | complexity-scoring | IA-301 | IA-301 | IA-301 |
| IA3 | risk-assessor | 02-impact-analysis | coverage-gap-detection | IA-302 | IA-302 | IA-302 |
| IA3 | risk-assessor | 02-impact-analysis | technical-debt-identification | IA-303 | IA-303 | IA-303 |
| IA3 | risk-assessor | 02-impact-analysis | risk-zone-mapping | IA-304 | IA-304 | IA-304 |
| QS | quick-scan-agent | 00-quick-scan | quick-scope-estimation | QS-001 | QS-001 | QS-001 |
| QS | quick-scan-agent | 00-quick-scan | keyword-search | QS-002 | QS-002 | QS-002 |
| QS | quick-scan-agent | 00-quick-scan | file-count-estimation | QS-003 | QS-003 | QS-003 |
| R1 | behavior-analyzer | R1-behavior-extraction | code-behavior-extraction | RE-001 | RE-001 | RE-001 |
| R1 | behavior-analyzer | R1-behavior-extraction | ac-generation-from-code | RE-002 | RE-002 | RE-002 |
| R1 | behavior-analyzer | R1-behavior-extraction | precondition-inference | RE-003 | RE-003 | RE-003 |
| R1 | behavior-analyzer | R1-behavior-extraction | postcondition-inference | RE-004 | RE-004 | RE-004 |
| R1 | behavior-analyzer | R1-behavior-extraction | side-effect-detection | RE-005 | RE-005 | RE-005 |
| R1 | behavior-analyzer | R1-behavior-extraction | business-rule-extraction | RE-006 | RE-006 | RE-006 |
| R1 | behavior-analyzer | R1-behavior-extraction | data-transformation-mapping | RE-007 | RE-007 | RE-007 |
| R1 | behavior-analyzer | R1-behavior-extraction | priority-scoring | RE-008 | RE-008 | RE-008 |
| R2 | characterization-test-generator | R2-characterization-tests | execution-capture | RE-101 | RE-101 | RE-101 |
| R2 | characterization-test-generator | R2-characterization-tests | fixture-generation | RE-102 | RE-102 | RE-102 |
| R2 | characterization-test-generator | R2-characterization-tests | side-effect-mocking | RE-103 | RE-103 | RE-103 |
| R2 | characterization-test-generator | R2-characterization-tests | snapshot-creation | RE-104 | RE-104 | RE-104 |
| R2 | characterization-test-generator | R2-characterization-tests | boundary-input-discovery | RE-105 | RE-105 | RE-105 |
| R2 | characterization-test-generator | R2-characterization-tests | test-scaffold-generation | RE-106 | RE-106 | RE-106 |
| R2 | characterization-test-generator | R2-characterization-tests | golden-file-management | RE-107 | RE-107 | RE-107 |
| R3 | artifact-integration | R3-artifact-integration | ac-feature-linking | RE-201 | RE-201 | RE-201 |
| R3 | artifact-integration | R3-artifact-integration | traceability-matrix-generation | RE-202 | RE-202 | RE-202 |
| R3 | artifact-integration | R3-artifact-integration | report-generation | RE-203 | RE-203 | RE-203 |
| R4 | atdd-bridge | R4-atdd-bridge | atdd-checklist-generation | RE-301 | RE-301 | RE-301 |
| R4 | atdd-bridge | R4-atdd-bridge | ac-behavior-tagging | RE-302 | RE-302 | RE-302 |
| R4 | atdd-bridge | R4-atdd-bridge | priority-migration | RE-303 | RE-303 | RE-303 |
| T0 | tracing-orchestrator | 02-tracing | tracing-delegation | TRACE-001 | TRACE-001 | TRACE-001 |
| T0 | tracing-orchestrator | 02-tracing | trace-consolidation | TRACE-002 | TRACE-002 | TRACE-002 |
| T0 | tracing-orchestrator | 02-tracing | diagnosis-summary | TRACE-003 | TRACE-003 | TRACE-003 |
| T1 | symptom-analyzer | 02-tracing | error-message-parsing | TRACE-101 | TRACE-101 | TRACE-101 |
| T1 | symptom-analyzer | 02-tracing | stack-trace-analysis | TRACE-102 | TRACE-102 | TRACE-102 |
| T1 | symptom-analyzer | 02-tracing | similar-bug-search | TRACE-103 | TRACE-103 | TRACE-103 |
| T1 | symptom-analyzer | 02-tracing | symptom-pattern-matching | TRACE-104 | TRACE-104 | TRACE-104 |
| T2 | execution-path-tracer | 02-tracing | call-chain-reconstruction | TRACE-201 | TRACE-201 | TRACE-201 |
| T2 | execution-path-tracer | 02-tracing | data-flow-tracing | TRACE-202 | TRACE-202 | TRACE-202 |
| T2 | execution-path-tracer | 02-tracing | state-mutation-tracking | TRACE-203 | TRACE-203 | TRACE-203 |
| T2 | execution-path-tracer | 02-tracing | condition-identification | TRACE-204 | TRACE-204 | TRACE-204 |
| T2 | execution-path-tracer | 02-tracing | async-flow-tracing |  | TRACE-205 | TRACE-205 |
| T3 | root-cause-identifier | 02-tracing | hypothesis-generation | TRACE-301 | TRACE-301 | TRACE-301 |
| T3 | root-cause-identifier | 02-tracing | hypothesis-ranking | TRACE-302 | TRACE-302 | TRACE-302 |
| T3 | root-cause-identifier | 02-tracing | root-cause-confirmation | TRACE-303 | TRACE-303 | TRACE-303 |
| T3 | root-cause-identifier | 02-tracing | fix-suggestion | TRACE-304 | TRACE-304 | TRACE-304 |

## Discrepancies Found

- Agent sdlc-orchestrator references ORCH-009 but no SKILL.md found
- Agent sdlc-orchestrator references ORCH-011 but no SKILL.md found
- Agent software-developer references DEV-014 but no SKILL.md found
- Manifest has TRACE-205 for execution-path-tracer but not in agent file
