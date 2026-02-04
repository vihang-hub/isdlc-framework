---
name: web-research-fallback
description: Generate custom skill files from web research when skills.sh has no match
skill_id: DISC-404
owner: skills-researcher
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When the skills.sh registry has no matching skills for a detected technology
dependencies: [DISC-401]
---

# Web Research Fallback

## Purpose
Generate custom lightweight SKILL.md files from web research when the skills.sh registry does not have matching skills for a detected technology. Ensures every technology in the stack has at least basic skill guidance.

## When to Use
- When skills search returns no results for a given technology
- When available registry skills score below the minimum quality threshold
- When a technology is too new or niche to have registry coverage

## Prerequisites
- Skills search has flagged technologies with no registry matches
- Web search capabilities are available
- Target technology name and version are known

## Process

### Step 1: Research Best Practices
Search the web for the technology's official documentation, best practices guides, and community conventions. Target authoritative sources: official docs, framework creator blogs, and high-quality tutorial sites.

### Step 2: Extract Patterns and Conventions
From the research results, extract key patterns: recommended project structure, naming conventions, configuration best practices, common pitfalls to avoid, and testing approaches specific to the technology.

### Step 3: Generate Skill File
Compose a lightweight SKILL.md file following the standard skill format. Include the technology name, a concise description, key conventions, recommended patterns, and common anti-patterns. Mark the skill as "auto-generated" in its metadata.

### Step 4: Write and Register
Write the generated skill file to the external skills directory:
- Single-project: `.claude/skills/external/{technology-name}/SKILL.md`
- Monorepo: `.isdlc/projects/{project-id}/skills/external/{technology-name}/SKILL.md`

Register it in the skill index with source marked as "web-research" to distinguish it from registry-sourced skills.

Also register the skill in the external skills manifest:
- Single-project: `docs/isdlc/external-skills-manifest.json`
- Monorepo: `docs/isdlc/projects/{project-id}/external-skills-manifest.json`

Record: name, `source: "web-research"`, `version: "generated"`, path, `available_to: "all"`, and installation timestamp.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| technology_name | string | Yes | Name of the technology needing skill coverage |
| technology_version | string | No | Version of the technology for targeted research |
| web_search_results | array | No | Pre-fetched search results if available |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| generated_skill | object | The generated SKILL.md file content and metadata |
| skill_file_path | string | Path where the skill file was written |
| research_sources | array | URLs and titles of sources used for generation |

## Integration Points
- **skills-search**: Triggered when search returns no matches for a technology
- **skill-installation**: Generated skills are installed alongside registry skills
- **skills-researcher**: Reports generated skills back to orchestrating agent

## Validation
- Generated skill file follows the standard SKILL.md format
- At least three authoritative sources were consulted
- Skill content is specific to the target technology, not generic
- File is properly written and registered in the skill index
- External manifest entry exists with `source: "web-research"`
