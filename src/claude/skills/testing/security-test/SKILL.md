---
name: security-test-design
description: Design security test scenarios and validation
skill_id: TEST-013
owner: integration-tester
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Security validation, compliance testing, vulnerability assessment
dependencies: [TEST-001]
---

# Security Test Design

## Purpose
Design security tests that validate security controls, identify vulnerabilities, and ensure compliance with security requirements.

## When to Use
- Security validation
- Compliance audits
- Pre-release security review
- After security architecture changes

## Prerequisites
- Security requirements defined
- Threat model available
- Security architecture documented

## Process

### Step 1: Identify Security Requirements
```
Requirement sources:
- Security NFRs
- Compliance requirements (GDPR)
- OWASP guidelines
- Threat model mitigations
```

### Step 2: Define Test Categories
```
Categories:
- Authentication testing
- Authorization testing
- Input validation
- Cryptography verification
- Session management
- API security
```

### Step 3: Design Test Cases
```
For each category:
- Positive tests (controls work)
- Negative tests (attacks blocked)
- Boundary tests
- Compliance checks
```

### Step 4: Select Tools
```
Tool categories:
- Static analysis (SAST)
- Dynamic analysis (DAST)
- Dependency scanning
- Manual testing
```

### Step 5: Create Test Plan
```
Plan includes:
- Test scenarios
- Tools and methods
- Execution frequency
- Remediation process
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| security_requirements | Markdown | Yes | Security NFRs |
| threat_model | Markdown | Yes | Threat analysis |
| compliance_reqs | Markdown | Yes | GDPR, etc. |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| security_test_plan.md | Markdown | Test plan |
| security_tests/ | Code | Test scripts |
| compliance_checklist.md | Markdown | Compliance checks |

## Project-Specific Considerations
- OAuth2 security testing
- GDPR compliance validation
- PII protection verification
- Document access control

## Integration Points
- **Security Agent**: Test collaboration
- **Developer Agent**: Remediation
- **DevOps Agent**: CI/CD security

## Examples
```
Security Test Plan - SDLC Framework

SECURITY REQUIREMENTS:

| ID | Requirement | Test Category |
|----|-------------|---------------|
| SEC-001 | OAuth2 secure implementation | Auth |
| SEC-002 | JWT token security | Session |
| SEC-003 | OWASP Top 10 protection | Multiple |
| SEC-004 | PII encryption | Crypto |
| SEC-005 | GDPR compliance | Compliance |

TEST CATEGORIES:

1. AUTHENTICATION TESTING

TC-SEC-AUTH-001: OAuth2 Token Validation
- Verify valid tokens accepted
- Verify expired tokens rejected
- Verify tampered tokens rejected
- Verify token refresh works

TC-SEC-AUTH-002: Session Security
- Verify httpOnly cookie flag
- Verify secure cookie flag
- Verify session timeout
- Verify concurrent session limits

TC-SEC-AUTH-003: OAuth Flow Security
- Verify state parameter validation
- Verify PKCE implementation
- Verify redirect URI validation

2. AUTHORIZATION TESTING

TC-SEC-AUTHZ-001: Horizontal Access Control
- User A cannot access User B's applications
- User A cannot access User B's documents
- Verify 403 for unauthorized access

TC-SEC-AUTHZ-002: Vertical Access Control
- Student cannot access admin endpoints
- Advisor limited to assigned students
- Verify role escalation blocked

TC-SEC-AUTHZ-003: API Authorization
- All endpoints require authentication (except public)
- Verify middleware protection
- Test direct URL access

3. INPUT VALIDATION

TC-SEC-INPUT-001: SQL Injection
- Test all input fields
- Test URL parameters
- Test JSON body fields
- Verify parameterized queries

TC-SEC-INPUT-002: XSS Prevention
- Test text inputs
- Test file names
- Test error messages
- Verify output encoding

TC-SEC-INPUT-003: File Upload Security
- Test file type bypass attempts
- Test malicious file names
- Test oversized files
- Verify virus scanning

4. CRYPTOGRAPHY

TC-SEC-CRYPTO-001: TLS Configuration
- Verify TLS 1.3 minimum
- Verify strong cipher suites
- Verify certificate validity
- Test with SSL Labs

TC-SEC-CRYPTO-002: Data Encryption
- Verify PII encrypted at rest
- Verify password hashing (bcrypt)
- Verify no secrets in code/logs

5. GDPR COMPLIANCE

TC-SEC-GDPR-001: Consent
- Verify consent collection
- Verify consent recorded
- Verify opt-out works

TC-SEC-GDPR-002: Data Rights
- Verify data export works
- Verify data deletion works
- Verify within time limits

AUTOMATED SECURITY TESTS:

```typescript
// tests/security/auth.security.test.ts
describe('Authentication Security', () => {
  describe('Token Validation', () => {
    it('should reject expired tokens', async () => {
      const expiredToken = generateExpiredToken()
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${expiredToken}`)
      
      expect(response.status).toBe(401)
      expect(response.body.error.code).toBe('AUTH_TOKEN_EXPIRED')
    })
    
    it('should reject tampered tokens', async () => {
      const tamperedToken = validToken.slice(0, -5) + 'xxxxx'
      const response = await request(app)
        .get('/api/v1/users/me')
        .set('Authorization', `Bearer ${tamperedToken}`)
      
      expect(response.status).toBe(401)
    })
  })
  
  describe('SQL Injection', () => {
    const sqlPayloads = [
      "'; DROP TABLE users; --",
      "1' OR '1'='1",
      "1; SELECT * FROM users"
    ]
    
    sqlPayloads.forEach(payload => {
      it(`should safely handle: ${payload}`, async () => {
        const response = await request(app)
          .get(`/api/v1/universities`)
          .query({ search: payload })
        
        // Should not error, should return safe results
        expect(response.status).toBe(200)
        // Verify no data leak
        expect(response.body.data).not.toContainEqual(
          expect.objectContaining({ password: expect.anything() })
        )
      })
    })
  })
})
```

CI/CD INTEGRATION:

```yaml
security:
  - name: Dependency Audit
    run: npm audit --production
    frequency: every-build
    
  - name: SAST Scan
    run: npm run security:sast
    frequency: every-build
    
  - name: DAST Scan
    run: npm run security:dast
    frequency: nightly
    
  - name: Secret Scan
    uses: trufflesecurity/trufflehog@main
    frequency: every-build
```

TOOLS:

| Tool | Purpose | Frequency |
|------|---------|-----------|
| npm audit | Dependency vulnerabilities | Every build |
| ESLint security | Code patterns | Every build |
| OWASP ZAP | Dynamic scanning | Nightly |
| Snyk | Dependency + code | Weekly |
| truffleHog | Secret detection | Every commit |

COMPLIANCE CHECKLIST:

GDPR:
☐ Consent mechanism implemented
☐ Data export within 30 days
☐ Data deletion within 72 hours
☐ Breach notification process
☐ Privacy policy accessible
☐ Cookie consent implemented

OWASP Top 10:
☐ A01: Broken Access Control - Tested
☐ A02: Cryptographic Failures - Tested
☐ A03: Injection - Tested
☐ A04: Insecure Design - Reviewed
☐ A05: Security Misconfiguration - Tested
☐ A06: Vulnerable Components - Scanned
☐ A07: Auth Failures - Tested
☐ A08: Integrity Failures - Tested
☐ A09: Logging Failures - Verified
☐ A10: SSRF - Tested
```

## Validation
- All security requirements tested
- OWASP coverage complete
- Tools integrated in CI/CD
- Compliance checklist verified
- Regular execution scheduled

###DIFFBREAK###
# Complete SDLC Skills Content Library - Part 3
# Project: SDLC Framework
# Developer Agent (14) + Security Agent (13)

# ============================================================================
# DEVELOPER AGENT SKILLS (14 Skills: DEV-001 to DEV-014)
# ============================================================================