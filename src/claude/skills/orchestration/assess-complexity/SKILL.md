---
name: assess-complexity
description: Analyze project requirements and determine required phases
skill_id: ORCH-009
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 2.0.0
when_to_use: Project initialization, scope changes, re-assessment
dependencies: []
---

# Assess Project Complexity

**Category**: Orchestration
**Agent**: SDLC Orchestrator (Agent 00)
**Phase**: Pre-Phase 01 (Project Initialization)
**Purpose**: Analyze project requirements and determine required phases dynamically

---

## Skill Description

This skill analyzes a project brief or initial requirements to determine:
1. **Complexity Level** (0-4): From bug fix to enterprise platform
2. **Required Phases**: Which of the 13 phases are needed for this task
3. **Estimated Timeline**: Approximate time investment

The orchestrator uses this assessment to configure the project's workflow dynamically, ensuring the right level of rigor without unnecessary overhead.

---

## When to Use

- **Project Initialization**: Before Phase 01 begins
- **Scope Changes**: When requirements significantly expand/contract
- **Re-assessment**: If initial track proves inadequate

---

## Complexity Levels

### Level 0: Trivial Changes
**Examples**:
- Fix typos in documentation
- Update configuration values
- Fix obvious bugs (< 10 lines of code)
- Change UI text/labels

**Characteristics**:
- No architecture impact
- No new features
- Minimal testing required
- < 30 minutes work

**Typical Phases**: 01, 05, 06

---

### Level 1: Simple Features
**Examples**:
- Add logging to existing functions
- Simple validation rules
- Basic UI component updates
- Minor bug fixes with tests

**Characteristics**:
- Single module/component impact
- Well-understood solution
- Minimal dependencies
- < 2 hours work

**Typical Phases**: 01, 05, 06

---

### Level 2: Standard Features
**Examples**:
- New API endpoint with validation
- Database schema changes
- New UI feature with backend integration
- Refactoring a module

**Characteristics**:
- Multiple components involved
- Some architectural decisions needed
- Integration testing required
- 4-8 hours work

**Typical Phases**: 01, 02, 03, 04, 05, 06, 07, 09

---

### Level 3: Significant Features
**Examples**:
- New microservice
- Authentication/authorization system
- Third-party API integration
- Multi-component feature

**Characteristics**:
- Cross-cutting concerns
- Security considerations
- Performance requirements
- Multiple teams/stakeholders
- 1-3 days work

**Typical Phases**: 01, 02, 03, 04, 05, 06, 07, 09

---

### Level 4: Enterprise Platforms
**Examples**:
- Multi-service architecture
- Compliance-heavy systems (HIPAA, SOC2)
- High-availability platforms
- Large-scale refactoring

**Characteristics**:
- Complex architecture
- Regulatory compliance required
- High security requirements
- Multi-week timeline
- Production deployment risk

**Typical Phases**: All 13 phases

---

## Assessment Criteria

When assessing a project, evaluate these dimensions:

### 1. Architectural Impact
- **Low**: Single file/component changes
- **Medium**: Multiple components, existing patterns
- **High**: New patterns, cross-cutting concerns
- **Critical**: Platform-wide changes

### 2. Security Requirements
- **None**: No sensitive data, internal tools
- **Low**: Basic authentication
- **Medium**: Authorization, data encryption
- **High**: Compliance (HIPAA, PCI-DSS, SOC2)

### 3. Testing Complexity
- **Low**: Unit tests sufficient
- **Medium**: Integration tests needed
- **High**: E2E, performance, security testing
- **Critical**: Compliance testing, penetration testing

### 4. Deployment Risk
- **Low**: No deployment (or dev environment only)
- **Medium**: Staging deployment
- **High**: Production deployment with rollback
- **Critical**: Zero-downtime, multi-region deployment

### 5. Team/Stakeholder Involvement
- **Low**: Single developer
- **Medium**: Small team (2-3 people)
- **High**: Multiple teams
- **Critical**: Cross-org, regulatory approval

### 6. Timeline Constraints
- **Immediate**: < 1 day
- **Short**: 1-3 days
- **Medium**: 1-2 weeks
- **Long**: Weeks to months

---

## Assessment Process

### Step 1: Gather Information
Ask the user to provide:
- Brief description of the change/feature
- Expected impact (which systems/components)
- Security/compliance requirements
- Timeline expectations
- Deployment target (dev/staging/production)

### Step 2: Score Each Dimension
Rate each of the 6 dimensions (Architectural Impact, Security, Testing, Deployment, Team, Timeline).

### Step 3: Calculate Complexity Level
Use this decision matrix:

| Dimension Score | Level 0 | Level 1 | Level 2 | Level 3 | Level 4 |
|----------------|---------|---------|---------|---------|---------|
| **Architectural** | Low | Low | Medium | Medium-High | High-Critical |
| **Security** | None | None-Low | Low-Medium | Medium-High | High-Critical |
| **Testing** | Low | Low | Medium | Medium-High | High-Critical |
| **Deployment** | Low | Low | Medium | Medium-High | High-Critical |
| **Team** | Low | Low-Medium | Medium | Medium-High | High-Critical |
| **Timeline** | Immediate | Immediate-Short | Short-Medium | Medium-Long | Long |

**Rule**: The complexity level is determined by the **highest-scoring dimension**.

### Step 4: Select Phases
Based on complexity level, determine required phases:
- Levels 0-1: Phases 01, 05, 06
- Levels 2-3: Phases 01, 02, 03, 04, 05, 06, 07, 09
- Level 4: All 13 phases

### Step 5: Validate with User
Present the assessment and ask for confirmation.

### Step 6: Document in State
Write assessment to `.isdlc/state.json`.

---

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| project_brief | String | Yes | Brief description of the project/feature |
| constraints | Object | No | Known constraints (timeline, compliance) |
| preferred_track | String | No | User's preferred track if any |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| complexity_level | Integer | 0-4 complexity rating |
| required_phases | Array | List of required phase numbers |
| estimated_timeline | String | Approximate time estimate |
| assessment_rationale | String | Explanation of the assessment |

---

## Related Skills

- **gate-validation** (ORCH-004) - Uses track info to determine which gates to enforce
- **workflow-management** (ORCH-001) - Only delegates to required phases

---

**Skill Version**: 2.0.0
**Last Updated**: 2026-02-05
