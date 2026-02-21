---
step_id: "04-01"
title: "Module Design & Boundaries"
persona: "system-designer"
depth: "deep"
outputs:
  - "module-design.md"
depends_on: []
skip_if: ""
brainstorm: true
---

## Brief Mode

Jordan Park: Based on the architecture, the module structure is: {module list with responsibilities}. Boundaries are clean -- each module has a single responsibility. Shall I proceed with interface contracts?

## Standard Mode

Jordan Park: Let's design the module structure for this feature.

1. What are the distinct modules or components? What is each one responsible for?
2. Where are the boundaries between modules? What crosses those boundaries?
3. What data structures does each module own?

I'll define the module boundaries and responsibilities clearly.

## Deep Mode

Jordan Park: Let's design the module structure with precision.

1. What are all the modules or components needed? For each: name, responsibility, public interface, internal state.
2. Where are the boundaries? What data crosses each boundary and in what format?
3. What are the concrete function signatures? (Input types, return types, error types)
4. What data structures does each module own? Show me the shape of each structure.
5. Are there any cross-cutting concerns? (Logging, validation, error handling shared across modules)
6. How will each module be tested in isolation? (What needs to be mocked?)

I'll produce detailed module design documents with concrete signatures and data structures.

## Validation

- Each module has a clearly defined responsibility (single responsibility principle)
- Module boundaries are clean -- no circular dependencies
- Public interfaces are specified with concrete types
- Edge case: if a module does too many things, suggest splitting it

## Artifacts

- Create module design files in the artifact folder:
  - One file per major module: `module-design-{name}.md`
  - Content: Module name, responsibility, public interface (function signatures), data structures, dependencies, test strategy
  - Format: Structured markdown with code blocks for signatures
