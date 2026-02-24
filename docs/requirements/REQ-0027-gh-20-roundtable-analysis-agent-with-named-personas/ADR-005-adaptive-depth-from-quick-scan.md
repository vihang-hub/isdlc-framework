# ADR-005: Adaptive Depth Determination from Quick-Scan Output

## Status

Accepted

## Context

The roundtable agent must adjust its analysis depth (brief/standard/deep) based on item complexity. This affects how each step file is executed: brief mode presents draft summaries for confirmation, standard mode uses multi-question discovery, and deep mode adds follow-up probing and edge case exploration.

The design question is how depth is determined and how user overrides interact with the initial determination.

Requirements context:
- FR-006 specifies the adaptive depth logic with scope-to-depth mapping
- FR-006 AC-006-04 and AC-006-05 specify user overrides ("deep", "brief" keywords)
- FR-006 AC-006-06 specifies persistence of depth overrides in meta.json
- FR-006 AC-006-07 specifies default to "standard" when no quick-scan output exists
- The quick-scan output is a markdown file in the artifact folder produced during Phase 00

## Decision

Use a **three-tier depth determination** with the following priority chain:

1. **User override** (highest priority): If the user says "deep", "more detail", "let's dig in", etc., switch to deep mode for remaining steps in the current phase. If "brief", "skip ahead", "keep it short", switch to brief. Save to `meta.depth_overrides[phase_key]`.

2. **Persisted override**: If `meta.depth_overrides[phase_key]` exists from a previous session, use it. This ensures resumed sessions maintain the user's depth preference.

3. **Quick-scan derivation** (lowest priority): Parse the quick-scan output to determine scope:
   - Scope "small" (< 5 files, complexity "low") -> brief
   - Scope "medium" (5-15 files, complexity "medium") -> standard
   - Scope "large" (> 15 files, complexity "high") -> deep
   - No quick-scan output or parse failure -> standard (safe default)

Depth is determined once at the start of each phase and can be overridden at any step boundary. The override applies to the remaining steps in the current phase only.

### Quick-Scan Parsing

The roundtable agent reads `quick-scan.md` from the artifact folder and extracts the scope estimate from the metadata section. It looks for:
- "Estimated Scope: {small|medium|large}" in the markdown body
- The "File Count Estimate" number if scope is ambiguous
- Falls back to "standard" if parsing fails

This is a best-effort parse. The quick-scan format is not a strict schema, so the agent uses pattern matching on the markdown content. If the format changes, the worst case is falling back to "standard" depth.

## Consequences

**Positive:**
- Users get appropriate depth automatically without configuration
- Overrides are intuitive: natural language ("deep", "brief")
- Persisted overrides maintain consistency across sessions
- Safe default: "standard" when depth cannot be determined
- No new configuration files or settings

**Negative:**
- Quick-scan parsing is fragile (markdown pattern matching, not structured data)
- Depth is per-phase, not per-step (a user cannot set different depths for different steps within the same phase)
- User override keywords ("deep", "brief") might collide with natural conversation

**Mitigations:**
- Quick-scan fragility is acceptable because the fallback is always "standard" (Article X: Fail-Safe Defaults)
- Per-step depth control is not required by the spec and adds complexity
- Keyword collision is mitigated by context: the agent checks for override keywords at step boundaries (in the menu response), not in the middle of conversational exchanges

## Alternatives Considered

### Explicit Depth Configuration Flag (Rejected)
- Add `--depth=brief` to the analyze verb
- **Rejected because**: Adds CLI complexity; most users will not know their ideal depth before analysis starts; the adaptive approach is more user-friendly

### Per-Step Depth Configuration (Rejected)
- Allow depth to be set for individual steps, not just phases
- **Rejected because**: 24 steps is too many to configure individually; the step file's `depth` frontmatter field already specifies the default depth for that step. Phase-level override is sufficient.

### Structured Quick-Scan Output (Deferred)
- Add a JSON metadata block to quick-scan.md for reliable parsing
- **Deferred**: This would be a good future improvement but is not needed for the initial release. The markdown parsing approach works for the current quick-scan format and fails safely.

## Traces

- FR-006 (adaptive depth logic)
- FR-006 AC-006-01 through AC-006-07 (specific depth behaviors)
- NFR-003 (resumed sessions use persisted depth)
- NFR-006 (conversational UX: brief mode uses confirmation, not interrogation)
- Article V (Simplicity First)
- Article X (Fail-Safe Defaults: "standard" as safe fallback)
