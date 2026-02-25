# Impact Analysis: TOON Format Integration

**Generated**: 2026-02-25T23:20:00Z
**Feature**: Adopt TOON encoding for session cache sections and state array injections to reduce token consumption by 30-60%
**Based On**: Phase 01 Requirements (finalized) - requirements-spec.md
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Adopt TOON for agent prompts and state data to reduce token usage | 5 FRs: SDK wrapper, session cache encoding, state array encoding, JSON fallback, cache rebuild consistency |
| Keywords | skills-manifest, session-cache, state.json, rebuild-cache | toon-encoder, encode/decode, CJS wrapper, fail-open, SKILL_INDEX, SKILLS_MANIFEST, ITERATION_REQUIREMENTS, WORKFLOW_CONFIG |
| Estimated Files | ~16 files | ~14 files directly affected (refined) |
| Scope Change | - | REFINED (clarified with 19 ACs, 9 NFRs, 6 constraints, dependency ordering) |

---

## Executive Summary

TOON Format Integration affects a well-bounded set of files concentrated in the hook system's session cache pipeline and state management layer. The primary blast radius centers on 3 core implementation files (`toon-encoder.cjs` (new), `common.cjs`, `rebuild-cache.js`), 1 hook file (`inject-session-cache.cjs` -- though its current implementation is a thin reader, the cache it reads is built by `common.cjs::rebuildSessionCache()`), and 7 test files that validate session cache format, skill injection, and I/O optimization. The feature creates a new utility module (`toon-encoder.cjs`) in the hooks/lib directory and introduces an npm dependency (`toon`). Risk is moderate due to the session cache being a critical path (read on every agent run) and the ESM/CJS boundary requiring careful bridging for the TOON SDK. The feature's fail-open design (REQ-004) and clean cutover approach (CON-006) significantly reduce migration risk.

**Blast Radius**: MEDIUM (14 files directly affected, 4 modules)
**Risk Level**: MEDIUM
**Affected Files**: 14 directly, ~6 indirectly
**Affected Modules**: 4 (hooks/lib, hooks, bin, lib)

---

## Impact Analysis

### M1: Files Directly Affected by Requirement

#### REQ-001: TOON SDK Integration + CJS Wrapper

| File | Change Type | Description |
|------|-------------|-------------|
| `package.json` | MODIFY | Add `toon` npm dependency |
| `src/claude/hooks/lib/toon-encoder.cjs` | NEW | CJS wrapper exposing `encode(data)` and `decode(toonString)` with fail-open JSON fallback |

**Outward Dependencies**: Every file that will `require('./lib/toon-encoder.cjs')` depends on this wrapper.
**Inward Dependencies**: Depends on the `toon` npm package. If SDK is ESM-only, requires dynamic `import()` bridge or compiled CJS output.

#### REQ-002: Session Cache TOON Encoding

| File | Change Type | Description |
|------|-------------|-------------|
| `src/claude/hooks/lib/common.cjs` | MODIFY | `rebuildSessionCache()` function (lines 4093-4270): modify sections 2-6 to use toon-encoder for tabular portions of WORKFLOW_CONFIG, ITERATION_REQUIREMENTS, SKILLS_MANIFEST (skill_lookup 243 entries, ownership 41 entries), and SKILL_INDEX (240 skills) |
| `src/claude/hooks/inject-session-cache.cjs` | NO CHANGE | This hook is a thin reader (reads pre-built session-cache.md and writes to stdout). No modification needed -- TOON encoding happens at build time in `rebuildSessionCache()` |

**Outward Dependencies**: Session cache is consumed by Claude Code's context injection. 34 hooks depend on `common.cjs` but only through other functions -- `rebuildSessionCache()` is called by `bin/rebuild-cache.js`, `lib/installer.js`, and `lib/updater.js`.
**Inward Dependencies**: `rebuildSessionCache()` calls `loadManifest()`, `getAgentSkillIndex()`, `formatSkillIndexBlock()` -- these return data that becomes TOON input.

**Change Propagation**:
- `rebuildSessionCache()` output format changes from JSON to TOON for tabular sections
- `formatSkillIndexBlock()` currently outputs plain text (not JSON) -- may need TOON variant or encoding applied post-format
- SKILL_INDEX section uses a custom text format (`ID: name -- description` + path), not JSON -- TOON applies to structured portions only
- SKILLS_MANIFEST section currently outputs `JSON.stringify(raw, null, 2)` (line 4151) -- this is the primary TOON target
- ITERATION_REQUIREMENTS and WORKFLOW_CONFIG sections output raw JSON file contents -- tabular portions need extraction

#### REQ-003: State Array TOON Encoding

| File | Change Type | Description |
|------|-------------|-------------|
| `src/claude/hooks/lib/common.cjs` | MODIFY | State injection points where `workflow_history` (105K chars, 51 entries), `skill_usage_log` (12K chars, 43 entries), and `history` (10K chars, 52 entries) are formatted for context |

**Key Finding**: State arrays are NOT currently injected into agent context via hooks. They are stored in `state.json` and read by various hooks for processing (skill logging, workflow completion, delegation gate). The TOON encoding for REQ-003 would apply if/when these arrays are included in session cache or other context injection paths.

**Current injection points for state data**:
- `workflow_history`: Read by `workflow-completion-enforcer.cjs` (lines 107-112), `performance-budget.cjs` (line 334) -- used for hook logic, not injected into LLM context
- `skill_usage_log`: Read by `delegation-gate.cjs` (line 168), `gate-blocker.cjs` (line 363) -- used for hook logic, not injected into LLM context
- `history`: Read by `common.cjs` (line 2610) for pruning -- used for hook logic, not injected into LLM context

**Implementation Note**: REQ-003 is "Should Have" priority. The state arrays may be injected into context through agent prompt construction (outside the hook system), or this requirement may need architectural clarification in Phase 03 to identify exact injection points.

#### REQ-004: JSON Fallback on Decode Failure

| File | Change Type | Description |
|------|-------------|-------------|
| `src/claude/hooks/lib/toon-encoder.cjs` | MODIFY (same as REQ-001) | Fallback logic baked into wrapper's `decode()` function |
| `src/claude/hooks/lib/common.cjs` | MODIFY | Per-section fallback in `rebuildSessionCache()` -- if TOON encoding fails for one section, that section falls back to JSON while others remain TOON |

**Change Propagation**: Minimal -- fallback is self-contained within the encoder wrapper and the `buildSection()` helper in `rebuildSessionCache()`.

#### REQ-005: Cache Rebuild TOON Consistency

| File | Change Type | Description |
|------|-------------|-------------|
| `bin/rebuild-cache.js` | MODIFY | Must call `rebuildSessionCache()` which now produces TOON output -- no direct changes needed if `rebuildSessionCache()` handles TOON internally |

**Key Finding**: `rebuild-cache.js` delegates entirely to `common.cjs::rebuildSessionCache()` (line 32). If `rebuildSessionCache()` is updated for TOON (REQ-002), `rebuild-cache.js` automatically produces TOON output. Direct modification may only be needed for verbose logging of TOON encoding status.

**Indirect callers of `rebuildSessionCache()`**:
- `lib/installer.js` (line 748-749): Calls during `isdlc init` -- will automatically get TOON output
- `lib/updater.js` (line 573-574): Calls during `isdlc update` -- will automatically get TOON output

### Test Files Affected

| Test File | Lines | Impact | Reason |
|-----------|-------|--------|--------|
| `src/claude/hooks/tests/test-session-cache-builder.test.cjs` | 1074 | HIGH | Validates session cache section format -- assertions will need to match TOON output instead of JSON |
| `src/claude/hooks/tests/test-inject-session-cache.test.cjs` | 181 | LOW | Tests the thin reader hook (reads file, writes to stdout) -- format-agnostic, likely no changes |
| `src/claude/hooks/tests/test-io-optimization.test.cjs` | 1207 | MEDIUM | Tests caching and I/O patterns -- may need TOON format awareness for config cache validation |
| `src/claude/hooks/tests/test-log-skill-usage.test.cjs` | 495 | LOW | Tests skill logging to state.json -- JSON storage unchanged, only TOON at injection time |
| `src/claude/hooks/tests/skill-injection.test.cjs` | - | MEDIUM | Tests skill data injection -- format validation may need TOON awareness |
| `src/claude/hooks/tests/test-req-0033-skill-injection-wiring.test.cjs` | - | LOW | Tests skill injection wiring -- may reference session cache format |
| `lib/installer.test.js` | - | LOW | Tests installer flow -- `rebuildSessionCache()` call verified but output format not deeply tested |

### Dependency Graph

```
toon (npm package)
  |
  v
toon-encoder.cjs (NEW)
  |
  v
common.cjs::rebuildSessionCache()
  |
  +---> session-cache.md (output artifact)
  |       |
  |       v
  |     inject-session-cache.cjs (reads and outputs to stdout)
  |
  +---> bin/rebuild-cache.js (CLI caller)
  +---> lib/installer.js (init caller)
  +---> lib/updater.js (update caller)
```

### Files Summary

| # | File Path | Change Type | Requirement |
|---|-----------|-------------|-------------|
| 1 | `package.json` | MODIFY | REQ-001 |
| 2 | `src/claude/hooks/lib/toon-encoder.cjs` | NEW | REQ-001, REQ-004 |
| 3 | `src/claude/hooks/lib/common.cjs` | MODIFY | REQ-002, REQ-003, REQ-004 |
| 4 | `bin/rebuild-cache.js` | MODIFY (minor) | REQ-005 |
| 5 | `lib/installer.js` | NO CHANGE (verify) | REQ-005 (indirect) |
| 6 | `lib/updater.js` | NO CHANGE (verify) | REQ-005 (indirect) |
| 7 | `src/claude/hooks/inject-session-cache.cjs` | NO CHANGE | REQ-002 (verify) |
| 8 | `src/claude/hooks/tests/test-session-cache-builder.test.cjs` | MODIFY | REQ-002 tests |
| 9 | `src/claude/hooks/tests/test-inject-session-cache.test.cjs` | VERIFY | REQ-002 tests |
| 10 | `src/claude/hooks/tests/test-io-optimization.test.cjs` | MODIFY | NFR tests |
| 11 | `src/claude/hooks/tests/skill-injection.test.cjs` | MODIFY | REQ-002 tests |
| 12 | `src/claude/hooks/tests/test-log-skill-usage.test.cjs` | VERIFY | REQ-003 tests |
| 13 | `src/claude/hooks/tests/test-req-0033-skill-injection-wiring.test.cjs` | VERIFY | REQ-002 tests |
| 14 | New test file for toon-encoder.cjs | NEW | REQ-001, REQ-004 tests |

---

## Entry Points

### M2: Implementation Entry Points

#### Existing Entry Points

| Entry Point | Type | Affected By | Current State |
|-------------|------|-------------|---------------|
| `common.cjs::rebuildSessionCache()` | Function (line 4093) | REQ-002, REQ-004 | Builds session cache with JSON-encoded sections. Sections 2-6 need TOON encoding for tabular data. |
| `inject-session-cache.cjs` | SessionStart Hook | REQ-002 (indirect) | Thin reader -- reads pre-built cache file. No direct changes needed. |
| `bin/rebuild-cache.js` | CLI Tool | REQ-005 | Delegates to `rebuildSessionCache()`. May need verbose TOON status logging. |
| `lib/installer.js::install()` | ESM Function (line 748) | REQ-005 (indirect) | Calls `rebuildSessionCache()` -- auto-inherits TOON output. |
| `lib/updater.js::update()` | ESM Function (line 573) | REQ-005 (indirect) | Calls `rebuildSessionCache()` -- auto-inherits TOON output. |
| `common.cjs::formatSkillIndexBlock()` | Function (line 1624) | REQ-002 | Formats skill index as plain text. May need TOON variant for structured output. |
| `common.cjs::loadManifest()` | Function (line 1330) | REQ-002 | Returns parsed skills-manifest.json with `skill_lookup` (243 entries) and `ownership` (41 entries). |

#### New Entry Points to Create

| Entry Point | Type | Requirement | Description |
|-------------|------|-------------|-------------|
| `src/claude/hooks/lib/toon-encoder.cjs` | CJS Module | REQ-001 | `encode(data)` and `decode(toonString)` functions wrapping TOON SDK |
| `toon-encoder.cjs::encode()` | Function | REQ-001 | Takes array of uniform objects, returns TOON string with header row + data rows |
| `toon-encoder.cjs::decode()` | Function | REQ-001, REQ-004 | Takes TOON string, returns array of objects. Falls back to JSON.parse() on failure. |

#### Implementation Chain (Entry to Data Layer)

```
1. toon-encoder.cjs (NEW)
   |
   +--> encode(data): array of objects --> TOON string
   +--> decode(toonString): TOON string --> array of objects
   |    (with JSON fallback on failure)
   |
2. common.cjs::rebuildSessionCache() (MODIFY)
   |
   +--> Section 5 (SKILLS_MANIFEST):
   |    JSON.parse(manifestFile) --> toonEncoder.encode(skill_lookup)
   |    JSON.parse(manifestFile) --> toonEncoder.encode(ownership)
   |
   +--> Section 3 (ITERATION_REQUIREMENTS):
   |    JSON.parse(iterReqFile) --> extract tabular portions --> toonEncoder.encode()
   |
   +--> Section 2 (WORKFLOW_CONFIG):
   |    JSON.parse(workflowFile) --> extract tabular portions --> toonEncoder.encode()
   |
   +--> Section 6 (SKILL_INDEX):
   |    getAgentSkillIndex() --> array of skill objects --> toonEncoder.encode()
   |    (or formatSkillIndexBlock() modified to produce TOON)
   |
3. session-cache.md (OUTPUT)
   |
   +--> Read by inject-session-cache.cjs (unchanged)
   +--> Consumed by Claude Code context window
   |
4. bin/rebuild-cache.js (VERIFY)
   +--> Calls rebuildSessionCache() -- inherits TOON output
```

#### Recommended Implementation Order

1. **REQ-001: toon-encoder.cjs** -- Create the CJS wrapper first. This is the foundation. Validate `require()` works on Node 20/22/24. Handle ESM-only SDK bridging.

2. **REQ-004: JSON fallback** -- Bake fallback into the wrapper immediately (part of REQ-001 implementation). Test with malformed input.

3. **REQ-002: Session cache TOON encoding** -- Modify `rebuildSessionCache()` to use toon-encoder for tabular sections. Start with SKILLS_MANIFEST (cleanest tabular data: skill_lookup 243x2 and ownership 41x4), then SKILL_INDEX, then ITERATION_REQUIREMENTS and WORKFLOW_CONFIG.

4. **REQ-005: Cache rebuild consistency** -- Verify `bin/rebuild-cache.js` produces identical output. Add verbose TOON status if needed.

5. **REQ-003: State array TOON encoding** -- Implement last. Requires identifying or creating the injection points where state arrays enter agent context. May need architectural clarification.

---

## Risk Assessment

### M3: Risk Analysis

#### Test Coverage Assessment

| File | Existing Test Coverage | Risk |
|------|----------------------|------|
| `common.cjs::rebuildSessionCache()` | HIGH -- `test-session-cache-builder.test.cjs` (1074 lines, comprehensive section validation) | LOW -- Well-tested but assertions check JSON format; must update for TOON |
| `inject-session-cache.cjs` | HIGH -- `test-inject-session-cache.test.cjs` (181 lines, 8 test cases) | LOW -- Format-agnostic (reads file, checks stdout) |
| `bin/rebuild-cache.js` | MEDIUM -- Tested indirectly via `rebuildSessionCache()` | LOW -- Thin CLI wrapper |
| `toon-encoder.cjs` (new) | NONE -- New file | HIGH -- Critical path utility with no existing tests. Must create comprehensive test suite. |
| `common.cjs::formatSkillIndexBlock()` | MEDIUM -- Tested via skill-injection tests | MEDIUM -- If format changes to TOON, tests need updating |
| State array injection (REQ-003) | LOW -- No clear injection path exists | HIGH -- Unclear implementation path; may need Phase 03 clarification |
| `lib/installer.js` | HIGH -- 30 test cases | LOW -- `rebuildSessionCache()` call is fire-and-forget with error handling |
| `lib/updater.js` | HIGH -- 22 test cases | LOW -- Same pattern as installer |

#### Complexity Hotspots

| Area | Complexity | Risk | Mitigation |
|------|-----------|------|------------|
| **ESM/CJS bridging for TOON SDK** | HIGH | The TOON SDK (`toon` npm package) may ship ESM-only. CJS hooks cannot use `import`. Dynamic `import()` returns a Promise and requires async handling, which conflicts with synchronous `rebuildSessionCache()`. | Check if SDK ships CJS build. If ESM-only, use `require('module').createRequire()` pattern or pre-compile a CJS bundle. Alternatively, implement minimal TOON encoder (header+rows format is simple) without SDK dependency. |
| **rebuildSessionCache() is synchronous** | MEDIUM | If TOON SDK requires async initialization (ESM dynamic import), the synchronous `rebuildSessionCache()` function cannot call it directly. | Either: (a) use synchronous-compatible SDK import, (b) make `rebuildSessionCache()` async (ripple effect to callers), or (c) implement lightweight synchronous encoder. |
| **SKILLS_MANIFEST section structure** | LOW | `skill_lookup` is a flat object (key->value), not an array of objects. TOON encodes arrays of uniform objects. Need to transform `{id: agent}` to `[{id, agent}]` before encoding. | Straightforward transformation. |
| **SKILL_INDEX text format** | MEDIUM | `formatSkillIndexBlock()` outputs human-readable text, not JSON. TOON encoding may not apply directly. Need to decide: encode the source data (skill objects array) or encode the formatted text. | Encode source data as TOON before formatting. Modify `formatSkillIndexBlock()` to accept TOON-encoded input or output TOON directly. |
| **Session cache is critical path** | HIGH | `inject-session-cache.cjs` runs on EVERY agent session start. Any encoding bug produces malformed context for all agents. | Fail-open design (REQ-004) mitigates: encoding failure falls back to JSON. Per-section fallback limits blast radius. Comprehensive test coverage for encoder. |
| **Node 20/22/24 compatibility** | MEDIUM | TOON SDK must work across 3 Node versions. If SDK uses modern APIs (structuredClone, etc.), older Node versions may fail. | CI matrix testing (NFR-006). Manual validation on Node 20 (oldest supported). |

#### Technical Debt Markers

| Area | Debt | Impact on TOON Integration |
|------|------|---------------------------|
| `common.cjs` is 4,395 lines | HIGH -- monolithic file | Adding TOON encoding logic increases complexity. Consider using toon-encoder.cjs as a clean separation boundary. |
| `rebuildSessionCache()` mixes I/O and formatting | MEDIUM | TOON encoding adds another concern. Section builders should be pure functions with encoding applied at the assembly layer. |
| `formatSkillIndexBlock()` outputs plain text | LOW | TOON encoding requires structured data input, not pre-formatted text. May need refactoring to separate data from presentation. |
| `inject-session-cache.cjs` has no dependency on common.cjs (ADR-0027) | POSITIVE | Self-contained reader design means TOON encoding changes don't touch this hook at all. |
| `test-session-cache-builder.test.cjs` (1074 lines) | MEDIUM | Large test file with format-specific assertions. TOON migration requires systematic assertion updates. |

#### Risk Zones (Intersection of Low Coverage + High Impact)

| Zone | Files | Risk Level | Recommendation |
|------|-------|-----------|----------------|
| **TOON SDK compatibility** | `toon-encoder.cjs` (new) | HIGH | Write unit tests BEFORE integration. Test ESM/CJS bridging on Node 20, 22, 24. Verify synchronous `require()` works. |
| **State array injection path** | REQ-003 scope | HIGH | Clarify in Phase 03 exactly where state arrays are injected into agent context. Current hooks read state for their own logic, not for context injection. |
| **Session cache format migration** | `test-session-cache-builder.test.cjs` | MEDIUM | Update test assertions incrementally -- per section rather than all-at-once. Keep JSON fallback tests. |
| **Encoding performance** | `rebuildSessionCache()` | LOW | NFR-003 requires <50ms encoding latency. TOON encoding of ~500 entries should be sub-millisecond. Benchmark to confirm. |

#### Risk Recommendations per Acceptance Criterion

| AC | Risk | Recommendation |
|----|------|---------------|
| AC-001-01 (CJS require) | HIGH | Test `require()` on all 3 Node versions before proceeding to REQ-002. If SDK is ESM-only, this is the critical blocker. |
| AC-001-02 (encode) | LOW | TOON format is well-defined (header+rows). Standard encoding. |
| AC-001-03 (decode) | LOW | Standard decoding with type preservation. |
| AC-001-04 (Node compat) | MEDIUM | CI matrix covers this. Test manually on Node 20 first. |
| AC-002-01 to AC-002-03 (section encoding) | MEDIUM | Modify one section at a time. SKILLS_MANIFEST first (cleanest tabular data). |
| AC-002-04 (30% token reduction) | LOW | TOON benchmarks show 39.6% reduction. 30% target is conservative. |
| AC-003-01 to AC-003-04 (state arrays) | HIGH | Implementation path unclear. May need Phase 03 to define injection points. |
| AC-004-01 to AC-004-04 (fallback) | LOW | Standard try/catch pattern. Well-understood fail-open model. |
| AC-005-01 to AC-005-03 (rebuild consistency) | LOW | `rebuild-cache.js` delegates to `rebuildSessionCache()`. Automatic consistency. |

---

## Cross-Validation

Cross-validation was not performed. (M4 skipped per fail-open protocol -- no separate cross-validation-verifier agent available.)

Manual cross-validation notes:
- M1 file list (14 files) is consistent with M2 entry points (7 existing + 3 new)
- M3 risk scoring aligns with M1 coupling analysis: `common.cjs` is the highest-impact file (34 dependents, 4395 lines)
- M2 implementation order matches M1 dependency graph (REQ-001 first, REQ-003 last)
- Coverage gap: REQ-003 state array injection path needs Phase 03 clarification (flagged by both M1 and M3)

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Implementation Order**: REQ-001 (SDK wrapper) -> REQ-004 (fallback, baked into wrapper) -> REQ-002 (session cache, section by section: SKILLS_MANIFEST -> SKILL_INDEX -> ITERATION_REQUIREMENTS -> WORKFLOW_CONFIG) -> REQ-005 (rebuild consistency verification) -> REQ-003 (state arrays, pending architectural clarification)

2. **High-Risk Areas -- Add Tests First**:
   - `toon-encoder.cjs`: Create comprehensive unit test suite before integration (ESM/CJS bridging, Node 20/22/24 compat, encode/decode round-trip, malformed input handling, JSON fallback)
   - `rebuildSessionCache()`: Baseline current output format in tests before modifying for TOON

3. **Dependencies to Resolve**:
   - Verify `toon` npm package ships CJS-compatible build. If ESM-only, decide between: (a) dynamic import bridge, (b) pre-compiled CJS bundle, (c) lightweight custom encoder
   - Clarify REQ-003 implementation path: where exactly are state arrays injected into LLM context? Current evidence shows hooks read state for their own logic, not for context injection
   - Determine if `formatSkillIndexBlock()` should output TOON or if TOON encoding should be applied to the raw skill data before formatting

4. **Architecture Questions for Phase 03**:
   - Should `toon-encoder.cjs` wrap the full SDK or implement a minimal encoder for the specific patterns used (header+rows for uniform arrays)?
   - Should `rebuildSessionCache()` remain synchronous? If TOON SDK requires async import, this decision affects all callers.
   - How should TOON sections be delimited in session-cache.md? Current sections use HTML comment markers. Should TOON content be marked with a format indicator (e.g., `<!-- SECTION: SKILLS_MANIFEST format=toon -->`)?

---

## Impact Analysis Metadata

The following JSON block is required for automated sizing analysis (REQ-0011).
All fields are required. The `parseSizingFromImpactAnalysis()` function reads
the LAST JSON block in the file to extract sizing metrics.

```json
{
  "analysis_completed_at": "2026-02-25T23:20:00Z",
  "sub_agents": ["M1", "M2", "M3", "M4"],
  "verification_status": "not_performed",
  "requirements_document": "docs/requirements/REQ-0040-toon-format-integration/requirements-spec.md",
  "quick_scan_used": "docs/requirements/REQ-0040-toon-format-integration/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["toon", "encode", "decode", "session-cache", "skills-manifest", "skill_lookup", "ownership", "workflow_history", "skill_usage_log", "history", "CJS", "fail-open", "token-reduction"],
  "files_directly_affected": 14,
  "modules_affected": 4,
  "risk_level": "medium",
  "blast_radius": "medium",
  "coverage_gaps": 1
}
```
