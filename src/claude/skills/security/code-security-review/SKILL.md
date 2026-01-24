---
name: code-security-review
description: Manual security review of code for vulnerabilities
skill_id: SEC-005
owner: security-compliance-auditor
collaborators: [developer]
project: sdlc-framework
version: 1.0.0
when_to_use: Security-critical code, authentication code
dependencies: []
---

# Code Security Review

## Purpose
Manually review code for security vulnerabilities that automated tools may miss.

## When to Use
- Authentication/authorization code
- Cryptographic implementations
- Input handling code
- Security-critical features

## Process

1. Identify critical code paths
2. Review for common vulnerabilities
3. Check security patterns
4. Document findings
5. Verify fixes

## Project-Specific Considerations
- OAuth implementation review
- JWT handling review
- File upload security
- PII handling review