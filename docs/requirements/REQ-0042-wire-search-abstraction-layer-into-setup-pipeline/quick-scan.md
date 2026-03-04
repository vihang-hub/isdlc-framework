# Quick Scan: Wire Search Abstraction Layer into Setup Pipeline

**Status**: Complete
**Confidence**: High
**Last Updated**: 2026-03-03
**Coverage**: Keywords (high), File Matches (high), Scope Estimate (high)

---

## Scope Estimate

**Estimated Scope**: Large
**File Count Estimate**: ~25-35 files
**Confidence**: High

---

## Keyword Matches

### Domain Keywords
| Keyword | File Matches |
|---------|--------------|
| search | 18 files (lib/search/*.js) |
| detection | 2 files (lib/search/detection.js, detection.test.js) |
| install | 4 files (lib/search/install.js, install.test.js, lib/installer.js, lib/cli.js) |
| MCP | 3 files (lib/search/install.js, .claude/settings.json, architecture-overview.md) |
| setup pipeline | 1 file (lib/installer.js) |

### Technical Keywords
| Keyword | File Matches |
|---------|--------------|
| quick-scan-agent | 1 file (src/claude/agents/quick-scan/quick-scan-agent.md) |
| impact-analysis | 6 files (src/claude/agents/impact-analysis/*.md) |
| architecture-analyzer | 1 file (src/claude/agents/discover/architecture-analyzer.md) |
| feature-mapper | 1 file (src/claude/agents/discover/feature-mapper.md) |
| Grep/Glob | 48+ agent files reference these tools |

---

## Relevant Modules

Based on codebase scan:

- `lib/search/` - Complete search abstraction layer (8 modules, all implemented with tests)
- `lib/installer.js` - Setup pipeline (7-step install function, ~900 lines)
- `lib/cli.js` - CLI command router (parses flags, delegates to installer)
- `src/claude/agents/quick-scan/quick-scan-agent.md` - Primary migration target
- `src/claude/agents/impact-analysis/` - 5 agent files (orchestrator + 4 sub-agents)
- `src/claude/agents/discover/` - 16 agent files (architecture-analyzer, feature-mapper are targets)

---

## Key Findings

1. All `lib/search/` modules exist and have test coverage from REQ-0041
2. The `lib/installer.js` `install()` function has 7 steps; search setup would be a new step
3. The CLI (`lib/cli.js`) currently does not parse a `--no-search-setup` flag
4. Agent files use `Grep` and `Glob` tool names in their markdown instructions
5. Agent migration involves updating markdown guidance, not runtime code

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-03-03T00:00:00Z",
  "search_duration_ms": 3500,
  "keywords_searched": 10,
  "files_matched": 35,
  "scope_estimate": "large"
}
```
