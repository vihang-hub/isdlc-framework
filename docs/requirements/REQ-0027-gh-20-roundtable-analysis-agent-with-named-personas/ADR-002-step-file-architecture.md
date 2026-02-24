# ADR-002: File-Based Step Architecture (Not Skill Manifest)

## Status

Accepted

## Context

The roundtable agent executes analysis in discrete steps within each phase. The design question is how to define, discover, and execute these steps.

The iSDLC framework has an existing skill system with `skills-manifest.json` registration, skill IDs, and hook-based skill validation. The question is whether analysis steps should integrate into this system or use a separate file-based approach.

Requirements context:
- FR-004 specifies step files as self-contained `.md` files under `analysis-steps/{phase-key}/`
- FR-012 defines the YAML frontmatter schema for step files
- NFR-004 requires adding new steps without modifying the core agent
- Requirements Section 7 explicitly states: "No new skill IDs are registered in skills-manifest.json"
- The skill manifest currently has 240 entries; adding 24 more would increase it by 10%

## Decision

Use a **file-based step architecture** where each step is a standalone `.md` file discovered by directory listing. Steps are NOT registered in `skills-manifest.json`.

Discovery mechanism:
1. The roundtable agent receives the `phase_key` from the delegation prompt
2. It lists files in `src/claude/skills/analysis-steps/{phase_key}/`
3. It filters for `.md` files
4. It sorts by filename (numeric prefix ensures deterministic order)
5. It parses YAML frontmatter for metadata
6. It executes the step body based on the active depth mode

## Consequences

**Positive:**
- Zero changes to skills-manifest.json (explicit requirement from Section 7)
- Adding a step is a single file operation -- no registration, no manifest update, no skill ID allocation
- Step files are self-contained and human-readable
- No hook interference: skill-delegation-enforcer does not validate step files
- Clear separation between the skill system (build workflow) and the step system (analyze workflow)

**Negative:**
- No compile-time or startup-time validation of step file schemas (risk R3 from impact analysis)
- Step files are invisible to skill observability logging (no skill_usage_log entries)
- No centralized inventory of steps (must list directories to discover all steps)
- Duplicate step_ids across files would not be detected until runtime

**Mitigations:**
- YAML frontmatter validation can be added as a CI check (future enhancement)
- The roundtable agent logs step execution to meta.json (steps_completed), providing traceability
- Step_id uniqueness can be validated by a pre-commit hook (future enhancement)
- 24 files is a manageable count for manual review

## Alternatives Considered

### Skill Manifest Registration (Rejected)
- Register each step as a skill ID in skills-manifest.json
- **Rejected because**: Requirements Section 7 explicitly prohibits this; would add 24 entries to the manifest (10% increase); skill system is designed for atomic operations, not interactive multi-step sessions

### Inline Steps in Agent File (Rejected)
- Define all 24 steps directly in the roundtable-analyst.md file
- **Rejected because**: Would make the agent file extremely large (3000+ lines); would not support extensibility (NFR-004); step content changes would require editing the agent file

### JSON Step Definitions (Rejected)
- Define steps as JSON files instead of markdown
- **Rejected because**: Step content includes rich prompt text, validation criteria, and artifact instructions -- markdown is the natural format for this content; JSON would require escaping all the prompt text

## Traces

- FR-004 (step-file architecture)
- FR-012 (step file schema)
- NFR-004 (extensibility)
- CON-005 (step file location)
- Requirements Section 7 (out of scope: no skill manifest changes)
