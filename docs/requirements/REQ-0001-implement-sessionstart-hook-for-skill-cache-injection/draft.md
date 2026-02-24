# Implement SessionStart hook for skill cache injection

**Source**: GitHub Issue #91
**Labels**: enhancement, Skills management

## Summary

Create a SessionStart hook that pre-loads project and external skill content into the LLM's context at session start. This eliminates all file reads during workflow phase delegation — skills are already in memory when the orchestrator needs them.

## Problem

The current external skill injection (isdlc.md STEP 3d lines 1716-1735) reads each matched skill file sequentially before every phase delegation. With project skills (3 bound to all phases) plus skills.sh skills, that's 5-8 file reads per phase x 9 phases = 45-72 file reads per feature workflow. This adds latency at every phase transition.

## Design

### Cache File: `.isdlc/skill-cache.md`

Pre-assembled skill content organized by phase. Format:

```markdown
<!-- SKILL CACHE v1.0 | generated: 2026-02-23T10:00:00Z | manifest_mtime: 1708700000 -->

## ALL-PHASE SKILLS

### EXTERNAL SKILL CONTEXT: project-architecture
---
{distilled content}
---

### EXTERNAL SKILL INSTRUCTION (project-conventions): You MUST follow these guidelines:
{distilled content}

### EXTERNAL SKILL CONTEXT: project-domain
---
{distilled content}
---

### EXTERNAL SKILL CONTEXT: react-hooks-guide
---
{content from skills.sh}
---

## PHASE-SPECIFIC SKILLS

### Phase: 05-test-strategy, 06-implementation, 07-testing, 16-quality-loop

#### EXTERNAL SKILL CONTEXT: project-test-landscape
---
{distilled content}
---
```

### SessionStart Hook: `inject-skill-cache.cjs`

```javascript
// Reads .isdlc/skill-cache.md and prints to stdout
// Stdout content is automatically loaded into LLM context at session start
```

Registered in `settings.json`:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/inject-skill-cache.cjs",
            "timeout": 5000
          }
        ]
      }
    ]
  }
}
```

### Cache Rebuild Triggers

The cache file is rebuilt by:
- `/discover` completion — after distilling project skills
- `/isdlc skill add` — after registering new skill
- `/isdlc skill remove` — after removing skill
- `/isdlc skill wire` — after changing bindings

Rebuild function: `rebuildSkillCache()` in `common.cjs`
1. Read `external-skills-manifest.json`
2. For each skill: read `.claude/skills/external/{file}`, format based on `delivery_type`
3. Group by phase bindings (all-phase vs phase-specific)
4. Write `.isdlc/skill-cache.md` with header (timestamp, manifest mtime)

### Phase-Loop Controller Changes (isdlc.md STEP 3d)

Replace the external skill injection block (lines 1716-1735) with:

```
{EXTERNAL SKILL INJECTION — Use the PROJECT SKILLS and EXTERNAL SKILLS blocks
 from your session context (injected at session start by the skill cache hook).
 For the current phase_key, include:
   1. All skills from the ALL-PHASE SKILLS section
   2. Any skills from PHASE-SPECIFIC SKILLS sections that list this phase_key
 If no skill cache is present in context: SKIP (fail-open, no skills injected).}
```

## Context Window Budget

- 4 project skills x ~4K chars = ~16K
- 2-3 skills.sh skills x ~3K chars = ~9K
- Total: ~25K chars from session start
- Acceptable tradeoff for zero per-phase read cost

## Depends On

- #88 (project skills distillation — generates project skills)
- #85 (unify injection — this replaces the current external injection mechanism)

## Files

- `src/claude/hooks/inject-skill-cache.cjs` (new)
- `src/claude/hooks/lib/common.cjs` (`rebuildSkillCache()` function)
- `src/claude/settings.json` (SessionStart hook registration)
- `src/claude/commands/isdlc.md` (STEP 3d update)

## Acceptance Criteria

- [ ] SessionStart hook reads `.isdlc/skill-cache.md` and outputs to stdout
- [ ] Cache content appears in LLM context at session start
- [ ] Phase-loop controller references cached skills from context (zero file reads)
- [ ] Cache is rebuilt on discover completion, skill add, skill remove, skill wire
- [ ] Missing cache file -> fail-open (no skills injected, no error)
- [ ] Stale cache detection via manifest mtime comparison
- [ ] Cache file is gitignored (`.isdlc/` is already gitignored)
