# Technical Debt: REQ-0002-powershell-windows-scripts

**Date**: 2026-02-08
**Phase**: 08 - Code Review & QA

---

## Identified Technical Debt Items

### TD-001: Helper Function Duplication (ACCEPTED)

**Severity**: Low
**Category**: Code duplication
**Description**: 11 helper functions (~175 lines) are duplicated across all 3 PowerShell scripts.
**ADR Reference**: ADR-001 (Inline Helper Functions)
**Rationale**: Accepted trade-off per architecture decision. Single-file execution eliminates module loading errors and path resolution issues. Duplication cost is low (stable, small functions).
**Future Action**: If helpers grow beyond ~200 lines or change frequently, reconsider extracting to a shared module. Currently not worth the complexity.

### TD-002: String-Based Version Comparison (LOW PRIORITY)

**Severity**: Low
**Category**: Logic limitation
**Description**: update.ps1 uses string equality for version comparison instead of semantic versioning. This matches bash behavior and works for the current version scheme.
**Future Action**: Implement semantic version comparison when the project starts using pre-release tags or version ranges that string comparison cannot handle correctly.

### TD-003: .isdlc/constitution.md Display Check (COSMETIC)

**Severity**: Very Low
**Category**: Dead code
**Description**: uninstall.ps1 (line 495) and uninstall.sh (line 449) both check for `.isdlc/constitution.md` which never exists. The constitution lives at `docs/isdlc/constitution.md`. This is a display-only check with no functional impact.
**Future Action**: Clean up in next maintenance pass.

---

## Technical Debt Summary

| ID | Severity | Status | Estimated Effort |
|----|----------|--------|-----------------|
| TD-001 | Low | Accepted (ADR-001) | N/A |
| TD-002 | Low | Deferred | 1 hour |
| TD-003 | Very Low | Deferred | 5 minutes |

**Total new technical debt**: Minimal. All items are either accepted architecture decisions or very low priority cosmetic issues.
