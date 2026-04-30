# Populate skill_usage_log during agent execution

**Source**: GitHub Issue #278
**Type**: Feature
**Labels**: enhancement

## Summary

skill_usage_log in state.json is always empty. The skills manifest tells us which skills are *available* per agent (e.g., software-developer has 14 skills), but we don't track which skills the agent actually *used* during execution.

## Why

GH-258 (live dashboard) needs to show fired vs not-fired skills in real-time. Currently all skills bound to the active agent show as 'loaded' — we can't distinguish invoked from available.

## Proposed Approach

- Hook into the skill invocation path (either via the Skill tool handler or via agent output parsing)
- Append entries to state.json → skill_usage_log with: agent, skill_id, skill_name, phase, timestamp, status
- The log-skill-usage hook already exists (src/claude/hooks/log-skill-usage.cjs) but skill_usage_log remains empty — investigate why

## Dependencies

- Prerequisite for GH-258 fired-vs-available skill visualization
- Existing infrastructure: log-skill-usage.cjs hook, getAgentSkillIndex() in common.cjs

## Acceptance Criteria

- skill_usage_log entries are written when agents invoke skills during build workflows
- Each entry includes: agent, skill_id, phase, timestamp
- Dashboard (GH-258) can read the log to show fired vs not-fired skills
