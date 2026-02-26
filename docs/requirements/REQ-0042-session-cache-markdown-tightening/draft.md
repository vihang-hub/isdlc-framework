# REQ-0042: Session Cache Markdown Tightening

## Problem Statement

The session cache consumes ~44% of the context window after `/clear`. The three largest sections are markdown (not JSON) and account for over 60% of the cache:

| Section | Chars | % of Cache |
|---------|-------|------------|
| ROUNDTABLE_CONTEXT | 47,166 | 27% |
| SKILL_INDEX | 39,926 | 23% |
| DISCOVERY_CONTEXT | 22,886 | 13% |
| **Total markdown** | **109,978** | **63%** |

REQ-0041 handles the JSON sections via TOON encoding (~9.4% total cache reduction). This item targets the remaining 63% by tightening verbose markdown without losing information.

## Opportunities Identified

- **SKILL_INDEX**: "AVAILABLE SKILLS (consult when relevant using Read tool):" banner repeats 39 times. Two-line-per-skill format could be condensed to tabular.
- **ROUNDTABLE_CONTEXT**: Three full persona files embedded verbatim including sections like "Meta.json Protocol", "Constraints", and detailed analytical approaches that may be redundant when personas are loaded via dispatch prompts.
- **DISCOVERY_CONTEXT**: Full discovery report with verbose prose tables that could be condensed.

## Constraints

- Source files (persona .md, topic .md, discovery report) remain unchanged on disk
- Optimization happens in `rebuildSessionCache()` during assembly
- Behavioral outcome for LLM consumers must be identical
- Information must remain crisp and unambiguous — no lossy removal

## Dependency

- REQ-0041 (TOON encoder upgrade) should land first — combined effect targets 25-30% total cache reduction
