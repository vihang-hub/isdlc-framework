---
name: article-generation
description: Generate constitution articles from research findings
skill_id: DISC-302
owner: constitution-generator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When transforming research findings into draft constitution articles with tech-specific thresholds
dependencies: [DISC-301, DISC-304]
---

# Article Generation

## Purpose
Generate draft constitution articles by combining universal best practice articles from the framework template with domain-specific articles derived from research findings. Sets concrete, tech-specific thresholds for coverage targets, performance SLAs, and quality gates.

## When to Use
- After research coordination has produced aggregated findings
- When creating the initial draft constitution for a new project
- When regenerating articles after significant tech stack changes

## Prerequisites
- Research coordination has completed with aggregated findings
- Domain detection has identified the project domain
- Tech stack information is available for threshold calibration

## Process

### Step 1: Load Universal Articles
Load the base set of universal constitution articles from the framework template. These cover fundamental standards applicable to all projects: code style, version control, documentation, and basic quality gates.

### Step 2: Generate Domain-Specific Articles
Analyze research findings to produce domain-specific articles. For each quality dimension with findings, generate articles that encode the discovered standards. Map compliance requirements to enforceable articles (e.g., HIPAA findings become data handling articles).

### Step 3: Set Tech-Specific Thresholds
Calibrate numeric thresholds based on the detected tech stack. Set test coverage targets (e.g., 80% for TypeScript, 90% for Go), performance SLAs (e.g., p95 response time under 200ms for API projects), and build time limits appropriate to the stack.

### Step 4: Merge and Order Articles
Combine universal and domain-specific articles into a single ordered list. Group articles by category (code quality, testing, security, performance, deployment). Assign article numbers and ensure no conflicts between universal and domain-specific rules.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| research_findings | object | Yes | Aggregated findings from research coordination |
| project_context | object | Yes | Project description, type, and goals |
| tech_stack | object | Yes | Detected technologies for threshold calibration |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| draft_articles | array | Ordered list of draft constitution articles |
| article_sources | object | Maps each article to its source (template, research, domain) |
| threshold_rationale | object | Explains why each numeric threshold was chosen |

## Integration Points
- **research-coordination**: Receives aggregated research findings as primary input
- **interactive-review**: Passes draft articles for user review and approval
- **domain-detection**: Uses domain context to select appropriate article templates

## Validation
- Every research finding is reflected in at least one article
- All numeric thresholds have documented rationale
- No conflicting articles exist in the merged set
- Articles cover all four quality dimensions (code, testing, security, performance)
