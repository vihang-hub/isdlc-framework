# ADR-0004: Additive-Only Synthesis Strategy for Artifact Updates

## Status

Accepted

## Context

After an elaboration discussion, the synthesis engine must update artifact files with insights from the multi-persona conversation. We needed to decide the update strategy: should synthesis replace existing content in relevant sections, merge content intelligently, or append new content additively?

**Requirements driving this decision**:
- FR-008 AC-008-03: Synthesis is additive -- enriches existing content rather than replacing it
- NFR-004: Artifact updates MUST NOT corrupt or overwrite existing artifact content
- RSK-003: Risk of synthesis corrupting existing artifact content (rated Low likelihood, High impact)
- Article X (Fail-Safe Defaults): Systems fail securely

## Decision

Adopt an **additive-only synthesis strategy**: the synthesis engine appends enriched content to artifact sections but never deletes, replaces, or reorders existing content.

Implementation pattern:
1. Read the full artifact file content
2. Identify the section most relevant to the elaboration topic (matching step title/topic)
3. Append an "Elaboration Insights" subsection after the existing content in that section
4. Mark the enrichment with a comment for traceability: `<!-- Elaboration: step {step_id}, {timestamp} -->`
5. Write the updated content

The synthesis output follows a structured template:
```markdown
### Elaboration Insights (Step {step_id}: {step_title})
- [Maya/Alex] {Insight attributed to persona(s)}
- [Jordan] {Insight attributed to persona}
**Decisions**: {Decisions made during discussion}
**Open Questions**: {Unresolved questions}
```

## Consequences

**Positive:**
- Zero risk of data loss: existing artifact content is never modified or deleted
- Idempotent from a safety perspective: running synthesis twice appends twice (clearly visible, easily reversible)
- User can easily identify elaboration additions via the structured subsection heading and Meld markers
- Fail-safe: if synthesis produces low-quality content, the original artifact content is intact
- Simple implementation: Read + Append is simpler than Read + Parse + Merge

**Negative:**
- Artifacts may accumulate redundant content if multiple elaboration passes cover overlapping topics (FR-009 AC-009-04 allows multiple elaborations per step)
- The "Elaboration Insights" subsection may feel disconnected from the surrounding content if not placed in the most relevant location
- No intelligent merging: if elaboration produces a more complete version of an existing requirement, both versions coexist rather than being merged

**Mitigations:**
- Each elaboration enrichment is clearly labeled with step ID and timestamp, making it easy to review and consolidate manually
- The user reviews the synthesis summary (AC-008-04) and can provide feedback via natural input before continuing
- Future enhancement (out of scope): add an "intelligent merge" option that diffs and proposes merged content for user approval

## Alternatives Considered

### Alternative 1: Intelligent Merge (Read-Parse-Merge-Write)
Parse the artifact's section structure, identify semantically overlapping content, and merge elaboration insights into existing paragraphs/bullets.

**Rejected because**:
- High implementation complexity for a prompt-instruction-based system (no AST or structural parser available)
- High risk of incorrect merges corrupting existing content (violates NFR-004)
- Merge logic would be expressed as natural language instructions, making it unreliable for edge cases
- Violates Article X (Fail-Safe Defaults): a merge failure could silently corrupt content

### Alternative 2: Full Section Replacement
Replace the entire relevant section with a new version that incorporates both existing content and elaboration insights.

**Rejected because**:
- Directly violates FR-008 AC-008-03 ("enriches existing content rather than replacing it")
- Risk of dropping existing content during the rewrite
- If the LLM misunderstands the section boundary, adjacent sections could be affected
- Not fail-safe: failure mode is data loss

### Alternative 3: Separate Elaboration File
Write elaboration insights to a separate file (e.g., `elaboration-notes-01-03.md`) rather than updating existing artifacts.

**Rejected because**:
- Creates file proliferation (potentially many elaboration files per item)
- Insights are disconnected from the artifacts they relate to
- Users must manually cross-reference elaboration files with artifact sections
- Violates FR-008 AC-008-02 ("system updates those artifacts with enriched content")

## Traces

- FR-008 AC-008-03 (Additive synthesis) -> core decision
- NFR-004 (Artifact integrity) -> no overwrites, no deletions
- RSK-003 (Artifact corruption risk) -> eliminated by additive-only pattern
- Article X (Fail-Safe Defaults) -> fail-safe: original content always preserved
- FR-009 AC-009-04 (Multiple elaborations) -> append-only supports stacking
