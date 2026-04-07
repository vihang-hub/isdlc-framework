---
name: project-architecture
description: Distilled project architecture -- components, boundaries, data flow, key patterns
skill_id: PROJ-001
owner: discover-orchestrator
collaborators: []
project: isdlc-framework
version: 1.0.0
when_to_use: When making architectural decisions, assessing impact, or designing modules
dependencies: []
---

# Project Architecture

## Components
- **CLI Entry** (`bin/isdlc.js` -> `lib/cli.js`): ESM command router, 8 commands
- **CLI Modules** (`lib/*.js`): 12 prod modules -- installer, updater, uninstaller, doctor, project-detector, monorepo-handler, memory, search setup
- **Embedding Pipeline** (`lib/embedding/`): 28 modules -- chunking, Jina v2/OpenAI/Voyage engines, aggregation, distribution, redaction, MCP server
- **Search Subsystem** (`lib/search/`): 12 modules -- backend-routed (lexical, semantic, structural, indexed), config, router, ranker
- **Core Layer** (`src/core/`): 112 provider-neutral ESM modules across 19 subdomains (analyze, backlog, bridge, compliance, config, content, discover, installer, memory, observability, orchestration, providers, search, skills, state, tasks, teams, validators, workflow)
- **Bridge Layer** (`src/core/bridge/`): 18 CJS modules wrapping ESM core for hook consumption via dynamic `import()`
- **Provider: Claude** (`src/providers/claude/`): 5 modules -- hooks adapter, installer, projection, runtime
- **Provider: Codex** (`src/providers/codex/`): 6 modules -- governance, installer, projection, runtime, verb-resolver
- **Runtime Hooks** (`src/claude/hooks/`): 30 hooks + 5 dispatchers + 14 lib modules (CJS, stdin/stdout JSON protocol)
- **Antigravity Scripts** (`src/antigravity/`): 14 CJS workflow automation scripts
- **Agent Definitions** (`src/claude/agents/`): 70 markdown agent specs
- **Skill Definitions** (`src/claude/skills/`): 276 SKILL.md files across 19 categories
- **Packages** (`packages/bulk-fs-mcp/`): MCP server for bulk file ops

## Data Flow
- User -> Claude Code -> Hooks (pre/post tool interception) -> Agent delegation -> Phase work -> Gate validation -> Phase advance
- CLI (bin/isdlc.js) -> lib/cli.js -> lib/{installer,updater,uninstaller}.js -> file system operations
- Hooks read stdin JSON -> process via hook lib -> write stdout JSON (allow/block/modify)
- Core bridge: CJS hooks -> bridge/*.cjs -> dynamic import() -> src/core/*.js (ESM)
- Embedding: Source files -> chunker -> engine (Jina v2 via Transformers.js) -> aggregation -> .emb file

## Integration Points
| Integration | Type | Protocol | Notes |
|-------------|------|----------|-------|
| Claude Code | External | Task tool + hooks (stdin/stdout JSON) | Primary provider |
| Codex | External | codex exec + AGENTS.md projection | Secondary provider |
| GitHub | External | gh CLI + GitHub Actions | CI/CD, issues |
| code-index-mcp | MCP | MCP protocol | Code search |
| bulk-fs-mcp | MCP (local) | MCP protocol | Bulk file ops |
| Jina v2 Base Code | Local | @huggingface/transformers | Offline embeddings |

## Architectural Patterns
- **Dual Module System**: ESM for core/lib, CJS for hooks (Claude Code protocol requirement)
- **Bridge Pattern**: src/core/bridge/*.cjs wraps ESM for CJS consumers
- **Provider Abstraction**: Provider-neutral core + provider-specific adapters
- **Hook Architecture**: PreToolUse/PostToolUse/Stop/Notification hooks with dispatchers
- **Team Patterns**: Debate (Creator->Critic->Refiner), Fan-out (parallel), Dual-track (impl+review)
- **Contract Enforcement**: .contract.json files define workflow compliance rules
- **Filesystem State**: All persistence via JSON files, schema-validated writes

## Provenance
- **Source**: docs/project-discovery-report.md, codebase analysis
- **Distilled**: 2026-03-28
- **Discovery run**: full
