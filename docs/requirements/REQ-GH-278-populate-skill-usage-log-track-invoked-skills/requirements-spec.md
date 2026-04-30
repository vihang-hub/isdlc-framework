# Requirements Specification: Populate skill_usage_log

**ID**: REQ-GH-278
**Source**: GitHub Issue #278
**Status**: Analyzed

---

## Functional Requirements

### FR-001: PostToolUse[Skill] Hook
When an agent calls the Skill tool with a skill name, log `{ skill_name, agent, phase, timestamp, source: "tool_call" }` to `state.json → skill_usage_log`. Wired via new `post-skill-dispatcher.cjs`.

### FR-002: Agent Delegation Instruction
Append to SKILL INJECTION STEP C output: "When you apply guidance from a skill listed above, call Skill("skill-name") to signal usage." Single edit point in isdlc.md, affects all agents uniformly.

### FR-003: Output-Based Inference Fallback
After a phase agent returns, the phase-loop controller reads the agent's skill index, scans the agent's output for skill name matches (case-insensitive, >4 char names), logs inferred usage as `{ skill_name, agent, phase, timestamp, source: "inferred" }`. Deduplicates against tool_call entries.

### FR-004: Analysis Index on Add
The add handler calls `updateAnalysisIndex()` after writing meta.json so new items immediately appear in the dashboard.

### FR-005: Roundtable Heartbeat
The analyze handler updates `last_activity_at` in analysis-index.json at each user exchange (not just at finalization), so the dashboard's 2-minute recency threshold detects the active roundtable.

### FR-006: Dashboard Skill States
Three visual treatments: confirmed (green solid, source=tool_call), likely (green dashed, source=inferred), loaded (grey, no signal).

### FR-007: Auto-Launch Dashboard
At start of analyze or build, HTTP probe `localhost:3456`. If responds, do nothing. If not, spawn `node src/dashboard/server.js` in background, open browser. Fail-open: if launch fails, continue without dashboard.

---

## Non-Functional Requirements

### NFR-001: Skill Logging Performance
Skill logging must not slow phase execution — fail-open, <50ms per event.

### NFR-002: Heartbeat Latency
Heartbeat must not add visible latency to the roundtable conversation.

### NFR-003: Auto-Launch Non-Blocking
Dashboard auto-launch must not block workflow start — spawn and forget.

---

## Architecture

### Skill Logging Pipeline
Skill tool call → PostToolUse[Skill] fires → `log-skill-invocation` in post-skill-dispatcher → extracts skill name from tool_input → appends to skill_usage_log with source:"tool_call". Inference path: phase-loop step 3f → getAgentSkillIndex → scan output → append with source:"inferred" → deduplicate by (skill_name, phase).

### Data Flow
- Primary: PostToolUse[Skill] hook → skill_usage_log (confirmed)
- Fallback: Phase-loop output scan → skill_usage_log (inferred)
- Dashboard: /api/state returns skill_usage_log → cross-reference with agent_skills → three visual states

### Dependencies
- GH-258 (live dashboard) — shipped, provides dashboard infrastructure
- GH-277 (analysis-index.json) — shipped, provides analysis index

---

## Files Changed

| File | Operation | Purpose |
|---|---|---|
| `src/claude/hooks/dispatchers/post-skill-dispatcher.cjs` | CREATE | PostToolUse[Skill] logging dispatcher |
| `.claude/settings.json` | MODIFY | Wire PostToolUse[Skill] hook |
| `src/claude/commands/isdlc.md` | MODIFY | Skill instruction (STEP C), inference (STEP 3f), heartbeat (step 7b), auto-launch (steps 5/6.5) |
| `src/core/backlog/item-state.js` | MODIFY | Add handler triggers updateAnalysisIndex |
| `src/dashboard/dashboard.html` | MODIFY | Three-state skill visuals |
| `src/dashboard/server.js` | MODIFY | skill_usage_log in /api/state |
| `tests/core/hooks/post-skill-dispatcher.test.cjs` | CREATE | Dispatcher tests |
| `tests/core/dashboard/server.test.js` | MODIFY | skill_usage_log API tests |
