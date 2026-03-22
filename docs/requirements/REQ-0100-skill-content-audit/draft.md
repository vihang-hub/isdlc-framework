# Skill content audit and decomposition

## Source
- GitHub Issue: #164 (CODEX-031)
- Workstream: D (Content Model), Phase: 5

## Description
Audit 245 SKILL.md files. Separate portable skill metadata (IDs, ownership, mappings, bindings, categories) from provider-specific instruction packaging. Classify each file for semantic guidance vs runtime-specific packaging vs provider-specific prompt tuning.

## Dependencies
- REQ-0074 (Content audit sizing) — completed

## Context
Skills are SKILL.md files under src/claude/skills/{category}/{skill-name}/SKILL.md. The content audit (REQ-0074) found 81% of content is templated/structured. Skills contain: frontmatter metadata (portable), analytical guidance (mostly portable), tool usage instructions (Claude-specific), output format requirements (mixed).

245 SKILL.md files across 17 categories.
