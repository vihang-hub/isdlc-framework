# Architecture Overview: Live Workflow Dashboard

**ID**: REQ-GH-258

---

## Component Diagram

```
Browser (dashboard.html)
    │
    │ GET /api/state (poll every 2s/10s)
    │
    ▼
Server (src/dashboard/server.js)
    │
    ├── readState()           → .isdlc/state.json          (build workflow, active_agent)
    ├── scanAnalysisIndex()   → .isdlc/analysis-index.json  (active slug detection)
    ├── readActiveMeta()      → docs/requirements/{slug}/meta.json (analysis detail)
    ├── scanHookLog()         → .isdlc/hook-activity.log    (recent hook events)
    ├── getAgentSkills()      → skills-manifest.json + external-skills-manifest.json
    └── scanPersonas()        → src/claude/agents/persona-*.md (one-time at startup)
          │
          ▼
    buildStateResponse() → unified JSON
```

## API Response Shape

```json
{
  "active_workflow": { ... },
  "phases": { ... },
  "topology": { ... },
  "workflow_type": "build",
  "timestamp": "ISO-8601",
  "stale": false,
  "analysis_items": [ ... ],
  "active_analysis": { "slug": "...", "last_activity_at": "..." },
  "active_meta": {
    "analysis_status": "partial",
    "phases_completed": ["00-quick-scan", "01-requirements"],
    "acceptance": { "domains": ["bug_summary", "root_cause"] },
    "bug_classification": { "classification": "bug" }
  },
  "hook_events": [
    { "ts": "...", "hook": "gate-blocker", "event": "block", "phase": "06-implementation", "reason": "..." }
  ],
  "agent_skills": {
    "built_in": [{ "name": "code-implementation", "skill_id": "DEV-001" }],
    "external": [{ "name": "custom-skill", "file": "custom.md" }]
  },
  "personas": [
    { "name": "business-analyst", "role_type": "primary" },
    { "name": "security-reviewer", "role_type": "contributing" }
  ]
}
```

## Dashboard Layout

```
+-------------------------------------------------------------------+
| Header: iSDLC Workflow Dashboard | status indicator                |
+-------------------------------+-----------------------------------+
|          ANALYSE              |             BUILD                 |
|                               |                                   |
|  {slug title}                 |  {slug title}                     |
|                               |                                   |
|  Personas:                    |  Phase DAG:                       |
|  [Maya●] [Alex●] [Jordan●]  |  [05-test] → [06-impl]           |
|  [SecRev○] [DevOps○]        |  → [16-QL] → [08-review]         |
|                               |                                   |
|  Confirmation:                |  Active Agent: [software-dev●]   |
|  [Reqs ✓] [Arch ✓]          |  Task Progress: ████░░░ 4/7      |
|  [Design ~] [Tasks ○]       |                                   |
|                               |  Skills (14 loaded):              |
|  Phases: ●●●○○              |  [code-impl] [unit-test] [api]   |
|                               |  [EXT: custom-skill]             |
+-------------------------------+-----------------------------------+
| Hooks: ●gate-blocker ●branch-guard ●test-watcher ●state-guard    |
|        (green=allow, red=block, amber=warn)                       |
+-------------------------------------------------------------------+
| Footer: Connected | Last update: 10:15:32 | localhost:3456        |
+-------------------------------------------------------------------+
```

## Visual Treatment

### Agents
- Active (currently executing) → blue node, pulse animation
- Completed (ran earlier) → green node, solid
- Pending (future phase) → grey node, dim
- Not applicable → hidden

### Personas
- Core (Maya, Alex, Jordan) → blue node, solid border, always shown
- Contributing → lighter blue, dashed border
- Promoted → blue, solid, with confirmation stage indicator
- Active persona → pulse animation

### Skills
- Built-in (loaded) → grey node, label only
- External (loaded) → purple border, "EXT" badge
- Future (fired, from #278) → green node

### Hooks
- Allowed → green dot
- Blocked → red dot, glow animation
- Warned → amber dot
- Skipped → grey dot, strikethrough
- Idle (no event in current phase) → hidden

## Files Changed

| File | Operation | Purpose |
|---|---|---|
| `src/dashboard/dashboard.html` | CREATE | Dashboard UI template (~800 lines) |
| `src/dashboard/server.js` | MODIFY | 4 new scan functions, expanded API response, HTML path resolution |
| `init-project.sh` | MODIFY | Copy dashboard.html to .isdlc/ at install |
| `tests/core/dashboard/server.test.js` | MODIFY | Tests for new API fields |
