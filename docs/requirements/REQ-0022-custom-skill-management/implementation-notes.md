# Implementation Notes: Custom Skill Management (REQ-0022)

**Phase**: 06-implementation
**Version**: 1.0
**Implemented**: 2026-02-18
**Agent**: software-developer (Phase 06)

---

## 1. Implementation Summary

Implemented the custom skill management feature across 6 modules per the module design specification. The feature enables users to add, wire, list, and remove external skills that get injected into agent Task prompts during workflow execution.

### Files Modified

| File | Change | Module |
|------|--------|--------|
| `src/claude/hooks/lib/common.cjs` | Added 6 functions + 2 constants | M1 |
| `src/claude/commands/isdlc.md` | Added skill action dispatch + STEP 3d injection | M2 |
| `CLAUDE.md` | Added Skill mgmt intent detection row | M5 |
| `src/claude/hooks/config/skills-manifest.json` | Registered skill-manager agent (SM, EXT-001/002/003) | M6 |
| `src/claude/hooks/tests/test-fan-out-manifest.test.cjs` | Updated total_skills count (243->246) | Test fix |
| `src/claude/hooks/tests/test-quality-loop.test.cjs` | Updated total_skills count (243->246) | Test fix |
| `src/claude/hooks/tests/test-strategy-debate-team.test.cjs` | Updated total_skills count (243->246) | Test fix |

### Files Created

| File | Module |
|------|--------|
| `src/claude/agents/skill-manager.md` | M3 |
| `src/claude/hooks/tests/external-skill-management.test.cjs` | Test suite |

### Module M4 Note

The `external-skills-manifest.json` (M4) is not created as a static file. Per the module design, it is created at runtime on first `skill add` via the `writeExternalManifest()` function. The schema is defined by the `writeExternalManifest()` implementation and documented in the interface spec.

---

## 2. Key Implementation Decisions

### 2.1 Simple YAML Parser (ADR-0009)

Used a simple regex + string split approach for frontmatter parsing instead of adding a `js-yaml` dependency. The parser handles `key: value` lines separated by `\n` with `: ` as the separator. This keeps the dependency footprint zero while supporting all required frontmatter fields.

### 2.2 Error Collection Strategy (NFR-006)

`validateSkillFrontmatter()` collects ALL validation errors before returning, rather than failing on the first error. This improves user experience by allowing them to fix all issues in one pass.

### 2.3 Fail-Open Pattern (Article X, NFR-003)

All functions follow the existing common.cjs pattern of returning structured error objects rather than throwing exceptions. `writeExternalManifest()` wraps the entire operation in try/catch and returns `{ success: false, error: message }` on failure. `loadExternalManifest()` returns `null` on parse failure.

### 2.4 Backward Compatibility (NFR-005)

Manifest entries without a `bindings` object are silently skipped during injection. This ensures projects with legacy manifest formats continue to work. The injection pipeline checks `skill.bindings && skill.bindings.injection_mode === 'always'` before processing.

### 2.5 Path Traversal Prevention (Security T1)

The `skill.file` field in the manifest stores only the filename (no directory path). Path traversal is prevented by checking for `/`, `\`, and `..` characters in filenames before they enter the manifest. The full path is resolved at runtime using `resolveExternalSkillsPath()`.

---

## 3. Test Results

### New Test Suite

- **File**: `src/claude/hooks/tests/external-skill-management.test.cjs`
- **Framework**: node:test + node:assert/strict (CJS)
- **Total tests**: 111
- **Passing**: 111
- **Failing**: 0
- **Coverage**: All 6 new functions + 2 constants fully exercised

### Test Distribution

| Group | Count | Priority |
|-------|-------|----------|
| TC-01: validateSkillFrontmatter (happy) | 5 | P0 |
| TC-02: validateSkillFrontmatter (errors) | 18 | P0 |
| TC-03: analyzeSkillContent (keywords) | 12 | P1 |
| TC-04: analyzeSkillContent (edge cases) | 5 | P1 |
| TC-05: suggestBindings | 10 | P1 |
| TC-06: writeExternalManifest (happy) | 8 | P0 |
| TC-07: writeExternalManifest (errors) | 2 | P0 |
| TC-08: formatSkillInjectionBlock | 8 | P0 |
| TC-09: removeSkillFromManifest | 6 | P2 |
| TC-10: Existing functions (gap fill) | 6 | P0 |
| TC-11: Skill add pipeline (integration) | 4 | P0 |
| TC-12: Runtime injection pipeline (integration) | 4 | P0 |
| TC-13: Skill removal pipeline (integration) | 3 | P1 |
| TC-14: Fail-open behavior | 5 | P0 |
| TC-15: Backward compatibility | 3 | P1 |
| TC-16: Path security | 4 | P0 |
| TC-17: Performance | 3 | P1 |
| TC-18: Constants validation | 5 | P2 |

### Regression Test Results

- **Hooks suite** (npm run test:hooks): 1810/1811 pass (1 pre-existing flaky test unrelated to REQ-0022)
- **ESM suite** (npm test): 629/632 pass (3 pre-existing failures unrelated to REQ-0022)
- **Zero regressions** from REQ-0022 changes (verified by stash-and-run comparison)

---

## 4. Traceability

| Requirement | Implementation | Test Coverage |
|-------------|---------------|---------------|
| FR-001 (Skill Acquisition) | validateSkillFrontmatter() | TC-01, TC-02 |
| FR-002 (Smart Binding) | analyzeSkillContent(), suggestBindings(), SKILL_KEYWORD_MAP, PHASE_TO_AGENT_MAP | TC-03, TC-04, TC-05, TC-18 |
| FR-004 (Manifest Registration) | writeExternalManifest() | TC-06, TC-07 |
| FR-005 (Runtime Injection) | formatSkillInjectionBlock(), STEP 3d injection | TC-08, TC-12 |
| FR-006 (Skill Listing) | isdlc.md skill list action | Prompt-level (no testable code) |
| FR-007 (Skill Removal) | removeSkillFromManifest() | TC-09, TC-13 |
| FR-008 (Natural Language) | CLAUDE.md intent detection row | Prompt-level |
| FR-009 (Re-wiring) | isdlc.md skill wire action | Prompt-level |
| NFR-001 (Performance) | All functions < 100ms | TC-17 |
| NFR-003 (Fail-Open) | try/catch in all functions | TC-14 |
| NFR-004 (Monorepo) | Uses existing resolve*Path() | TC-10 |
| NFR-005 (Backward Compat) | Optional bindings handling | TC-15 |
| NFR-006 (Validation Clarity) | Error collection in validateSkillFrontmatter | TC-02.09, TC-02.18 |
| Security T1 (Path Traversal) | Filename validation | TC-16 |
