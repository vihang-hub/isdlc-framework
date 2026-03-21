# Architecture Overview: Governance Strength Assessment

**Item**: REQ-0071 | **GitHub**: #135

---

## 1. Architecture Options

This is an assessment task — the architecture decision is about the classification model.

| Option | Summary | Pros | Cons | Verdict |
|--------|---------|------|------|---------|
| A: 5-tier classification with per-hook matrix | Group hooks by portability tier, classify each individually | Comprehensive, actionable, maps to conversion items | More detailed than strictly necessary | **Selected** |
| B: Class-level assessment only | Classify the 4 hook classes from the design doc without per-hook detail | Faster, simpler | Doesn't catch per-hook nuances; insufficient for conversion planning | Eliminated |

## 2. Selected Architecture

### ADR-CODEX-003: Instruction-Level Governance as "Sufficient with Monitoring"

- **Status**: Accepted
- **Context**: Tier 3 hooks (branch-guard, state-file-guard, explore-readonly-enforcer, skill-delegation-enforcer, delegation-gate) rely on Claude's external hook interception. Codex has no equivalent external boundary — only AGENTS.md instruction compliance.
- **Decision**: Accept instruction-level governance as "sufficient with monitoring" for Tier 3 hooks. The core validator layer provides the hard boundary for critical state mutations. Instruction-level enforcement is defense-in-depth.
- **Rationale**: P6 proved Codex respects AGENTS.md restrictions proactively. Critical paths (state writes, phase advancement) go through Antigravity scripts (deterministic code) regardless. The theoretical risk of instruction bypass is mitigated by core validators being the source of truth.
- **Consequences**: Tier 3 hooks get Codex equivalents via AGENTS.md instructions, but are not hard-enforced. Any state mutation without core validation evidence remains blocked regardless.

## 3. Technology Decisions

No new technology. Pure assessment artifact.

## 4. Integration Architecture

### Data Flow

- **Input**: REQ-0070 audit findings + CODEX-INTEGRATION-DESIGN.md hook conversion map + current hook source files
- **Output**: `docs/governance-strength-assessment.md` in isdlc-codex repo
- **Consumers**: REQ-0088 (enforcement layering), REQ-0090-0093 (hook conversions), REQ-0117 (Codex governance checkpoints)

## 5. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Classification model | 5-tier with per-hook matrix | Maps to conversion items, catches per-hook nuances |
| Tier 3 governance position | Sufficient with monitoring | Core validators are hard boundary; instructions are defense-in-depth |
