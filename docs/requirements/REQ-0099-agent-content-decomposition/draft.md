# Agent content decomposition — RoleSpec + RuntimePackaging

## Source
- GitHub Issue: #163 (CODEX-030)
- Workstream: D (Content Model), Phase: 5

## Description
Decompose 47 agent markdown files into: (1) provider-neutral RoleSpec (role identity, purpose, phase applicability, responsibilities, inputs/outputs, loop/validator expectations, owned skills), and (2) provider-specific RuntimePackaging (tool names, delegation mechanism, recovery protocol, formatting, prompt tuning).

## Dependencies
- REQ-0074 (Content audit sizing) — completed

## Context
Agent markdown files are the most deeply Claude-specific content. They contain mixed content: durable role semantics (what the agent does) interleaved with Claude-specific runtime instructions (how it uses Claude Code tools). This item classifies each section of each agent file as RoleSpec or RuntimePackaging, producing a classification schema that future decomposition can use.

47 agent files: 38 in src/claude/agents/*.md + 9 in subdirectories (impact-analysis/, tracing/).
