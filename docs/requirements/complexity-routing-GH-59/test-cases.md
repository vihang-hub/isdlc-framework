# Test Cases: Complexity-Based Routing (GH-59)

**Phase**: 05-test-strategy
**Generated**: 2026-02-20
**Framework**: Node.js built-in `node:test` + `node:assert/strict`
**Test File**: `src/claude/hooks/tests/test-three-verb-utils.test.cjs` (append to existing)
**Traces**: FR-001..FR-009, NFR-001..NFR-005, CON-001..CON-005

---

## Table of Contents

1. [Unit Tests: computeRecommendedTier()](#1-unit-tests-computerecommendedtier)
2. [Unit Tests: getTierDescription()](#2-unit-tests-gettierdescription)
3. [Unit Tests: Constants](#3-unit-tests-constants)
4. [Integration Tests: meta.json Tier Field Persistence](#4-integration-tests-metajson-tier-field-persistence)
5. [Integration Tests: Backward Compatibility](#5-integration-tests-backward-compatibility)
6. [Manual Tests: Analyze Handler](#6-manual-tests-analyze-handler)
7. [Manual Tests: Build Handler](#7-manual-tests-build-handler)
8. [Manual Tests: Trivial Execution Path](#8-manual-tests-trivial-execution-path)
9. [Manual Tests: User Agency and NFRs](#9-manual-tests-user-agency-and-nfrs)

---

## 1. Unit Tests: computeRecommendedTier()

### 1.1 Base Thresholds (AC-002a) -- 11 Tests

#### TC-CRT-001: Zero files maps to trivial
- **Traces**: AC-002a
- **Given** estimatedFiles is 0 and riskLevel is null
- **When** computeRecommendedTier(0, null) is called
- **Then** it returns "trivial"
- **Boundary**: Below lower bound

#### TC-CRT-002: 1 file with low risk maps to trivial
- **Traces**: AC-002a
- **Given** estimatedFiles is 1 and riskLevel is "low"
- **When** computeRecommendedTier(1, "low") is called
- **Then** it returns "trivial"
- **Boundary**: Within trivial range

#### TC-CRT-003: 2 files at trivial upper boundary (inclusive)
- **Traces**: AC-002a
- **Given** estimatedFiles is 2 and riskLevel is "low"
- **When** computeRecommendedTier(2, "low") is called
- **Then** it returns "trivial"
- **Boundary**: Trivial upper boundary (2 <= 2)

#### TC-CRT-004: 3 files just above trivial boundary
- **Traces**: AC-002a
- **Given** estimatedFiles is 3 and riskLevel is "low"
- **When** computeRecommendedTier(3, "low") is called
- **Then** it returns "light"
- **Boundary**: Just above trivial (3 > 2)

#### TC-CRT-005: 5 files in mid light range
- **Traces**: AC-002a
- **Given** estimatedFiles is 5 and riskLevel is "low"
- **When** computeRecommendedTier(5, "low") is called
- **Then** it returns "light"
- **Boundary**: Mid-range

#### TC-CRT-006: 8 files at light upper boundary (inclusive)
- **Traces**: AC-002a
- **Given** estimatedFiles is 8 and riskLevel is "low"
- **When** computeRecommendedTier(8, "low") is called
- **Then** it returns "light"
- **Boundary**: Light upper boundary (8 <= 8)

#### TC-CRT-007: 9 files just above light boundary
- **Traces**: AC-002a
- **Given** estimatedFiles is 9 and riskLevel is "low"
- **When** computeRecommendedTier(9, "low") is called
- **Then** it returns "standard"
- **Boundary**: Just above light (9 > 8)

#### TC-CRT-008: 15 files in mid standard range
- **Traces**: AC-002a
- **Given** estimatedFiles is 15 and riskLevel is "low"
- **When** computeRecommendedTier(15, "low") is called
- **Then** it returns "standard"
- **Boundary**: Mid-range

#### TC-CRT-009: 20 files at standard upper boundary (inclusive)
- **Traces**: AC-002a
- **Given** estimatedFiles is 20 and riskLevel is "low"
- **When** computeRecommendedTier(20, "low") is called
- **Then** it returns "standard"
- **Boundary**: Standard upper boundary (20 <= 20)

#### TC-CRT-010: 21 files just above standard boundary
- **Traces**: AC-002a
- **Given** estimatedFiles is 21 and riskLevel is "low"
- **When** computeRecommendedTier(21, "low") is called
- **Then** it returns "epic"
- **Boundary**: Just above standard (21 > 20)

#### TC-CRT-011: 100 files far above standard
- **Traces**: AC-002a
- **Given** estimatedFiles is 100 and riskLevel is "low"
- **When** computeRecommendedTier(100, "low") is called
- **Then** it returns "epic"
- **Boundary**: Well above all thresholds

### 1.2 Risk-Based Promotion (AC-002b) -- 11 Tests

#### TC-CRT-012: Trivial promoted to light for medium risk
- **Traces**: AC-002b
- **Given** estimatedFiles is 2 (trivial base) and riskLevel is "medium"
- **When** computeRecommendedTier(2, "medium") is called
- **Then** it returns "light" (promoted one level)

#### TC-CRT-013: Trivial promoted to light for high risk
- **Traces**: AC-002b
- **Given** estimatedFiles is 2 (trivial base) and riskLevel is "high"
- **When** computeRecommendedTier(2, "high") is called
- **Then** it returns "light" (promoted one level)
- **Note**: Per requirements, high risk with <=2 files returns "light", not "trivial"

#### TC-CRT-014: Light promoted to standard for medium risk
- **Traces**: AC-002b
- **Given** estimatedFiles is 5 (light base) and riskLevel is "medium"
- **When** computeRecommendedTier(5, "medium") is called
- **Then** it returns "standard" (promoted one level)

#### TC-CRT-015: Light at boundary promoted to standard for high risk
- **Traces**: AC-002b
- **Given** estimatedFiles is 8 (light upper boundary) and riskLevel is "high"
- **When** computeRecommendedTier(8, "high") is called
- **Then** it returns "standard" (promoted one level)

#### TC-CRT-016: Standard promoted to epic for medium risk
- **Traces**: AC-002b
- **Given** estimatedFiles is 15 (standard base) and riskLevel is "medium"
- **When** computeRecommendedTier(15, "medium") is called
- **Then** it returns "epic" (promoted one level)

#### TC-CRT-017: Standard at boundary promoted to epic for high risk
- **Traces**: AC-002b
- **Given** estimatedFiles is 20 (standard upper boundary) and riskLevel is "high"
- **When** computeRecommendedTier(20, "high") is called
- **Then** it returns "epic" (promoted one level)

#### TC-CRT-018: Epic not promoted beyond ceiling for high risk
- **Traces**: AC-002b
- **Given** estimatedFiles is 21 (epic base) and riskLevel is "high"
- **When** computeRecommendedTier(21, "high") is called
- **Then** it returns "epic" (ceiling, no further promotion)

#### TC-CRT-019: Epic not promoted for medium risk
- **Traces**: AC-002b
- **Given** estimatedFiles is 100 (epic) and riskLevel is "medium"
- **When** computeRecommendedTier(100, "medium") is called
- **Then** it returns "epic" (ceiling, no further promotion)

#### TC-CRT-020: Low risk does not trigger promotion
- **Traces**: AC-002b
- **Given** estimatedFiles is 2 (trivial base) and riskLevel is "low"
- **When** computeRecommendedTier(2, "low") is called
- **Then** it returns "trivial" (no promotion for low risk)

#### TC-CRT-021: Null risk does not trigger promotion
- **Traces**: AC-002b
- **Given** estimatedFiles is 5 (light base) and riskLevel is null
- **When** computeRecommendedTier(5, null) is called
- **Then** it returns "light" (no promotion for null risk)

#### TC-CRT-022: Undefined risk does not trigger promotion
- **Traces**: AC-002b
- **Given** estimatedFiles is 5 (light base) and riskLevel is undefined
- **When** computeRecommendedTier(5, undefined) is called
- **Then** it returns "light" (no promotion for undefined risk)

### 1.3 Invalid Input Handling (AC-002c) -- 7 Tests

All tests in this section verify that the function returns "standard" as a safe default AND emits a warning to stderr.

#### TC-CRT-023: Null estimatedFiles returns standard
- **Traces**: AC-002c
- **Given** estimatedFiles is null
- **When** computeRecommendedTier(null, "low") is called
- **Then** it returns "standard"
- **And** stderr contains "invalid estimatedFiles (null)"

#### TC-CRT-024: Undefined estimatedFiles returns standard
- **Traces**: AC-002c
- **Given** estimatedFiles is undefined
- **When** computeRecommendedTier(undefined, "low") is called
- **Then** it returns "standard"
- **And** stderr contains "invalid estimatedFiles (undefined)"

#### TC-CRT-025: NaN estimatedFiles returns standard
- **Traces**: AC-002c
- **Given** estimatedFiles is NaN
- **When** computeRecommendedTier(NaN, "low") is called
- **Then** it returns "standard"
- **And** stderr contains "invalid estimatedFiles (NaN)"

#### TC-CRT-026: Negative estimatedFiles returns standard
- **Traces**: AC-002c
- **Given** estimatedFiles is -1
- **When** computeRecommendedTier(-1, "low") is called
- **Then** it returns "standard"
- **And** stderr contains "invalid estimatedFiles (-1)"

#### TC-CRT-027: Large negative estimatedFiles returns standard
- **Traces**: AC-002c
- **Given** estimatedFiles is -5
- **When** computeRecommendedTier(-5, "low") is called
- **Then** it returns "standard"
- **And** stderr contains "invalid estimatedFiles (-5)"

#### TC-CRT-028: String estimatedFiles returns standard
- **Traces**: AC-002c
- **Given** estimatedFiles is "three" (string)
- **When** computeRecommendedTier("three", "low") is called
- **Then** it returns "standard"
- **And** stderr contains "invalid estimatedFiles (three)"

#### TC-CRT-029: Infinity estimatedFiles returns standard
- **Traces**: AC-002c
- **Given** estimatedFiles is Infinity
- **When** computeRecommendedTier(Infinity, "low") is called
- **Then** it returns "standard"
- **And** stderr contains "invalid estimatedFiles (Infinity)"

### 1.4 Unrecognized riskLevel (AC-002d) -- 4 Tests

All tests verify that the function treats the unrecognized risk as "low" (no promotion) AND emits a warning to stderr.

#### TC-CRT-030: "critical" treated as low
- **Traces**: AC-002d
- **Given** estimatedFiles is 2 and riskLevel is "critical"
- **When** computeRecommendedTier(2, "critical") is called
- **Then** it returns "trivial" (no promotion, treated as low)
- **And** stderr contains "unrecognized riskLevel (critical)"

#### TC-CRT-031: "MEDIUM" (wrong case) treated as low
- **Traces**: AC-002d
- **Given** estimatedFiles is 5 and riskLevel is "MEDIUM"
- **When** computeRecommendedTier(5, "MEDIUM") is called
- **Then** it returns "light" (no promotion, case-sensitive)
- **And** stderr contains "unrecognized riskLevel (MEDIUM)"

#### TC-CRT-032: Empty string treated as low
- **Traces**: AC-002d
- **Given** estimatedFiles is 5 and riskLevel is ""
- **When** computeRecommendedTier(5, "") is called
- **Then** it returns "light" (no promotion)
- **And** stderr contains "unrecognized riskLevel ()"

#### TC-CRT-033: Arbitrary unknown string treated as low
- **Traces**: AC-002d
- **Given** estimatedFiles is 5 and riskLevel is "extreme"
- **When** computeRecommendedTier(5, "extreme") is called
- **Then** it returns "light" (no promotion)
- **And** stderr contains "unrecognized riskLevel (extreme)"

### 1.5 Custom Thresholds (CON-002) -- 8 Tests

#### TC-CRT-034: Custom thresholds {3, 10, 25} -- mid light range
- **Traces**: CON-002
- **Given** estimatedFiles is 5, riskLevel is "low", thresholds are {trivial_max_files: 3, light_max_files: 10, standard_max_files: 25}
- **When** computeRecommendedTier(5, "low", {3, 10, 25}) is called
- **Then** it returns "light" (5 <= 10)

#### TC-CRT-035: Custom thresholds -- at trivial boundary
- **Traces**: CON-002
- **Given** estimatedFiles is 3, riskLevel is "low", thresholds are {3, 10, 25}
- **When** computeRecommendedTier(3, "low", {3, 10, 25}) is called
- **Then** it returns "trivial" (3 <= 3)

#### TC-CRT-036: Custom thresholds -- just above trivial
- **Traces**: CON-002
- **Given** estimatedFiles is 4, riskLevel is "low", thresholds are {3, 10, 25}
- **When** computeRecommendedTier(4, "low", {3, 10, 25}) is called
- **Then** it returns "light" (4 > 3, 4 <= 10)

#### TC-CRT-037: Custom thresholds -- within standard range
- **Traces**: CON-002
- **Given** estimatedFiles is 22, riskLevel is "low", thresholds are {3, 10, 25}
- **When** computeRecommendedTier(22, "low", {3, 10, 25}) is called
- **Then** it returns "standard" (22 <= 25)

#### TC-CRT-038: Custom thresholds -- above standard (epic)
- **Traces**: CON-002
- **Given** estimatedFiles is 26, riskLevel is "low", thresholds are {3, 10, 25}
- **When** computeRecommendedTier(26, "low", {3, 10, 25}) is called
- **Then** it returns "epic" (26 > 25)

#### TC-CRT-039: Null thresholds fallback to defaults
- **Traces**: CON-002
- **Given** estimatedFiles is 5, riskLevel is "low", thresholds is null
- **When** computeRecommendedTier(5, "low", null) is called
- **Then** it returns "light" (uses default: 5 <= 8)

#### TC-CRT-040: Undefined thresholds fallback to defaults
- **Traces**: CON-002
- **Given** estimatedFiles is 5, riskLevel is "low", thresholds is undefined
- **When** computeRecommendedTier(5, "low", undefined) is called
- **Then** it returns "light" (uses default: 5 <= 8)

#### TC-CRT-041: Partial thresholds -- missing fields use defaults
- **Traces**: CON-002
- **Given** estimatedFiles is 5, riskLevel is "low", thresholds is {trivial_max_files: 1}
- **When** computeRecommendedTier(5, "low", {trivial_max_files: 1}) is called
- **Then** it returns "light" (trivial_max=1, light_max=8 from default, 5 <= 8)

---

## 2. Unit Tests: getTierDescription()

### 2.1 Valid Tier Inputs (AC-009a) -- 4 Tests

#### TC-GTD-001: Trivial tier returns correct description
- **Traces**: AC-009a
- **Given** tier is "trivial"
- **When** getTierDescription("trivial") is called
- **Then** it returns { label: "Trivial", description: "direct edit, no workflow", fileRange: "1-2 files" }

#### TC-GTD-002: Light tier returns correct description
- **Traces**: AC-009a
- **Given** tier is "light"
- **When** getTierDescription("light") is called
- **Then** it returns { label: "Light", description: "skip architecture and design", fileRange: "3-8 files" }

#### TC-GTD-003: Standard tier returns correct description
- **Traces**: AC-009a
- **Given** tier is "standard"
- **When** getTierDescription("standard") is called
- **Then** it returns { label: "Standard", description: "full workflow", fileRange: "9-20 files" }

#### TC-GTD-004: Epic tier returns correct description
- **Traces**: AC-009a
- **Given** tier is "epic"
- **When** getTierDescription("epic") is called
- **Then** it returns { label: "Epic", description: "full workflow with decomposition", fileRange: "20+ files" }

### 2.2 Invalid/Unknown Tier Inputs (AC-009b) -- 5 Tests

#### TC-GTD-005: Unknown tier string returns Unknown
- **Traces**: AC-009b
- **Given** tier is "unknown-tier"
- **When** getTierDescription("unknown-tier") is called
- **Then** it returns { label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }

#### TC-GTD-006: Null tier returns Unknown
- **Traces**: AC-009b
- **Given** tier is null
- **When** getTierDescription(null) is called
- **Then** it returns { label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }

#### TC-GTD-007: Undefined tier returns Unknown
- **Traces**: AC-009b
- **Given** tier is undefined
- **When** getTierDescription(undefined) is called
- **Then** it returns { label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }

#### TC-GTD-008: Empty string tier returns Unknown
- **Traces**: AC-009b
- **Given** tier is ""
- **When** getTierDescription("") is called
- **Then** it returns { label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }

#### TC-GTD-009: Non-string input (number) returns Unknown
- **Traces**: AC-009b
- **Given** tier is 42 (a number)
- **When** getTierDescription(42) is called
- **Then** it returns { label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }

### 2.3 Mutation Safety -- 1 Test

#### TC-GTD-010: Returned objects are independent copies
- **Traces**: AD-01
- **Given** getTierDescription("trivial") is called and the returned object is mutated (label set to "MUTATED")
- **When** getTierDescription("trivial") is called again
- **Then** the second return has label "Trivial" (lookup table not corrupted)

### 2.4 Additional Type Guards (AC-009b) -- 2 Tests

#### TC-GTD-011: Boolean input returns Unknown
- **Traces**: AC-009b
- **Given** tier is true (boolean)
- **When** getTierDescription(true) is called
- **Then** it returns { label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }

#### TC-GTD-012: Array input returns Unknown
- **Traces**: AC-009b
- **Given** tier is ["trivial"] (array)
- **When** getTierDescription(["trivial"]) is called
- **Then** it returns { label: "Unknown", description: "unrecognized tier", fileRange: "unknown" }

---

## 3. Unit Tests: Constants

#### TC-CONST-001: TIER_ORDER contains exactly 4 tiers in correct order
- **Traces**: FR-002, AD-01
- **Given** TIER_ORDER is exported from three-verb-utils.cjs
- **When** TIER_ORDER is inspected
- **Then** it deeply equals ['trivial', 'light', 'standard', 'epic']

#### TC-CONST-002: DEFAULT_TIER_THRESHOLDS has correct values
- **Traces**: CON-002
- **Given** DEFAULT_TIER_THRESHOLDS is exported from three-verb-utils.cjs
- **When** DEFAULT_TIER_THRESHOLDS is inspected
- **Then** it deeply equals { trivial_max_files: 2, light_max_files: 8, standard_max_files: 20 }

#### TC-CONST-003: TIER_DESCRIPTIONS keys match TIER_ORDER
- **Traces**: FR-009, AD-01
- **Given** TIER_DESCRIPTIONS and TIER_ORDER are exported
- **When** Object.keys(TIER_DESCRIPTIONS) is compared against TIER_ORDER
- **Then** every tier in TIER_ORDER has a corresponding key in TIER_DESCRIPTIONS

---

## 4. Integration Tests: meta.json Tier Field Persistence

All integration tests use the existing `createTestDir()` / `createSlugDir()` / `cleanupTestDir()` helpers.

#### TC-INT-001: Write and read recommended_tier
- **Traces**: AC-003a
- **Given** a slug directory with a meta.json containing `recommended_tier: "light"`
- **When** `writeMetaJson(slugDir, meta)` is called and then `readMetaJson(slugDir)` reads it back
- **Then** the returned meta has `recommended_tier` equal to "light"

#### TC-INT-002: Write and read tier_used
- **Traces**: AC-007c
- **Given** a slug directory with a meta.json containing `tier_used: "trivial"`
- **When** meta.json is written and read back
- **Then** the returned meta has `tier_used` equal to "trivial"

#### TC-INT-003: Write and read tier_override object
- **Traces**: AC-005e
- **Given** a slug directory with a meta.json containing `tier_override: { recommended: "light", selected: "standard", overridden_at: "2026-02-20T10:00:00Z" }`
- **When** meta.json is written and read back
- **Then** the returned meta has `tier_override.recommended` equal to "light", `tier_override.selected` equal to "standard", and `tier_override.overridden_at` equal to "2026-02-20T10:00:00Z"

#### TC-INT-004: Write and read last_trivial_change object
- **Traces**: AC-007c
- **Given** a slug directory with a meta.json containing `last_trivial_change: { completed_at: "2026-02-20T10:20:00Z", commit_sha: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2", files_modified: ["src/foo.js"] }`
- **When** meta.json is written and read back
- **Then** the returned meta has all `last_trivial_change` fields preserved correctly

#### TC-INT-005: Overwrite recommended_tier on re-analysis
- **Traces**: AC-003c
- **Given** a meta.json with `recommended_tier: "light"` is written
- **When** the meta is updated to `recommended_tier: "standard"` and written again
- **Then** reading back yields `recommended_tier` equal to "standard" (overwritten, not appended)

#### TC-INT-006: Read legacy meta.json without tier fields -- no error
- **Traces**: AC-003b, AC-NFR-002a
- **Given** a meta.json written with only legacy fields (source, slug, created_at, phases_completed) and NO `recommended_tier`
- **When** `readMetaJson(slugDir)` is called
- **Then** no error is thrown and `meta.recommended_tier` is `undefined`

#### TC-INT-007: Read legacy meta.json without tier_override or tier_used
- **Traces**: AC-NFR-002b
- **Given** a meta.json with only legacy fields and NO `tier_override` or `tier_used`
- **When** `readMetaJson(slugDir)` is called
- **Then** `meta.tier_override` is `undefined` and `meta.tier_used` is `undefined`, no error thrown

---

## 5. Integration Tests: Backward Compatibility

#### TC-BC-001: computeStartPhase unchanged with no tier fields
- **Traces**: AC-NFR-002c
- **Given** a legacy meta.json with `phases_completed: ["00-quick-scan", "01-requirements"]` and NO tier fields
- **When** `computeStartPhase(meta, featurePhases)` is called
- **Then** it returns the same result as it did before GH-59 (status: "partial", correct startPhase)

#### TC-BC-002: computeStartPhase unchanged with tier fields present
- **Traces**: AC-NFR-002c
- **Given** a meta.json with `phases_completed: ["00-quick-scan", "01-requirements"]` AND `recommended_tier: "light"`
- **When** `computeStartPhase(meta, featurePhases)` is called
- **Then** the result is identical to TC-BC-001 (tier fields do not interfere)

#### TC-BC-003: writeMetaJson with empty meta does not inject tier fields
- **Traces**: NFR-002
- **Given** an empty meta object `{}`
- **When** `writeMetaJson(slugDir, {})` is called and the file is read back
- **Then** the JSON does not contain `recommended_tier`, `tier_used`, `tier_override`, or `last_trivial_change` keys

---

## 6. Manual Tests: Analyze Handler

#### MT-001: Tier displayed after analysis completes
- **Traces**: AC-004a
- **Given** a fully analyzed item (all 5 analysis phases complete) with `recommended_tier: "light"` in meta.json
- **When** the analyze handler runs step 8
- **Then** the output includes:
  ```
  Analysis complete. {slug} is ready to build.
  Recommended tier: light -- skip architecture and design
  ```

#### MT-002: Tier line omitted for legacy meta.json
- **Traces**: AC-004b
- **Given** a legacy meta.json without `recommended_tier`
- **When** the analyze handler runs step 8
- **Then** the output shows "Analysis complete. {slug} is ready to build." with NO tier line and NO error

#### MT-003: Tier preserved through partial analysis resume
- **Traces**: AC-004c
- **Given** analysis ran through Phase 02 (which set recommended_tier in meta.json) then stopped
- **When** analysis is resumed and completes through Phase 04
- **Then** step 8 displays the tier that was set during Phase 02

---

## 7. Manual Tests: Build Handler

#### MT-004: Tier menu display with RECOMMENDED marker
- **Traces**: AC-005a
- **Given** meta.json contains `recommended_tier: "light"`
- **When** the build handler runs step 4a-tier
- **Then** the menu displays all 4 tiers with `<-- RECOMMENDED` on the light option and "Select tier [2]:" as prompt

#### MT-005: Default selection accepts recommended tier
- **Traces**: AC-005b
- **Given** the tier menu is displayed with recommended tier "light"
- **When** the user presses Enter without typing a number
- **Then** the build handler uses "light" tier

#### MT-006: No recommendation defaults to standard with warning
- **Traces**: AC-005c
- **Given** meta.json does NOT contain `recommended_tier`
- **When** the build handler runs step 4a-tier
- **Then** the output shows "No tier recommendation available. Defaulting to standard." and the menu shows no RECOMMENDED marker, with default at [3]

#### MT-007: Trivial selection routes to trivial path
- **Traces**: AC-005d
- **Given** the tier menu is displayed
- **When** the user selects [1] Trivial
- **Then** the trivial execution path (T1-T9) runs instead of creating a workflow

#### MT-008: Override recording in meta.json
- **Traces**: AC-005e, AC-008a, AC-008b, AC-008c
- **Given** recommended tier is "light"
- **When** the user selects [3] Standard (overrides recommendation)
- **Then** meta.json is updated with `tier_override: { recommended: "light", selected: "standard", overridden_at: "{timestamp}" }`

#### MT-009: User can select lower tier than recommended
- **Traces**: AC-008b
- **Given** recommended tier is "standard"
- **When** the user selects [1] Trivial
- **Then** the trivial execution path runs without blocking

#### MT-010: Epic placeholder routes to standard
- **Traces**: CON-003
- **Given** the tier menu is displayed
- **When** the user selects [4] Epic
- **Then** the output shows "Epic decomposition is not yet available. Running standard workflow." and the standard workflow begins

---

## 8. Manual Tests: Trivial Execution Path

#### MT-011: Trivial happy path -- full execution
- **Traces**: AC-006a, AC-006b, AC-006c, AC-006d, AC-007a, AC-007c
- **Given** the user selected trivial tier and requirements context exists
- **When** the framework assists with the edit and user confirms
- **Then**:
  - No workflow is created in state.json (AC-006a)
  - No git branch is created (AC-006a)
  - Requirements context is read (AC-006b)
  - Change is committed on current branch (AC-006c)
  - Completion summary is displayed (AC-006d)
  - change-record.md is created with date, tier, summary, files, SHA, diffs (AC-007a)
  - meta.json is updated with tier_used and last_trivial_change (AC-007c)

#### MT-012: Trivial append to existing change-record.md
- **Traces**: AC-007b
- **Given** a change-record.md already exists for this slug
- **When** a second trivial change completes
- **Then** the new entry is appended after a `---` separator, preserving the previous entry

#### MT-013: Trivial error handling -- no change record on failure
- **Traces**: AC-006e
- **Given** the trivial execution path is active
- **When** an error occurs (file not found, commit failure)
- **Then** the error is reported, no change-record.md is written, and the user sees retry/escalate/abort options

#### MT-014: Trivial BACKLOG.md marker update
- **Traces**: AC-007d
- **Given** a trivial change completes and the item is tracked in BACKLOG.md
- **When** the post-edit recording runs
- **Then** the BACKLOG.md marker is updated via updateBacklogMarker()

---

## 9. Manual Tests: User Agency and NFRs

#### MT-015: Tier menu always presented -- no auto-execute
- **Traces**: AC-NFR-001a
- **Given** a recommended_tier exists in meta.json
- **When** the build handler runs
- **Then** the tier menu is ALWAYS displayed and user input is waited for (never auto-executed)

#### MT-016: --trivial flag shows confirmation prompt
- **Traces**: AC-NFR-001b
- **Given** the `--trivial` flag is passed to the build command
- **When** the build handler processes the flag
- **Then** it displays "Trivial tier selected via flag. Proceed with direct edit? [Y/n]" (not silent execution)

#### MT-017: Audit trail records selection context
- **Traces**: AC-NFR-001c
- **Given** a tier is selected
- **When** the selection is processed
- **Then** the audit trail (meta.json) records whether the tier was selected by user, defaulted, or overridden

#### MT-018: Trivial state.json isolation
- **Traces**: AC-NFR-005a, AC-NFR-005b, AC-NFR-005c
- **Given** state.json exists with content before trivial execution
- **When** the trivial execution path runs from start to finish
- **Then**:
  - state.json is byte-identical before and after (AC-NFR-005a)
  - No phase-loop-controller, gate-blocker, or state-write-validator hooks fire (AC-NFR-005b)
  - No active_workflow entry exists for the trivial change (AC-NFR-005c)

#### MT-019: Trivial traceability -- change-record.md completeness
- **Traces**: AC-NFR-003a, AC-NFR-003b, AC-NFR-003c
- **Given** a trivial change was made
- **When** change-record.md is inspected
- **Then** it contains: what was changed, why, which files, commit SHA, date -- equivalent information to full workflow artifacts

#### MT-020: Trivial path performance budget
- **Traces**: AC-NFR-004a, AC-NFR-004b, AC-NFR-004c
- **Given** the user selects trivial tier
- **When** the framework sets up the trivial execution path (before the actual edit)
- **Then** setup completes in under 5 seconds (AC-NFR-004a)
- **And** when the edit is complete and user confirms, post-edit recording (change-record.md, commit, meta.json, BACKLOG.md) completes in under 10 seconds (AC-NFR-004b)
- **And** total framework overhead (excluding edit time and user interaction) is under 30 seconds (AC-NFR-004c)

---

## Test Case Summary

| Category | ID Range | Count | Automated |
|----------|----------|-------|-----------|
| Unit: computeRecommendedTier base | TC-CRT-001..011 | 11 | Yes |
| Unit: computeRecommendedTier risk | TC-CRT-012..022 | 11 | Yes |
| Unit: computeRecommendedTier invalid | TC-CRT-023..029 | 7 | Yes |
| Unit: computeRecommendedTier riskLevel | TC-CRT-030..033 | 4 | Yes |
| Unit: computeRecommendedTier custom | TC-CRT-034..041 | 8 | Yes |
| Unit: getTierDescription | TC-GTD-001..012 | 12 | Yes |
| Unit: Constants | TC-CONST-001..003 | 3 | Yes |
| Integration: meta.json persistence | TC-INT-001..007 | 7 | Yes |
| Integration: backward compat | TC-BC-001..003 | 3 | Yes |
| Manual: analyze handler | MT-001..003 | 3 | No |
| Manual: build handler | MT-004..010 | 7 | No |
| Manual: trivial path | MT-011..014 | 4 | No |
| Manual: user agency/NFRs | MT-015..020 | 6 | No |
| **Total** | | **86** | 66 auto + 20 manual |

---

*Test cases completed for Phase 05 -- test-strategy.*
