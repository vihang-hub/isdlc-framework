# Assess Project Complexity

**Category**: Orchestration
**Agent**: SDLC Orchestrator (Agent 00)
**Phase**: Pre-Phase 01 (Project Initialization)
**Purpose**: Analyze project requirements and recommend appropriate workflow track

---

## Skill Description

This skill analyzes a project brief or initial requirements to determine:
1. **Complexity Level** (0-4): From bug fix to enterprise platform
2. **Recommended Track**: Quick Flow, Standard Flow, or Enterprise Flow
3. **Required Phases**: Which of the 13 phases are needed
4. **Estimated Timeline**: Approximate time investment

The orchestrator uses this assessment to configure the project's workflow, ensuring the right level of rigor without unnecessary overhead.

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

**Recommended Track**: Quick Flow

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

**Recommended Track**: Quick Flow

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

**Recommended Track**: Standard Flow

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

**Recommended Track**: Standard Flow

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

**Recommended Track**: Enterprise Flow

---

## Workflow Tracks

### Quick Flow (Levels 0-1)
**Phases Required**: 01 (brief) → 05 → 06
**Gates**: GATE-05, GATE-06
**Timeline**: 30 minutes - 2 hours
**Best For**: Bug fixes, trivial changes, simple features

**Process**:
1. **Phase 01 (Simplified)**: Brief requirements (1 paragraph + acceptance criteria)
2. **Phase 05**: Implementation with unit tests
3. **Phase 06**: Integration/E2E tests (if applicable)

**Skipped Phases**: 02, 03, 04, 07, 08, 09, 10, 11, 12, 13

---

### Standard Flow (Levels 2-3)
**Phases Required**: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 09
**Gates**: GATE-01 through GATE-07, GATE-09
**Timeline**: 4-8 hours (Level 2), 1-3 days (Level 3)
**Best For**: Features, services, integrations

**Process**:
1. **Phase 01**: Full requirements specification
2. **Phase 02**: Architecture design
3. **Phase 03**: API contracts and module design
4. **Phase 04**: Test strategy
5. **Phase 05**: Implementation (TDD)
6. **Phase 06**: Integration testing
7. **Phase 07**: Code review and QA
8. **Phase 09**: CI/CD pipeline setup

**Skipped Phases**: 08 (security), 10 (local dev), 11-13 (deployment/ops)

**Note**: Phase 08 can be added if security requirements exist

---

### Enterprise Flow (Level 4)
**Phases Required**: All 13 phases
**Gates**: All 13 gates
**Timeline**: Weeks to months
**Best For**: Platforms, compliance systems, mission-critical applications

**Process**: Full SDLC workflow through all phases

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

### Step 4: Recommend Track
- Levels 0-1 → Quick Flow
- Levels 2-3 → Standard Flow
- Level 4 → Enterprise Flow

### Step 5: Identify Phase Requirements
Based on the track, specify:
- Required phases
- Optional phases (can add if needed)
- Skippable phases

### Step 6: Validate with User
Present the assessment and ask for confirmation:
```
Based on your requirements, I assess this as:

**Complexity Level**: 2 (Standard Feature)
**Recommended Track**: Standard Flow
**Required Phases**: 01, 02, 03, 04, 05, 06, 07, 09
**Estimated Timeline**: 4-8 hours
**Skipped Phases**: 08, 10, 11, 12, 13

This means:
- Full requirements and architecture
- API design and test strategy
- TDD implementation with code review
- CI/CD pipeline setup
- No security audit (unless you need it)
- No formal deployment process

Does this match your expectations? [Yes/No/Adjust]
```

### Step 7: Document in State
Write assessment to `.isdlc/state.json`:
```json
{
  "complexity_assessment": {
    "level": 2,
    "track": "standard",
    "assessed_at": "2026-01-17T10:30:00Z",
    "dimensions": {
      "architectural": "medium",
      "security": "low",
      "testing": "medium",
      "deployment": "low",
      "team": "low",
      "timeline": "short"
    }
  },
  "workflow": {
    "track": "standard",
    "phases_required": [1, 2, 3, 4, 5, 6, 7, 9],
    "phases_optional": [8],
    "phases_skipped": [10, 11, 12, 13]
  }
}
```

---

## Example Assessments

### Example 1: Fix Typo in README
**Input**: "Fix typo in README.md line 42"

**Assessment**:
- Architectural: Low (documentation only)
- Security: None
- Testing: Low (no tests needed)
- Deployment: Low (no deployment)
- Team: Low (single person)
- Timeline: Immediate (< 5 minutes)

**Result**: Level 0, Quick Flow (simplified even further - just edit and commit)

---

### Example 2: Add User Profile API
**Input**: "Add REST API endpoint for user profile CRUD operations with validation"

**Assessment**:
- Architectural: Medium (new endpoint, follows existing patterns)
- Security: Medium (authentication required)
- Testing: Medium (unit + integration tests)
- Deployment: Medium (requires deployment to staging/prod)
- Team: Low (single developer)
- Timeline: Short (1 day)

**Result**: Level 2, Standard Flow (Phases 01-07, 09)

---

### Example 3: Build Multi-Tenant SaaS Platform
**Input**: "Build multi-tenant SaaS platform with org management, RBAC, billing, analytics"

**Assessment**:
- Architectural: Critical (complex multi-service architecture)
- Security: High (RBAC, data isolation, compliance)
- Testing: High (E2E, performance, security testing)
- Deployment: Critical (zero-downtime, multi-region)
- Team: High (multiple teams, stakeholders)
- Timeline: Long (months)

**Result**: Level 4, Enterprise Flow (All 13 phases)

---

## Track Override Protocol

Users can override the recommended track if they have specific needs:

### Upgrade to Higher Track
**Allowed**: Always (more rigor is acceptable)

**Example**: Level 1 project but user wants full security audit
- Recommended: Quick Flow
- Override: Standard Flow + Phase 08

### Downgrade to Lower Track
**Requires Justification**: User must acknowledge skipped phases

**Example**: Level 3 project but user wants Quick Flow
- Recommended: Standard Flow
- Override Request: Quick Flow
- System asks: "You're skipping architecture, design, test strategy, code review, and CI/CD. Are you sure? [Yes/No]"

---

## Integration with Orchestrator

The orchestrator uses this skill during project initialization:

1. **User provides brief**
2. **Orchestrator runs `/assess-complexity`**
3. **Orchestrator presents assessment**
4. **User confirms or adjusts**
5. **Orchestrator writes to state.json**
6. **Workflow begins with correct track**

Throughout the project, the orchestrator enforces the track by:
- Only executing required phases
- Skipping validation for optional phases
- Allowing manual addition of optional phases if needed

---

## Skill Parameters

When invoking this skill:

```
/assess-complexity

Required Input:
- Project brief or initial requirements

Optional Input:
- Known constraints (timeline, compliance)
- Preferred track (if user has strong preference)

Output:
- Complexity level (0-4)
- Recommended track (Quick/Standard/Enterprise)
- Required phases list
- Optional phases list
- Estimated timeline
- Assessment rationale
```

---

## Related Skills

- [validate-gate.md](validate-gate.md) - Uses track info to determine which gates to enforce
- [delegate-phase.md](delegate-phase.md) - Only delegates to required phases
- [generate-state.md](generate-state.md) - Includes track configuration in state

---

## Notes

- **Re-assessment**: If scope changes significantly during development, re-run this skill
- **Phase Addition**: User can always add optional phases mid-project (e.g., add security audit to Standard Flow)
- **Phase Removal**: Cannot remove required phases once committed to a track
- **Constitution**: Track selection must still comply with project constitution

---

**Skill Version**: 1.0.0
**Last Updated**: 2026-01-17
**Author**: iSDLC Framework
