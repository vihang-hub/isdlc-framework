---
name: security-architecture-review
description: Review system architecture for security concerns
skill_id: SEC-001
owner: security
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Architecture review, security assessment
dependencies: []
---

# Security Architecture Review

## Purpose
Review system architecture to identify security weaknesses, validate security controls, and ensure security requirements are properly addressed.

## When to Use
- After architecture design
- Before implementation
- Major architectural changes
- Security audit preparation

## Prerequisites
- Architecture documentation
- Security requirements
- Threat model (if available)

## Process

### Step 1: Review Architecture Components
```
Components to review:
- Authentication mechanisms
- Authorization model
- Data protection
- Network security
- Integration points
- Infrastructure
```

### Step 2: Identify Security Concerns
```
Concern categories:
- Authentication weaknesses
- Authorization gaps
- Data exposure risks
- Injection points
- Configuration issues
- Third-party risks
```

### Step 3: Validate Security Controls
```
Control validation:
- Are controls appropriate?
- Are controls sufficient?
- Are controls properly placed?
- Defense in depth?
```

### Step 4: Document Findings
```
Finding format:
- Issue description
- Risk level
- Affected component
- Recommendation
```

### Step 5: Provide Recommendations
```
Recommendations:
- Required changes
- Suggested improvements
- Best practices
- Implementation guidance
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| architecture_docs | Markdown | Yes | System design |
| security_reqs | Markdown | Yes | Security requirements |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| security_review.md | Markdown | Review findings |
| recommendations.md | Markdown | Security recommendations |

## Project-Specific Considerations
- OAuth2 implementation review
- PII data flow analysis
- External API security
- Document storage security

## Integration Points
- **Architecture Agent**: Design feedback
- **Developer Agent**: Implementation guidance

## Examples
```markdown
# Security Architecture Review - SDLC Framework

## Review Scope
- Authentication and authorization
- Data protection
- API security
- Infrastructure security

## Findings

### HIGH: JWT Token Storage
**Issue**: JWT stored in localStorage is vulnerable to XSS attacks
**Component**: Frontend authentication
**Risk**: High - Token theft enables account takeover
**Recommendation**: 
- Store tokens in httpOnly cookies
- Implement CSRF protection
- Use short-lived access tokens (15 min)

### MEDIUM: API Rate Limiting
**Issue**: No rate limiting on authentication endpoints
**Component**: API Gateway
**Risk**: Medium - Brute force attacks possible
**Recommendation**:
- Implement rate limiting (10 req/min for auth)
- Add exponential backoff on failures
- Log and alert on suspicious activity

### MEDIUM: PII Encryption
**Issue**: PII fields not encrypted at application level
**Component**: Database
**Risk**: Medium - Database breach exposes plaintext PII
**Recommendation**:
- Implement field-level encryption for PII
- Use AWS KMS for key management
- Consider searchable encryption for email

### LOW: CORS Configuration
**Issue**: CORS allows all origins in development
**Component**: API server
**Risk**: Low - Only in development, but could leak to production
**Recommendation**:
- Environment-specific CORS config
- Whitelist specific origins in production
- Add pre-commit hook to prevent * origin

## Summary

| Severity | Count | Action Required |
|----------|-------|-----------------|
| Critical | 0 | - |
| High | 1 | Before launch |
| Medium | 2 | Before launch |
| Low | 1 | Soon |

## Approval Status
Architecture security: **CONDITIONAL APPROVAL**
Conditions: Address High and Medium findings before launch
```

## Validation
- All components reviewed
- Findings documented
- Recommendations actionable
- Risk levels assigned
- Follow-up tracked