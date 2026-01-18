---
name: authentication-testing
description: Test authentication mechanisms for security weaknesses
skill_id: SEC-006
owner: security-compliance-auditor
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Auth system testing, security validation
dependencies: []
---

# Authentication Testing

## Purpose
Test authentication mechanisms to ensure they properly protect against unauthorized access.

## When to Use
- After auth implementation
- Security audits
- Before releases
- After auth changes

## Process

1. Test valid authentication
2. Test invalid credentials
3. Test session management
4. Test token security
5. Test edge cases

## Project-Specific Considerations
- OAuth2 flow testing
- JWT token validation
- Session timeout testing
- Concurrent session handling