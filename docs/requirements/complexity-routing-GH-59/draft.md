# Complexity-based routing — Phase 00 recommends workflow tier including trivial direct-edit path

**Source**: GitHub Issue #59
**Type**: Enhancement
**Category**: Workflow Quality

## Summary

The framework's lightest path (`-light`) still runs 6 phases with gates, branches, and constitutional validation. For trivial changes (1-2 files, single concern, no architectural impact), this is overkill and users bypass the framework entirely. Sizing tiers only kick in after Phase 02 during `build` — too late.

## Design

Phase 00 (quick scan) produces a `recommended_tier` based on scope estimation:

| Tier | Criteria | Recommended Path |
|------|----------|-----------------|
| **trivial** | 1-2 files, single concern, no architectural impact | Direct edit (no workflow) |
| **light** | 3-8 files, single module, low risk | `/isdlc build -light` |
| **standard** | 9-20 files, cross-module, moderate risk | `/isdlc build` |
| **epic** | 20+ files, cross-cutting, high risk | `/isdlc build` with decomposition |

### Trivial Tier Behavior

- No workflow, no branches, no gates
- Framework makes the edit directly
- **Still records the change in the requirements folder** — creates/updates `docs/requirements/{slug}/` with a lightweight change record (what changed, why, files modified, commit SHA) so the audit trail is preserved even without a full workflow

### Key Principle

Framework **recommends**, user **decides**. Trivial is a first-class framework option, not a bypass.

## Sync Points

- `analyze` step 8: display recommended tier at completion
- `build` step 4a: present tier menu with recommended tier as default

## Related

- #51 — Sizing decision prompts user (completed)
- #57 — Sizing decision in analyze verb
- Adaptive workflow sizing (Phase 02 post-impact-analysis)

## Complexity

Medium — quick scan scoring logic, meta.json schema extension, build auto-detection update, trivial-tier execution path with requirements folder recording
