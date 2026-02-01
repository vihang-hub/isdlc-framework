---
name: page-discovery
description: Catalog UI pages, views, and navigation structure
skill_id: DISC-602
owner: feature-mapper
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When mapping an existing frontend codebase to understand its page structure
dependencies: []
---

# Page Discovery

## Purpose
Scan frontend source code to catalog all UI pages, views, and navigation routes. Produces a structured page inventory including route paths, layout hierarchy, and component relationships.

## When to Use
- During initial discovery of a frontend or full-stack application
- When auditing navigation structure for completeness or accessibility
- Before redesigning or migrating a frontend to capture the full page surface

## Prerequisites
- Source code access to page components, view files, and router configuration
- Frontend framework identified so the correct page conventions can be targeted

## Process

### Step 1: Detect Page Convention
Identify the frontend routing mechanism — Next.js App Router or Pages Router, React Router configuration, Vue Router definitions, Angular route modules, or template-based views in server-rendered frameworks. Locate where page definitions reside.

### Step 2: Extract Page Routes
Parse each page or view component to capture the URL route, any dynamic segments or parameters, and the component or template that renders the page. Resolve nested routes and catch-all patterns.

### Step 3: Map Layout Hierarchy
Identify shared layouts, nested layout boundaries, and wrapper components. Determine which pages share common navigation, sidebars, or header structures. Document the layout tree.

### Step 4: Compile Page Catalog
Assemble all discovered pages into a structured catalog with route path, component reference, parent layout, dynamic parameters, and any route guards or redirects.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| source_code | directory | Yes | Page components, view files, and router configuration |
| tech_stack | object | Yes | Identified frontend framework from tech detection |
| base_route | string | No | Application base route prefix if known |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| page_catalog | array | List of pages with route, component, layout, and parameters |
| page_count | number | Total number of discovered pages |
| layout_tree | object | Hierarchy of layouts and their child pages |

## Integration Points
- **tech-detection**: Provides frontend framework context for targeting correct page conventions
- **domain-mapping**: Consumes page catalog to cluster pages by business domain
- **endpoint-discovery**: Cross-references API endpoints with pages to identify data flow

## Validation
- Every page or view component in the codebase has a corresponding catalog entry
- Route paths are accurate including dynamic segments and resolved prefixes
- Layout hierarchy correctly reflects the nesting structure in the codebase
