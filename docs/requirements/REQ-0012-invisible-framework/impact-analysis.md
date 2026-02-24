# Impact Analysis: REQ-0012 Invisible Framework

**Generated**: 2026-02-13T12:05:00Z
**Feature**: CLAUDE.md rewrite for auto-intent-detection, consent protocol, and invisible framework behavior
**Based On**: Phase 01 Requirements (finalized -- 5 FRs, 4 NFRs, 27 ACs, 11 user stories)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | CLAUDE.md rewrite so the framework auto-detects user intent, gets consent, invokes commands automatically | Same core concept, formalized into 5 FRs with 6 intent categories, consent protocol, edge case handling, invisible framework principle |
| Keywords | intent, auto-detect, consent, invisible | intent-detection, consent-protocol, intent-to-command-mapping, edge-cases, invisible-framework, backward-compatibility |
| Estimated Files | 2 (CLAUDE.md, CLAUDE.md.template) | 2 primary + 2 test files at risk |
| Scope Change | - | REFINED (same intent, significantly more precise) |

---

## Executive Summary

This feature has a **narrow blast radius** -- it modifies only 2 files directly (both markdown system prompts), but those 2 files are **load-bearing**: `CLAUDE.md` is the system prompt that defines all Claude Code behavior for this project, and `src/claude/CLAUDE.md.template` is the template shipped to all new iSDLC installations. The change is surgical (only the `## Workflow-First Development` section, ~10 lines today, expanding to ~60-80 lines) but carries elevated risk because (a) CLAUDE.md has no unit-testable runtime code, making regression detection rely on behavioral observation and existing format tests, and (b) the unchanged sections (Agent Framework Context, SKILL OBSERVABILITY, SUGGESTED PROMPTS, CONSTITUTIONAL PRINCIPLES) must remain byte-identical per NFR-02. Two existing test files (`lib/prompt-format.test.js`, `lib/installer.test.js`) validate CLAUDE.md content structure and will act as regression guards.

**Blast Radius**: LOW (2 files directly changed, 0 runtime code files)
**Risk Level**: MEDIUM (load-bearing system prompt, limited automated test coverage for behavioral correctness)
**Affected Files**: 2 direct, 6 dependent (read-only references)
**Affected Modules**: 1 (system prompt / CLAUDE.md module)

---

## Impact Analysis (M1)

### Directly Affected Files

| # | File | Change Type | Acceptance Criteria |
|---|------|-------------|---------------------|
| 1 | `CLAUDE.md` (project root) | **MODIFY** -- Rewrite `## Workflow-First Development` section (lines 9-19) | AC-01.1 through AC-05.5 (all 27 ACs) |
| 2 | `src/claude/CLAUDE.md.template` | **MODIFY** -- Rewrite `## Workflow-First Development` section (lines 5-13) | AC-01.1 through AC-05.5, NFR-04 (template consistency) |

### Untouched Sections (NFR-02 Compliance)

The following sections in CLAUDE.md and CLAUDE.md.template MUST remain unchanged:

| Section | Lines (CLAUDE.md) | Lines (template) | Verified |
|---------|-------------------|-------------------|----------|
| `## Agent Framework Context` | 23-64 | 17-58 | Must be identical before/after |
| `### SKILL OBSERVABILITY Protocol` | 27-33 | 21-27 | Must be identical before/after |
| `### SUGGESTED PROMPTS -- Phase Agent Protocol` | 35-64 | 29-58 | Must be identical before/after |
| `### CONSTITUTIONAL PRINCIPLES Preamble` | 66-70 | 60-65 | Must be identical before/after |
| `## Project Context` (CLAUDE.md only) | 74-112 | N/A | Dogfooding-specific, must remain |

### Outward Dependencies (What Reads These Files)

Files that reference or depend on `CLAUDE.md` or `CLAUDE.md.template` (read-only -- NOT modified by this feature):

| # | File | Relationship | Risk |
|---|------|-------------|------|
| 1 | `lib/installer.js` (line 551-562) | Copies template to create CLAUDE.md for new installs | NONE -- copies whole file, no section-specific logic |
| 2 | `lib/updater.js` (line 220, 281) | Explicitly preserves CLAUDE.md during updates | NONE -- does not touch CLAUDE.md content |
| 3 | `lib/uninstaller.js` (line 351) | Checks for CLAUDE.md.backup during cleanup | NONE -- file existence check only |
| 4 | `install.sh` (lines 962-970) | Seeds CLAUDE.md from template for shell-based installs | NONE -- copies whole file |
| 5 | `install.ps1` (lines 1214-1224) | Seeds CLAUDE.md from template for PowerShell installs | NONE -- copies whole file |
| 6 | `lib/prompt-format.test.js` (lines 594-616) | Validates CLAUDE.md contains "Show project status" and "Start a new workflow" | MEDIUM -- these strings are in unchanged sections, but test reads full file |

### Inward Dependencies (What These Files Depend On)

| # | Dependency | Relationship |
|---|-----------|-------------|
| 1 | `src/claude/commands/isdlc.md` | CLAUDE.md instructs Claude to invoke `/isdlc` commands -- the command file must accept the same arguments |
| 2 | `.isdlc/state.json` | CLAUDE.md references state.json for active workflow detection (existing reference, unchanged) |

### Change Propagation

```
CLAUDE.md (project root)
  |-- Read by: Claude Code runtime (system prompt)
  |-- Validated by: lib/prompt-format.test.js (TC-09-02, TC-09-03)
  |-- No runtime code depends on specific section content

src/claude/CLAUDE.md.template
  |-- Copied by: lib/installer.js -> CLAUDE.md (new installs)
  |-- Copied by: install.sh -> CLAUDE.md (shell installs)
  |-- Copied by: install.ps1 -> CLAUDE.md (PowerShell installs)
  |-- Preserved by: lib/updater.js (updates do NOT overwrite CLAUDE.md)
```

**Key Insight**: The updater explicitly preserves CLAUDE.md, meaning existing installations will NOT automatically get the new "Workflow-First Development" section on update. Only new installations (via `isdlc init`) will get the template. This is a **design consideration** for Phase 03 Architecture -- should `isdlc update` offer to refresh the Workflow-First section?

---

## Entry Points (M2)

### Primary Entry Points

| # | Entry Point | Type | Description | Implementation Priority |
|---|------------|------|-------------|------------------------|
| 1 | `CLAUDE.md` > `## Workflow-First Development` | System prompt section | Replace 10-line section with intent detection rules, consent protocol, intent-to-command mapping, edge case handling | **P1 -- Primary change** |
| 2 | `src/claude/CLAUDE.md.template` > `## Workflow-First Development` | Template section | Mirror the CLAUDE.md changes for new installations | **P1 -- Must match** |

### No New Entry Points Required

This feature does **not** require creating any new files. Both changes are modifications to existing sections in existing files. There are:

- **0** new agents needed
- **0** new hooks needed
- **0** new skills needed
- **0** new commands needed
- **0** new runtime code files

### Implementation Chain

```
1. Draft the new "## Workflow-First Development" section content
   |
2. Write to src/claude/CLAUDE.md.template (source of truth)
   |
3. Write the same section to CLAUDE.md (dogfooding copy, with project-specific additions if any)
   |
4. Verify NFR-02: Sections below "---" separator are unchanged
   |
5. Run existing tests to verify no regressions
   |
6. Behavioral validation (manual or prompt-based)
```

### Recommended Implementation Order

1. **Start with template** (`src/claude/CLAUDE.md.template`) -- this is the source of truth
2. **Copy to dogfooding** (`CLAUDE.md`) -- add project-specific context section after template content
3. **Validate format tests** -- run `npm test` to ensure prompt-format tests still pass
4. **Verify unchanged sections** -- diff pre/post to confirm Agent Framework Context, SKILL OBSERVABILITY, SUGGESTED PROMPTS, CONSTITUTIONAL PRINCIPLES are byte-identical

### Content Structure (New Section)

Based on the 5 FRs and 27 ACs, the new section needs these sub-sections:

```
## Workflow-First Development

### Intent Detection
- Feature intent signals (AC-01.1)
- Fix intent signals (AC-01.2)
- Upgrade intent signals (AC-01.3)
- Test run intent signals (AC-01.4)
- Test generate intent signals (AC-01.5)
- Discovery intent signals (AC-01.6)

### Consent Protocol
- Detection message format (AC-02.1, AC-02.2, AC-02.5)
- Confirmation handling (AC-02.3)
- Decline handling (AC-02.4)
- Plain language requirement (AC-05.2, AC-05.3)

### Intent-to-Command Mapping Table
- 6 mappings (AC-03.1 through AC-03.6)
- Slash command passthrough (AC-03.7)

### Edge Cases
- Ambiguous intent (AC-04.1)
- Non-development conversations (AC-04.2, AC-04.5)
- Active workflow protection (AC-04.3)
- Refactoring as feature (AC-04.4)

### Invisible Framework Principle
- No slash command suggestions (AC-05.1)
- User-terms language (AC-05.2, AC-05.3)
- Progress visibility preserved (AC-05.4)
- Discoverability on request (AC-05.5)
```

---

## Risk Assessment (M3)

### Risk Matrix

| # | Risk Area | Severity | Likelihood | Impact | Mitigation |
|---|-----------|----------|------------|--------|------------|
| R1 | **System prompt regression** -- changing CLAUDE.md could break existing Claude Code behavior | HIGH | LOW | HIGH | Only modify "Workflow-First Development" section; diff-verify unchanged sections |
| R2 | **Test false failures** -- prompt-format tests read CLAUDE.md and check for specific strings | MEDIUM | LOW | MEDIUM | Tests check for "Show project status" and "Start a new workflow" which are in UNCHANGED sections |
| R3 | **Intent detection false positives** -- new instructions may cause Claude to misinterpret non-dev conversations as dev intent | MEDIUM | MEDIUM | MEDIUM | Consent protocol (FR-02) acts as safety net; explicit passthrough rules (FR-04) |
| R4 | **Template/dogfooding drift** -- CLAUDE.md and template could get out of sync | MEDIUM | MEDIUM | LOW | NFR-04 requires identical Workflow-First section; implementation should copy-paste between files |
| R5 | **Update path gap** -- existing installations won't get new template on `isdlc update` | LOW | HIGH | LOW | Architectural decision for Phase 03; documented as known limitation |
| R6 | **Prompt token budget** -- expanding 10 lines to ~80 lines increases system prompt size | LOW | HIGH | LOW | CLAUDE.md is read once; ~70 extra lines (~500 tokens) is negligible |

### Test Coverage Analysis

| File | Existing Tests | Coverage | Gap |
|------|---------------|----------|-----|
| `CLAUDE.md` | `lib/prompt-format.test.js` -- TC-09-02, TC-09-03, TC-10-01 | Tests check for "Show project status", "Start a new workflow", CLAUDE.md references | No tests for "Workflow-First Development" section content |
| `src/claude/CLAUDE.md.template` | `lib/installer.test.js` -- checks CLAUDE.md creation | Tests check file exists after install, not content | No tests for template content |
| Intent detection behavior | None | 0% | No automated way to test prompt-level behavior |
| Consent protocol | None | 0% | No automated way to test prompt-level behavior |

### Complexity Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| Lines of code changed | **LOW** | ~10 lines removed, ~60-80 lines added (all markdown) |
| Number of files | **LOW** | 2 files |
| Cross-module impact | **NONE** | No runtime code affected |
| Test complexity | **LOW** | Existing tests unaffected; new tests optional |
| Architectural complexity | **LOW** | No new patterns, APIs, or data flows |
| Behavioral complexity | **MEDIUM** | Prompt engineering requires careful phrasing for reliable intent detection |

### Technical Debt Markers

| File | Debt | Relevance |
|------|------|-----------|
| `CLAUDE.md` | Dogfooding copy includes project-specific context that template does not | **MEDIUM** -- must ensure new section is identical between template and dogfooding, only Project Context section differs |
| `lib/updater.js` | Explicitly skips CLAUDE.md during updates | **LOW** -- by design, but means existing users won't get the invisible framework on update |

### Recommendations

1. **Add a template-consistency test** (Phase 05): Create a test that verifies the `## Workflow-First Development` section in `CLAUDE.md` matches `src/claude/CLAUDE.md.template` (after stripping project-specific content)
2. **Add edge-case behavioral tests** (Phase 05): Create prompt-format tests that verify the new section contains required keywords for each intent category
3. **Pre/post diff verification** (Phase 06): During implementation, capture a diff of CLAUDE.md before and after to verify only the Workflow-First section changed
4. **Consider update path** (Phase 03): Decide whether `isdlc update` should offer to refresh the Workflow-First section in existing installations

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: Template first (`src/claude/CLAUDE.md.template`), then dogfooding copy (`CLAUDE.md`), then test verification
2. **High-Risk Areas**: No high-risk code areas. The primary risk is prompt engineering quality (intent detection accuracy). The consent protocol (FR-02) provides a safety net.
3. **Dependencies to Resolve**: None -- all dependencies are read-only references that do not need changes
4. **Key Constraint**: The sections below `## Workflow-First Development` (Agent Framework Context, SKILL OBSERVABILITY, SUGGESTED PROMPTS, CONSTITUTIONAL PRINCIPLES) MUST remain byte-identical. Use automated diff to verify.

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-13T12:05:00Z",
  "sub_agents": ["M1-impact-analyzer", "M2-entry-point-finder", "M3-risk-assessor"],
  "requirements_document": "docs/requirements/REQ-0012-invisible-framework/requirements-spec.md",
  "quick_scan_used": null,
  "scope_change_from_original": "refined",
  "requirements_context": {
    "original_description": "Invisible framework -- CLAUDE.md rewrite so the framework auto-detects user intent from natural conversation, selects the appropriate iSDLC command, informs the user, gets consent, and invokes it automatically",
    "clarified_scope": "5 FRs (Intent Detection, Consent Protocol, Intent-to-Command Mapping, Edge Cases, Invisible Framework Principle), 4 NFRs (Reliability, Backward Compat, Maintainability, Template Consistency), 27 ACs, 11 user stories",
    "scope_change": "refined",
    "domain_keywords": ["intent-detection", "consent", "natural-language", "workflow", "invisible", "slash-commands"],
    "technical_keywords": ["CLAUDE.md", "system-prompt", "template", "markdown"],
    "acceptance_criteria_count": 27,
    "constraints": ["No runtime code changes", "No hook/agent/skill changes", "Template and dogfooding must match", "Unchanged sections must be byte-identical"]
  },
  "blast_radius": "low",
  "risk_level": "medium",
  "directly_affected_files": 2,
  "dependent_files": 6,
  "new_files_required": 0,
  "runtime_code_changes": 0
}
```
