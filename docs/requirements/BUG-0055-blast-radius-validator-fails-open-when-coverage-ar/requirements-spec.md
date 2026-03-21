# Requirements Specification: Fix blast radius validator regex mismatch and add zero-file guard

**Status**: Complete (bug analysis)
**Source**: GH-127
**Last Updated**: 2026-03-21

---

## 1. Business Context

### Problem Statement

The blast radius validator hook — the primary enforcement mechanism ensuring implementation completeness — has been non-functional for all roundtable-analyzed features since its creation. The `IMPACT_TABLE_ROW` regex expects a 3-column table format but the roundtable produces a 4-column format. This causes the parser to extract zero affected files, making the validator a no-op. The result is that implementation agents can silently skip files from the impact analysis without any gate blocking them.

This was discovered when REQ-0066 shipped without `src/claude/commands/isdlc.md` being modified despite it being listed as a Tier 1 direct change. The bug affects all past and future feature builds that go through roundtable analysis.

---

## 6. Functional Requirements

### FR-001: Fix IMPACT_TABLE_ROW regex to match both table formats
**Confidence**: High

The regex must extract file paths and change types from both the 3-column format (`| File | Change Type | Risk |`) used in tests and the 4-column format (`| File | Module | Change Type | Traces |`) produced by the roundtable.

- **AC-001-01**: Given an impact-analysis.md with 3-column format (`| \`file\` | MODIFY | Risk |`), when `parseImpactAnalysis()` runs, then the file path and change type are correctly extracted (backward compatible — existing tests continue passing)
- **AC-001-02**: Given an impact-analysis.md with 4-column format (`| \`file\` | module | Modify | traces |`), when `parseImpactAnalysis()` runs, then the file path and change type are correctly extracted
- **AC-001-03**: Given an impact-analysis.md with mixed column counts across sections, when `parseImpactAnalysis()` runs, then files from all sections are extracted regardless of column count
- **AC-001-04**: Given a change type in any case (Modify, MODIFY, modify), when the regex matches, then the change type is normalized to uppercase for comparison

### FR-002: Add zero-file guard with warning
**Confidence**: High

When impact-analysis.md exists and is non-empty but the parser extracts zero affected files, this is suspicious and should produce a diagnostic warning rather than silently passing.

- **AC-002-01**: Given impact-analysis.md exists and has >100 characters of content, when `parseImpactAnalysis()` returns an empty array, then a warning is emitted to stderr: "blast-radius-validator: impact-analysis.md has content but no affected files were parsed. Table format may not match expected pattern."
- **AC-002-02**: Given the zero-file guard fires, the validator still returns `allow` (fail-open per Article X) but the warning provides diagnostic visibility
- **AC-002-03**: Given impact-analysis.md is genuinely empty or very short (<100 chars), the zero-file guard does NOT fire (avoids false alarms for stub files)

### FR-003: Update test fixtures to include 4-column format
**Confidence**: High

Test coverage must include the actual format produced by the roundtable analysis.

- **AC-003-01**: Given existing 3-column test fixtures, all existing tests continue passing unchanged (no regression)
- **AC-003-02**: A new test fixture uses the 4-column format matching actual roundtable output (`| \`file\` | module | Modify | FR-NNN |`)
- **AC-003-03**: A new test verifies `parseImpactAnalysis()` correctly extracts files from the 4-column fixture
- **AC-003-04**: A new test verifies the zero-file guard fires when content exists but no files are parsed (e.g., a table with an unrecognized column layout)

### FR-004: Add code review blast radius cross-check
**Confidence**: High

Phase 08 (code review) should independently verify that impact-analysis.md Tier 1 files appear in the git diff, as a defense-in-depth check.

- **AC-004-01**: The qa-engineer agent prompt (or code-review skill DEV-015) includes a mandatory check: "Compare impact-analysis.md Tier 1 file list against `git diff --name-only` and flag any Tier 1 files not present in the diff"
- **AC-004-02**: If unaddressed Tier 1 files are found, the code review report must include a BLOCKING finding (not just informational)

### FR-005: Add quality loop blast radius check
**Confidence**: High

Phase 16 (quality loop) should check blast radius coverage alongside test coverage.

- **AC-005-01**: The quality-loop-engineer agent prompt includes blast radius coverage as a quality check: "Verify that all Tier 1 files from impact-analysis.md appear in the git diff or have documented deferrals"
- **AC-005-02**: If unaddressed Tier 1 files are found, the quality report must flag them as a failing check
