# Add sizing decision to analyze verb

**Source**: GitHub Issue #57
**Type**: Enhancement
**Category**: Workflow Quality

## Summary

The sizing decision (light/standard/epic) currently only exists in the **build** workflow (STEP 3e-sizing, after Phase 02 Impact Analysis). Users who run `/isdlc analyze` always go through all 5 analysis phases (00-04) including architecture and design — even for trivial changes like changing a button color.

This means:
- Users who analyze first **never see the sizing menu**, because by the time they build, phases 03-04 are already done
- The `-light` flag only works on `build`, not `analyze`
- There's no way to skip architecture/design during standalone analysis

## Proposed Behavior

After Phase 02 (Impact Analysis) completes within the analyze flow, offer the same sizing menu currently shown in build:

```
WORKFLOW SIZING RECOMMENDATION: Light
  [A] Accept recommendation (skip architecture & design)
  [O] Override (choose different intensity)
  [S] Show full impact analysis
```

If **light** is accepted:
- Skip phases `03-architecture` and `04-design` in the analyze run
- Record sizing decision in `meta.json` so build can honor it later
- Update `analysis_status` to `"analyzed"` after Phase 02 (since 03/04 are intentionally skipped)

The `-light` flag should also work on analyze: `/isdlc analyze -light "change button color"`

## Design Considerations

- Analyze is stateless (NFR-002: no state.json writes) — sizing must be stored in `meta.json` only
- `computeStartPhase()` in build must recognize that 03/04 were skipped by sizing (not missing)
- `deriveAnalysisStatus()` needs to account for intentionally-skipped phases vs incomplete phases
- ADR-0001-sizing-insertion-point.md may need updating to cover the analyze insertion point

## Related

- #51 — Sizing decision must always prompt the user (completed)
- ADR-0001 — Sizing insertion point (currently build-only)
- REQ-0011 — Adaptive workflow sizing
