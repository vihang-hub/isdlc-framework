---
name: antigravity-prime-session
description: Prime the iSDLC session with context (Constitution, Workflows, Skills)
skill_id: ORCH-015
owner: sdlc-orchestrator
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: At the start of every iSDLC session in Antigravity.
dependencies: []
---

# Antigravity Prime Session

## Purpose
This skill replaces the Claude Code `sessionstart` hook. It rebuilds the session cache and injects it into the LLM context window to ensure the agent has all the necessary rules, architectural patterns, and skill mappings.

## Usage
The Orchestrator should call this skill before performing any major task in Antigravity.

## Process
1. Call `rebuildSessionCache()` to ensure information is up-to-date.
2. Read `.isdlc/session-cache.md`.
3. Return the content as a skill result.
