---
name: component-design
description: Design reusable UI components with variants and states
skill_id: DES-004
owner: design
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Building component library, UI standardization
dependencies: [DES-003]
---

# Component Design

## Purpose
Design reusable UI components that provide consistency, accessibility, and maintainability across the application.

## When to Use
- Building design system
- New component needs
- Component refactoring
- Consistency improvements

## Process

### Step 1: Identify Component Needs
### Step 2: Define Props and Variants  
### Step 3: Design All States
### Step 4: Document Usage Guidelines
### Step 5: Create Component Spec

## Project-Specific Considerations
- ApplicationCard component
- StatusBadge variants
- ProgressBar component
- DocumentUpload component
- UniversityCard component

## Examples
```typescript
// Component Specification: StatusBadge

interface StatusBadgeProps {
  status: 'draft' | 'submitted' | 'under_review' | 'accepted' | 'rejected'
  size?: 'sm' | 'md' | 'lg'
}

// Variants by status:
// draft: gray background, "Draft" text
// submitted: blue background, "Submitted" text
// under_review: yellow background, "Under Review" text
// accepted: green background, "Accepted" text
// rejected: red background, "Rejected" text
```