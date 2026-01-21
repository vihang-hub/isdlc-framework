---
name: state-management-design
description: Design application state management architecture
skill_id: DES-007
owner: system-designer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: Frontend architecture, complex state needs
dependencies: [DES-005]
---

# State Management Design

## Purpose
Design state management architecture that handles local, server, and global state effectively.

## Process
1. Categorize state types
2. Select management tools
3. Design state structure
4. Plan state synchronization
5. Document patterns

## Project-Specific Considerations
- Server state: React Query (applications, universities)
- UI state: Zustand (modals, filters, preferences)
- Form state: React Hook Form
- URL state: React Router (search params)