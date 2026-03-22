# Command system decomposition

## Source
- GitHub Issue: #165 (CODEX-032)
- Workstream: D (Content Model), Phase: 5

## Description
Decompose isdlc.md, provider.md, discover.md, tour.md into: shared command semantics and workflow meaning vs Claude markdown command packaging vs Codex command/invocation execution model. isdlc.md is a major migration workstream in its own right.

## Dependencies
- REQ-0074 (Content audit sizing) — completed

## Context
4 command files in src/claude/commands/. isdlc.md is the largest (~4000 lines) and contains the entire workflow orchestration protocol (Phase-Loop Controller, build handler, analyze handler, etc.). It's deeply Claude-specific in its tool usage patterns but the workflow semantics are provider-neutral.
