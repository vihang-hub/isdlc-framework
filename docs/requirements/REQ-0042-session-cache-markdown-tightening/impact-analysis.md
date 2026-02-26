# Impact Analysis: REQ-0042 Session Cache Markdown Tightening

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-26
**Coverage**: Blast Radius, Entry Points, Implementation Order, Risk Zones, Summary

---

## 1. Blast Radius

### Tier 1: Direct Modifications

| File | Module | Change Type | Requirement Traces |
|------|--------|-------------|-------------------|
| `src/claude/hooks/lib/common.cjs` | Hook library | Modify | FR-001 through FR-009 |
| `src/claude/hooks/tests/test-session-cache-builder.test.cjs` | Test suite | Modify | FR-001 through FR-009 |

### Tier 2: Transitive Impact

| File | Module | Impact Description | Change Needed |
|------|--------|-------------------|---------------|
| `bin/rebuild-cache.js` | CLI entry | Calls `rebuildSessionCache()` -- output format changes | None (consumes return value, not section content) |
| `src/claude/hooks/inject-session-cache.cjs` | Hook | Reads and outputs the cache file -- content format changes | None (transparent passthrough) |
| `.isdlc/session-cache.md` | Generated artifact | Content structure changes in SKILL_INDEX, ROUNDTABLE_CONTEXT, DISCOVERY_CONTEXT | Regenerated automatically |

### Tier 3: Potential Side Effects

| Area | Potential Impact | Risk Level |
|------|-----------------|------------|
| Orchestrator persona extraction | Depends on `### Persona:` heading format in ROUNDTABLE_CONTEXT | Low -- delimiter preserved |
| Orchestrator topic extraction | Depends on `### Topic:` heading format in ROUNDTABLE_CONTEXT | Low -- delimiter preserved |
| Phase agent skill lookup | Agents parse SKILL_INDEX for skill IDs and paths | Medium -- format changes from 2-line to 1-line |
| Roundtable persona behavior | Tightened persona content may affect voice quality | Medium -- validated through usage observation |
| Discovery knowledge consumption | Agents rely on DISCOVERY_CONTEXT for project understanding | Low -- tables preserved, only prose trimmed |

## 2. Entry Points

### Recommended Entry Point: `formatSkillIndexBlock()` in `common.cjs`

**Rationale**: This is the smallest, most self-contained change. It modifies a single formatting function with clear input/output contract. Tests can verify the new format immediately. Success here builds confidence for the more nuanced persona and discovery tightening.

### Secondary Entry Point: Persona tightening function

**Rationale**: After SKILL_INDEX format is confirmed, add the persona section-stripping function. This requires the most careful design (preserving specific sections, stripping others) but has well-defined rules from the analysis.

## 3. Implementation Order

| Order | FRs | Description | Risk | Parallel | Depends On |
|-------|-----|-------------|------|----------|------------|
| 1 | FR-008 | Implement fail-open wrapper pattern | Low | No | None |
| 2 | FR-001, FR-002 | SKILL_INDEX tightening (banner dedup + single-line) | Low | No | FR-008 |
| 3 | FR-003, FR-004, FR-005 | ROUNDTABLE_CONTEXT persona tightening | Medium | Yes (with step 4) | FR-008 |
| 4 | FR-006 | ROUNDTABLE_CONTEXT topic tightening | Low | Yes (with step 3) | FR-008 |
| 5 | FR-007 | DISCOVERY_CONTEXT prose condensation | Medium | No | FR-008 |
| 6 | FR-009 | Reduction reporting in verbose mode | Low | No | Steps 2-5 |

## 4. Risk Zones

| ID | Risk | Area | Likelihood | Impact | Mitigation |
|----|------|------|-----------|--------|------------|
| RZ-001 | SKILL_INDEX format change breaks agent skill lookup | `formatSkillIndexBlock()` consumers | Medium | High | Add test that verifies skill ID and path are extractable from single-line format; test with regex patterns agents use |
| RZ-002 | Persona section stripping removes content the roundtable actually needs | `rebuildSessionCache()` persona tightening | Medium | High | Preserve sections 1, 2, 3, 5, 7 per analysis consensus; strip only sections 6, 8, 9, 10 confirmed redundant |
| RZ-003 | Orchestrator extraction regex breaks on tightened content | `isdlc.md` step 7a extraction logic | Low | Critical | Preserve `### Persona:` and `### Topic:` delimiters exactly; regression test for extraction |
| RZ-004 | DISCOVERY_CONTEXT condensation removes facts agents rely on | DISCOVERY_CONTEXT section | Low | Medium | Preserve all tables verbatim; only condense prose paragraphs |
| RZ-005 | Combined reduction does not meet 25-30% target | All sections | Medium | Medium | Track per-section savings with FR-009 reporting; adjust tightening if needed |

### Test Coverage Assessment

- `test-session-cache-builder.test.cjs` exists and covers the current `rebuildSessionCache()` behavior
- New tests needed for: tightened SKILL_INDEX format, persona section stripping, topic metadata stripping, discovery prose condensation, fail-open fallback behavior
- Existing 555+ test baseline should not be affected (changes are additive to cache builder)

## 5. Summary

### Metrics

| Metric | Value |
|--------|-------|
| Direct modifications | 1 file |
| New files | 0 |
| Test file modifications | 1 file |
| Transitive modifications | 0 (consumers are format-transparent) |
| Total affected | 2 files |

### Decision Log

| Decision | Rationale |
|----------|-----------|
| Modify `common.cjs` rather than extracting tightening to separate module | Follows existing pattern where all cache assembly logic lives in `rebuildSessionCache()`; no new module boundary needed for internal transformation functions |
| Single-line skill format over tabular | Tabular format adds markdown overhead (header + separator rows) that negates savings for small agent skill lists; single-line with pipe separator is denser |
| Fail-open over fail-hard | Consistent with framework convention (ADR-0027, Article X); a broken tightener should never break the entire cache |

### Implementation Recommendations

1. Start with `formatSkillIndexBlock()` modification -- highest confidence, easiest to verify
2. Add persona tightening function as a content transformer called within the ROUNDTABLE_CONTEXT section builder
3. Add topic tightening function as a second content transformer in the same section builder
4. Add discovery condensation as a content transformer in the DISCOVERY_CONTEXT section builder
5. Wire verbose reporting last, after all transformers are in place

### Overall Risk Level: **Low-Medium**

The changes are confined to content formatting within a single function. The fail-open pattern ensures safety. The primary risk is format changes breaking downstream consumers, mitigated by preserving all structural delimiters and testing parsability.

**Go/No-Go Recommendation**: **Go** -- well-scoped, low blast radius, clear implementation path.
