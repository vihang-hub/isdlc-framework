# Test Cases: BUG-0030-GH-24

**Bug**: Impact analysis sub-agents anchor on quick scan file list instead of independent search
**Phase**: 05-test-strategy
**Test File**: `src/claude/hooks/tests/test-impact-search-directives.test.cjs`
**Total Test Cases**: 17

---

## Section 1: M1 Impact Analyzer -- Independent Search Directive (AC-001, AC-005)

### TC-01: M1 prompt contains independent search instruction
- **Requirement**: FR-001, AC-001
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: `src/claude/agents/impact-analysis/impact-analyzer.md` exists and is readable
- **Input**: Read file content as UTF-8 string
- **Expected**: File content matches pattern `/MUST\s+perform\s+independent.*(?:Glob|Grep)\s+search/i` (case-insensitive)
- **Assertion**: `assert.match(m1Content, /MUST\s+perform\s+independent.*(?:Glob|Grep)/i)`
- **TDD Status**: WILL FAIL against current file (trace analysis confirmed 0 occurrences of "independent" in M1)

### TC-02: M1 prompt references Glob tool explicitly
- **Requirement**: FR-001, AC-001
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Same file loaded
- **Input**: Read file content
- **Expected**: File content contains "Glob" (capital G, referencing the tool) in the feature workflow section
- **Assertion**: `assert.match(m1FeatureSection, /Glob/)`
- **TDD Status**: WILL FAIL (trace analysis: "Glob" appears 0 times in M1 feature section)

### TC-03: M1 prompt references Grep tool explicitly
- **Requirement**: FR-001, AC-001
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Same file loaded
- **Input**: Read file content
- **Expected**: File content contains "Grep" (capital G, referencing the tool) in the feature workflow section
- **Assertion**: `assert.match(m1FeatureSection, /Grep/)`
- **TDD Status**: WILL FAIL (trace analysis: "Grep" appears 0 times in M1 feature section as a tool reference)

### TC-04: M1 prompt labels quick scan as supplementary
- **Requirement**: AC-005
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: Same file loaded
- **Input**: Read file content
- **Expected**: File content matches `/supplementary\s+(context|reference|hint)/i`
- **Assertion**: `assert.match(m1Content, /supplementary\s+(context|reference|hint)/i)`
- **TDD Status**: WILL FAIL (trace analysis: "supplementary" appears 0 times in M1)

---

## Section 2: M2 Entry Point Finder -- Independent Search Directive (AC-002, AC-005)

### TC-05: M2 prompt contains independent search instruction
- **Requirement**: FR-001, AC-002
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: `src/claude/agents/impact-analysis/entry-point-finder.md` exists and is readable
- **Input**: Read file content as UTF-8 string
- **Expected**: File content matches `/MUST\s+perform\s+independent.*(?:Glob|Grep)/i`
- **Assertion**: `assert.match(m2Content, /MUST\s+perform\s+independent.*(?:Glob|Grep)/i)`
- **TDD Status**: WILL FAIL (trace analysis: "independent" and "Glob" and "Grep" all 0 occurrences in M2)

### TC-06: M2 prompt references Glob tool explicitly
- **Requirement**: FR-001, AC-002
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Same file loaded
- **Input**: Read file content
- **Expected**: File content contains "Glob" (capital G) in the feature workflow section
- **Assertion**: `assert.match(m2FeatureSection, /Glob/)`
- **TDD Status**: WILL FAIL

### TC-07: M2 prompt references Grep tool explicitly
- **Requirement**: FR-001, AC-002
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Same file loaded
- **Input**: Read file content
- **Expected**: File content contains "Grep" (capital G) in the feature workflow section
- **Assertion**: `assert.match(m2FeatureSection, /Grep/)`
- **TDD Status**: WILL FAIL

### TC-08: M2 prompt labels quick scan as supplementary
- **Requirement**: AC-005
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: Same file loaded
- **Input**: Read file content
- **Expected**: File content matches `/supplementary\s+(context|reference|hint)/i`
- **Assertion**: `assert.match(m2Content, /supplementary\s+(context|reference|hint)/i)`
- **TDD Status**: WILL FAIL

---

## Section 3: M3 Risk Assessor -- Independent Search Directive (AC-003, AC-005)

### TC-09: M3 prompt contains independent search instruction
- **Requirement**: FR-001, AC-003
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: `src/claude/agents/impact-analysis/risk-assessor.md` exists and is readable
- **Input**: Read file content as UTF-8 string
- **Expected**: File content matches `/MUST\s+perform\s+independent.*(?:Glob|Grep)/i`
- **Assertion**: `assert.match(m3Content, /MUST\s+perform\s+independent.*(?:Glob|Grep)/i)`
- **TDD Status**: WILL FAIL (trace analysis: all 0 occurrences in M3)

### TC-10: M3 prompt references Glob tool explicitly
- **Requirement**: FR-001, AC-003
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Same file loaded
- **Input**: Read file content
- **Expected**: File content contains "Glob" in feature workflow section
- **Assertion**: `assert.match(m3FeatureSection, /Glob/)`
- **TDD Status**: WILL FAIL

### TC-11: M3 prompt references Grep tool explicitly
- **Requirement**: FR-001, AC-003
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Same file loaded
- **Input**: Read file content
- **Expected**: File content contains "Grep" in feature workflow section
- **Assertion**: `assert.match(m3FeatureSection, /Grep/)`
- **TDD Status**: WILL FAIL

### TC-12: M3 prompt labels quick scan as supplementary
- **Requirement**: AC-005
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: Same file loaded
- **Input**: Read file content
- **Expected**: File content matches `/supplementary\s+(context|reference|hint)/i`
- **Assertion**: `assert.match(m3Content, /supplementary\s+(context|reference|hint)/i)`
- **TDD Status**: WILL FAIL

---

## Section 4: M4 Cross-Validation Verifier -- Independent Completeness Verification (AC-004)

### TC-13: M4 prompt contains independent completeness verification step
- **Requirement**: FR-002, AC-004
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: `src/claude/agents/impact-analysis/cross-validation-verifier.md` exists and is readable
- **Input**: Read file content as UTF-8 string
- **Expected**: File content matches `/independent.*completeness.*verif/i` or `/independent.*codebase.*search/i`
- **Assertion**: `assert.match(m4Content, /independen(t|tly).*(?:completeness|codebase|search|verif)/i)`
- **TDD Status**: WILL FAIL (trace analysis: "independent" appears 0 times in M4)

### TC-14: M4 prompt references Glob or Grep for independent search
- **Requirement**: FR-002, AC-004
- **Test Type**: positive
- **Priority**: P0
- **Precondition**: Same file loaded
- **Input**: Read file content
- **Expected**: File content references Glob or Grep tools in the context of independent verification
- **Assertion**: `assert.match(m4Content, /(?:Glob|Grep)/)`
- **TDD Status**: WILL FAIL (trace analysis: 0 occurrences of Glob/Grep in M4)

### TC-15: M4 prompt defines completeness_gap finding category
- **Requirement**: FR-002, AC-004
- **Test Type**: positive
- **Priority**: P1
- **Precondition**: Same file loaded
- **Input**: Read file content
- **Expected**: File content contains "completeness_gap" as a finding category
- **Assertion**: `assert.match(m4Content, /completeness_gap/)`
- **TDD Status**: WILL FAIL (no completeness_gap category exists in current M4)

---

## Section 5: Negative / Guard Tests

### TC-16: No agent prompt treats quick scan as authoritative
- **Requirement**: AC-005 (inverse validation)
- **Test Type**: negative
- **Priority**: P1
- **Precondition**: All four agent files loaded
- **Input**: Read all four file contents
- **Expected**: No file contains language treating quick scan as definitive, such as "complete list" or "authoritative" in reference to quick scan output without the negation "NOT"
- **Assertion**: For each agent, verify that if "authoritative" appears, it appears in a negating context (e.g., "NOT authoritative", "not authoritative")
- **TDD Status**: WILL PASS (current files do not use the word "authoritative" at all -- this is a guard test)

### TC-17: M4 prompt does not ONLY cross-reference agent outputs
- **Requirement**: FR-002, AC-004 (inverse validation)
- **Test Type**: negative
- **Priority**: P1
- **Precondition**: M4 file loaded
- **Input**: Read M4 file content
- **Expected**: M4 prompt contains at least one step that goes beyond comparing M1/M2/M3 outputs -- i.e., it must contain instructions for independent codebase search, not just set-difference operations on agent outputs
- **Assertion**: `assert.match(m4Content, /independen(t|tly)/i)` -- confirms M4 has at least one instruction for independent action
- **TDD Status**: WILL FAIL (M4 currently only does cross-referencing)

---

## Test Summary

| Section | Test Cases | Priority Breakdown | TDD Status |
|---------|-----------|-------------------|------------|
| M1 (AC-001, AC-005) | TC-01 to TC-04 | 3x P0, 1x P1 | All FAIL pre-fix |
| M2 (AC-002, AC-005) | TC-05 to TC-08 | 3x P0, 1x P1 | All FAIL pre-fix |
| M3 (AC-003, AC-005) | TC-09 to TC-12 | 3x P0, 1x P1 | All FAIL pre-fix |
| M4 (AC-004) | TC-13 to TC-15 | 2x P0, 1x P1 | All FAIL pre-fix |
| Negative/Guard | TC-16 to TC-17 | 2x P1 | TC-16 PASS, TC-17 FAIL |
| **Total** | **17** | **11x P0, 6x P1** | **16 FAIL, 1 PASS** |
