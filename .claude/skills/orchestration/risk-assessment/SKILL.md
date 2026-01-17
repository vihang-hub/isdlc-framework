---
name: risk-assessment
description: Identify project risks and define mitigation strategies
skill_id: ORCH-008
owner: orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Project planning, phase reviews, when issues emerge, external changes
dependencies: [ORCH-001, ORCH-003]
---

# Risk Assessment

## Purpose
Proactively identify risks that could impact project success, assess their likelihood and impact, define mitigation strategies, and monitor risk indicators throughout the project lifecycle.

## When to Use
- Project kickoff
- Phase transitions
- When blockers emerge
- External factor changes
- Sprint retrospectives
- Stakeholder concerns raised

## Prerequisites
- Project scope understood
- Technical architecture defined
- Dependencies identified
- Team capacity known

## Process

### Step 1: Identify Risks
```
Risk categories:
- Technical: Technology choices, complexity, unknowns
- Resource: Capacity, skills, availability
- Schedule: Timeline pressures, dependencies
- External: APIs, third parties, regulations
- Security: Vulnerabilities, compliance
- Quality: Technical debt, testing gaps
```

### Step 2: Assess Each Risk
```
For each risk, determine:
- Likelihood: High (>70%) / Medium (30-70%) / Low (<30%)
- Impact: Critical / High / Medium / Low
- Risk Score: Likelihood × Impact
- Detection: How will we know if it happens?
```

### Step 3: Prioritize Risks
```
Risk priority matrix:
- Critical: Immediate action required
- High: Active mitigation needed
- Medium: Monitor closely
- Low: Accept or defer
```

### Step 4: Define Mitigations
```
For each significant risk:
- Mitigation strategy (avoid/reduce/transfer/accept)
- Specific actions
- Owner (which agent)
- Timeline
- Success criteria
- Contingency plan if risk materializes
```

### Step 5: Create Risk Register
```
Maintain living risk register:
- Risk ID and description
- Category and severity
- Mitigation status
- Current indicators
- Last review date
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| project_scope | Markdown | Yes | Project definition |
| architecture | Markdown | Yes | Technical decisions |
| task_breakdown | JSON | Yes | Work breakdown |
| progress_report | JSON | Yes | Current status |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| risk_register.json | JSON | Complete risk list |
| risk_report.md | Markdown | Summary for review |
| mitigation_tasks | JSON | Risk mitigation tasks |

## Project-Specific Considerations
- External API reliability risk (university, visa services)
- GDPR compliance risk (legal/financial impact)
- OAuth2 implementation security risk
- Peak load during application deadlines
- Multi-region deployment complexity

## Integration Points
- **Security Agent**: Security risk identification
- **Architecture Agent**: Technical risk assessment
- **DevOps Agent**: Infrastructure risks
- **All Agents**: Risk indicator monitoring

## Examples
```
Risk Register - SDLC Framework

RISK-001: University API Reliability
Category: External
Likelihood: Medium (40%)
Impact: High
Score: 6/10
Description: University API may have downtime during peak enrollment
Mitigation: 
  - Implement caching layer
  - Add circuit breaker pattern
  - Create fallback UI for degraded mode
Owner: architecture-agent
Status: Mitigation in progress

RISK-002: GDPR Non-Compliance
Category: Regulatory
Likelihood: Low (20%)
Impact: Critical
Score: 8/10
Description: Potential GDPR violations in user data handling
Mitigation:
  - Security agent audit all data flows
  - Implement consent management
  - Data retention automation
  - Right-to-deletion feature
Owner: security-agent
Status: Mitigation planned

RISK-003: OAuth2 Security Vulnerability
Category: Security
Likelihood: Medium (35%)
Impact: Critical
Score: 7/10
Description: OAuth2 implementation may have security flaws
Mitigation:
  - Security-focused code review
  - Penetration testing
  - Use established library (not custom)
Owner: security-agent, developer-agent
Status: Monitoring
```

## Validation
- All major risk categories covered
- Risk scores accurately calculated
- Mitigations defined for high/critical risks
- Risk register updated regularly
- Triggers identified for risk monitoring


# ============================================================================
# REQUIREMENTS AGENT SKILLS (10 Skills: REQ-001 to REQ-010)
# ============================================================================