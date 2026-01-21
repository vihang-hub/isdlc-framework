---
name: security-configuration
description: Review and harden security configurations
skill_id: SEC-009
owner: security-compliance-auditor
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Infrastructure setup, security hardening
dependencies: []
---

# Security Configuration

## Purpose
Review and configure security settings for application, infrastructure, and services.

## When to Use
- Initial setup
- Security audits
- Configuration changes
- Compliance checks

## Process

1. Review HTTP headers
2. Configure TLS
3. Set up CORS
4. Configure CSP
5. Review cookie settings

## Project-Specific Considerations
- Strict CORS policy
- HSTS enabled
- Secure cookie flags
- CSP for XSS prevention