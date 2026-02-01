---
name: architecture-documentation
description: Generate architecture documentation from codebase analysis
skill_id: DISC-104
owner: architecture-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: After all architecture analysis sub-skills complete to synthesize findings
dependencies: [DISC-101, DISC-102, DISC-103]
---

# Architecture Documentation

## Purpose
Synthesize the results from directory scanning, tech detection, and dependency analysis into a cohesive architecture overview document. This provides a human-readable summary of how the project is structured and what technologies it uses.

## When to Use
- After directory scan, tech detection, and dependency analysis have all completed
- When generating the architecture section of the discovery report
- When creating initial architecture documentation for new team members

## Prerequisites
- Directory scan (DISC-101) results are available
- Tech detection (DISC-102) results are available
- Dependency analysis (DISC-103) results are available
- Deployment topology and integration mapping results are available if applicable

## Process

### Step 1: Identify Architecture Pattern
Based on the combined analysis results, determine the dominant architecture pattern. Classify as MVC, microservices, serverless, monolith, modular monolith, event-driven, hexagonal, or layered architecture. Support the classification with evidence from directory structure and dependency patterns.

### Step 2: Build Component Map
Create a logical component map showing how major modules relate to each other. Identify entry points (main files, route handlers, CLI commands), core business logic modules, data access layers, external service integrations, and shared utilities. Map data flow between components.

### Step 3: Generate Report Section
Compile the architecture pattern, component map, tech stack summary, and dependency overview into a structured markdown report section. Include a technology table, architecture diagram description, key design decisions observed, and areas that may need attention.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| scan_results | object | Yes | Output from directory-scan |
| tech_results | object | Yes | Output from tech-detection |
| dependency_results | object | Yes | Output from dependency-analysis |
| topology_results | object | No | Output from deployment-topology-detection |
| integration_results | object | No | Output from integration-point-mapping |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| report_section | string | Markdown-formatted architecture overview |
| architecture_pattern | string | Identified primary architecture pattern |
| component_map | object | Logical component relationships |
| recommendations | list | Suggested architecture improvements |

## Integration Points
- **directory-scan**: Provides structural foundation for the documentation
- **tech-detection**: Supplies the technology stack details
- **dependency-analysis**: Contributes the dependency landscape
- **state-initialization**: Architecture pattern is persisted in state.json
- **discover-orchestrator**: Report section is included in final discovery output

## Validation
- Architecture pattern is identified with supporting evidence
- Report section includes technology table with versions
- Component map covers all major source directories
- Recommendations are actionable and specific to the project
