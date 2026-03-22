# Topic content classification

## Source
- GitHub Issue: #166 (CODEX-033)
- Workstream: D (Content Model), Phase: 5

## Description
Classify topic files as provider-neutral analytical knowledge vs provider-specific packaging. Topics contain depth guidance, analytical knowledge, and coverage criteria — not just metadata. Must be audited as first-class content assets.

## Dependencies
- REQ-0074 (Content audit sizing) — completed

## Context
6 topic files in src/claude/skills/analysis-topics/. Topics define what the roundtable analyzes (problem-discovery, technical-analysis, requirements-definition, architecture, security, specification). They contain: coverage criteria (portable), depth guidance (portable), analytical knowledge (portable), source step references (Claude-specific), artifact instructions (mostly portable).
