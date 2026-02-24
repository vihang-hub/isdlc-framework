# Reverse-Engineered Acceptance Criteria - Index

**Generated**: 2026-02-07
**Method**: Full behavior extraction from source code analysis
**Total AC**: 87 acceptance criteria across 7 business domains
**Confidence**: HIGH (derived from actual source code, not documentation)

---

## Domain Organization

| # | Domain | File | AC Count | Priority Breakdown |
|---|--------|------|----------|-------------------|
| 1 | [Workflow Orchestration](./domain-01-workflow-orchestration.md) | domain-01 | 14 | 5 Critical, 6 High, 3 Medium |
| 2 | [Installation & Lifecycle](./domain-02-installation-lifecycle.md) | domain-02 | 16 | 4 Critical, 8 High, 4 Medium |
| 3 | [Iteration Enforcement](./domain-03-iteration-enforcement.md) | domain-03 | 18 | 7 Critical, 8 High, 3 Medium |
| 4 | [Skill Observability](./domain-04-skill-observability.md) | domain-04 | 10 | 2 Critical, 5 High, 3 Medium |
| 5 | [Multi-Provider LLM Routing](./domain-05-provider-routing.md) | domain-05 | 9 | 3 Critical, 4 High, 2 Medium |
| 6 | [Constitution Management](./domain-06-constitution-management.md) | domain-06 | 8 | 2 Critical, 4 High, 2 Medium |
| 7 | [Monorepo & Project Detection](./domain-07-monorepo-detection.md) | domain-07 | 12 | 3 Critical, 6 High, 3 Medium |
| 8 | [Agent Orchestration](./domain-08-agent-orchestration.md) | domain-08 | TBD | Generated at runtime by D6 Step 9 |

---

## Priority Legend

- **Critical**: Core functionality that, if broken, prevents framework from operating
- **High**: Important behavior that affects user experience or data integrity
- **Medium**: Secondary behavior, edge cases, or convenience features

## Source Files Analyzed

### Production Code (12,895 lines across 17 files)
- `lib/cli.js` (233 lines) - CLI command router
- `lib/installer.js` (845 lines) - Cross-platform installer
- `lib/updater.js` (550 lines) - In-place updater
- `lib/uninstaller.js` (514 lines) - Safe uninstaller
- `lib/doctor.js` (238 lines) - Health checker
- `lib/project-detector.js` (277 lines) - Project type detection
- `lib/monorepo-handler.js` (247 lines) - Monorepo detection
- `lib/utils/fs-helpers.js` (250 lines) - File system helpers
- `lib/utils/logger.js` (137 lines) - Structured logging
- `lib/utils/prompts.js` (110 lines) - Interactive prompts
- `src/claude/hooks/gate-blocker.js` (575 lines) - Gate advancement blocker
- `src/claude/hooks/iteration-corridor.js` (337 lines) - Iteration corridor enforcement
- `src/claude/hooks/skill-validator.js` (202 lines) - Skill observability
- `src/claude/hooks/log-skill-usage.js` (175 lines) - Skill usage logger
- `src/claude/hooks/constitution-validator.js` (323 lines) - Constitutional validation
- `src/claude/hooks/menu-tracker.js` (261 lines) - Menu interaction tracker
- `src/claude/hooks/test-watcher.js` (545 lines) - Test result watcher
- `src/claude/hooks/model-provider-router.js` (153 lines) - Provider router
- `src/claude/hooks/lib/common.js` (898 lines) - Shared hook utilities
- `src/claude/hooks/lib/provider-utils.js` (894 lines) - Provider utilities

### Test Code (555 tests across 20 files)
- `lib/*.test.js` (302 ESM tests)
- `src/claude/hooks/tests/*.test.cjs` (253 CJS tests)

### Shell Scripts (2,609 lines)
- `install.sh` (1,162 lines)
- `uninstall.sh` (867 lines)
- `update.sh` (580 lines)
