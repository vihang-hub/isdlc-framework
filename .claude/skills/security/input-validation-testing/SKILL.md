---
name: input-validation-testing
description: Test input validation for injection vulnerabilities
skill_id: SEC-008
owner: security
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: API testing, form testing, security audits
dependencies: []
---

# Input Validation Testing

## Purpose
Test all input points for proper validation and resistance to injection attacks.

## When to Use
- API endpoint testing
- Form submission testing
- File upload testing
- Search functionality testing

## Process

1. Identify all input points
2. Test SQL injection
3. Test XSS
4. Test command injection
5. Test file upload attacks

## Project-Specific Considerations
- University search input
- Application form fields
- Document upload filenames
- URL parameters