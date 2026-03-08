# Quick Scan: User-Space Hooks

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-08
**Coverage**: 100%

---

## Codebase Summary

- **Total framework hooks**: 26 (in `src/claude/hooks/`)
- **Hook API contract**: Documented in `docs/isdlc/hooks-api-contract.md`
- **Antigravity scripts**: 14 CJS files in `src/antigravity/`
- **Primary integration points**: `phase-advance.cjs`, `workflow-init.cjs`, `workflow-finalize.cjs`

## Relevant Files

| File | Relevance |
|------|-----------|
| `src/antigravity/phase-advance.cjs` | Gate validation and phase advancement -- pre-gate and post-phase hook execution point |
| `src/antigravity/workflow-init.cjs` | Workflow initialization -- pre-workflow hook execution point |
| `src/antigravity/workflow-finalize.cjs` | Workflow finalization -- post-workflow hook execution point |
| `src/claude/hooks/lib/common.cjs` | Shared utilities (getProjectRoot, readState) -- reusable for hook discovery |
| `src/claude/hooks/lib/gate-logic.cjs` | Gate requirement checks -- user hooks integrate before these run |
| `docs/isdlc/hooks-api-contract.md` | Existing hook API documentation -- user hooks are architecturally distinct |
| `docs/isdlc/hackability-roadmap.md` | Roadmap context -- Tier 2, Layer 3 (Extend) |

## Key Observations

1. **Clear separation**: Framework hooks (`src/claude/hooks/`) use Claude Code's JSON stdin/stdout protocol. User-space hooks (`.isdlc/hooks/`) will use shell execution with exit codes. No overlap.
2. **Phase names are strings**: `workflow-init.cjs` defines phases as string arrays (e.g., `['00-quick-scan', '01-requirements', ...]`). User hooks need phase name resolution for friendly aliases.
3. **No existing `.isdlc/config.json` reader**: The framework reads iteration requirements from `src/claude/hooks/config/iteration-requirements.json`, not from `.isdlc/config.json`. A config reader for user-space settings (hook timeout, etc.) would be new infrastructure.
4. **Change summary generator exists**: `src/antigravity/change-summary-generator.cjs` already runs during `workflow-finalize.cjs`. User hooks can consume its output.

## Module Distribution

- `src/antigravity/`: 14 files -- workflow lifecycle management
- `src/claude/hooks/`: ~26 hooks -- framework enforcement
- `src/claude/hooks/lib/`: Shared utilities (common.cjs, gate-logic.cjs)
- `src/claude/hooks/config/`: Configuration and schemas
