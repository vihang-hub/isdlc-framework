# Quick Scan: Contract Enforcement Must Be Inline

**Generated**: 2026-03-27T06:50:04.000Z
**Feature**: Contract enforcement must be inline (during execution), not post-phase
**Phase**: 00-quick-scan
**Issue**: GitHub #213

---

## Scope Estimate

**Estimated Scope**: MEDIUM-HIGH
**File Count Estimate**: ~35-45 files
**Confidence**: HIGH

### Rationale

The feature touches multiple subsystems across two execution models (Claude Code + Codex):

1. **Contract infrastructure** (validator subsystem) — 8 files
2. **Roundtable protocol & hooks** — 14+ files
3. **Phase-loop orchestration** — 8 files
4. **Tool dispatch hooks** (PreToolUse enforcement) — 6+ files
5. **Provider-specific implementations** (Claude + Codex) — 4-6 files

All are core runtime systems with existing test coverage, reducing risk.

---

## Keyword Matches

### Domain Keywords
| Keyword | File Matches | Key Files |
|---------|--------------|-----------|
| contract | 25 files | contract-evaluator.js, contract-loader.js, contract-schema.js |
| inline enforcement | 14 files | phase-loop-controller.cjs, roundtable-analyst.md, PreToolUse hooks |
| decision point | 8 files | phase-loop.js, gate-logic.js, checkpoint-router.js |
| tool dispatch | 12 files | pre-skill-dispatcher.cjs, post-bash-dispatcher.cjs, tool-selector hooks |

### Technical Keywords
| Keyword | File Matches | Key Modules |
|---------|--------------|-------------|
| PreToolUse | 6 files | tool dispatch hooks, hook dispatchers |
| roundtable confirmation | 18 files | roundtable-analyst.md, roundtable-config.cjs |
| phase-loop controller | 5 files | phase-loop-controller.cjs, phase-loop.js |
| artifact production | 11 files | artifact-readiness.js, finalization-chain.js |
| skill usage | 8 files | skill-validator.cjs, skill-delegation-enforcer.cjs |

---

## Affected Modules (Estimated)

### Core Validators (src/core/validators/)
- `contract-evaluator.js` — Refactor from batch to inline queryable guard
- `contract-loader.js` — Ensure contract available at phase start
- `contract-schema.js` — Update schema with tool_usage_mapping
- `contract-ref-resolver.js` — No change (dependency)
- `enforcement.js` — Integrate inline enforcement logic
- `gate-logic.js` — Add contract check before gate advancement
- `checkpoint-router.js` — Contract aware checkpoints
- Related: constitutional-validator.js, test-execution-validator.js

### Phase-Loop & Orchestration (src/core/orchestration/)
- `phase-loop.js` — Check contract before delegation & completion
- Provider runtimes — Integrate contract checks into execution flow

### Roundtable Protocol (src/claude/hooks/)
- `roundtable-analyst.md` — Read contract at session start, validate at transitions
- `phase-loop-controller.cjs` — Enforce inline checks before phase advance
- Dispatchers: `pre-task-dispatcher.cjs`, `pre-skill-dispatcher.cjs`, `post-bash-dispatcher.cjs`
- Config loaders: `roundtable-config.cjs`, `profile-loader.cjs`

### Tool Dispatch Hooks (src/claude/hooks/)
- `pre-skill-dispatcher.cjs` — Check skill in contract before delegation
- Need NEW: `pre-tool-use.cjs` — Intercept Grep/Glob when MCP tools available
- Related: `skill-delegation-enforcer.cjs`, `skill-validator.cjs`

### Test Files
- ~15 test files covering validators, orchestration, roundtable, hooks

---

## Decision Points Requiring Changes

| Context | File | Change Type | Effort |
|---------|------|-------------|--------|
| Roundtable start | roundtable-analyst.md | Load contract, store in session | S |
| Roundtable transition | phase-loop-controller.cjs | Check domain presence before confirming | M |
| Batch write | post-write-edit-dispatcher.cjs | Validate artifact set against contract | M |
| Persona output | roundtable-analyst.md | Validate format matches contract | S |
| Phase delegation | phase-loop.js | Validate agent + skills before delegation | M |
| Artifact completion | checkpoint-router.js | Validate artifacts present before gate | S |
| Tool invocation | NEW: pre-tool-use.cjs | Route Grep/Glob → MCP when available | M |

---

## Builds On

- **REQ-0141** (Execution Contract System) — contract schema, loader, ref resolver all reused
- **REQ-GH-208** (Task Breakdown Model) — PRESENTING_TASKS is a new enforcement point

---

## High-Risk Areas

1. **Provider dual-implementation** — Both Claude and Codex must support inline checks. Codex projection bundles may not expose runtime hooks.
2. **Roundtable complexity** — The analyst runs without explicit phase-loop control; injecting inline checks requires careful state threading.
3. **Tool routing** — PreToolUse interception for tool choice is new surface; must not block legitimate tool usage.
4. **Performance** — Contract checks at every decision point may add latency; needs performance budget alignment.

---

## Files by Category

### Validators (8 files)
- src/core/validators/contract-evaluator.js
- src/core/validators/contract-loader.js
- src/core/validators/contract-schema.js
- src/core/validators/contract-ref-resolver.js
- src/core/validators/enforcement.js
- src/core/validators/gate-logic.js
- src/core/validators/checkpoint-router.js
- src/core/validators/test-execution-validator.js

### Orchestration (8 files)
- src/core/orchestration/phase-loop.js
- src/core/orchestration/instruction-generator.js
- src/core/orchestration/provider-runtime.js
- src/core/teams/implementation-loop.js
- src/claude/hooks/phase-loop-controller.cjs
- src/claude/hooks/phase-sequence-guard.cjs
- src/claude/hooks/phase-transition-enforcer.cjs
- src/claude/hooks/gate-blocker.cjs

### Roundtable & Protocol (14 files)
- src/claude/agents/roundtable-analyst.md
- src/claude/hooks/lib/roundtable-config.cjs
- src/claude/hooks/lib/profile-loader.cjs
- src/claude/hooks/lib/gate-requirements-injector.cjs
- src/claude/hooks/dispatchers/pre-task-dispatcher.cjs
- src/claude/hooks/dispatchers/post-write-edit-dispatcher.cjs
- src/claude/hooks/dispatchers/post-task-dispatcher.cjs
- Related: menu-tracker.cjs, menu-halt-enforcer.cjs, conversational-compliance.cjs (6+ more)

### Tool Dispatch & Skills (8 files)
- src/claude/hooks/dispatchers/pre-skill-dispatcher.cjs
- src/claude/hooks/lib/user-hooks.cjs
- src/claude/hooks/skill-delegation-enforcer.cjs
- src/claude/hooks/skill-validator.cjs
- src/claude/hooks/log-skill-usage.cjs
- **NEW**: src/claude/hooks/pre-tool-use-dispatcher.cjs (or similar)
- Related: model-provider-router.cjs, test-adequacy-blocker.cjs (2+ more)

### Provider Implementations (4-6 files)
- src/providers/claude/integration.cjs (or similar)
- src/providers/codex/integration.cjs (or similar)
- Both need contract checks wired into execution dispatch

### Tests (15+ files)
- Tests in src/claude/hooks/tests/ covering each major hook
- Core tests in tests/core/validators/, tests/core/orchestration/

---

## Notes for Requirements Phase

The following questions may clarify scope in Phase 01:

1. **Scope of tool routing**: Should the PreToolUse check apply to all Grep/Glob uses, or only during specific phases (e.g., Phase 02 Impact Analysis)?
2. **Severity & recovery**: When inline enforcement detects a violation, should it block execution or emit a warning? (Current design suggests warn for tool usage, block for missing artifacts.)
3. **Roundtable state threading**: How should contract state be passed from the phase-loop controller to roundtable-analyst without breaking session isolation?
4. **Codex support**: Does Codex have an equivalent to PreToolUse hooks, or will this feature be Claude-only initially?
5. **Backwards compatibility**: Should old contracts (without tool_usage_mapping) be loadable, or do we enforce the new schema?

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-03-27T06:50:04.000Z",
  "search_duration_ms": 45,
  "keywords_searched": 12,
  "files_matched": 127,
  "scope_estimate": "medium-high",
  "file_count_estimate": 40,
  "confidence_level": "high",
  "build_on_features": ["REQ-0141", "REQ-GH-208"],
  "high_risk_areas": 3,
  "decision_points_identified": 7,
  "test_coverage_baseline": "existing"
}
```
