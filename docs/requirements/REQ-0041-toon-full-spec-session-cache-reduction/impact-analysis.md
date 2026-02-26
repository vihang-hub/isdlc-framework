# Impact Analysis: REQ-0041 TOON Full Spec Session Cache Reduction

| Field | Value |
|-------|-------|
| **Status** | Complete |
| **Confidence** | High |
| **Last Updated** | 2026-02-26 |
| **Coverage** | Blast radius (all tiers), risk zones, implementation order |

---

## 1. Blast Radius

### Tier 1: Direct Changes

Files that will be directly modified.

| File | Change Description | Lines Affected | Risk |
|------|--------------------|---------------|------|
| `src/claude/hooks/lib/toon-encoder.cjs` | Add `encodeValue()`, `decodeValue()` functions with full TOON spec support | +300-400 new lines | Medium -- new code, but isolated module |
| `src/claude/hooks/lib/common.cjs` | Update `rebuildSessionCache()` to use `encodeValue()` for all 4 JSON sections | ~30 lines modified (4147-4172 expanded) | Low -- contained change within existing try/catch |
| `src/claude/hooks/tests/toon-encoder.test.cjs` | Add test suites for `encodeValue()`, `decodeValue()`, round-trip tests | +200-300 new lines | Low -- additive tests |

### Tier 2: Transitive Impact

Files that depend on changed files but are not directly modified.

| File | Dependency | Impact |
|------|-----------|--------|
| `bin/rebuild-cache.js` | Calls `rebuildSessionCache()` | No change needed -- calls the same function, gets smaller output |
| `src/claude/hooks/inject-session-cache.cjs` | Reads `.isdlc/session-cache.md` | No change needed -- reads raw file content regardless of format |
| `.isdlc/session-cache.md` | Output of `rebuildSessionCache()` | Content changes (TOON-encoded JSON sections), size decreases |

### Tier 3: Potential Side Effects

Areas that may behave differently due to the change.

| Area | Potential Effect | Likelihood | Mitigation |
|------|-----------------|-----------|------------|
| LLM context window | Reduced cache consumption (~9.4% of total cache) | High (intended) | This is the goal |
| Agent behavior | Agents read TOON-encoded config from context instead of JSON | Medium | TOON spec benchmarks show equal/better LLM accuracy; validate manually |
| Hook runtime behavior | No effect -- hooks read original JSON files, not cache | None | N/A |
| Cache staleness detection | Hash computed from source file mtimes, not content format | None | N/A |
| Existing TOON tabular tests | Existing `encode()`/`decode()` unchanged | None | All 47 tests must pass unchanged |

## 2. Consumer Analysis

### Session Cache Consumers

| Consumer | How it reads | Impact |
|----------|-------------|--------|
| `inject-session-cache.cjs` | `fs.readFileSync()` + `stdout.write()` | Zero -- dumb pipe |
| LLM context window | Semantic reading of injected text | Content format changes from JSON to TOON for 4 sections |

### Source File Consumers (Unaffected)

| Consumer | File Read | Impact |
|----------|----------|--------|
| `gate-blocker.cjs` | `iteration-requirements.json` via `JSON.parse` | Zero -- reads source file directly |
| `gate-requirements-injector.cjs` | `iteration-requirements.json`, `workflows.json` via `JSON.parse` | Zero -- reads source files directly |
| `skill-delegation-enforcer.cjs` | `skills-manifest.json` via `loadManifest()` | Zero -- `loadManifest()` reads source file |
| `log-skill-usage.cjs` | `skills-manifest.json` via `loadManifest()` | Zero |
| `constitution-validator.cjs` | `iteration-requirements.json` via `JSON.parse` | Zero |

## 3. Risk Zones

| ID | Risk Zone | Description | Likelihood | Impact | Mitigation |
|----|-----------|------------|-----------|--------|------------|
| RZ-001 | `encodeValue()` recursion | Deep nesting (7 levels in iteration-requirements) could produce incorrect indentation | Low | Medium | Unit tests with real cache data; max-depth guard |
| RZ-002 | Inline array ambiguity | Primitive arrays containing values with commas could produce ambiguous inline format | Low | Medium | Apply `serializeValue()` quoting rules to inline array elements |
| RZ-003 | `rebuildSessionCache()` integration | Changing the TOON integration point from single-section to four-section | Low | Low | Per-section try/catch preserves fail-open; each section independent |
| RZ-004 | Backward compatibility regression | New exports or internal changes could break existing `encode()`/`decode()` | Low | High | Run all 47 existing tests as gate; no modification to existing functions |
| RZ-005 | LLM parsing of TOON for deeply nested config | Complex TOON structures might be harder for LLM to parse than JSON in edge cases | Low | Medium | Validate with representative prompts; fail-open allows per-section JSON fallback |

## 4. Implementation Order

### Phase 1: Core Encoder (FR-001, FR-002, FR-003)

1. Implement `encodeValue()` for plain objects (nested, key-value pairs)
2. Implement inline primitive array detection and encoding
3. Add unit tests for each type handler
4. Validate with extracted real data from `skills-manifest.json` and `iteration-requirements.json`

### Phase 2: Complete Encoder (FR-004, FR-005, FR-006)

5. Implement non-uniform/mixed array list form
6. Add `isUniformArray()` delegation path in `encodeValue()`
7. Implement `stripKeys` option
8. Add unit tests

### Phase 3: Decoder and Round-Trip (FR-008)

9. Implement `decodeValue()` parser (indentation-based, recursive descent)
10. Add round-trip tests with real cache section data
11. Validate `decodeValue(encodeValue(data))` deep-equals original (modulo stripped keys)

### Phase 4: Cache Integration (FR-007, FR-010)

12. Update `rebuildSessionCache()` to use `encodeValue()` for all four JSON sections
13. Add `stripKeys: ['_comment']` to all JSON section encoding calls
14. Add verbose logging for per-section encoding statistics
15. Run `bin/rebuild-cache.js --verbose` and validate output
16. Verify all existing hook tests still pass

### Dependency Chain

```
Phase 1 (Core) -> Phase 2 (Complete) -> Phase 3 (Decoder) -> Phase 4 (Integration)
```

Phase 3 depends on Phase 1+2 because the decoder must handle everything the encoder produces. Phase 4 depends on Phase 3 because round-trip validation should pass before wiring into the cache builder.

## 5. Entry Points

| Entry Point | File | Function/Line | Rationale |
|-------------|------|--------------|-----------|
| Primary | `src/claude/hooks/lib/toon-encoder.cjs` | New `encodeValue()` function | All new encoding logic lives here |
| Integration | `src/claude/hooks/lib/common.cjs` | `rebuildSessionCache()` line 4147 | Existing TOON integration point; expand to all JSON sections |
| Validation | `src/claude/hooks/tests/toon-encoder.test.cjs` | New test suites | Test-driven development of new features |
| Manual verification | `bin/rebuild-cache.js --verbose` | CLI entry point | End-to-end validation of cache reduction |

## 6. Rollback Strategy

If TOON encoding causes issues post-implementation:

1. **Immediate**: Set `encodeValue()` to throw immediately, triggering JSON fallback for all sections. Zero-line change in the cache builder (fail-open handles it).
2. **Targeted**: Disable TOON encoding per-section by wrapping individual `encodeValue()` calls in a feature flag or conditional.
3. **Full**: Revert `common.cjs` changes to restore REQ-0040 behavior (single-section tabular-only attempt). New `encodeValue()` code remains in encoder module but is unused.

## Pending Sections

None -- all sections complete.
