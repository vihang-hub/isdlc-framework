# Technical Debt Inventory: REQ-0008-update-node-version

**Date**: 2026-02-10
**Phase**: 08-code-review

---

## New Technical Debt Introduced

**None.** This change introduces zero new technical debt. It is a pure configuration update with no runtime code changes.

## Pre-Existing Technical Debt (Noted)

### TD-001: Pre-existing TC-E09 test failure (LOW)

- **Location**: `lib/deep-discovery-consistency.test.js:115`
- **Description**: Test expects README.md to reference "40 agents" but the actual agent count has changed. This test has been failing across multiple workflows.
- **Impact**: LOW -- single cosmetic test failure, does not affect framework functionality
- **Recommendation**: Update README agent count or test expectation in a future fix workflow

### TD-002: Node 20 EOL approaching (INFORMATIONAL)

- **Description**: Node 20 reaches end-of-life on April 30, 2026 (~2.5 months away). When it does, another version bump workflow will be needed to set minimum to Node 22.
- **Impact**: LOW -- proactive awareness, not a current issue
- **Recommendation**: Schedule REQ for Node 22 minimum in March 2026

### TD-003: No YAML parser in test suite (INFORMATIONAL)

- **Description**: YAML workflow validation uses string matching and regex rather than a proper YAML parser. This is by design (no external test dependencies) but means structural YAML errors beyond readability are not caught by the test suite.
- **Impact**: VERY LOW -- GitHub Actions would catch YAML parse errors on push
- **Recommendation**: Acceptable trade-off per Article V (Simplicity First)
