---
name: mvp-scoping
description: Define MVP boundaries and prioritize features
skill_id: DISC-704
owner: product-analyst
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When determining which features belong in the MVP versus later releases
dependencies: [DISC-703]
---

# MVP Scoping

## Purpose
Analyze the full set of functional requirements from the PRD and draw a clear MVP boundary line. Categorizes features by priority to define what ships first and what gets deferred, with rationale for each decision.

## When to Use
- After PRD generation to decide what to build first
- When the full requirements set exceeds what can be delivered in the initial release
- When the team needs alignment on scope and priorities before development begins

## Prerequisites
- Functional requirements from prd-generation (DISC-703)
- Understanding of timeline and resource constraints from vision data

## Process

### Step 1: Categorize Features Using MoSCoW
Evaluate each functional requirement against the project's success criteria, user needs, and constraints. Assign each feature to one of four categories: Must Have (essential for launch, system is unusable without it), Should Have (important but workaround exists), Could Have (desirable if time permits), or Won't Have (explicitly deferred to future releases).

### Step 2: Draw the MVP Boundary
Define the MVP as all Must Have features plus any Should Have features that are low-effort and high-impact. Ensure the MVP forms a coherent, usable product that delivers the core value proposition. Verify that the MVP scope is achievable within stated timeline constraints.

### Step 3: Document Deferred Features with Rationale
For each feature outside the MVP boundary, document why it was deferred — whether due to complexity, dependency on MVP features, lower user impact, or timeline constraints. Group deferred features into logical future release phases where possible.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| functional_requirements | array | Yes | Full requirements list from DISC-703 |
| constraints | object | Yes | Timeline, resource, and budget constraints from vision |
| success_criteria | array | Yes | Measurable success criteria from vision elicitation |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| mvp_scope | object | In-scope features with priority category assignments |
| deferred_features | array | Out-of-scope features with deferral rationale |
| scope_summary | string | Concise summary of what the MVP delivers |

## Integration Points
- **prd-generation**: Provides the full functional requirements to be scoped
- **architecture-pattern-selection**: MVP scope influences architecture complexity choices
- **directory-scaffolding**: MVP scope determines which components need scaffolding

## Validation
- Every functional requirement is assigned to exactly one MoSCoW category
- Must Have features form a coherent, independently usable product
- Deferred features each have a documented rationale for exclusion
- MVP scope aligns with stated timeline and resource constraints
