# Replace 24h staleness discovery context injection with project skills

**Source**: GitHub #90
**Source ID**: GH-90
**Type**: REQ (enhancement)
**Labels**: enhancement, Skills management

---

## Summary

Once project skills are in place (#88, #89), the special-case discovery context injection on line 1706 of isdlc.md becomes redundant and should be removed.

## Current Behavior (line 1706)

```
If phase_key starts with 02- or 03-, read state.json -> discovery_context.
If it exists and completed_at is within 24 hours, include as DISCOVERY CONTEXT block.
If older than 24h, include with STALE warning. Otherwise omit.
```

Problems with this approach:
- Only phases 02-03 get discovery context -- other phases are blind
- 24h expiry is arbitrary -- project knowledge doesn't expire
- Analyze phase gets nothing
- Injects a blob of JSON, not structured actionable knowledge

## New Behavior

- **Remove** the discovery context injection block from STEP 3d
- **Remove** the `discovery_context` envelope from state.json (or deprecate)
- Project skills in the AVAILABLE SKILLS block provide the same knowledge to **all phases**, in a structured format, with no expiry
- The discover orchestrator still writes `discovery_context.completed_at` to state.json for audit/provenance, but it's no longer used for injection

## Migration

- The `discovery_context` field in state.json can be retained as metadata (when was discover last run?) but is no longer read during phase delegation
- Existing projects that haven't re-run discover will have no project skills but also won't get the old injection -- fail-open behavior means no breakage

## Depends On

- #88 (project skills distillation) -- DONE
- #89 (project skill directory and manifest) -- DONE
- #84 (skill index injection wired) -- DONE

## Files

- `src/claude/commands/isdlc.md` (remove discovery context injection block from STEP 3d)
- `src/claude/agents/discover-orchestrator.md` (update envelope documentation)

## Acceptance Criteria

- [ ] Discovery context injection block removed from isdlc.md STEP 3d
- [ ] All phases receive project knowledge via AVAILABLE SKILLS (not just 02-03)
- [ ] Analyze phase benefits from project skills (no special wiring needed)
- [ ] No 24h staleness logic remains
- [ ] Existing projects without project skills still work (fail-open)
