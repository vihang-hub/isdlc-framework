# Scale-Adaptive Workflow Tracks

**Feature**: Scale-adaptive workflow tracks for the iSDLC framework
**Version**: 1.0.0
**Date**: 2026-01-17
**Status**: ✅ Implemented

---

## Overview

The iSDLC framework now supports **three workflow tracks** that adapt to project complexity, ensuring the right level of rigor without unnecessary overhead:

1. **Quick Flow** - For bug fixes and simple features (30 mins - 2 hours)
2. **Standard Flow** - For features and services (4 hours - 3 days)
3. **Enterprise Flow** - For platforms and compliance systems (weeks - months)

This addresses the critical gap identified in the [Framework Comparison Analysis](FRAMEWORK-COMPARISON-ANALYSIS.md) where all projects were forced through all 13 phases regardless of complexity.

---

## The Problem We Solved

### Before: One-Size-Fits-All
- **All projects** went through **all 13 phases**
- Bug fix (2 lines of code) → 13 phases → hours of overhead
- Enterprise platform → 13 phases → appropriate rigor

### After: Right-Sized Process
- **Bug fixes** → Quick Flow → 3 phases → 30 minutes - 2 hours
- **Features** → Standard Flow → 8 phases → 4 hours - 3 days
- **Platforms** → Enterprise Flow → 13 phases → weeks - months

**Result**: Framework now works for projects of all sizes.

---

## The Three Workflow Tracks

### Quick Flow (Complexity Levels 0-1)

**Best For**:
- Bug fixes (< 10 lines of code)
- Configuration changes
- Documentation updates
- Simple validation rules
- Minor UI tweaks

**Phases Required**: 3 phases
- Phase 01: Brief Requirements (simplified)
- Phase 05: Implementation
- Phase 06: Testing

**Phases Skipped**: 10 phases
- 02 (Architecture), 03 (Design), 04 (Test Strategy), 07 (Code Review), 08 (Security), 09 (CI/CD), 10 (Local Dev), 11 (Staging), 12 (Production), 13 (Operations)

**Gates Enforced**: GATE-05, GATE-06

**Timeline**: 30 minutes - 2 hours

**Quality Thresholds**:
- Unit test coverage: ≥60%
- Integration tests: Optional
- Code review: Optional
- Security scan: None
- Documentation: Minimal (code comments)

**Use When**:
- No architecture impact
- Well-understood solution
- Internal tools or non-production changes
- Minimal testing needed

**⚠️ Warnings**:
- No architecture review - ensure change fits existing patterns
- No formal design - only for well-understood solutions
- No security audit - not suitable for security-sensitive changes
- No deployment automation - manual deployment only

---

### Standard Flow (Complexity Levels 2-3)

**Best For**:
- New API endpoints with validation
- Database schema changes
- New UI features with backend integration
- Refactoring modules
- Third-party integrations
- Authentication/authorization features
- New microservices (non-production)

**Phases Required**: 8 phases
- Phase 01: Requirements Capture
- Phase 02: Architecture & Blueprint
- Phase 03: Design & API Contracts
- Phase 04: Test Strategy & Design
- Phase 05: Implementation
- Phase 06: Integration & Testing
- Phase 07: Code Review & QA
- Phase 09: CI/CD Setup

**Phases Optional**: 2 phases
- Phase 08: Security Validation (if handling sensitive data)
- Phase 10: Local Dev Environment (if multi-developer team)

**Phases Skipped**: 3 phases
- 11 (Staging Deployment), 12 (Production Deployment), 13 (Operations)

**Gates Enforced**: GATE-01 through GATE-07, GATE-09

**Timeline**: 4 hours - 3 days

**Quality Thresholds**:
- Unit test coverage: ≥80%
- Integration test coverage: ≥70%
- Code review: Required
- Security scan: Basic (dependency scan)
- Documentation: Standard (README + API docs)

**Use When**:
- Multiple components involved
- Some architectural decisions needed
- Integration testing required
- Not production-critical (dev/staging deployments)

**⚠️ Warnings**:
- No security audit by default - add Phase 08 if handling sensitive data
- No formal deployment process - suitable for dev/staging only
- No operations setup - not for production-critical systems

**Optional Phase Triggers**:
- Add Phase 08 when: Handling authentication, authorization, or sensitive data
- Add Phase 10 when: Multiple developers or complex local setup needed

---

### Enterprise Flow (Complexity Level 4)

**Best For**:
- Multi-tenant SaaS platforms
- Compliance-heavy systems (HIPAA, PCI-DSS, SOC2)
- High-availability production systems
- Large-scale platform refactoring
- Mission-critical applications
- Multi-region distributed systems
- Systems requiring formal security audit
- Systems with strict SLA requirements

**Phases Required**: All 13 phases
- Phases 01 through 13 (complete SDLC)

**Phases Skipped**: None

**Gates Enforced**: All 13 gates

**Timeline**: Weeks to months

**Quality Thresholds**:
- Unit test coverage: ≥90%
- Integration test coverage: ≥80%
- Code review: Required
- Security scan: Comprehensive (SAST, DAST, penetration testing)
- Documentation: Comprehensive (full documentation suite)

**Use When**:
- Complex multi-service architecture
- Regulatory compliance required
- High security requirements
- Production deployment with zero-downtime needs
- Multi-team coordination required

**⚠️ Warnings**:
- Full SDLC process - significant time investment required
- All 13 gates must pass - no shortcuts
- Suitable for production-critical, compliance-driven projects only

---

## Complexity Assessment

Projects are assessed on 5 complexity levels (0-4) using 6 dimensions:

### Complexity Levels

| Level | Name | Timeline | Recommended Track |
|-------|------|----------|-------------------|
| **0** | Trivial Changes | < 30 minutes | Quick Flow |
| **1** | Simple Features | < 2 hours | Quick Flow |
| **2** | Standard Features | 4-8 hours | Standard Flow |
| **3** | Significant Features | 1-3 days | Standard Flow |
| **4** | Enterprise Platforms | Weeks-months | Enterprise Flow |

### Assessment Dimensions

1. **Architectural Impact**
   - Low: Single file/component changes
   - Medium: Multiple components, existing patterns
   - High: New patterns, cross-cutting concerns
   - Critical: Platform-wide architectural changes

2. **Security Requirements**
   - None: No sensitive data, internal tools
   - Low: Basic authentication
   - Medium: Authorization, data encryption
   - High: Compliance (HIPAA, PCI-DSS, SOC2)

3. **Testing Complexity**
   - Low: Unit tests sufficient
   - Medium: Integration tests needed
   - High: E2E, performance, security testing
   - Critical: Compliance testing, penetration testing

4. **Deployment Risk**
   - Low: No deployment (or dev environment only)
   - Medium: Staging deployment
   - High: Production deployment with rollback
   - Critical: Zero-downtime, multi-region deployment

5. **Team/Stakeholder Involvement**
   - Low: Single developer
   - Medium: Small team (2-3 people)
   - High: Multiple teams
   - Critical: Cross-org, regulatory approval

6. **Timeline Constraints**
   - Immediate: < 1 day
   - Short: 1-3 days
   - Medium: 1-2 weeks
   - Long: Weeks to months

### Assessment Process

The SDLC Orchestrator uses the `assess-complexity` skill to:

1. Gather project information from user
2. Score each dimension (low/medium/high/critical)
3. Determine complexity level (highest-scoring dimension wins)
4. Recommend appropriate track
5. Present assessment for user confirmation
6. Allow track override with appropriate warnings
7. Write assessment to `.isdlc/state.json`

---

## How to Use

### Option 1: Manual Selection (During init-project.sh)

When initializing a project:

```bash
./isdlc-framework/scripts/init-project.sh my-project

# You'll be prompted:
Select Workflow Track:
1) Quick Flow      - Bug fixes, trivial changes (30min - 2hrs)
2) Standard Flow   - Features, services (4hrs - 3 days)
3) Enterprise Flow - Platforms, compliance (weeks - months)
4) Let orchestrator assess complexity

Select track [1-4]: 2

Selected: Standard Flow
```

The script will configure `.isdlc/state.json` with the appropriate track settings.

### Option 2: Automatic Assessment (By Orchestrator)

When starting a project in Claude Code:

1. The orchestrator reads your project brief
2. Runs the `assess-complexity` skill
3. Presents recommendation:
   ```
   Based on your requirements:

   Complexity Level: 2 (Standard Feature)
   Recommended Track: Standard Flow
   Required Phases: 01, 02, 03, 04, 05, 06, 07, 09
   Optional Phases: 08, 10
   Skipped Phases: 11, 12, 13
   Estimated Timeline: 4-8 hours

   Does this match your expectations? [Yes/No/Adjust]
   ```
4. You can accept, reject, or adjust the recommendation

---

## Track Override Rules

### Upgrading Track (Always Allowed)

You can always add more rigor:

**Example**: Quick Flow → Standard Flow
- **Allowed**: Yes, no confirmation needed
- **Effect**: Adds phases 02, 03, 04, 07, 09
- **When**: Scope increased, more architectural decisions needed

**Example**: Standard Flow → Enterprise Flow
- **Allowed**: Yes, no confirmation needed
- **Effect**: Adds phases 08, 10, 11, 12, 13
- **When**: Production deployment required, compliance needs emerge

### Downgrading Track (Requires Confirmation)

You can reduce rigor, but must acknowledge risks:

**Example**: Standard Flow → Quick Flow (Requested)
- **Allowed**: Yes, with warning
- **Confirmation Required**: Yes
- **Warning Message**:
  ```
  ⚠️ WARNING: You are downgrading from Standard Flow to Quick Flow.

  This means you will skip the following phases:
  - Phase 02: Architecture & Blueprint
  - Phase 03: Design & API Contracts
  - Phase 04: Test Strategy & Design
  - Phase 07: Code Review & QA
  - Phase 09: CI/CD Setup

  Risks:
  - No architecture review
  - No formal design process
  - No test strategy
  - No code review
  - No deployment automation

  Are you sure you want to proceed? [Yes/No]
  ```

---

## Track Transitions Mid-Project

Tracks can be upgraded during project execution:

### Allowed Transitions

| From | To | Trigger | Action |
|------|------|---------|--------|
| Quick | Standard | Scope increased, more rigor needed | Add phases 02, 03, 04, 07, 09 |
| Quick | Enterprise | Major scope change, compliance requirements | Add all missing phases |
| Standard | Enterprise | Production deployment, compliance requirements | Add phases 08, 10, 11, 12, 13 |

### Forbidden Transitions

| From | To | Reason |
|------|------|--------|
| Standard | Quick | Cannot reduce rigor once architecture/design complete |
| Enterprise | Quick | Cannot skip security/ops for enterprise projects |
| Enterprise | Standard | Cannot remove compliance phases for enterprise |

**Rule**: Cannot downgrade track once architectural decisions have been made.

---

## Configuration Files

### 1. Complexity Assessment Skill
**Location**: [.claude/skills/orchestration/assess-complexity.md](../.claude/skills/orchestration/assess-complexity.md)

Defines:
- 5 complexity levels (0-4)
- 6 assessment dimensions with scoring criteria
- Assessment process and decision matrix
- Example assessments for common scenarios

### 2. Tracks Configuration
**Location**: [isdlc-framework/config/tracks.yaml](../isdlc-framework/config/tracks.yaml)

Defines:
- Three track configurations (quick/standard/enterprise)
- Required/optional/skipped phases for each track
- Phase-specific artifact modifications
- Quality thresholds by track
- Override rules and transition policies

### 3. Project State
**Location**: `.isdlc/state.json` (in each project)

Stores:
- `complexity_assessment.level` - Complexity level (0-4)
- `complexity_assessment.track` - Selected track name
- `complexity_assessment.dimensions` - Dimension scores
- `workflow.track` - Active track
- `workflow.phases_required` - Array of required phase numbers
- `workflow.phases_optional` - Array of optional phase numbers
- `workflow.phases_skipped` - Array of skipped phase numbers

---

## Benefits

### 1. Right-Sized Process
- Bug fixes don't require full SDLC (Quick Flow)
- Features get appropriate rigor (Standard Flow)
- Platforms get full compliance process (Enterprise Flow)

### 2. Faster Iteration
- Quick Flow: 30 minutes - 2 hours (vs 13-phase overhead)
- Standard Flow: 4 hours - 3 days (vs full enterprise process)
- Enterprise Flow: Full rigor when actually needed

### 3. Flexibility
- Start with Quick Flow, upgrade to Standard if scope grows
- Start with Standard, add security audit (Phase 08) if needed
- Cannot accidentally skip critical phases for enterprise projects

### 4. Clear Expectations
- User knows upfront which phases are required
- Timeline estimates aligned with track complexity
- No surprise requirements mid-project

### 5. Maintains Quality
- Quick Flow still requires unit tests (≥60% coverage)
- Standard Flow requires architecture, design, code review
- Enterprise Flow maintains full compliance rigor

---

## Examples

### Example 1: Fix Typo in README (Quick Flow)

**Input**: "Fix typo in README.md line 42"

**Assessment**:
- Complexity Level: 0 (Trivial)
- Track: Quick Flow

**Process**:
1. Phase 01 (Brief): "Fix typo on line 42: 'teh' → 'the'"
2. Phase 05: Make the edit
3. Phase 06: Verify rendering looks correct
4. Done in < 5 minutes

**Phases Skipped**: 02, 03, 04, 07, 08, 09, 10, 11, 12, 13

---

### Example 2: Add User Profile API (Standard Flow)

**Input**: "Add REST API endpoint for user profile CRUD operations with validation"

**Assessment**:
- Complexity Level: 2 (Standard Feature)
- Track: Standard Flow

**Process**:
1. Phase 01: Requirements specification
2. Phase 02: Architecture (add endpoint to existing REST service)
3. Phase 03: OpenAPI specification for profile endpoints
4. Phase 04: Test strategy (unit + integration tests)
5. Phase 05: Implement endpoints + unit tests
6. Phase 06: Integration tests
7. Phase 07: Code review
8. Phase 09: Add to CI/CD pipeline
9. Done in 6-8 hours

**Phases Skipped**: 08 (unless handling PII), 10, 11, 12, 13

---

### Example 3: Build Multi-Tenant SaaS Platform (Enterprise Flow)

**Input**: "Build multi-tenant SaaS platform with org management, RBAC, billing, analytics, SOC2 compliance"

**Assessment**:
- Complexity Level: 4 (Enterprise Platform)
- Track: Enterprise Flow

**Process**: All 13 phases
1. Phase 01: Complete requirements specification
2. Phase 02: Multi-tenant architecture design
3. Phase 03: API contracts, module designs, UI/UX wireframes
4. Phase 04: Comprehensive test strategy
5. Phase 05: Implementation (weeks)
6. Phase 06: Integration and E2E testing
7. Phase 07: Code review and QA sign-off
8. Phase 08: Security audit, penetration testing, SOC2 compliance
9. Phase 09: Production CI/CD pipeline
10. Phase 10: Local development environment for team
11. Phase 11: Staging deployment with smoke tests
12. Phase 12: Production deployment with monitoring
13. Phase 13: Operations, SLA tracking, incident response

**Timeline**: 2-3 months

**Phases Skipped**: None

---

## Integration with Constitution

Track selection respects project constitutional principles:

- **Article I (Specification Primacy)**: All tracks require specifications (varying detail)
- **Article II (Test-First Development)**: All tracks enforce test-first (varying coverage)
- **Article III (Library-First Design)**: Standard/Enterprise tracks validate this
- **Article IV (Security by Design)**: Enterprise track enforces, Standard optional
- **Article IX (Quality Gate Integrity)**: Gates enforced based on track

Constitutional compliance is validated at gates based on the active track.

---

## Comparison to Other Frameworks

### Before: iSDLC v0.1 (Pre-Tracks)
- ❌ All projects → 13 phases
- ❌ Bug fix → hours of overhead
- ❌ No flexibility

### After: iSDLC v1.0 (With Tracks)
- ✅ Right-sized process (Quick/Standard/Enterprise)
- ✅ Bug fix → 30 minutes
- ✅ Full flexibility with safety rails

### BMAD-METHOD (Inspiration)
- ✅ Has 5 complexity levels, 3 tracks (Quick/BMad/Enterprise)
- ⚠️ Less granular phase control
- ⚠️ 26 agents (overkill for most projects)

### iSDLC v1.0 (Best of Both)
- ✅ 5 complexity levels, 3 tracks (borrowed from BMAD)
- ✅ 13 phases with granular control (better than BMAD)
- ✅ 14 specialized agents (right-sized vs BMAD's 26)
- ✅ Clear phase-to-agent mapping (simpler than BMAD)

---

## Testing the Feature

### Test Case 1: Quick Flow
```bash
./isdlc-framework/scripts/init-project.sh test-quick-flow
# Select: 1) Quick Flow
# Verify state.json has phases_required: [1, 5, 6]
```

### Test Case 2: Standard Flow
```bash
./isdlc-framework/scripts/init-project.sh test-standard-flow
# Select: 2) Standard Flow
# Verify state.json has phases_required: [1, 2, 3, 4, 5, 6, 7, 9]
```

### Test Case 3: Enterprise Flow
```bash
./isdlc-framework/scripts/init-project.sh test-enterprise-flow
# Select: 3) Enterprise Flow
# Verify state.json has phases_required: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]
```

### Test Case 4: Auto-Assessment
```bash
./isdlc-framework/scripts/init-project.sh test-auto-assess
# Select: 4) Let orchestrator assess complexity
# In Claude Code, orchestrator runs assess-complexity skill
```

---

## Future Enhancements

### Potential Additions (Not Implemented Yet)

1. **Track Auto-Detection**: Analyze git diff to auto-suggest track
2. **Track Analytics**: Track time spent per track, optimize recommendations
3. **Custom Tracks**: Allow projects to define custom track configurations
4. **Track Templates**: Pre-configured tracks for common domains (web apps, ML, mobile)
5. **Phase Parallelization**: Run some phases in parallel for Standard/Enterprise tracks

---

## File Inventory

Files created/modified for this feature:

### Created:
1. `.claude/skills/orchestration/assess-complexity.md` (200+ lines)
2. `isdlc-framework/config/tracks.yaml` (500+ lines)
3. `docs/SCALE-ADAPTIVE-TRACKS.md` (this file)

### Modified:
1. `.claude/agents/00-sdlc-orchestrator.md` - Added track enforcement section
2. `isdlc-framework/scripts/init-project.sh` - Added track selection prompt
3. `.isdlc/state.json` template - Added complexity_assessment and workflow sections

**Total Addition**: ~1,100 lines
**Effort**: ~6-8 hours
**Impact**: Framework now works for all project sizes

---

## Summary

Scale-adaptive workflow tracks solve the critical gap where the iSDLC framework was heavyweight for simple changes. Now:

✅ **Bug fixes**: 30 minutes (Quick Flow) instead of hours (full SDLC)
✅ **Features**: 4-8 hours (Standard Flow) with right rigor
✅ **Platforms**: Full SDLC (Enterprise Flow) when needed

The framework maintains its core strengths (13 phases, 14 agents, quality gates) while becoming usable for projects of all sizes.

---

**Implementation Date**: 2026-01-17
**Feature Status**: ✅ Complete
**Next Steps**: Test with real projects, gather feedback, optimize recommendations
