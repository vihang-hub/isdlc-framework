---
name: ui-component-discovery
description: Discover existing and new UI components/pages for feature implementation
skill_id: IA-202
owner: entry-point-finder
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During M2 Entry Point analysis to find UI entry points
dependencies: []
---

# UI Component Discovery

## Purpose
Discover existing UI components and pages that relate to the feature and identify new UI elements that need to be created based on acceptance criteria from finalized requirements.

## When to Use
- Finding existing UI for feature
- Planning new UI components
- Understanding frontend entry points
- Mapping acceptance criteria to UI

## Prerequisites
- Finalized requirements with acceptance criteria
- Discovery report with page inventory
- Component/page file locations known

## Process

### Step 1: Search Existing Components
```
For each acceptance criterion:
1. Search component/page files
2. Check route definitions
3. Find related form/display components
4. Note state management patterns
```

### Step 2: Classify Relevance
```
For each found component:
- HIGH: Directly supports acceptance criterion
- MEDIUM: Can be extended for AC
- LOW: Tangentially related

Map each component to specific AC(s).
```

### Step 3: Identify New Components
```
For ACs without existing UI:
1. Suggest component location
2. Determine page vs component
3. Identify parent components
4. Note routing requirements
```

### Step 4: Document Findings
```
Return:
- Existing components with AC mapping
- Suggested new components
- Extension recommendations
- Navigation/routing updates
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| acceptance_criteria | Array | Yes | List of ACs from requirements |
| discovery_report | Object | No | Page inventory from discovery |
| component_patterns | Object | No | Project's component conventions |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| existing_components | Array | Found components with AC mapping |
| new_components | Array | Suggested new components |
| extensions | Array | Components to extend |
| routing_changes | Array | Route updates needed |

## Validation
- UI ACs have component coverage
- Components follow project patterns
- Routing updates identified
- AC mapping complete
