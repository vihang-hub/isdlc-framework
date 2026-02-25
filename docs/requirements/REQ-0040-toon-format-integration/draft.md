# TOON Format Integration

## Source
- **Backlog item**: #33
- **Type**: Feature / Optimization

## Description
Adopt Token-Oriented Object Notation (TOON) for agent prompts and state data to reduce token usage in context management.

## Candidate Areas
1. **skills-manifest.json** — `skill_lookup` (243 entries, 7,900 chars, 100% tabular eligibility) and `ownership` (41 entries, 6,253 chars, ~80% eligibility)
2. **state.json arrays** — `workflow_history` (105K chars), `history` (10K chars), `skill_usage_log` (9K chars) — 93.8% of state.json is array data
3. **Session cache sections** — SKILL_INDEX (~4,500 tokens), SKILLS_MANIFEST (~5,000 tokens), ITERATION_REQUIREMENTS (~5,500 tokens), WORKFLOW_CONFIG (~3,500 tokens)

## Target
- ~35% token reduction on structured data injection (~6,600 tokens saved in session cache)
- ~50-60% reduction on state.json array reads
- Maintained or improved LLM accuracy (TOON benchmarks show +2-10 accuracy points)

## Context from Research
- TOON reduces token consumption by 30-60% vs JSON for tabular/uniform data
- Sweet spot: uniform arrays (field names declared once as header, rows follow)
- Less effective for deeply nested/non-uniform structures (keep JSON for those)
- TypeScript SDK available: github.com/toon-format/toon
- Benchmarks show 73.9% accuracy (vs JSON 69.7%) while using 39.6% fewer tokens
- Claude Haiku: TOON 59.8% vs JSON 57.4% accuracy

## NOT in Scope
- Full JSON replacement — TOON complements JSON for token-heavy tabular data only
- Constitution (prose), agent definitions (markdown), discovery context (narrative)
- Deeply nested phase objects in state.json (~6K chars, 4.6% of state)
