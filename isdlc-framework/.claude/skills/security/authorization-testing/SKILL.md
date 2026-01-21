---
name: authorization-testing
description: Test authorization controls and access policies
skill_id: SEC-007
owner: security-compliance-auditor
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Access control testing, permission verification
dependencies: [SEC-006]
---

# Authorization Testing

## Purpose
Verify that authorization controls properly restrict access to resources and actions.

## When to Use
- After authz implementation
- New resource/action added
- Role changes
- Security audits

## Process

1. Map authorization rules
2. Test allowed access
3. Test denied access
4. Test privilege escalation
5. Test cross-user access

## Project-Specific Considerations
- User can only access own applications
- Horizontal privilege testing
- Admin role verification
- Resource ownership validation