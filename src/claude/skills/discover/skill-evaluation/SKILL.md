---
name: skill-evaluation
description: Evaluate and rank discovered skills by relevance and quality
skill_id: DISC-402
owner: skills-researcher
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: When scoring and ranking skills discovered from the skills.sh registry
dependencies: [DISC-401]
---

# Skill Evaluation

## Purpose
Evaluate and rank each discovered skill using a weighted scoring system that considers relevance, quality, popularity, and compatibility. Categorizes skills as recommended or optional to guide user selection.

## When to Use
- After skills search has returned matching skills from the registry
- When determining which skills to recommend for installation
- When re-evaluating skills after project context changes

## Prerequisites
- Skills search has returned a set of matching skills with metadata
- Project tech stack is available for compatibility scoring
- Project type and domain are known for relevance scoring

## Process

### Step 1: Score Relevance (40% Weight)
Evaluate how closely each skill aligns with the project's specific needs. Consider technology version match, framework compatibility, and whether the skill addresses a detected gap in the project's tooling. Score from 0-100.

### Step 2: Score Quality (30% Weight)
Assess skill quality based on available signals: author reputation, documentation completeness, last update recency, open issue count, and presence of tests. Penalize skills not updated within the last 12 months. Score from 0-100.

### Step 3: Score Popularity (20% Weight)
Factor in community adoption metrics: total downloads, weekly download trend, star count, and number of dependent projects. Apply logarithmic scaling to prevent mega-popular skills from dominating. Score from 0-100.

### Step 4: Score Compatibility (10% Weight)
Check for known conflicts with other selected skills or project dependencies. Verify the skill supports the project's runtime environment and operating system. Deduct points for any compatibility warnings. Score from 0-100.

### Step 5: Rank and Categorize
Calculate the weighted composite score for each skill. Rank skills by composite score. Categorize as "recommended" (score above 70) or "optional" (score 40-70). Exclude skills scoring below 40.

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| search_results | array | Yes | Skills with metadata from skills search |
| tech_stack | object | Yes | Project tech stack for compatibility checking |
| project_context | object | No | Project type and domain for relevance scoring |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| ranked_skills | array | Skills ordered by composite score with category labels |
| score_breakdown | object | Per-skill breakdown of relevance, quality, popularity, compatibility |
| exclusions | array | Skills excluded with reasons |

## Integration Points
- **skills-search**: Receives raw skill search results as input
- **skill-installation**: Passes recommended skills for user selection and installation
- **skills-researcher**: Reports evaluation summary to orchestrating agent

## Validation
- All input skills received a composite score
- Score weights sum to 100% (40 + 30 + 20 + 10)
- Recommended skills have composite scores above 70
- No skills are categorized without a complete score breakdown
