---
name: error-message-parsing
description: Parse and classify error messages from bug reports
skill_id: TRACE-101
owner: symptom-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: At start of T1 symptom analysis
dependencies: []
---

# Error Message Parsing

## Purpose

Parse error messages from bug reports to extract structured information about the failure type, location, and context.

## When to Use

- At the start of T1 symptom analysis
- When error messages are available

## Process

1. Extract error type/code
2. Parse error message text
3. Identify error source/file
4. Extract relevant line numbers
5. Classify error category

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| error_logs | String | Yes | Raw error output |
| bug_description | String | No | Additional context |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| error_type | String | TypeError, NetworkError, etc. |
| error_message | String | Clean error message |
| source_location | JSON | File and line info |
| error_category | String | runtime/compile/network/data |

## Error Categories

- **Runtime**: Exceptions during execution
- **Compile/Build**: Build-time failures
- **Network**: API/connectivity issues
- **Data**: Invalid data or state
- **Logic**: Incorrect behavior (no error thrown)

## Validation

- Error type extracted
- Source location identified if available
- Category assigned
