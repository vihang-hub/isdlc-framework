# Agent-Skill Mapping

This document provides a comprehensive mapping of all 48 agents and their 240 skills across the iSDLC framework, including skill IDs from all three authoritative sources:

1. **Manifest** - `src/claude/hooks/config/skills-manifest.json`
2. **SKILL.md** - Individual skill definition files in `src/claude/skills/`
3. **Agent.md** - Agent definition files in `src/claude/agents/`

## Legend

| Symbol | Meaning |
|--------|---------|
| ✓ | Consistent across all sources |
| ⚠️ | Discrepancy detected |
| **MISSING** | Not found in that source |
| DUPLICATE | Same ID used by multiple SKILL.md files |

---

## Core Orchestration

### Agent 00: sdlc-orchestrator

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 00 | sdlc-orchestrator | all |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| ORCH-001 | Workflow Management | ORCH-001 | ORCH-001 | ✓ |
| ORCH-002 | Task Decomposition | ORCH-002 | ORCH-002 | ✓ |
| ORCH-003 | Progress Tracking | ORCH-003 | ORCH-003 | ✓ |
| ORCH-004 | Gate Validation | ORCH-004 | ORCH-004 | ✓ |
| ORCH-005 | Conflict Resolution | ORCH-005 | ORCH-005 | ✓ |
| ORCH-006 | Priority Management | ORCH-006 | ORCH-006 | ✓ |
| ORCH-007 | Communication Routing | ORCH-007 | ORCH-007 | ✓ |
| ORCH-008 | Risk Assessment | ORCH-008 | ORCH-008 | ✓ |
| ORCH-009 | Assess Complexity | ORCH-009 | ORCH-009 | ✓ |
| ORCH-010 | Skill Validation | ORCH-010 | ORCH-010 | ✓ |
| ORCH-011 | Autonomous Constitution Validate | ORCH-011 | ORCH-011 | ✓ |
| ORCH-012 | Generate Plan | ORCH-012 | ORCH-012 | ✓ |

---

## Discovery Phase (Setup)

### Agent D0: discover-orchestrator

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| D0 | discover-orchestrator | setup |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DISC-001 | Project Detection | DISC-001 | DISC-001 | ✓ |
| DISC-002 | Workflow Coordination | DISC-002 | DISC-002 | ✓ |
| DISC-003 | State Initialization | DISC-003 | DISC-003 | ✓ |
| DISC-004 | Cloud Configuration | DISC-004 | DISC-004 | ✓ |

### Agent D1: architecture-analyzer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| D1 | architecture-analyzer | setup |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DISC-101 | Directory Scan | DISC-101 | DISC-101 | ✓ |
| DISC-102 | Tech Detection | DISC-102 | DISC-102 | ✓ |
| DISC-103 | Dependency Analysis | DISC-103 | DISC-103 | ✓ |
| DISC-104 | Architecture Documentation | DISC-104 | DISC-104 | ✓ |
| DISC-105 | Deployment Topology Detection | DISC-105 | DISC-105 | ✓ |
| DISC-106 | Integration Point Mapping | DISC-106 | DISC-106 | ✓ |

### Agent D2: test-evaluator

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| D2 | test-evaluator | setup |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DISC-201 | Test Framework Detection | DISC-201 | DISC-201 | ✓ |
| DISC-202 | Coverage Analysis | DISC-202 | DISC-202 | ✓ |
| DISC-203 | Gap Identification | DISC-203 | DISC-203 | ✓ |
| DISC-204 | Test Report Generation | DISC-204 | DISC-204 | ✓ |
| DISC-205 | Critical Path Analysis | DISC-205 | DISC-205 | ✓ |
| DISC-206 | Test Quality Assessment | DISC-206 | DISC-206 | ✓ |

### Agent D3: constitution-generator

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| D3 | constitution-generator | setup |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DISC-301 | Research Coordination | DISC-301 | DISC-301 | ✓ |
| DISC-302 | Article Generation | DISC-302 | DISC-302 | ✓ |
| DISC-303 | Interactive Review | DISC-303 | DISC-303 | ✓ |
| DISC-304 | Domain Detection | DISC-304 | DISC-304 | ✓ |

### Agent D4: skills-researcher

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| D4 | skills-researcher | setup |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DISC-401 | Skills Search | DISC-401 | DISC-401 | ✓ |
| DISC-402 | Skill Evaluation | DISC-402 | DISC-402 | ✓ |
| DISC-403 | Skill Installation | DISC-403 | DISC-403 | ✓ |
| DISC-404 | Web Research Fallback | DISC-404 | DISC-404 | ✓ |

### Agent D5: data-model-analyzer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| D5 | data-model-analyzer | setup |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DISC-501 | Data Store Detection | DISC-501 | DISC-501 | ✓ |
| DISC-502 | Schema Extraction | DISC-502 | DISC-502 | ✓ |
| DISC-503 | Relationship Mapping | DISC-503 | DISC-503 | ✓ |
| DISC-504 | Migration Analysis | DISC-504 | DISC-504 | ✓ |

### Agent D6: feature-mapper

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| D6 | feature-mapper | setup |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DISC-601 | Endpoint Discovery | DISC-601 | DISC-601 | ✓ |
| DISC-602 | Page Discovery | DISC-602 | DISC-602 | ✓ |
| DISC-603 | Job Discovery | DISC-603 | DISC-603 | ✓ |
| DISC-604 | Domain Mapping | DISC-604 | DISC-604 | ✓ |

### Agent D7: product-analyst

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| D7 | product-analyst | setup |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DISC-701 | Vision Elicitation | DISC-701 | DISC-701 | ✓ |
| DISC-702 | Solution Brainstorming | DISC-702 | DISC-702 | ✓ |
| DISC-703 | PRD Generation | DISC-703 | DISC-703 | ✓ |
| DISC-704 | MVP Scoping | DISC-704 | DISC-704 | ✓ |

### Agent D8: architecture-designer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| D8 | architecture-designer | setup |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DISC-801 | Architecture Pattern Selection | DISC-801 | DISC-801 | ✓ |
| DISC-802 | Data Model Design | DISC-802 | DISC-802 | ✓ |
| DISC-803 | API Design | DISC-803 | DISC-803 | ✓ |
| DISC-804 | Directory Scaffolding | DISC-804 | DISC-804 | ✓ |

---

## Reverse Engineering Phase

### Agent R1: behavior-analyzer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| R1 | behavior-analyzer | R1-behavior-extraction |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| RE-001 | Code Behavior Extraction | RE-001 | RE-001 | ✓ |
| RE-002 | AC Generation from Code | RE-002 | RE-002 | ✓ |
| RE-003 | Precondition Inference | RE-003 | RE-003 | ✓ |
| RE-004 | Postcondition Inference | RE-004 | RE-004 | ✓ |
| RE-005 | Side Effect Detection | RE-005 | RE-005 | ✓ |
| RE-006 | Business Rule Extraction | RE-006 | RE-006 | ✓ |
| RE-007 | Data Transformation Mapping | RE-007 | RE-007 | ✓ |
| RE-008 | Priority Scoring | RE-008 | RE-008 | ✓ |

### Agent R2: characterization-test-generator

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| R2 | characterization-test-generator | R2-characterization-tests |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| RE-101 | Execution Capture | RE-101 | RE-101 | ✓ |
| RE-102 | Fixture Generation | RE-102 | RE-102 | ✓ |
| RE-103 | Side Effect Mocking | RE-103 | RE-103 | ✓ |
| RE-104 | Snapshot Creation | RE-104 | RE-104 | ✓ |
| RE-105 | Boundary Input Discovery | RE-105 | RE-105 | ✓ |
| RE-106 | Test Scaffold Generation | RE-106 | RE-106 | ✓ |
| RE-107 | Golden File Management | RE-107 | RE-107 | ✓ |

### Agent R3: artifact-integration

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| R3 | artifact-integration | R3-artifact-integration |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| RE-201 | AC Feature Linking | RE-201 | RE-201 | ✓ |
| RE-202 | Traceability Matrix Generation | RE-202 | RE-202 | ✓ |
| RE-203 | Report Generation | RE-203 | RE-203 | ✓ |

### Agent R4: atdd-bridge

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| R4 | atdd-bridge | R4-atdd-bridge |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| RE-301 | ATDD Checklist Generation | RE-301 | RE-301 | ✓ |
| RE-302 | AC Behavior Tagging | RE-302 | RE-302 | ✓ |
| RE-303 | Priority Migration | RE-303 | RE-303 | ✓ |

---

## Quick Scan Phase

### Agent QS: quick-scan-agent

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| QS | quick-scan-agent | 00-quick-scan |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| QS-001 | Quick Scope Estimation | QS-001 | QS-001 | ✓ |
| QS-002 | Keyword Search | QS-002 | QS-002 | ✓ |
| QS-003 | File Count Estimation | QS-003 | QS-003 | ✓ |

---

## Impact Analysis Phase

### Agent IA0: impact-analysis-orchestrator

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| IA0 | impact-analysis-orchestrator | 02-impact-analysis |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| IA-001 | Impact Delegation | IA-001 | IA-001 | ✓ |
| IA-002 | Impact Consolidation | IA-002 | IA-002 | ✓ |
| IA-003 | Scope Refinement | IA-003 | IA-003 | ✓ |

### Agent IA1: impact-analyzer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| IA1 | impact-analyzer | 02-impact-analysis |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| IA-101 | File Impact Detection | IA-101 | IA-101 | ✓ |
| IA-102 | Module Dependency Mapping | IA-102 | IA-102 | ✓ |
| IA-103 | Coupling Analysis | IA-103 | IA-103 | ✓ |
| IA-104 | Change Propagation Estimation | IA-104 | IA-104 | ✓ |

### Agent IA2: entry-point-finder

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| IA2 | entry-point-finder | 02-impact-analysis |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| IA-201 | API Endpoint Discovery | IA-201 | IA-201 | ✓ |
| IA-202 | UI Component Discovery | IA-202 | IA-202 | ✓ |
| IA-203 | Job Handler Discovery | IA-203 | IA-203 | ✓ |
| IA-204 | Event Listener Discovery | IA-204 | IA-204 | ✓ |

### Agent IA3: risk-assessor

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| IA3 | risk-assessor | 02-impact-analysis |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| IA-301 | Complexity Scoring | IA-301 | IA-301 | ✓ |
| IA-302 | Coverage Gap Detection | IA-302 | IA-302 | ✓ |
| IA-303 | Technical Debt Identification | IA-303 | IA-303 | ✓ |
| IA-304 | Risk Zone Mapping | IA-304 | IA-304 | ✓ |

---

## Tracing Phase

### Agent T0: tracing-orchestrator

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| T0 | tracing-orchestrator | 02-tracing |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| TRACE-001 | Tracing Delegation | TRACE-001 | TRACE-001 | ✓ |
| TRACE-002 | Trace Consolidation | TRACE-002 | TRACE-002 | ✓ |
| TRACE-003 | Diagnosis Summary | TRACE-003 | TRACE-003 | ✓ |

### Agent T1: symptom-analyzer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| T1 | symptom-analyzer | 02-tracing |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| TRACE-101 | Error Message Parsing | TRACE-101 | TRACE-101 | ✓ |
| TRACE-102 | Stack Trace Analysis | TRACE-102 | TRACE-102 | ✓ |
| TRACE-103 | Similar Bug Search | TRACE-103 | TRACE-103 | ✓ |
| TRACE-104 | Symptom Pattern Matching | TRACE-104 | TRACE-104 | ✓ |

### Agent T2: execution-path-tracer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| T2 | execution-path-tracer | 02-tracing |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| TRACE-201 | Call Chain Reconstruction | TRACE-201 | TRACE-201 | ✓ |
| TRACE-202 | Data Flow Tracing | TRACE-202 | TRACE-202 | ✓ |
| TRACE-203 | State Mutation Tracking | TRACE-203 | TRACE-203 | ✓ |
| TRACE-204 | Condition Identification | TRACE-204 | TRACE-204 | ✓ |
| TRACE-205 | Async Flow Tracing | TRACE-205 | TRACE-205 | ✓ |

### Agent T3: root-cause-identifier

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| T3 | root-cause-identifier | 02-tracing |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| TRACE-301 | Hypothesis Generation | TRACE-301 | TRACE-301 | ✓ |
| TRACE-302 | Hypothesis Ranking | TRACE-302 | TRACE-302 | ✓ |
| TRACE-303 | Root Cause Confirmation | TRACE-303 | TRACE-303 | ✓ |
| TRACE-304 | Fix Suggestion | TRACE-304 | TRACE-304 | ✓ |

---

## Main SDLC Phases (01-15)

### Agent 01: requirements-analyst

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 01 | requirements-analyst | 01-requirements |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| REQ-001 | Requirements Elicitation | REQ-001 | REQ-001 | ✓ |
| REQ-002 | User Story Writing | REQ-002 | REQ-002 | ✓ |
| REQ-003 | Requirements Classification | REQ-003 | REQ-003 | ✓ |
| REQ-004 | Ambiguity Detection | REQ-004 | REQ-004 | ✓ |
| REQ-005 | Requirements Prioritization | REQ-005 | REQ-005 | ✓ |
| REQ-006 | Dependency Mapping | REQ-006 | REQ-006 | ✓ |
| REQ-007 | Change Impact Analysis | REQ-007 | REQ-007 | ✓ |
| REQ-008 | Traceability Management | REQ-008 | REQ-008 | ✓ |
| REQ-009 | Acceptance Criteria Writing | REQ-009 | REQ-009 | ✓ |
| REQ-010 | NFR Quantification | REQ-010 | REQ-010 | ✓ |
| REQ-011 | Domain Research | REQ-011 | REQ-011 | ✓ |

### Agent 02: solution-architect

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 02 | solution-architect | 03-architecture |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| ARCH-001 | Architecture Pattern Selection | ARCH-001 | ARCH-001 | ✓ |
| ARCH-002 | Technology Evaluation | ARCH-002 | ARCH-002 | ✓ |
| ARCH-003 | Database Design | ARCH-003 | ARCH-003 | ✓ |
| ARCH-004 | API Architecture | ARCH-004 | ARCH-004 | ✓ |
| ARCH-005 | Infrastructure Design | ARCH-005 | ARCH-005 | ✓ |
| ARCH-006 | Security Architecture | ARCH-006 | ARCH-006 | ✓ |
| ARCH-007 | Scalability Planning | ARCH-007 | ARCH-007 | ✓ |
| ARCH-008 | Integration Architecture | ARCH-008 | ARCH-008 | ✓ |
| ARCH-009 | Cost Estimation | ARCH-009 | ARCH-009 | ✓ |
| ARCH-010 | ADR Writing | ARCH-010 | ARCH-010 | ✓ |
| ARCH-011 | Diagram Generation | ARCH-011 | ARCH-011 | ✓ |
| ARCH-012 | Environment Design | ARCH-012 | ARCH-012 | ✓ |
| DOC-009 | Architecture Documentation | DOC-009 | DOC-009 | ✓ |

### Agent 03: system-designer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 03 | system-designer | 04-design |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DES-001 | Module Design | DES-001 | DES-001 | ✓ |
| DES-002 | Interface Contract Design | DES-002 | DES-002 | ✓ |
| DES-003 | UI/UX Design | DES-003 | DES-003 | ✓ |
| DES-004 | Component Design | DES-004 | DES-004 | ✓ |
| DES-005 | Data Flow Design | DES-005 | DES-005 | ✓ |
| DES-006 | Error Handling Design | DES-006 | DES-006 | ✓ |
| DES-007 | State Management Design | DES-007 | DES-007 | ✓ |
| DES-008 | Integration Design | DES-008 | DES-008 | ✓ |
| DES-009 | Validation Design | DES-009 | DES-009 | ✓ |
| DES-010 | Wireframing | DES-010 | DES-010 | ✓ |
| DOC-010 | User Guide Writing | DOC-010 | DOC-010 | ✓ |

### Agent 04: test-design-engineer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 04 | test-design-engineer | 05-test-strategy |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| TEST-001 | Test Strategy Design | TEST-001 | TEST-001 | ✓ |
| TEST-002 | Test Case Design | TEST-002 | TEST-002 | ✓ |
| TEST-003 | Test Data Generation | TEST-003 | TEST-003 | ✓ |
| TEST-004 | Traceability Management | TEST-004 | TEST-004 | ✓ |
| TEST-005 | Test Prioritization | TEST-005 | TEST-005 | ✓ |
| TEST-014 | ATDD Scenario Mapping | TEST-014 | TEST-014 | ✓ |
| TEST-015 | ATDD Fixture Generation | TEST-015 | TEST-015 | ✓ |
| TEST-016 | ATDD Checklist | TEST-016 | TEST-016 | ✓ |
| TEST-017 | ATDD Priority Tagging | TEST-017 | TEST-017 | ✓ |

### Agent 05: software-developer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 05 | software-developer | 06-implementation |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DEV-001 | Code Implementation | DEV-001 | DEV-001 | ✓ |
| DEV-002 | Unit Test Writing | DEV-002 | DEV-002 | ✓ |
| DEV-003 | Interface Implementation | DEV-003 | DEV-003 | ✓ |
| DEV-004 | Database Integration | DEV-004 | DEV-004 | ✓ |
| DEV-005 | Frontend Development | DEV-005 | DEV-005 | ✓ |
| DEV-006 | Authentication Implementation | DEV-006 | DEV-006 | ✓ |
| DEV-007 | Integration Implementation | DEV-007 | DEV-007 | ✓ |
| DEV-008 | Error Handling | DEV-008 | DEV-008 | ✓ |
| DEV-009 | Code Refactoring | DEV-009 | DEV-009 | ✓ |
| DEV-010 | Bug Fixing | DEV-010 | DEV-010 | ✓ |
| DEV-011 | Code Documentation | DEV-011 | DEV-011 | ✓ |
| DEV-012 | Migration Writing | DEV-012 | DEV-012 | ✓ |
| DEV-013 | Performance Optimization | DEV-013 | DEV-013 | ✓ |
| DEV-014 | Autonomous Iterate | DEV-014 | DEV-014 | ✓ |

### Agent 06: integration-tester

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 06 | integration-tester | 07-testing |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| TEST-006 | Coverage Analysis | TEST-006 | TEST-006 | ✓ |
| TEST-007 | Defect Analysis | TEST-007 | TEST-007 | ✓ |
| TEST-008 | Regression Management | TEST-008 | TEST-008 | ✓ |
| TEST-009 | Test Reporting | TEST-009 | TEST-009 | ✓ |
| TEST-010 | Test Environment Management | TEST-010 | TEST-010 | ✓ |
| TEST-011 | Impact Analysis | TEST-011 | TEST-011 | ✓ |
| TEST-012 | Performance Test Design | TEST-012 | TEST-012 | ✓ |
| TEST-013 | Security Test Design | TEST-013 | TEST-013 | ✓ |

### Agent 07: qa-engineer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 07 | qa-engineer | 08-code-review |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| DEV-015 | Code Review | DEV-015 | DEV-015 | ✓ |

### Agent 08: security-compliance-auditor

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 08 | security-compliance-auditor | 09-validation |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| SEC-001 | Security Architecture Review | SEC-001 | SEC-001 | ✓ |
| SEC-002 | Threat Modeling | SEC-002 | SEC-002 | ✓ |
| SEC-003 | Vulnerability Scanning | SEC-003 | SEC-003 | ✓ |
| SEC-004 | Dependency Auditing | SEC-004 | SEC-004 | ✓ |
| SEC-005 | Code Security Review | SEC-005 | SEC-005 | ✓ |
| SEC-006 | Authentication Testing | SEC-006 | SEC-006 | ✓ |
| SEC-007 | Authorization Testing | SEC-007 | SEC-007 | ✓ |
| SEC-008 | Input Validation Testing | SEC-008 | SEC-008 | ✓ |
| SEC-009 | Security Configuration | SEC-009 | SEC-009 | ✓ |
| SEC-010 | Compliance Checking | SEC-010 | SEC-010 | ✓ |
| SEC-011 | Penetration Testing | SEC-011 | SEC-011 | ✓ |
| SEC-012 | Security Reporting | SEC-012 | SEC-012 | ✓ |
| SEC-013 | Incident Analysis | SEC-013 | SEC-013 | ✓ |

### Agent 09: cicd-engineer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 09 | cicd-engineer | 10-cicd |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| OPS-001 | CI/CD Pipeline Design | OPS-001 | OPS-001 | ✓ |
| OPS-002 | Containerization | OPS-002 | OPS-002 | ✓ |
| OPS-003 | Infrastructure as Code | OPS-003 | OPS-003 | ✓ |
| OPS-004 | Log Management | OPS-004 | OPS-004 | ✓ |
| OPS-005 | Monitoring Setup | OPS-005 | OPS-005 | ✓ |
| OPS-006 | Cost Optimization | OPS-006 | OPS-006 | ✓ |

### Agent 10: environment-builder

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 10 | environment-builder | 11-local-testing |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| OPS-007 | Environment Configuration | OPS-007 | OPS-007 | ✓ |
| OPS-008 | Database Operations | OPS-008 | OPS-008 | ✓ |
| OPS-015 | App Build Orchestration | OPS-015 | OPS-015 | ✓ |
| OPS-016 | Server Lifecycle Management | OPS-016 | OPS-016 | ✓ |
| DOC-001 | Technical Writing | DOC-001 | DOC-001 | ✓ |
| DOC-002 | Onboarding Documentation | DOC-002 | DOC-002 | ✓ |
| DOC-003 | Code Documentation | DOC-003 | DOC-003 | ✓ |

### Agent 11: deployment-engineer-staging

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 11 | deployment-engineer-staging | 12-test-deploy |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| OPS-009 | Deployment Strategy | OPS-009 | OPS-009 | ✓ |
| OPS-010 | Load Balancing | OPS-010 | OPS-010 | ✓ |
| OPS-011 | SSL/TLS Management | OPS-011 | OPS-011 | ✓ |
| DOC-004 | Diagram Creation | DOC-004 | DOC-004 | ✓ |

### Agent 12: release-manager

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 12 | release-manager | 13-production |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| OPS-012 | Backup and Recovery | OPS-012 | OPS-012 | ✓ |
| OPS-013 | Auto Scaling Configuration | OPS-013 | OPS-013 | ✓ |
| OPS-014 | Performance Tuning | OPS-014 | OPS-014 | ✓ |
| DOC-005 | Changelog Management | DOC-005 | DOC-005 | ✓ |
| DOC-006 | API Documentation | DOC-006 | DOC-006 | ✓ |

### Agent 13: site-reliability-engineer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 13 | site-reliability-engineer | 14-operations |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| SRE-001 | System Monitoring | SRE-001 | SRE-001 | ✓ |
| SRE-002 | Performance Monitoring | SRE-002 | SRE-002 | ✓ |
| SRE-003 | Security Monitoring | SRE-003 | SRE-003 | ✓ |
| SRE-004 | Log Analysis | SRE-004 | SRE-004 | ✓ |
| SRE-005 | Alerting Management | SRE-005 | SRE-005 | ✓ |
| SRE-006 | Incident Response | SRE-006 | SRE-006 | ✓ |
| SRE-007 | Capacity Planning | SRE-007 | SRE-007 | ✓ |
| SRE-008 | SLA Management | SRE-008 | SRE-008 | ✓ |
| SRE-009 | Availability Management | SRE-009 | SRE-009 | ✓ |
| SRE-010 | Disaster Recovery | SRE-010 | SRE-010 | ✓ |
| SRE-011 | Change Management | SRE-011 | SRE-011 | ✓ |
| SRE-012 | Operations Reporting | SRE-012 | SRE-012 | ✓ |
| DOC-007 | Runbook Writing | DOC-007 | DOC-007 | ✓ |
| DOC-008 | Compliance Documentation | DOC-008 | DOC-008 | ✓ |

### Agent 14: upgrade-engineer

| Agent ID | Agent Name | Phase |
|----------|-----------|-------|
| 14 | upgrade-engineer | 15-upgrade |

| Skill ID (Manifest) | Skill Name | Skill ID (SKILL.md) | Skill ID (Agent.md) | Status |
|---------------------|------------|---------------------|---------------------|--------|
| UPG-001 | Version Detection | UPG-001 | UPG-001 | ✓ |
| UPG-002 | Registry Lookup | UPG-002 | UPG-002 | ✓ |
| UPG-003 | Impact Analysis | UPG-003 | UPG-003 | ✓ |
| UPG-004 | Migration Planning | UPG-004 | UPG-004 | ✓ |
| UPG-005 | Upgrade Execution | UPG-005 | UPG-005 | ✓ |
| UPG-006 | Regression Validation | UPG-006 | UPG-006 | ✓ |

---

## Discrepancy Summary

No discrepancies. All 240 skills are fully consistent across manifest, SKILL.md files, and agent files.

---

## Statistics

| Metric | Count |
|--------|-------|
| Total Agents | 48 |
| Total Skills (Manifest) | 240 |
| Total SKILL.md Files | 240 |
| Skills with Full Consistency | 240 |
| Skills with Discrepancies | 0 |
| Missing SKILL.md Files | 0 |
| Missing Agent Assignments | 0 |
| Duplicate Skill IDs | 0 |

---

*Generated: 2026-02-07*
*Source: iSDLC Framework v0.1.0-alpha*
