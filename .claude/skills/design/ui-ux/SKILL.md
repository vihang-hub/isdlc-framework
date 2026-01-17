---
name: ui-ux-design
description: Design user interfaces and user experience flows
skill_id: DES-003
owner: design
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Before frontend implementation, user flow design
dependencies: []
---

# UI/UX Design

## Purpose
Design intuitive user interfaces and seamless user experiences that meet user needs and align with business goals.

## When to Use
- New feature design
- User flow optimization
- Usability improvements
- Accessibility enhancements

## Prerequisites
- User requirements
- User personas
- Business goals

## Process

### Step 1: Define User Flows
```
Flow mapping:
- Entry points
- Decision points
- Success paths
- Error paths
- Exit points
```

### Step 2: Create Wireframes
```
Wireframe levels:
- Low-fidelity (structure)
- Medium-fidelity (layout)
- High-fidelity (detail)
```

### Step 3: Design Components
```
Component design:
- Reusable patterns
- States (default, hover, active, disabled)
- Responsive behavior
- Accessibility
```

### Step 4: Define Interactions
```
Interaction patterns:
- Form behavior
- Navigation
- Feedback (loading, success, error)
- Animations
```

### Step 5: Validate Design
```
Validation methods:
- User testing
- Accessibility audit
- Stakeholder review
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| user_requirements | Markdown | Yes | User needs |
| brand_guidelines | PDF | Optional | Visual guidelines |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| wireframes/ | Images | UI wireframes |
| user_flows/ | Mermaid | Flow diagrams |
| component_specs/ | Markdown | Component details |

## Project-Specific Considerations
- Multi-step application wizard
- University search and filters
- Document upload interface
- Progress tracking dashboard
- Mobile-responsive design

## Integration Points
- **Developer Agent**: Implementation specs
- **Test Manager**: Usability testing
- **Accessibility**: WCAG compliance

## Examples
```
User Flow: Application Submission

[Start] → [Dashboard]
    ↓
[Select Program] → Program Search
    ↓                   ↓
[Start Application] ← [View Program Details]
    ↓
[Step 1: Personal Info]
    ↓ (Next)
[Step 2: Academic History]
    ↓ (Next)
[Step 3: Documents]
    ↓ (Upload required docs)
[Step 4: Statement]
    ↓ (Next)
[Step 5: Review]
    ↓ (Submit)
[Confirmation] → [Dashboard with updated status]

Navigation:
- Back button on each step
- Progress indicator
- Save draft at any step
- Exit with confirmation

States:
- Step complete: ✓ checkmark
- Current step: highlighted
- Future steps: dimmed
- Invalid: red indicator
```

## Validation
- User flows complete
- All states designed
- Accessibility considered
- Responsive design
- Stakeholder approved