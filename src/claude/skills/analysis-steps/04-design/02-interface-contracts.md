---
step_id: "04-02"
title: "Interface Contracts"
persona: "system-designer"
depth: "deep"
outputs:
  - "interface-spec.md"
depends_on: ["04-01"]
skip_if: ""
---

## Brief Mode

Jordan Park: The key interfaces are: {list of function/API signatures}. Data formats follow existing patterns. Ready to proceed to data flow?

## Standard Mode

Jordan Park: Let's define the interface contracts between components.

1. What are the public interfaces for each module? (Function signatures, API endpoints, data formats)
2. What are the request/response schemas for each interface?
3. Are there any existing interface patterns this should follow?

I'll document each interface contract with concrete types and examples.

## Deep Mode

Jordan Park: Let's define every interface contract precisely.

1. For each public function/API: name, parameters (with types), return type, error types, side effects.
2. For each data structure: field names, types, constraints, defaults, invariants.
3. What are the request/response schemas? Include examples of valid and invalid inputs.
4. What validation is performed at each interface boundary?
5. How are errors communicated across interfaces? (Return codes, exceptions, error objects)
6. Are there versioning considerations for any interface?

I'll produce complete interface specifications with concrete examples and error scenarios.

## Validation

- Each public interface has a concrete signature with types
- Data structures have field-level specifications
- Error handling is specified for each interface
- Edge case: if interfaces are too broad (accept "any"), push for specific types

## Artifacts

- Create or update `interface-spec.md` in the artifact folder:
  - Content: Interface specifications for all public interfaces
  - Include: Function signatures, parameter types, return types, error types
  - Format: Code blocks with JSDoc/TypeScript-style signatures and examples
