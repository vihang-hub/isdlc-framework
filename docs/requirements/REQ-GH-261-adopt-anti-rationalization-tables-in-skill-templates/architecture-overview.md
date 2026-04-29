# Architecture Overview: Constitutional Quality Enforcement (GH-261)

## 1. Architecture Options

| Option | Summary | Pros | Cons | Verdict |
|---|---|---|---|---|
| A: Individual hooks per concern | Separate .cjs per validator (5 hooks) | Clear separation, independently configurable | 5 files | Selected |
| B: Single quality-gate hook | Monolithic hook checks all criteria | Single file | Hard to configure per-phase, bloated | Eliminated |
| C: Core module + thin wrappers | Logic in src/core/, hooks are wrappers | Testable core | Extra indirection for simple patterns | Overkill for v1 |

## 2. Selected Architecture

### ADR-001: Individual Hooks Per Quality Concern
- **Status**: Accepted
- **Context**: Five distinct quality checks with different firing times (inline vs gate), different phase applicability, and different retry limits.
- **Decision**: One .cjs per concern: deferral-detector, test-quality-validator, spec-trace-validator, security-depth-validator, review-depth-validator.
- **Rationale**: Matches existing pattern (38 hooks). Each independently enabled/disabled. Each has own block signal in 3f dispatch.
- **Consequences**: 5 new files. All follow same template. Shared utilities in common.cjs.

### ADR-002: Deferral-Detector as PreToolUse (Inline Block)
- **Status**: Accepted
- **Context**: Deferral language should be caught at write time, not gate check.
- **Decision**: deferral-detector.cjs fires as PreToolUse on Write and Edit. Inspects content, blocks if deferral patterns found.
- **Rationale**: Immediate feedback. No retry loop. Prevents accumulation.
- **Consequences**: Fires on every Write/Edit — must be <50ms. Exemption list prevents false positives.

### ADR-003: Gate-Check Hooks Use Existing Extension Point
- **Status**: Accepted
- **Context**: gate-blocker fires at phase completion. New quality hooks need same trigger.
- **Decision**: Register as Notification hooks alongside gate-blocker. Each independently checks and returns block/allow.
- **Rationale**: No changes to gate-blocker. Additive. 3f dispatch handles multiple block types.
- **Consequences**: Multiple hooks can block same phase transition. 3f processes in order.

## 3. Technology Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Hook language | CJS | All existing hooks are CJS. Claude Code loads synchronously. |
| Pattern matching | Regex | Simple, fast. No AST parsing for v1. |
| AC extraction | Regex on requirements-spec.md | Parse AC-NNN-NN patterns. |
| Test scanning | fs.readdirSync + regex | Scan test dirs for traces and assertions. |
| Git diff | execSync('git diff') | Existing pattern in blast-radius-validator. |

## 4. Integration Architecture

| Source | Target | Interface |
|---|---|---|
| Write/Edit call → deferral-detector | PreToolUse | Inspect content, allow/block |
| Phase completion → test-quality-validator | Notification | Read tests + spec, allow/block |
| Phase completion → spec-trace-validator | Notification | Read diff + tasks.md, allow/block |
| Phase completion → security-depth-validator | Notification | Read modified files, allow/block |
| Phase completion → review-depth-validator | Notification | Read Phase 08 output, allow/block |
| Block message → Phase-Loop Controller 3f | Existing protocol | New signals, max 5 retries |

## 5. Summary

| Decision | Choice | Risk |
|---|---|---|
| Hook architecture | Individual hooks per concern | Low |
| Deferral timing | Inline (PreToolUse) | Low |
| Quality hooks timing | Gate check (Notification) | Low |
| Pattern approach | Regex, no AST | Low (may need AST later for #270) |

**Go/No-Go**: Go — fits existing infrastructure perfectly, 5 additive hooks, no architectural changes.
