---
step_id: "04-03"
title: "Data Flow & State Management"
persona: "system-designer"
depth: "standard"
outputs:
  - "data-flow.md"
depends_on: ["04-01"]
skip_if: ""
---

## Brief Mode

Jordan Park: Data flows from {source} through {processing} to {output}. State is managed in {location}. No shared mutable state concerns. Sound right?

## Standard Mode

Jordan Park: Let's document how data moves through the system.

1. What is the primary data flow? (Input -> processing -> output)
2. Where is state stored and how is it managed? (Files, memory, configuration)
3. Are there any caching, buffering, or queueing considerations?

I'll produce a data flow diagram showing how information moves between components.

## Deep Mode

Jordan Park: Let's trace every data path through the system.

1. What are all the data sources? (User input, files, configuration, external APIs)
2. For each data source, trace its path through the system to its final destination.
3. Where is state mutated? Who reads it? Are there any race conditions?
4. What data transformations happen at each stage?
5. Is there any data that needs to be persisted across sessions?
6. Are there any data validation or sanitization steps in the flow?

I'll produce a complete data flow specification with state management documentation.

## Validation

- All data sources and sinks are identified
- Data flow direction is clear at each stage
- State management approach is documented
- Edge case: if state is shared between components, verify there are no conflicts

## Artifacts

- Create or update `data-flow.md` in the artifact folder:
  - Content: Data flow documentation
  - Include: Data sources, transformations, state management, persistence approach
  - Format: Structured narrative with flow diagrams (text-based)
