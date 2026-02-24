# Implementation Notes: REQ-0039 Replace Staleness Discovery Context Injection

## Summary

Removed the legacy 24h staleness-based discovery context injection mechanism from the iSDLC workflow pipeline. Discovery context is now delivered exclusively via AVAILABLE SKILLS and the SessionStart cache (`<!-- SECTION: DISCOVERY_CONTEXT -->`). The `discovery_context` envelope in state.json is retained as audit-only metadata for provenance tracking.

## Files Modified

### 1. `src/claude/commands/isdlc.md` (FR-001, FR-002)

- **Line 1566 area**: Removed the state.json fallback from the "Discovery context" paragraph. Previously, if the SessionStart cache was absent, the system fell back to reading `discovery_context` from state.json (with or without 24h staleness check). Now it simply omits the block if the SessionStart cache section is not present.
- **STEP C (skill injection assembly)**: Updated reference from "after DISCOVERY CONTEXT" to "after WORKFLOW MODIFIERS (or after DISCOVERY CONTEXT if present from SessionStart cache)".
- **Delegation template (line 1794 area)**: Changed `{DISCOVERY CONTEXT: ... -- if phase 02 or 03}` to `{DISCOVERY CONTEXT: ... -- if present in SessionStart cache}` -- removing the phase-specific conditional.

### 2. `src/claude/agents/discover-orchestrator.md` (FR-003)

- **Step 9 envelope (line 670 area)**: Updated description to explicitly state the envelope is "audit-only metadata" for provenance tracking, not for active injection.
- **Deep Discovery Phase 5.2 (line 1191)**: Added "Audit-Only" qualifier to the section heading and description.
- **Step 8 PHASE 5 Finalize (line 2569 area)**: Updated description to mark as audit-only, added closing note that downstream workflows do NOT read it.
- **user_next_action (line 2539)**: Added "(audit-only metadata)" qualifier.
- **Progress display (line 2562)**: Updated label to "Write discovery context envelope (audit-only)".

### 3. `src/claude/agents/00-sdlc-orchestrator.md` (FR-004)

- **DISCOVERY CONTEXT INJECTION section (line 880-903 area)**: Completely rewritten from a 4-tier fallback (fresh envelope / stale envelope / legacy boolean / no discovery) to a 3-tier delivery mechanism (SessionStart cache / project skills / absent). Removed all references to reading state.json for context injection. Added explicit note that discovery_context in state.json is audit-only.
- **Agent delegation table**: Changed "DISCOVERY CONTEXT (above)" references to "DISCOVERY CONTEXT (from SessionStart cache, if available)".
- **Conversational Protocol line 955**: Changed "READ discovery_context from state.json" to "USE project knowledge from AVAILABLE SKILLS and DISCOVERY CONTEXT".

### 4. `src/claude/agents/01-requirements-analyst.md` (FR-004)

- **Conversational Opening (line 45)**: Replaced state.json read instruction with SessionStart cache / AVAILABLE SKILLS reference.
- **PRE-PHASE CHECK section**: Complete rewrite of the "Check for Discovery Artifacts" subsection -- no longer reads state.json, instead checks delegation prompt for DISCOVERY CONTEXT block and AVAILABLE SKILLS.
- **Banner**: Removed emoji from banner text.
- **If No Discovery section**: Updated condition from checking state.json to checking delegation prompt contents.

### 5. `src/claude/agents/02-solution-architect.md` (FR-004)

- **PRE-PHASE CHECK section**: Complete rewrite -- no longer reads state.json or project-discovery-report.md directly. Checks delegation prompt for DISCOVERY CONTEXT block (primary) and AVAILABLE SKILLS (supplementary).
- **Banner**: Removed emoji.
- **If No Discovery section**: Updated condition from state.json check to delegation prompt check.

### 6. `src/claude/agents/03-system-designer.md` (FR-004)

- **PRE-PHASE CHECK section**: Complete rewrite -- same pattern as agent 02. Checks delegation prompt and AVAILABLE SKILLS instead of state.json.
- **Banner**: Removed emoji.
- **If No Discovery section**: Updated condition.
- **Pattern Constraints Table heading**: Updated "When discovery context exists" to "When discovery context is available".

### 7. `src/claude/commands/discover.md` (FR-003)

- **Context Handover bullet (line 176)**: Updated from "enables seamless transition" to "audit-only metadata -- records when discovery was last run, for provenance tracking".

### 8. Runtime copies (`.claude/` directory)

All modified source files were synced to their corresponding `.claude/` runtime copies to maintain parity (required by BUG-0006 TC-04a sync test).

## What Was NOT Changed (and why)

- **roundtable-analyst.md**: Out of scope -- uses DISCOVERY_CONTEXT in a different code path (STEP 7a, not STEP 3d).
- **Hook .cjs files**: Already audit-only in their implementation -- no documentation changes needed.
- **tour.md**: Minimal reference, no change needed.
- **state.json**: Not modified (constraint). The discovery_context field continues to be written by discover-orchestrator for audit purposes.
- **SessionStart cache mechanism**: Preserved as-is -- this is the replacement mechanism.

## Backward Compatibility (FR-005)

- Fail-open is preserved: if no DISCOVERY CONTEXT is found in the SessionStart cache, agents simply skip the section and proceed with greenfield behavior.
- The discover-orchestrator continues writing the discovery_context envelope to state.json -- existing discover workflows are not broken.
- No hook changes needed -- hooks already treat discovery_context as audit metadata.

## Test Results

- Hook tests: 2664 passing, 9 pre-existing failures (unrelated to this change)
- TC-04a (isdlc.md sync test): Now passes after syncing runtime copies
