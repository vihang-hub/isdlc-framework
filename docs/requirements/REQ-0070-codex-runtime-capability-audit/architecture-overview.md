# Architecture Overview: Codex Runtime Capability Audit

**Item**: REQ-0070 | **GitHub**: #134

---

## 1. Architecture Options

This is a research/audit task, not a code implementation. The architecture decision is about how to structure and execute the probes.

| Option | Summary | Pros | Cons | Pattern Alignment | Verdict |
|--------|---------|------|------|-------------------|---------|
| A: Sequential probes with early termination | Run P1→P2→P3→P4→P5→P6 in order, stop on Tier 1 failure | Simple, prerequisite-safe, minimal wasted effort | Slower if all pass | Matches Phase 0 risk gate from implementation plan | **Selected** |
| B: Parallel probes with post-hoc analysis | Run all 6 probes independently, analyze results together | Faster if all pass | Wastes effort if P1 fails; harder to reproduce | Doesn't match graduated risk model | Eliminated |

## 2. Selected Architecture

### ADR-CODEX-001: Tiered Probe Execution with Early Termination

- **Status**: Accepted
- **Context**: The audit must validate 6 assumptions before broad extraction begins. Some assumptions are prerequisites for others.
- **Decision**: Execute probes in 3 tiers with early termination. Tier 1 (P1, P2) must pass before Tier 2 (P3, P4). Tier 2 must pass before Tier 3 (P5, P6).
- **Rationale**: Tier 1 failures make all subsequent probes meaningless. Sequential within tiers, but P3/P4 can run in parallel, and P5/P6 can run in parallel.
- **Consequences**: Audit may terminate early with a "no-go" recommendation. This is a feature, not a limitation — it prevents wasted effort.

### ADR-CODEX-002: Go/No-Go Decision Tiers

- **Status**: Accepted
- **Context**: The Phase 0 risk gate needs a clear decision framework.
- **Decision**: Three-tier outcome model:
  - Tier 1 fail → **No-go**: Stop Codex integration entirely or defer
  - Tier 1 pass + Tier 2 fail → **Go with narrow scope**: Single-agent Codex only, no team execution
  - All pass → **Go**: Full extraction proceeds per implementation plan
- **Rationale**: Avoids binary thinking. Partial Codex support is still valuable.
- **Consequences**: "Go with narrow scope" requires the design doc to define which workflows are viable single-agent. This feeds into REQ-0073 (analyze lifecycle decision).

## 3. Technology Decisions

| Technology | Version | Rationale | Alternatives Considered |
|-----------|---------|-----------|------------------------|
| Codex CLI | (record during audit) | User's chosen runtime | Codex API (too low-level), Codex Agent SDK (not CLI) |
| isdlc-codex repo | iSDLC 0.1.0-alpha fork | Real codebase with full test suite and hooks | Synthetic test project (too artificial) |
| Node.js | Same as isdlc-codex | Existing runtime | N/A |

**No new dependencies** — all probes use existing code and tools.

## 4. Integration Architecture

### Probe Execution Flow

```
Tier 1 (Prerequisites)
  P1: File/Process → pass? → P2: Instruction Projection → pass?
    ↓ fail                      ↓ fail
    NO-GO                       NO-GO

Tier 2 (Team Capabilities) — P3 and P4 can run in parallel
  P3: Sub-agent Execution
  P4: Structured Result Collection
    → both pass? → Tier 3
    → either fail? → GO WITH NARROW SCOPE

Tier 3 (Orchestration) — P5 and P6 can run in parallel
  P5: Orchestration Loop (Antigravity scripts)
  P6: Governance Boundary
    → results feed into classification and go/no-go
```

### Data Flow

- **Input**: isdlc-codex repo + Codex CLI
- **Processing**: Execute probes, capture raw output
- **Output**: `docs/codex-capability-audit.md` in isdlc-codex repo

### Integration Points

| Source | Target | Interface | Data Format | Error Handling |
|--------|--------|-----------|-------------|----------------|
| Codex CLI | isdlc-codex repo | File system + process execution | Files, stdout/stderr | Capture all output as evidence |
| Probe results | Audit artifact | Manual documentation | Markdown | N/A |
| Audit artifact | Downstream REQ-0071, REQ-0072, REQ-0073 | Document reference | Markdown | N/A |

## 5. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Execution model | Tiered with early termination | Prerequisite-safe, minimal waste |
| Go/no-go framework | 3-tier outcome | Partial support is still valuable |
| Test environment | isdlc-codex fork | Real codebase, not synthetic |
| New dependencies | None | Pure research task |

**Risk**: P6 (governance) is the highest-uncertainty probe. Even if all other probes pass, governance may be weaker than Claude — the enforcement layering protocol from the design doc is the planned mitigation.
