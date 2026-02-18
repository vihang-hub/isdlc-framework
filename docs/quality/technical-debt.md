# Technical Debt Inventory

**Project:** iSDLC Framework
**Workflow:** BUG-0011-GH-15
**Date:** 2026-02-18

---

## New Technical Debt Introduced

**None significant.** Two minor advisory items documented below, neither requiring immediate action.

### TD-NEW-01: Heading Level Inconsistency (Low)
**Location:** `src/claude/agents/16-quality-loop-engineer.md` (line 548)
**Description:** Uses `### Skills` (H3) instead of `## Skills` (H2) used by all other 51 agents. Also changed `## SUGGESTED PROMPTS` to `# SUGGESTED PROMPTS` (H1).
**Impact:** Cosmetic only. Does not affect runtime behavior.
**Recommendation:** Fix heading levels in a mechanical cleanup pass. Estimated effort: 1 minute.

### TD-NEW-02: Regex Edge Case with Empty Quoted Descriptions (Low)
**Location:** `src/claude/hooks/lib/common.cjs` (line 896)
**Description:** The YAML description regex does not handle `description: ""` (empty quotes) correctly -- returns `"` instead of null. No real SKILL.md files trigger this case.
**Impact:** Zero. All 242 SKILL.md descriptions are non-empty strings.
**Recommendation:** Add quote-stripping logic in a future hardening pass if needed.

## Debt Reduced by This Fix

| Item | Before | After |
|------|--------|-------|
| Skills architecture (dead weight) | 242 SKILL.md files (~56,900 lines) never injected into agent prompts | Skill index injected into delegation prompts via STEP 3d |
| Agent skill awareness | Agents unaware of their owned skills | Agents instructed to consult AVAILABLE SKILLS via Read tool |
| Hardcoded skill tables | ~8 agents had static skill tables in .md files | Tables replaced with dynamic injection instruction |

## Pre-Existing Technical Debt (Noted During Review)

### TD-01: Phase Numbering Inconsistency (Pre-existing, Low)
**Location:** `src/claude/agents/07-qa-engineer.md`
**Description:** The QA engineer agent file header references "Phase 07" and "GATE-07" but the phase key in workflows.json is `08-code-review`.
**Impact:** Low.
**Status:** Pre-existing, noted in previous reviews.

### TD-02: No Linter or Coverage Tool Configured (Pre-existing)
**Impact:** Cannot run automated style checks or measure line/branch coverage.
**Status:** Known and tracked separately.

### TD-03: 49 Pre-Existing Test Failures (Pre-existing)
**Tests:** workflow-finalizer (28), branch-guard (3), cleanupCompletedWorkflow (1), version-lock (1), writer-role (2), others
**Impact:** Low -- drift-related, not functionality bugs. The workflow-finalizer hook and cleanupCompletedWorkflow are not yet implemented.
**Status:** Known and documented in previous quality reports.

### TD-04: Skills Manifest JSON Not Auto-Generated (Pre-existing)
**Description:** `getAgentSkillIndex()` reads `skills-manifest.json` which is generated during `isdlc init`. In the development environment, the JSON manifest does not exist (only the YAML source at `.isdlc/config/skills-manifest.yaml`). The function correctly fails-open (returns empty array), but skills are not injected during local development without running init.
**Impact:** Low -- this is by design (installation creates the JSON). Tests create their own temp manifests.
**Status:** Working as intended.
