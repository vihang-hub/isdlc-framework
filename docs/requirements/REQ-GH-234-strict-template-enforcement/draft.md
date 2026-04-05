# GH-234: Enforce artifact templates strictly in roundtable confirmations and artifact writes

**Source**: GitHub #234
**Created**: 2026-04-05

---

## Summary

The framework has 8 artifact templates at `src/isdlc/config/templates/` (requirements, architecture, design, tasks, traceability, plus 3 bug-flow templates) but **nothing enforces them**. LLMs running `/analyze` or spawning `roundtable-analyst` default to their own structure, producing confirmation summaries and artifact files that don't match the templates' `section_order` or `required_sections`.

## Observed Gap

During REQ-GH-227 analysis (2026-04-04/05), all 4 domain confirmations (Requirements, Architecture, Design, Tasks) AND all 4 artifact files were written with improvised structures:

- `requirements-spec.md` had Assumptions AFTER Out of Scope (template says between FR and NFR)
- `architecture-overview.md` added a standalone ADRs section not in template
- `module-design.md` added Error Taxonomy + Testability sections not in template
- `tasks.md` Phase 06 tasks were a flat list, not grouped by `required_task_categories` (setup/core_implementation/unit_tests/wiring_claude/wiring_codex/cleanup)
- Tasks confirmation was improvised instead of using the 4-column traceability table from `traceability.template.json` v2.1

The user had to catch this and ask for a redo. **4th repeat occurrence across multiple analyses.**

## Root Cause

1. `src/claude/agents/roundtable-analyst.md` uses discretionary language ("substantive content with these items") for Requirements/Architecture/Design summaries — LLMs improvise
2. Only the Tasks summary references `traceability.template.json` by name (lines 242-258) and even that is easy to skim past
3. No hook validates artifact structure against the corresponding template JSON after Write/Edit
4. No shared formatter function — each LLM session reinvents the presentation structure

## Proposed Fix

### Part A — strict template binding in roundtable-analyst.md
For each of the 4 domain summaries, replace discretionary language with hard constraints:
- Inline the template's `section_order` verbatim
- State: "Use EXACTLY these sections in this order — no additions, no reorderings, no renaming"
- Include concrete template-compliant examples for each domain

### Part B — template-validator hook (PostToolUse)
New hook `src/claude/hooks/template-validator.cjs` that fires after Write/Edit on artifact files:
1. Reads the corresponding template JSON from `src/isdlc/config/templates/`
2. Parses the markdown for top-level H2 sections
3. Compares against template's `section_order` and `required_sections`
4. Warns (or blocks) on mismatch with specifics

### Part C — shared formatter (optional)
A `src/core/templates/renderer.js` module exposing `renderDomainConfirmation(domain, content)` that takes structured content + template + returns template-compliant markdown.

## Tier

Tier 3 — Quality / framework integrity.

## Related

Discovered during REQ-GH-227 analysis. Those artifacts have structural drift — content accepted, structure wrong. Will be rebuilt under new enforcement when this ships.
