# Architecture Overview: Content Audit Sizing Confirmation

**Item**: REQ-0074 | **GitHub**: #138

---

## 1. Selected Architecture

No architectural decisions required — this is a sizing assessment. The decomposition model (RoleSpec + RuntimePackaging) was established in the design doc and confirmed by REQ-0072 (peer provider model).

## 2. Effort Classification

| Category | Count | Effort | Rationale |
|----------|-------|--------|-----------|
| **Personas** | 8 | **Low** | Almost entirely semantic content (role identity, voice rules, analytical approach). Minimal Claude-specific packaging. |
| **Topics** | 6 | **Trivial** | Pure analytical knowledge + depth guidance. Fully portable. No provider-specific content. |
| **Debate agents** (critic/refiner) | 8 | **Medium** | Structured pattern — same decomposition template applies to all 8. Do one, template the rest. |
| **Tracing agents** | 4 | **Medium** | Fan-out pattern with Task tool delegation. Delegation mechanism is Claude-specific; role semantics are portable. |
| **Impact analysis agents** | 5 | **Medium** | Same fan-out pattern as tracing. |
| **Core phase agents** | 26 | **Medium-High** | Mixed — role semantics portable, but tool instructions, delegation patterns, recovery protocols, hook references deeply Claude-specific. Largest individual files. |
| **Discover agents** | 22 | **High** | Heavy Claude-specific delegation (Task tool, subagent_type). 22 agents with varied patterns. Most diverse set. |
| **Other orchestrators** | ~5 | **High** | roundtable-analyst.md and sdlc-orchestrator.md are the two largest, most complex files. Deep Claude coupling. |
| **Skills** | 245 | **Medium (volume)** | Metadata fully portable. Content varies: many are pure guidance (portable), some reference Claude tools. High volume but templated structure means batch processing possible. |
| **Commands** | 4 | **High** | isdlc.md is ~2000+ lines, deeply Claude-specific (analyze handler, build handler, phase-loop controller). Major workstream alone. Other 3 are smaller. |

## 3. Summary

| Effort Level | File Count | Percentage |
|-------------|-----------|------------|
| Trivial | 6 | 2% |
| Low | 8 | 2% |
| Medium | 262 (245 skills + 8 debate + 4 tracing + 5 IA) | 81% |
| Medium-High | 26 | 8% |
| High | 23 (22 discover + 4 commands - 3 smaller) | 7% |

The bulk (81%) is medium-effort templated work (skills + structured agent patterns). The hard work is concentrated in ~23 files: discover agents, command files, and orchestrators.
