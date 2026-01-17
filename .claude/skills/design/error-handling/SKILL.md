---
name: error-handling-design
description: Design error taxonomy and handling patterns
skill_id: DES-006
owner: design
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Error strategy design, user feedback patterns
dependencies: []
---

# Error Handling Design

## Purpose
Design a comprehensive error handling strategy including error taxonomy, user-facing messages, and recovery patterns.

## When to Use
- System design phase
- Error experience improvement
- Consistency standardization

## Process

### Step 1: Create Error Taxonomy
### Step 2: Design Error Response Format
### Step 3: Define User-Facing Messages
### Step 4: Plan Recovery Strategies
### Step 5: Document Error Handling

## Project-Specific Considerations
- Validation errors with field details
- Deadline passed errors
- External API errors (graceful degradation)
- Document upload errors

## Examples
```
Error Taxonomy:

VAL_* - Validation errors (400)
  VAL_INVALID_INPUT - General validation failure
  VAL_MISSING_FIELD - Required field missing
  VAL_INVALID_FORMAT - Wrong format

AUTH_* - Authentication errors (401)
  AUTH_UNAUTHORIZED - Not authenticated
  AUTH_TOKEN_EXPIRED - Token expired

BIZ_* - Business logic errors (400)
  BIZ_DEADLINE_PASSED - Application deadline passed
  BIZ_ALREADY_SUBMITTED - Already submitted
  BIZ_INCOMPLETE - Application incomplete

NF_* - Not found errors (404)
  NF_RESOURCE - Resource not found

EXT_* - External service errors (502/503)
  EXT_SERVICE_ERROR - External service unavailable
```