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
| `src/claude/hooks/lib/common.cjs` | Hook library | Modify | FR-001 through FR-008 |
| `src/claude/hooks/tests/test-session-cache-builder.test.cjs` | Test suite | Modify | FR-001 through FR-008 |

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
| Phase agent skill lookup | Agents parse SKILL_INDEX for skill IDs and paths | Medium -- format changes from 2-line to 1-line with shortened paths |
| Roundtable persona behavior | Aggressively tightened persona content (sections 4, 6, 8, 9, 10 stripped) may affect voice quality | Medium-High -- validated through usage observation |
| Discovery knowledge consumption | Agents rely on DISCOVERY_CONTEXT for project understanding | Medium -- all prose stripped, only structured content remains |

## 2. Entry Points

### Recommended Entry Point: `formatSkillIndexBlock()` in `common.cjs`

**Rationale**: This is the smallest, most self-contained change. It modifies a single formatting function with clear input/output contract. Tests can verify the new format immediately. Success here builds confidence for the more aggressive persona and discovery tightening.

### Secondary Entry Point: Persona tightening function

**Rationale**: After SKILL_INDEX format is confirmed, add the persona section-stripping function. This is the most aggressive change (stripping section 4 entirely plus sections 6, 8, 9, 10) but has well-defined rules.

## 3. Implementation Order

| Order | FRs | Description | Risk | Parallel | Depends On |
|-------|-----|-------------|------|----------|------------|
| 1 | FR-007 | Implement fail-open wrapper pattern | Low | No | None |
| 2 | FR-001, FR-002 | SKILL_INDEX tightening (banner dedup + compact format + path shortening) | Low | No | FR-007 |
| 3 | FR-003, FR-004 | ROUNDTABLE_CONTEXT persona tightening (strip sections 4, 6, 8, 9, 10; compact section 7) | Medium | Yes (with step 4) | FR-007 |
| 4 | FR-005 | ROUNDTABLE_CONTEXT topic tightening | Low | Yes (with step 3) | FR-007 |
| 5 | FR-006 | DISCOVERY_CONTEXT aggressive prose stripping | Medium | No | FR-007 |
| 6 | FR-008 | Reduction reporting in verbose mode | Low | No | Steps 2-5 |

## 4. Risk Zones

| ID | Risk | Area | Likelihood | Impact | Mitigation |
|----|------|------|-----------|--------|------------|
| RZ-001 | SKILL_INDEX format change breaks agent skill lookup | `formatSkillIndexBlock()` consumers | Medium | High | Add test that verifies skill ID and shortened path are extractable from compact format; document base path convention in section header |
| RZ-002 | Persona section stripping removes content the roundtable actually needs | `rebuildSessionCache()` persona tightening | Medium | High | Preserve sections 1, 2, 3, 5, 7 (compacted); strip sections 4, 6, 8, 9, 10. Section 4 removal is safe because topic files contain identical analytical questions |
| RZ-003 | Orchestrator extraction regex breaks on tightened content | `isdlc.md` step 7a extraction logic | Low | Critical | Preserve `### Persona:` and `### Topic:` delimiters exactly; regression test for extraction |
| RZ-004 | DISCOVERY_CONTEXT aggressive stripping removes facts agents rely on | DISCOVERY_CONTEXT section | Medium | Medium | Preserve all tables, headings, and list items verbatim; only strip prose paragraphs |
| RZ-005 | Reduction falls short of 25-30% target | All sections | Low | High | Each section has aggressive individual targets (50%, 40%, 40%); combined estimate is 48K-55K chars, providing buffer above the 44K minimum |
| RZ-006 | Aggressive tightening degrades agent behavior in practice | All agents consuming cache | Medium | High | Validate through real usage; each tightening function can be individually disabled by catching and returning verbose content |

### Test Coverage Assessment

- `test-session-cache-builder.test.cjs` exists and covers the current `rebuildSessionCache()` behavior
- New tests needed for: compact SKILL_INDEX format with path shortening, persona section stripping (including section 4 removal), topic metadata stripping, aggressive discovery prose stripping, fail-open fallback behavior
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

### Estimated Savings

| Section | Current | Target Reduction | Estimated After | Chars Saved |
|---------|---------|-----------------|-----------------|-------------|
| SKILL_INDEX | 39,866 | 50%+ | ~19,000 | ~21,000 |
| ROUNDTABLE_CONTEXT | 47,092 | 40%+ | ~27,000 | ~20,000 |
| DISCOVERY_CONTEXT | 22,814 | 40%+ | ~13,000 | ~10,000 |
| **Total** | **109,772** | **46%** | **~59,000** | **~51,000** |

51K chars saved from 177K total = ~29% total cache reduction (within the 25-30% target).

### Decision Log

| Decision | Rationale |
|----------|-----------|
| Modify `common.cjs` rather than extracting tightening to separate module | Follows existing pattern where all cache assembly logic lives in `rebuildSessionCache()` |
| Compact skill format with path shortening over simple single-line | Path shortening adds ~9.6K extra savings needed to hit 50% section target |
| Strip section 4 (Analytical Approach) entirely rather than trimming | Topic files contain identical questions; removing eliminates ~3K-4K per persona |
| Strip all prose from DISCOVERY_CONTEXT rather than condensing | REQ-0042 must carry full 25-30% alone; aggressive stripping needed |
| Fail-open over fail-hard | Consistent with framework convention (ADR-0027, Article X) |

### Overall Risk Level: **Medium**

More aggressive than the original spec due to REQ-0041 savings being unproven. The fail-open pattern ensures safety -- worst case is identical to current behavior. The primary risk is agent behavior degradation from aggressive tightening, mitigated by individual adjustability of each tightening function.

**Go/No-Go Recommendation**: **Go** -- well-scoped, low blast radius, higher aggressiveness is justified by the updated target.
