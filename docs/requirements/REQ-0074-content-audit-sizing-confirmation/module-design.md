# Design Specification: Content Audit Sizing Confirmation

**Item**: REQ-0074 | **GitHub**: #138

---

## 1. Recommended Audit Sequence

| Order | Category | Count | Effort | Rationale |
|-------|----------|-------|--------|-----------|
| 1 | Topics | 6 | Trivial | Quick win — fully portable, validates the decomposition approach |
| 2 | Personas | 8 | Low | Quick win — mostly semantic, establishes RoleSpec template |
| 3 | Debate agents | 8 | Medium | Establishes the critic/refiner decomposition template |
| 4 | Tracing agents | 4 | Medium | Small fan-out pattern — validates team agent decomposition |
| 5 | Impact analysis agents | 5 | Medium | Same fan-out pattern, confirms template |
| 6 | Skills (batch) | 245 | Medium | Highest volume — batch-process using templates from steps 1-5 |
| 7 | Core phase agents | 26 | Medium-High | Larger, more varied — benefits from patterns established earlier |
| 8 | Discover agents | 22 | High | Most diverse — needs careful per-file audit |
| 9 | Commands (isdlc.md last) | 4 | High | isdlc.md is the hardest single file — tackle last with all patterns established |

### Rationale for Ordering
- **Quick wins first** (topics, personas) — validate the approach, build confidence
- **Templated patterns next** (debate, tracing, IA) — establish reusable decomposition templates
- **Volume in the middle** (skills) — batch-process with established templates
- **Hard files last** (discover, commands) — tackle with full pattern knowledge

## 2. Decomposition Template

Each content file gets classified into:

| Layer | What It Contains | Where It Goes |
|-------|-----------------|---------------|
| **RoleSpec** (provider-neutral) | Role identity, purpose, phase applicability, responsibilities, inputs/outputs, loop expectations, owned skills, validator expectations | `src/core/content/roles/` or `src/core/content/skills/` |
| **RuntimePackaging** (provider-specific) | Tool names, delegation mechanism, recovery protocol, formatting conventions, prompt tuning, runtime constraints | `src/providers/{provider}/packaging/` |

### Classification Heuristics

Content is **provider-neutral** if it answers: "What should this role/skill accomplish?"
Content is **provider-specific** if it answers: "How does this role/skill operate in {Claude/Codex/Antigravity}?"

**Markers of Claude-specific content** (flag during audit):
- `Task tool`, `Agent tool`, `subagent_type` references
- `Read`, `Write`, `Edit`, `Bash`, `Grep`, `Glob` tool names
- `CLAUDE.md`, `.claude/`, `settings.json` references
- Hook block auto-recovery protocols
- `system-reminder` or session cache injection references
- Claude-specific formatting conventions (markdown for prompts)

## 3. Downstream Item Mapping

| Audit Step | Produces Input For |
|-----------|-------------------|
| Topics (step 1) | REQ-0102 (topic content classification) |
| Personas (step 2) | REQ-0099 (agent content decomposition) — persona subset |
| Debate agents (step 3) | REQ-0099 — debate subset |
| Fan-out agents (steps 4-5) | REQ-0099 — team agent subset |
| Skills (step 6) | REQ-0100 (skill content audit) |
| Core phase agents (step 7) | REQ-0099 — core phase subset |
| Discover agents (step 8) | REQ-0099 — discover subset |
| Commands (step 9) | REQ-0101 (command system decomposition) |
