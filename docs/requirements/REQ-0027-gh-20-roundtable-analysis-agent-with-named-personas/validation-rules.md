# Validation Rules: Roundtable Analysis Agent

**Feature ID**: REQ-ROUNDTABLE-ANALYST (GH-20)
**Phase**: 04-design
**Date**: 2026-02-19
**Traces**: FR-004, FR-005, FR-006, FR-012, NFR-005

---

## 1. Overview

This document defines all validation rules for data structures used by the roundtable analysis agent system. Three categories of validation are defined:

1. **Step File Validation** -- YAML frontmatter fields and body structure
2. **Meta.json Validation** -- schema, types, backward compatibility constraints
3. **Persona Definition Validation** -- structure within the roundtable-analyst.md agent file

Each rule has a unique ID (VR prefix), a severity indicating the consequence of violation, and a specification of when and where the validation is applied.

---

## 2. Step File Validation

### 2.1 Frontmatter Required Fields

These rules are applied at runtime by the roundtable agent when parsing step files during step discovery (see module-design-integration.md Section 5.1, Step 4).

#### VR-STEP-001: step_id Required

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-001 |
| **Field** | `step_id` |
| **Constraint** | Must be a non-empty string |
| **Format** | `"{PP}-{NN}"` where PP is a two-digit phase number and NN is a two-digit step number |
| **Regex** | `^[0-9]{2}-[0-9]{2}$` |
| **Examples** | `"00-01"`, `"01-03"`, `"04-05"` |
| **On Violation** | Skip step file (ERR-STEP-005). Do not add to steps_completed. |
| **Traces** | FR-012 AC-012-01 |

#### VR-STEP-002: title Required

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-002 |
| **Field** | `title` |
| **Constraint** | Must be a non-empty string, maximum 60 characters |
| **Examples** | `"User Needs Discovery"`, `"Blast Radius Assessment"` |
| **On Violation** | Skip step file (ERR-STEP-005) |
| **Traces** | FR-012 AC-012-01 |

#### VR-STEP-003: persona Required

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-003 |
| **Field** | `persona` |
| **Constraint** | Must be one of the allowed persona key values |
| **Allowed Values** | `"business-analyst"`, `"solutions-architect"`, `"system-designer"` |
| **On Violation** | Skip step file (ERR-STEP-006) |
| **Traces** | FR-012 AC-012-01 |

#### VR-STEP-004: depth Required

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-004 |
| **Field** | `depth` |
| **Constraint** | Must be one of the allowed depth values |
| **Allowed Values** | `"brief"`, `"standard"`, `"deep"` |
| **On Violation** | Skip step file (ERR-STEP-006) |
| **Traces** | FR-012 AC-012-01 |

#### VR-STEP-005: outputs Required

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-005 |
| **Field** | `outputs` |
| **Constraint** | Must be a non-empty array of strings |
| **Element format** | Non-empty strings representing artifact filenames |
| **Examples** | `["requirements-spec.md"]`, `["impact-analysis.md"]`, `["requirements-spec.md", "nfr-matrix.md"]` |
| **On Violation** | Skip step file (ERR-STEP-005) |
| **Traces** | FR-012 AC-012-01 |

### 2.2 Frontmatter Optional Fields

#### VR-STEP-006: depends_on Type

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-006 |
| **Field** | `depends_on` |
| **Constraint** | If present, must be an array of strings. Each string should match the step_id format. |
| **Default** | `[]` (when absent) |
| **On Violation** | Ignore the field, treat as `[]`. Log warning: "Invalid depends_on in {filename}. Ignoring." |
| **Traces** | FR-012 AC-012-02 |

#### VR-STEP-007: skip_if Type

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-007 |
| **Field** | `skip_if` |
| **Constraint** | If present, must be a string (evaluable expression or empty string) |
| **Default** | `""` (when absent, meaning never skip) |
| **On Violation** | Ignore the field, treat as `""`. Log warning: "Invalid skip_if in {filename}. Ignoring." |
| **Traces** | FR-012 AC-012-02 |

### 2.3 Frontmatter Cross-Field Validation

#### VR-STEP-008: step_id Matches File Location

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-008 |
| **Field** | `step_id` cross-referenced with file path |
| **Constraint** | The phase portion of step_id (first two digits) must match the parent directory's phase number. The step portion (last two digits) must match the filename's numeric prefix. |
| **Example** | File `analysis-steps/01-requirements/03-ux-journey.md` must have `step_id: "01-03"` |
| **On Violation** | WARNING only (logged, not a skip). The step executes but the inconsistency is flagged for the framework maintainer. |
| **Traces** | CON-005, module-design-step-files Section 2.4 |

#### VR-STEP-009: step_id Uniqueness

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-009 |
| **Field** | `step_id` across all step files |
| **Constraint** | No two step files across any phase directory may have the same step_id |
| **Enforcement** | At runtime during step discovery. If duplicates are found, the second occurrence is skipped with a warning. |
| **On Violation** | Skip duplicate step file (WARNING). The first occurrence (in lexicographic order) is used. |
| **Traces** | FR-012 AC-012-01 ("globally unique") |

### 2.4 Body Structure Validation

#### VR-STEP-010: Required Body Sections

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-010 |
| **Sections** | `## Brief Mode`, `## Standard Mode`, `## Deep Mode`, `## Validation`, `## Artifacts` |
| **Constraint** | All five sections SHOULD be present. `## Standard Mode` MUST be present. |
| **On Violation** | |
| | `## Standard Mode` missing: WARNING. Step still executes using raw body content as fallback. |
| | Other section missing: INFO. Fallback chain applies (see module-design-step-files Section 3.6). |
| **Traces** | FR-012 AC-012-03 |

#### VR-STEP-011: Brief Mode Content Structure

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-011 |
| **Section** | `## Brief Mode` |
| **Constraint** | Should contain a draft summary or confirmation prompt. Should be concise (under 5 paragraphs). Should present conclusions for confirmation, not open-ended questions. |
| **Enforcement** | Authoring-time guideline only. No runtime validation. |
| **Traces** | FR-004 AC-004-05, NFR-006 AC-NFR-006-03 |

#### VR-STEP-012: Standard Mode Content Structure

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-012 |
| **Section** | `## Standard Mode` |
| **Constraint** | Should contain 2-3 focused questions. Questions should be open-ended and domain-focused. Should include follow-up guidance. |
| **Enforcement** | Authoring-time guideline only. No runtime validation. |
| **Traces** | FR-012 AC-012-03, NFR-006 AC-NFR-006-01 |

#### VR-STEP-013: Deep Mode Content Structure

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-013 |
| **Section** | `## Deep Mode` |
| **Constraint** | Should contain 4-6 questions covering multiple angles. Should include edge cases, failure modes, and cross-cutting concerns. |
| **Enforcement** | Authoring-time guideline only. No runtime validation. |
| **Traces** | FR-004 AC-004-06 |

#### VR-STEP-014: Validation Section Content

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-014 |
| **Section** | `## Validation` |
| **Constraint** | Should contain a bulleted list of criteria. Each criterion should be verifiable against the user's responses. |
| **Enforcement** | Authoring-time guideline. The roundtable agent uses these criteria as guidance, not rigid pass/fail checks. |
| **Traces** | FR-012 AC-012-03 |

#### VR-STEP-015: Artifacts Section Content

| Property | Value |
|----------|-------|
| **Rule ID** | VR-STEP-015 |
| **Section** | `## Artifacts` |
| **Constraint** | Should reference artifact filenames from the `outputs` frontmatter field. Should specify which section of the artifact to update. Should describe the content to derive from the conversation. |
| **Enforcement** | Authoring-time guideline. Runtime behavior: the roundtable agent follows these instructions to write artifacts. |
| **Traces** | FR-012 AC-012-04 |

---

## 3. Meta.json Validation

These rules are applied by `readMetaJson()` in `three-verb-utils.cjs` at read time, and by `writeMetaJson()` at write time.

### 3.1 Existing Field Validation (Unchanged)

These rules already exist in the codebase and are unaffected by this feature:

| Rule ID | Field | Constraint | Default |
|---------|-------|-----------|---------|
| VR-META-001 | `analysis_status` | Must be a truthy string | `"raw"` |
| VR-META-002 | `phases_completed` | Must be an array | `[]` |
| VR-META-003 | `source` | Must be a truthy string | `"manual"` |
| VR-META-004 | `created_at` | Must be a truthy string | Current ISO timestamp |

### 3.2 New Field Validation (v3)

#### VR-META-005: steps_completed Type

| Property | Value |
|----------|-------|
| **Rule ID** | VR-META-005 |
| **Field** | `steps_completed` |
| **Constraint** | Must be an array. If absent or not an array, default to `[]`. |
| **Validation Code** | `if (!Array.isArray(raw.steps_completed)) { raw.steps_completed = []; }` |
| **Applied In** | `readMetaJson()` |
| **Traces** | FR-005 AC-005-04 |

#### VR-META-006: steps_completed Element Type

| Property | Value |
|----------|-------|
| **Rule ID** | VR-META-006 |
| **Field** | `steps_completed` elements |
| **Constraint** | Each element should be a string matching the step_id format (`^[0-9]{2}-[0-9]{2}$`). |
| **Enforcement** | Soft validation at read time by the roundtable agent (not by `readMetaJson()`). Invalid entries are ignored during the skip-completed filter. |
| **On Violation** | Invalid entries are silently ignored. They do not cause step skipping. |
| **Traces** | FR-005 |

#### VR-META-007: depth_overrides Type

| Property | Value |
|----------|-------|
| **Rule ID** | VR-META-007 |
| **Field** | `depth_overrides` |
| **Constraint** | Must be a plain object (not null, not an array, not a primitive). If invalid, default to `{}`. |
| **Validation Code** | `if (typeof raw.depth_overrides !== 'object' \|\| raw.depth_overrides === null \|\| Array.isArray(raw.depth_overrides)) { raw.depth_overrides = {}; }` |
| **Applied In** | `readMetaJson()` |
| **Traces** | FR-006 AC-006-06 |

#### VR-META-008: depth_overrides Value Type

| Property | Value |
|----------|-------|
| **Rule ID** | VR-META-008 |
| **Field** | `depth_overrides` values |
| **Constraint** | Each value should be one of `"brief"`, `"standard"`, `"deep"`. Keys should be valid phase keys. |
| **Enforcement** | Soft validation by the roundtable agent at depth determination time. Invalid values are ignored (fall through to quick-scan mapping). |
| **On Violation** | Invalid override is ignored (ERR-DEPTH-002). Depth determined from quick-scan or default. |
| **Traces** | FR-006 |

### 3.3 Backward Compatibility Rules

#### VR-META-BC-001: New Fields Absent in Old Files

| Property | Value |
|----------|-------|
| **Rule ID** | VR-META-BC-001 |
| **Constraint** | meta.json files created before GH-20 will not have `steps_completed` or `depth_overrides`. `readMetaJson()` must handle their absence gracefully. |
| **Validation** | `readMetaJson()` defaults missing fields to `[]` and `{}` respectively. |
| **Test** | Test case 1 and 2 in test-three-verb-utils-steps.test.cjs |
| **Traces** | NFR-005 AC-NFR-005-03 |

#### VR-META-BC-002: Write Preserves New Fields

| Property | Value |
|----------|-------|
| **Rule ID** | VR-META-BC-002 |
| **Constraint** | `writeMetaJson()` must not strip `steps_completed` or `depth_overrides` from the meta object during write. |
| **Validation** | `writeMetaJson()` uses `JSON.stringify(meta, null, 2)` which serializes all properties. The only field explicitly deleted is `phase_a_completed` (legacy). |
| **Test** | Test cases 8 and 9 in test-three-verb-utils-steps.test.cjs |
| **Traces** | FR-005 AC-005-05, NFR-005 AC-NFR-005-02 |

#### VR-META-BC-003: Write Without New Fields

| Property | Value |
|----------|-------|
| **Rule ID** | VR-META-BC-003 |
| **Constraint** | `writeMetaJson()` must succeed even when `steps_completed` and `depth_overrides` are absent from the input meta object (old consumers may not include them). |
| **Validation** | No explicit check needed. `JSON.stringify()` simply omits undefined properties. On next read, `readMetaJson()` defaults them. |
| **Test** | Test case 10 in test-three-verb-utils-steps.test.cjs |
| **Traces** | NFR-005 AC-NFR-005-04 |

#### VR-META-BC-004: analysis_status Derivation Independent

| Property | Value |
|----------|-------|
| **Rule ID** | VR-META-BC-004 |
| **Constraint** | The `analysis_status` derivation in `writeMetaJson()` must continue to derive from `phases_completed` only, NOT from `steps_completed`. Step-level granularity must not affect the phase-level status used by the build verb. |
| **Validation** | Code inspection: `writeMetaJson()` reads `(meta.phases_completed \|\| []).filter(p => ANALYSIS_PHASES.includes(p)).length` -- no reference to `steps_completed`. |
| **Traces** | NFR-005 AC-NFR-005-02 |

---

## 4. Persona Definition Validation

These rules apply to persona definitions within `src/claude/agents/roundtable-analyst.md`. They are authoring-time constraints enforced by code review, not runtime validation.

#### VR-PERSONA-001: Persona Name Required

| Property | Value |
|----------|-------|
| **Rule ID** | VR-PERSONA-001 |
| **Constraint** | Each persona definition must include a human name (non-empty string) |
| **Examples** | "Maya Chen", "Alex Rivera", "Jordan Park" |
| **Enforcement** | Code review |
| **Traces** | FR-002 AC-002-01 through AC-002-03 |

#### VR-PERSONA-002: Identity Statement Required

| Property | Value |
|----------|-------|
| **Rule ID** | VR-PERSONA-002 |
| **Constraint** | Each persona must have a one-line identity statement in first person |
| **Format** | "I'm {name}, your {role}. {brief description of focus}." |
| **Enforcement** | Code review |
| **Traces** | FR-002 AC-002-01 through AC-002-03 |

#### VR-PERSONA-003: Communication Style Required

| Property | Value |
|----------|-------|
| **Rule ID** | VR-PERSONA-003 |
| **Constraint** | Each persona must have a communication style descriptor (comma-separated adjectives describing the persona's interaction approach) |
| **Examples** | "Probing, detail-oriented, challenges assumptions", "Strategic, tradeoff-focused, risk-aware" |
| **Enforcement** | Code review |
| **Traces** | FR-002 AC-002-01 through AC-002-03 |

#### VR-PERSONA-004: Minimum Three Principles

| Property | Value |
|----------|-------|
| **Rule ID** | VR-PERSONA-004 |
| **Constraint** | Each persona must define at least 3 guiding principles, each with a bold title and description |
| **Format** | Numbered list, each item: `N. **{Title}**: {Description}` |
| **Enforcement** | Code review |
| **Traces** | FR-002 AC-002-01 through AC-002-03 |

#### VR-PERSONA-005: Persona Key Consistency

| Property | Value |
|----------|-------|
| **Rule ID** | VR-PERSONA-005 |
| **Constraint** | Each persona's key (used in step file `persona` field and phase mapping table) must be one of the three allowed values: `"business-analyst"`, `"solutions-architect"`, `"system-designer"` |
| **Enforcement** | Code review + runtime validation in step file parsing (VR-STEP-003) |
| **Traces** | FR-003 |

#### VR-PERSONA-006: Phase Mapping Completeness

| Property | Value |
|----------|-------|
| **Rule ID** | VR-PERSONA-006 |
| **Constraint** | The Phase-to-Persona Mapping table must include all 5 analysis phase keys: `00-quick-scan`, `01-requirements`, `02-impact-analysis`, `03-architecture`, `04-design` |
| **Enforcement** | Code review |
| **Traces** | FR-003 AC-003-01 through AC-003-05 |

#### VR-PERSONA-007: Phase Mapping Single Persona

| Property | Value |
|----------|-------|
| **Rule ID** | VR-PERSONA-007 |
| **Constraint** | Each phase key in the mapping table maps to exactly one persona. No phase has multiple personas. |
| **Enforcement** | Code review |
| **Traces** | FR-003 "map each analysis phase to exactly one persona" |

---

## 5. Validation Rule Summary

### 5.1 Runtime Validated (by code at execution time)

| Rule ID | Component | Severity | Enforcement Point |
|---------|-----------|----------|-------------------|
| VR-STEP-001 | Step frontmatter | Skip step | roundtable-analyst, step discovery |
| VR-STEP-002 | Step frontmatter | Skip step | roundtable-analyst, step discovery |
| VR-STEP-003 | Step frontmatter | Skip step | roundtable-analyst, step discovery |
| VR-STEP-004 | Step frontmatter | Skip step | roundtable-analyst, step discovery |
| VR-STEP-005 | Step frontmatter | Skip step | roundtable-analyst, step discovery |
| VR-STEP-006 | Step frontmatter | Ignore field | roundtable-analyst, step discovery |
| VR-STEP-007 | Step frontmatter | Ignore field | roundtable-analyst, step discovery |
| VR-STEP-008 | Step frontmatter | Warning | roundtable-analyst, step discovery |
| VR-STEP-009 | Step frontmatter | Skip duplicate | roundtable-analyst, step discovery |
| VR-STEP-010 | Step body | Fallback chain | roundtable-analyst, step execution |
| VR-META-005 | meta.json | Default to `[]` | `readMetaJson()` |
| VR-META-006 | meta.json | Silently ignore | roundtable-analyst, skip filter |
| VR-META-007 | meta.json | Default to `{}` | `readMetaJson()` |
| VR-META-008 | meta.json | Ignore invalid | roundtable-analyst, depth logic |

### 5.2 Authoring-Time Validated (by code review)

| Rule ID | Component | Enforcement |
|---------|-----------|-------------|
| VR-STEP-011 | Step body (Brief Mode) | Code review |
| VR-STEP-012 | Step body (Standard Mode) | Code review |
| VR-STEP-013 | Step body (Deep Mode) | Code review |
| VR-STEP-014 | Step body (Validation) | Code review |
| VR-STEP-015 | Step body (Artifacts) | Code review |
| VR-PERSONA-001 | Persona definition | Code review |
| VR-PERSONA-002 | Persona definition | Code review |
| VR-PERSONA-003 | Persona definition | Code review |
| VR-PERSONA-004 | Persona definition | Code review |
| VR-PERSONA-005 | Persona definition | Code review + runtime |
| VR-PERSONA-006 | Phase mapping | Code review |
| VR-PERSONA-007 | Phase mapping | Code review |

### 5.3 Test Validated (by automated tests)

| Rule ID | Component | Test File |
|---------|-----------|-----------|
| VR-META-BC-001 | meta.json backward compat | test-three-verb-utils-steps.test.cjs (cases 1-2) |
| VR-META-BC-002 | meta.json write preservation | test-three-verb-utils-steps.test.cjs (cases 8-9) |
| VR-META-BC-003 | meta.json write without fields | test-three-verb-utils-steps.test.cjs (case 10) |
| VR-META-BC-004 | analysis_status derivation | test-three-verb-utils-steps.test.cjs (implicit) |

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.0 | 2026-02-19 | System Designer (Phase 04) | Initial validation rules |
