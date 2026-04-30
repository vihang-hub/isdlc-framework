# Live Workflow Dashboard: Wire Animated Flow to state.json

**Source**: GitHub Issue #258
**Type**: Feature
**Labels**: ready-to-build

## Summary

Wire the animated E2E flow diagram (`docs/index.html`) to live project state from `.isdlc/state.json` and `.isdlc/analysis-index.json`, so only the currently active components flash and the rest show as solid/dim based on real workflow progress.

## Current State

The animated flow HTML exists as a static presentation with manual Play/Next controls and hardcoded stage data. It shows all 6 workflow stages (Discover → Embeddings → Test Generate → Add → Analyze → Build) with agents, skills, hooks, and artifacts.

A separate simple dashboard exists at `src/dashboard/` (REQ-0068, GH-277) that reads state.json and analysis-index.json but has a basic UI — no animated flow visualization.

## Proposed Work

### Data Source
- Read `.isdlc/state.json` for: `active_workflow.current_phase`, `phases[*].status`, `active_agent`, `active_workflow.type`
- Read `.isdlc/analysis-index.json` (GH-277) for analysis progress, active roundtable detection
- Read `docs/isdlc/tasks.md` for task completion status per phase
- Read `meta.json` from active artifact folder for analysis progress

### Live Update Mechanism
- Lightweight Node.js HTTP server that watches state.json for changes
- Push updates to the browser via Server-Sent Events (SSE)
- Map state fields to flash/solid/dim CSS classes on the existing HTML

### Visualization Rules
- Stage with `current_phase` match → active (flash animation)
- Phases with `status: completed` → solid
- Phases with `status: pending` → dim
- Active agent name highlighted in sidebar
- Task progress shown as filled/unfilled in phase bars
- Hooks that fired in current phase shown with glow
- Analysis stage: Maya/Alex/Jordan nodes pulse when roundtable active (from analysis-index.json recency)

### Delivery Modes
- **Local mode**: `node src/dashboard/server.js` — developer's own machine, reads local state.json
- **Team mode** (future): shared server that aggregates multiple developers' state — depends on GH-256

## Dependencies
- Existing animated flow HTML (docs/index.html, 1933 lines)
- state.json schema
- analysis-index.json (GH-277, just shipped)
- src/dashboard/server.js (existing API server)

## Out of Scope
- Multi-user / team view (future — depends on GH-256 SVN + Fisheye)
- Historical replay of past workflows
- Deployment to remote server
