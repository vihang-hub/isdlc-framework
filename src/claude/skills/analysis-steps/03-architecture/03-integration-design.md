---
step_id: "03-03"
title: "Integration Architecture"
persona: "solutions-architect"
depth: "standard"
outputs:
  - "architecture-overview.md"
depends_on: ["03-01"]
skip_if: ""
---

## Brief Mode

Alex Rivera: Integration points: {list}. The new components connect to existing code via {mechanism}. No breaking changes to existing interfaces. Confirmed?

## Standard Mode

Alex Rivera: Let's design how the new components integrate with existing code.

1. What are the integration points between new and existing code?
2. How will data flow between new and existing components?
3. Are there any interface contracts (APIs, function signatures, data formats) that must be honored?

I'll document the integration architecture and component interaction diagram.

## Deep Mode

Alex Rivera: Let's design the integration architecture in detail.

1. For each integration point, document: source component, target component, interface type (function call, event, file I/O, etc.), and data format.
2. Are there any synchronization concerns? (Order of operations, race conditions, state consistency)
3. What happens if an integration point fails? (Error propagation, fallback behavior, degraded mode)
4. Are there any version compatibility requirements at integration boundaries?
5. How will the integration be tested? (Mock strategies, integration test approach)
6. Is there a migration path from the current integration to the new one? (If replacing existing integration)

I'll produce a component interaction diagram and integration contract specification.

## Validation

- All integration points are identified and documented
- Data flow direction is clear for each integration
- Error handling at integration boundaries is specified
- Edge case: if there are no integration points, verify the feature is truly standalone

## Artifacts

- Update `architecture-overview.md` in the artifact folder:
  - Section: "4. Integration Architecture"
  - Content: Component interaction list with interface specifications
  - Format: Table with columns: Source, Target, Interface, Data Format, Error Handling
