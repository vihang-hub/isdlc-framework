# Technical Debt Assessment -- REQ-0021 T7 Agent Prompt Boilerplate Extraction

**Date**: 2026-02-17
**Phase**: 08-code-review
**Workflow**: Feature (REQ-0021 -- T7 Agent Prompt Boilerplate Extraction)

---

## 1. Technical Debt Resolved by This Feature

### TD-RESOLVED-01: Agent Prompt Duplication (Major)

**Previous state**: 4 categories of boilerplate protocols were duplicated across 26-29 agent files (~255 lines of total duplication). Updating any shared protocol required modifying up to 26 files, risking drift and inconsistency.
**Resolution**: Extracted all 4 categories into 5 shared sections in CLAUDE.md. Each agent now uses a 1-line reference.
**Impact**: Maintenance burden reduced from N files to 1 file. Drift risk eliminated. 100% duplication removed.

### TD-RESOLVED-02: Monorepo Blockquote Variant Drift (Minor)

**Previous state**: 3 different wordings of the monorepo mode guidance existed across agents (full form, short form, orchestrator-specific). While semantically equivalent, the variation made it unclear which was canonical.
**Resolution**: All 3 variants are now documented in a single CLAUDE.md section with explicit "full form" and "analysis-scoped form" labels. Agents reference the appropriate form.
**Impact**: Canonical wording established. No more ambiguity about which variant to use.

### TD-RESOLVED-03: Orchestrator Protocol Duplication (Medium)

**Previous state**: ROOT RESOLUTION (5 steps, ~10 lines) and MONOREPO CONTEXT RESOLUTION (~55 lines including path routing table and delegation template) were duplicated in both `00-sdlc-orchestrator.md` and `discover-orchestrator.md`. Changes to resolution logic required updating both files.
**Resolution**: Extracted to CLAUDE.md. Both orchestrators now reference the same shared protocol.
**Impact**: Resolution protocol has a single source of truth. Risk of orchestrator divergence eliminated.

## 2. Technical Debt Introduced (New)

### TD-NEW-01: CLAUDE.md Size Growth (Low)

**Location**: `/CLAUDE.md`
**Description**: CLAUDE.md grew from ~149 to 252 lines. Every agent delegation now loads 252 lines of project instructions regardless of which protocols it uses. Agents that do not use monorepo mode (most in single-project installations) still load the monorepo sections.
**Risk**: Low -- 103 lines is modest. Claude Code context windows are large. Token cost is fractional.
**Remediation**: If CLAUDE.md continues growing in future features, consider a table-of-contents approach or conditional loading (would require Claude Code runtime support).
**Recommendation**: Monitor. Set an informal budget alert at 400 lines.

### TD-NEW-02: Implicit Coupling Between CLAUDE.md Section Names and Agent References (Low)

**Location**: 37 agent reference lines across 29 files
**Description**: Agent files reference CLAUDE.md sections by exact section name (e.g., "Mandatory Iteration Enforcement Protocol"). If a section is renamed in CLAUDE.md, the agent references become broken pointers. There is no automated validation that references resolve correctly.
**Risk**: Low -- section names are descriptive and unlikely to change. Any future section rename is a controlled refactoring task.
**Remediation cost**: Could add a CI check that greps agent files for reference patterns and validates they exist in CLAUDE.md.
**Recommendation**: Defer. The coupling is inherent to the centralization approach and accepted in the architecture ADR.

## 3. Pre-Existing Technical Debt (Observed, Not Introduced)

### TD-PRE-01: No Linter Configured

**Impact**: Cannot run automated style checks. Manual review required.
**Status**: Known. Tracked separately.

### TD-PRE-02: No Code Coverage Tool Configured

**Impact**: Cannot measure line/branch coverage automatically.
**Status**: Known. Tracked separately.

### TD-PRE-03: 4 Pre-Existing Test Failures

**Tests**: TC-E09 (agent count 48 vs actual 59), T43, TC-13-01 (agent file count), supervised_review (gate-blocker)
**Impact**: Low -- drift-related, not functionality bugs.
**Status**: Known and documented in previous Phase 16 quality reports.

## 4. Summary

| Category | Count | Details |
|----------|-------|---------|
| Debt resolved | 3 | Prompt duplication (major), monorepo variant drift (minor), orchestrator duplication (medium) |
| Debt introduced | 2 | CLAUDE.md size growth (low), implicit name coupling (low) |
| Pre-existing debt | 3 | No linter, no coverage tool, test drift |
| **Net debt change** | **-1** | Resolved more than introduced; resolved items were higher severity |
