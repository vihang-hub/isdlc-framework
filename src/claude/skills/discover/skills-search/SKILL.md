---
name: skills-search
description: Search skills.sh registry for matching skills
skill_id: DISC-401
owner: skills-researcher
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When querying the skills.sh registry to find skills matching detected technologies
dependencies: []
---

# Skills Search

## Purpose
Query the skills.sh registry API for skills that match each detected technology in the project's tech stack. Collects matching skill metadata for downstream evaluation and ranking.

## When to Use
- After tech stack detection has identified project technologies
- When populating the initial list of candidate skills for evaluation
- When refreshing skill recommendations after tech stack changes

## Prerequisites
- Tech stack detection has completed with a list of technologies
- Network access to the skills.sh registry is available
- API rate limits have not been exceeded

## Process

### Step 1: Prepare Search Queries
For each technology in the detected tech stack, construct a search query targeting the skills.sh API. Include the technology name, version constraints, and category filters (e.g., "react 18.x frontend" or "prisma 5.x orm").

### Step 2: Execute API Queries
Send search requests to the skills.sh registry for each technology. Execute queries in parallel where possible to minimize total search time. Handle API errors gracefully with retries (max 2 retries per query).

### Step 3: Parse and Collect Results
Parse API responses to extract skill metadata: name, description, version, author, rating, download count, compatibility tags, and last update date. Deduplicate results where the same skill appears across multiple technology queries.

### Step 4: Filter by Relevance
Apply initial relevance filtering to remove clearly irrelevant results (e.g., skills for incompatible framework versions, deprecated skills, skills with zero downloads). Pass filtered results to skill evaluation.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| technologies | array | Yes | List of detected technologies with versions |
| category_filters | array | No | Optional category filters to narrow search |
| max_results_per_tech | number | No | Maximum results per technology (default 20) |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| matching_skills | array | Skills with metadata (name, version, rating, downloads) |
| search_coverage | object | Which technologies returned results and which did not |
| api_status | object | API response status and any errors encountered |

## Integration Points
- **tech-detection**: Receives detected technologies as search input
- **skill-evaluation**: Passes matching skills for ranking and scoring
- **web-research-fallback**: Triggers fallback for technologies with no registry matches

## Validation
- Every technology in the stack was queried against the registry
- API responses are valid and properly parsed
- No duplicate skills exist in the output set
- Technologies with no matches are flagged for fallback research
