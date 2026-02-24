# Implement project skills distillation step in discover orchestrator

**Source**: GitHub #88
**Labels**: enhancement, Skills management

## Summary

Add a new step to the discover orchestrator that **distills discovery artifacts into project-level skills**. This is the core of the "project skills" feature — treating discovery output as institutional knowledge that agents carry permanently, not as documents on a shelf.

## Analogy

When a developer joins a team, they go through onboarding and learn the codebase, architecture, conventions, and domain. This knowledge stays with them — it doesn't expire after 24 hours. Discovery is the AI's onboarding. The output should become persistent project skills, not stale documents.

## What Gets Distilled

Discovery already produces detailed reports. This step distills them into concise, actionable skill files:

| Skill | Source Artifact | Content | Bound To |
|-------|----------------|---------|----------|
| `project-architecture` | `docs/architecture/architecture-overview.md` + D1 output | Component boundaries, data flow, integration points, key patterns | All agents |
| `project-conventions` | D1 (architecture-analyzer) pattern detection | Naming conventions, error handling patterns, framework usage, file organization | All agents |
| `project-domain` | D6 (feature-mapper) + reverse-engineered ACs | Domain terminology, business rules, existing feature catalog summary | All agents |
| `project-test-landscape` | D2 (test-evaluator) output | Coverage gaps, test patterns, framework config, fragile areas | Testing/implementation agents |

## Where It Fits

After skills-researcher (D4) installs external skills, before finalize writes the envelope:

- **Existing projects**: After Step 5 (D4), before Step 7.5 (Walkthrough)
- **New projects**: After Step 8b (D4), before Step 9 (Finalize)

## Output Location

Project skills are written to `.claude/skills/external/` alongside skills.sh skills and user-added skills. They use the same `external-skills-manifest.json` with `source: "discover"` to distinguish them from other external skills.

Manifest entry example:
```json
{
  "name": "project-architecture",
  "description": "Distilled project architecture — components, boundaries, data flow",
  "file": "project-architecture.md",
  "added_at": "2026-02-23T10:00:00Z",
  "source": "discover",
  "bindings": {
    "agents": [],
    "phases": ["01-requirements", "02-impact-analysis", "02-tracing", "03-architecture", "04-design", "05-test-strategy", "06-implementation", "07-testing", "08-code-review", "09-validation", "16-quality-loop"],
    "injection_mode": "always",
    "delivery_type": "context"
  }
}
```

## Cache Rebuild

After writing all project skills and updating the manifest, the distillation step calls `rebuildSkillCache()` to regenerate `.isdlc/skill-cache.md`. This ensures the next session picks up the new project skills via the SessionStart hook (#91).

## Constraints

- Each skill file must stay **under 5,000 characters** — distillations, not copies
- **Idempotent** — re-running discover overwrites skills with `source: "discover"`, leaves user-added skills untouched
- **Fail-open** — if distillation fails for one skill, others still get created
- Standard skill .md format with YAML frontmatter (`name`, `description`, `owner`, `when_to_use`)

## Depends On

- #81, #82, #84 (skill index must work for built-in skills) — DONE
- #89 (manifest registration and source field) — OPEN
- #91 (SessionStart cache — distillation step triggers cache rebuild) — DONE

## Files

- `src/claude/agents/discover-orchestrator.md` (new step)
- `.claude/skills/external/` (project skill files written here)
- `docs/isdlc/external-skills-manifest.json` (entries added here)

## Acceptance Criteria

- [ ] Discover produces 4 project skill files in `.claude/skills/external/`
- [ ] Skills registered in `external-skills-manifest.json` with `source: "discover"`
- [ ] Re-running discover updates discover-sourced skills without touching user-added skills
- [ ] Each skill < 5,000 chars
- [ ] Skills follow standard .md format with valid frontmatter
- [ ] Failure to distill one skill doesn't block others
- [ ] `rebuildSkillCache()` called after distillation completes
