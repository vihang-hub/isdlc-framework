---
name: project-conventions
description: Distilled project conventions -- naming, error handling, file organization, patterns
skill_id: PROJ-002
owner: discover-orchestrator
collaborators: []
project: isdlc-framework
version: 1.0.0
when_to_use: When writing new code, reviewing code, or making style decisions
dependencies: []
---

# Project Conventions

## Naming Conventions
- Files: `kebab-case.js` (ESM), `kebab-case.cjs` (CommonJS), `kebab-case.test.{js|cjs}` (tests)
- Phase agents: `{NN}-{role}.md` (e.g., `05-software-developer.md`)
- Hooks: `{kebab-case}.cjs` (e.g., `gate-blocker.cjs`)
- Skills: `{skill-name}/SKILL.md` (directory per skill)
- Contracts: `{workflow-type}.contract.json`
- Functions/methods: camelCase
- Constants: UPPER_SNAKE_CASE (exported), camelCase (local)
- Variables: camelCase

## Error Handling Patterns
- Hooks: fail-open by default (log warning, allow operation) unless security-critical
- Gates: fail-closed (block phase advance until all criteria met)
- State writes: validated against JSON schemas before persistence
- Agent failures: retry once, then surface to user with context
- CLI commands: wrap in try/catch, display user-friendly error, exit non-zero
- Bridge modules: catch import errors, return fallback values

## File Organization
- `bin/` -- CLI entry points (ESM)
- `lib/` -- CLI modules, embedding, search (ESM, with co-located .test.js files)
- `src/core/` -- Provider-neutral business logic (ESM, tests in tests/core/)
- `src/core/bridge/` -- CJS wrappers for ESM modules
- `src/providers/{claude,codex}/` -- Provider-specific adapters
- `src/claude/hooks/` -- Runtime enforcement hooks (CJS)
- `src/claude/hooks/lib/` -- Shared hook utilities (CJS)
- `src/claude/hooks/dispatchers/` -- Event routing (CJS)
- `src/claude/hooks/config/` -- Configuration files (JSON, YAML)
- `src/claude/agents/` -- Agent markdown specifications
- `src/claude/skills/` -- Skill definitions (SKILL.md per skill)
- `src/claude/commands/` -- Command handler specifications
- `src/antigravity/` -- Workflow automation scripts (CJS)
- `tests/` -- Test files mirroring src/ structure
- `docs/` -- Requirements, architecture, design, isdlc config

## Framework Usage
- Node.js built-in test runner (`node --test`) -- no external test framework
- `node:assert` strict mode for assertions
- `chalk` v5 for terminal colors (ESM-only import)
- `fs-extra` for filesystem operations in CLI modules
- `js-yaml` for YAML parsing
- `semver` for version comparison
- `onnxruntime-node` for local CodeBERT embeddings
- Single-line bash convention: all bash in agent/command files must be one line (for permission auto-allow)
- Dual-file awareness (dogfooding): changes to src/ must also update root .isdlc/ and .claude/

## Provenance
- **Source**: docs/project-discovery-report.md (patterns/conventions section)
- **Distilled**: 2026-03-28
- **Discovery run**: full
