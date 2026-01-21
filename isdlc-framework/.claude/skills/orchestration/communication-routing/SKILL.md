---
name: communication-routing
description: Route information and requests between agents efficiently
skill_id: ORCH-007
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Agent needs information from another, cross-functional coordination
dependencies: [ORCH-001]
---

# Communication Routing

## Purpose
Ensure efficient information flow between agents by routing requests, sharing artifacts, broadcasting updates, and maintaining communication records for audit and context.

## When to Use
- Agent requests information from another agent
- Artifact handoffs between phases
- Broadcast announcements needed
- Cross-functional coordination required
- Context sharing for related tasks

## Prerequisites
- Agent registry loaded
- Communication protocols defined
- Message queue available
- Audit logging enabled

## Process

### Step 1: Receive Communication Request
```
Parse incoming message:
- Source agent
- Target agent(s) or broadcast
- Message type (request/response/notification)
- Subject and payload
- Priority level
- Response required (Y/N)
```

### Step 2: Validate Routing
```
Validation checks:
1. Source agent authorized to send
2. Target agent exists and active
3. Message type appropriate
4. Required fields present
5. Payload format valid
```

### Step 3: Determine Route
```
Routing rules:
- Direct: Single target agent
- Multicast: Specific agent group
- Broadcast: All agents
- Escalation: Human involvement

Route selection based on:
- Message type
- Target specification
- Urgency level
```

### Step 4: Deliver Message
```
Delivery process:
1. Add routing metadata
2. Log message in audit trail
3. Deliver to target(s)
4. Confirm receipt
5. Track response if required
```

### Step 5: Handle Response
```
If response required:
1. Set response timeout
2. Monitor for response
3. Route response to original sender
4. Escalate if timeout exceeded
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| message | JSON | Yes | Communication content |
| source_agent | String | Yes | Sending agent ID |
| target | String/Array | Yes | Recipient(s) |
| priority | String | Optional | urgent/normal/low |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| delivery_confirmation | JSON | Delivery status |
| audit_record | JSON | Communication log |
| response | JSON | If response received |

## Project-Specific Considerations
- Security agent notifications are always high priority
- External API changes broadcast to architecture + developer
- GDPR-related communications logged for compliance
- Test manager receives all requirement changes

## Integration Points
- **All Agents**: Send and receive communications
- **Audit System**: Log all communications
- **Human**: Escalation endpoint

## Examples
```
# Developer needs API spec from Design Agent
Message:
{
  "from": "developer-agent",
  "to": "design-agent",
  "type": "request",
  "subject": "OpenAPI spec for profile endpoints",
  "payload": {
    "endpoints": ["/api/user/profile", "/api/user/settings"],
    "format": "yaml"
  },
  "priority": "normal",
  "response_required": true
}

Routing:
→ Validated: developer-agent authorized
→ Route: Direct to design-agent
→ Delivered: 2024-01-15T10:30:00Z
→ Response received: 2024-01-15T10:32:15Z
→ Routed response to developer-agent

# Broadcast: Requirement change
Message:
{
  "from": "requirements-agent",
  "to": "broadcast",
  "type": "notification",
  "subject": "REQ-015 modified",
  "payload": {
    "requirement_id": "REQ-015",
    "change_type": "acceptance_criteria_updated",
    "summary": "Added email verification step"
  }
}

Routing:
→ Broadcast to: all agents
→ Special routing: test-manager (impact analysis trigger)
```

## Validation
- All messages logged in audit trail
- Delivery confirmation received
- No messages lost or undelivered
- Response timeouts handled
- Routing rules correctly applied