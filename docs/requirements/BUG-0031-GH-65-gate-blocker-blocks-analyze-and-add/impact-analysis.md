# Impact Analysis: BUG-0031 -- gate-blocker blocks /isdlc analyze and /isdlc add

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-02-22
**Coverage**: Blast radius (all 3 tiers), entry points, risk zones, implementation order

---

## Blast Radius

### Tier 1: Direct Changes (files we modify)

| File | Change Type | Description |
|------|------------|-------------|
| `src/claude/hooks/gate-blocker.cjs` | Modify | Add EXEMPT_ACTIONS set and action verb parsing to `isGateAdvancementAttempt()` Skill branch (lines 117-133) |
| `src/claude/hooks/iteration-corridor.cjs` | Modify | Add EXEMPT_ACTIONS set and action verb parsing to `skillIsAdvanceAttempt()` (lines 189-205) |
| `src/claude/hooks/tests/test-gate-blocker-extended.test.cjs` | Modify | Add test cases for analyze/add verb exemption |

### Tier 2: Transitive Impact (files that depend on changed files)

| File | Impact | Risk |
|------|--------|------|
| `src/claude/hooks/dispatchers/pre-skill-dispatcher.cjs` | Imports `gate-blocker.cjs` and `iteration-corridor.cjs` via `require('../gate-blocker.cjs')` and `require('../iteration-corridor.cjs')`. No code change needed but behavior changes. | Low -- the dispatcher calls `check()` which now allows more inputs through. |
| `.claude/hooks/gate-blocker.cjs` | Runtime copy. Must be synced after src changes. | Low -- standard sync process. |
| `.claude/hooks/iteration-corridor.cjs` | Runtime copy. Must be synced after src changes. | Low -- standard sync process. |
| `.claude/hooks/dispatchers/pre-skill-dispatcher.cjs` | Runtime copy. No change needed. | None. |

### Tier 3: Potential Side Effects

| Area | Risk | Likelihood |
|------|------|------------|
| Other hooks in pre-skill-dispatcher chain | constitutional-iteration-validator is the 3rd hook. If gate-blocker now allows `analyze`/`add` through, the constitutional-iteration-validator also runs. But it checks `isGateInvocation()` which would return false for `analyze`/`add` args (no gate keywords in the action verb). | Very Low |
| PostToolUse skill-delegation-enforcer | Already exempts `analyze`/`add`. No behavioral change. | None |
| Existing workflows | The `build`, `advance`, `gate-check` verbs are unaffected. Only `analyze` and `add` get new exemptions. | None |
| State.json integrity | `analyze` and `add` do not write to state.json by design. Allowing them through hooks does not introduce state corruption risk. | None |

## Summary Metrics

| Category | Count |
|----------|-------|
| Direct modifications | 2 source files |
| New files | 0 |
| Test file modifications | 1 |
| Restructured files | 0 |
| Transitive modifications | 2 runtime copies (sync) |
| Total affected | 5 files |

## Entry Points

### Recommended Starting Point: `gate-blocker.cjs` isGateAdvancementAttempt()

The fix starts at line 117 of `gate-blocker.cjs`, inside the `if (toolName === 'Skill')` branch. Add the EXEMPT_ACTIONS check before the `args.includes('advance') || args.includes('gate')` check.

**Rationale**: This is the hook that produced the observed error message. Fixing it first resolves the user-facing bug immediately. The iteration-corridor fix follows the same pattern.

## Implementation Order

1. **gate-blocker.cjs** -- Add EXEMPT_ACTIONS constant and action verb parsing to `isGateAdvancementAttempt()`
2. **iteration-corridor.cjs** -- Add same EXEMPT_ACTIONS constant and action verb parsing to `skillIsAdvanceAttempt()`
3. **test-gate-blocker-extended.test.cjs** -- Add test cases verifying exemption and non-regression
4. **Sync runtime copies** -- Copy modified files to `.claude/hooks/`

## Risk Zones

### Risk 1: Regex Action Parsing Edge Cases
- **Likelihood**: Low
- **Impact**: Medium (could fail to exempt valid analyze/add commands)
- **Mitigation**: Use the exact same regex pattern from `skill-delegation-enforcer.cjs` line 72, which is already battle-tested. Test with edge cases: empty args, flag-prefixed args, quoted descriptions.

### Risk 2: Future Verb Additions
- **Likelihood**: Medium (new verbs may be added to the three-verb model)
- **Impact**: Low (new verbs would need to be added to EXEMPT_ACTIONS in 3 places)
- **Mitigation**: Add a comment in each EXEMPT_ACTIONS definition referencing the canonical list in `skill-delegation-enforcer.cjs`. Consider extracting to `common.cjs` in a future refactor if the list grows.

### Risk 3: Accidental Exemption of build Verb
- **Likelihood**: Very Low
- **Impact**: High (would allow gate bypass for build workflows)
- **Mitigation**: The EXEMPT_ACTIONS set explicitly includes only `analyze` and `add`. The `build` verb is intentionally excluded. Test case AC-004-04 verifies this.

## Test Coverage Assessment

| Area | Current Coverage | After Fix |
|------|-----------------|-----------|
| Gate advancement detection | Good (6 tests) | Good + 4 new tests |
| Setup command bypass | Good (2 tests) | Unchanged |
| Requirement checks | Good (8+ tests) | Unchanged |
| Analyze/add exemption | None | 4 new tests |
| Iteration-corridor exemption | None | Consider adding in follow-up |
