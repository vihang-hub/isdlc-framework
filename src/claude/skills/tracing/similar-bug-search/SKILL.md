---
name: similar-bug-search
description: Search for similar past bugs to inform current investigation
skill_id: TRACE-103
owner: symptom-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T1 symptom analysis to leverage historical data
dependencies: [TRACE-101]
---

# Similar Bug Search

## Purpose

Search issue trackers, commit history, and documentation for similar past bugs to inform the current investigation.

## When to Use

- During T1 symptom analysis
- When symptoms seem familiar
- When leveraging institutional knowledge

## Process

1. Extract key symptoms/keywords
2. Search issue tracker
3. Search commit messages
4. Search documentation
5. Rank by similarity

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| symptoms | Array | Yes | Current bug symptoms |
| error_messages | Array | No | Error text to match |
| affected_areas | Array | No | Code areas involved |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| similar_issues | Array | Past issues with similarity scores |
| related_commits | Array | Relevant fix commits |
| known_patterns | Array | Documented bug patterns |
| suggested_fixes | Array | Fixes that worked before |

## Search Sources

- **Issue tracker**: Jira, GitHub Issues
- **Commit history**: Git log, PR descriptions
- **Documentation**: Runbooks, post-mortems
- **Code comments**: TODO, FIXME, HACK markers

## Validation

- Multiple sources searched
- Similarity scores calculated
- Relevant matches surfaced
