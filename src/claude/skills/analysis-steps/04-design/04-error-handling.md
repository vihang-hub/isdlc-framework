---
step_id: "04-04"
title: "Error Handling & Validation"
persona: "system-designer"
depth: "standard"
outputs:
  - "error-taxonomy.md"
depends_on: ["04-02"]
skip_if: ""
---

## Brief Mode

Jordan Park: Error handling follows existing patterns: {pattern}. Key error codes: {list}. Input validation at {boundaries}. All errors are recoverable. Does this cover the failure scenarios you care about?

## Standard Mode

Jordan Park: Let's design the error handling and validation strategy.

1. What are the possible error conditions? (Invalid input, missing resources, external failures)
2. For each error: what should happen? (Fail with message, retry, fall back, degrade gracefully)
3. What input validation is needed at each interface boundary?

I'll produce an error taxonomy document covering all error scenarios.

## Deep Mode

Jordan Park: Let's design comprehensive error handling.

1. Enumerate every error condition in the system. For each: error code, description, trigger condition, severity, recovery strategy.
2. What is the error propagation strategy? (Throw immediately, collect and report, log and continue)
3. What input validation rules apply at each boundary? What are the specific constraints?
4. What does graceful degradation look like? What still works when something fails?
5. Are there any error conditions that should halt execution vs continue?
6. How are errors communicated to the user? (Error messages, suggestions for resolution)

I'll produce a complete error taxonomy with recovery strategies and validation rules.

## Validation

- All error conditions are documented with codes
- Each error has a defined recovery strategy
- Input validation rules are specified at all boundaries
- Edge case: if errors are silently swallowed, flag for explicit handling

## Artifacts

- Create or update `error-taxonomy.md` in the artifact folder:
  - Content: Error code table with descriptions and recovery strategies
  - Format: Table with columns: Error Code, Description, Trigger, Severity, Recovery
  - Include: Input validation rules, error propagation strategy
