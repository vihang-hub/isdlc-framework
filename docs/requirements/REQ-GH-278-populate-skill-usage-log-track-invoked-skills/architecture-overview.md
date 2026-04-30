# Architecture Overview: Populate skill_usage_log

**ID**: REQ-GH-278

---

## Skill Invocation Tracking

```
Agent execution
    │
    ├── Agent calls Skill("unit-testing")
    │       │
    │       ▼
    │   PostToolUse[Skill] hook fires
    │       │
    │       ▼
    │   post-skill-dispatcher.cjs
    │       ├── Extract skill name from tool_input.skill
    │       ├── Read state.json
    │       ├── Append { skill_name, agent, phase, ts, source: "tool_call" }
    │       └── Write state.json
    │
    └── Agent returns output
            │
            ▼
        Phase-loop STEP 3f (inference)
            ├── getAgentSkillIndex(agent) → skill list
            ├── Scan output for skill name matches (>4 chars, case-insensitive)
            ├── Deduplicate against existing tool_call entries
            └── Append { skill_name, agent, phase, ts, source: "inferred" }
```

## Dashboard Data Flow

```
/api/state response
    │
    ├── agent_skills: { built_in: [...], external: [...] }  (available)
    ├── skill_usage_log: [{ skill_name, source, ... }]       (used)
    │
    ▼
dashboard.html cross-references:
    ├── skill in usage_log with source:"tool_call" → green solid (confirmed)
    ├── skill in usage_log with source:"inferred"  → green dashed (likely)
    └── skill in agent_skills but not in log        → grey (loaded)
```

## Analysis Liveness

```
Add handler
    └── writeMetaJson() → updateAnalysisIndex()  (item appears in dashboard)

Roundtable conversation
    └── Each user exchange → updateAnalysisIndex(slug, last_activity_at: now)
            │
            ▼
        Dashboard polls /api/state every 2s
            └── active_analysis: item with last_activity_at < 2min → "active"
```

## Auto-Launch

```
/isdlc analyze or /isdlc build
    │
    ├── HTTP probe http://127.0.0.1:3456/api/state
    │
    ├── Response OK → do nothing
    │
    └── Error/timeout → spawn("node", ["src/dashboard/server.js"], { detached, stdio:"ignore" })
                         └── .unref() → continue workflow immediately
```
