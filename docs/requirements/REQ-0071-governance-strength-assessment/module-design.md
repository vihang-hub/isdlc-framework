# Design Specification: Governance Strength Assessment

**Item**: REQ-0071 | **GitHub**: #135

---

## 1. Assessment Artifact Structure

Single file: `docs/governance-strength-assessment.md` in the isdlc-codex repo.

```
# Governance Strength Assessment
## Summary
  - Tier gap overview table
  - Key finding
## Per-Hook Classification Matrix
  | Hook | Tier | Claude Mechanism | Codex Equivalent | Gap Severity | Mitigation |
  (27 rows: 26 hooks + inject-session-cache)
## Tier 1: Core Validators (9 hooks) — gap: none
## Tier 2: Workflow Guards (7 hooks) — gap: none
## Tier 3: File Protection (5 hooks) — gap: moderate
## Tier 4: Observability (6 hooks) — gap: none
## Tier 5: Context Injection (1 hook) — gap: adapter-specific
## Enforcement Layering Recommendation
## Downstream Item Mapping
```

## 2. Per-Hook Classification Matrix

| Hook | Tier | Claude Mechanism | Codex Equivalent | Gap | Mitigation |
|------|------|-----------------|------------------|-----|------------|
| gate-blocker | T1 | PreToolUse — blocks Stop tool | Core ValidatorEngine.run() | none | Port to core validator |
| constitution-validator | T1 | PostToolUse — validates artifacts | Core ValidatorEngine.run() | none | Port to core validator |
| constitutional-iteration-validator | T1 | PostToolUse — checks iteration count | Core ValidatorEngine.run() | none | Port to core validator |
| phase-sequence-guard | T1 | PreToolUse — blocks out-of-order delegation | Core WorkflowEngine.runPhase() | none | Port to core validator |
| test-adequacy-blocker | T1 | PreToolUse — blocks without test coverage | Core ValidatorEngine.run() | none | Port to core validator |
| state-write-validator | T1 | PostToolUse — validates state schema | Core StateStore.writeState() | none | Port to core validator |
| output-format-validator | T1 | PostToolUse — validates output structure | Core ValidatorEngine.run() | none | Port to core validator |
| blast-radius-validator | T1 | PreToolUse — blocks incomplete coverage | Core ValidatorEngine.run() | none | Port to core validator |
| test-watcher | T1 | PostToolUse — monitors test execution | Core ValidatorEngine.run() | none | Port to core validator |
| iteration-corridor | T2 | PostToolUse — enforces iteration limits | Core WorkflowEngine rule | none | Port to workflow engine |
| phase-loop-controller | T2 | PostToolUse — drives phase execution | Core WorkflowEngine.advancePhase() | none | Port to workflow engine |
| plan-surfacer | T2 | PostToolUse — surfaces task plan | Core WorkflowEngine rule | none | Port to workflow engine |
| workflow-completion-enforcer | T2 | PreToolUse — blocks premature completion | Core WorkflowEngine.finalizeWorkflow() | none | Port to workflow engine |
| phase-transition-enforcer | T2 | PreToolUse — validates phase transitions | Core WorkflowEngine.advancePhase() | none | Port to workflow engine |
| discover-menu-guard | T2 | PreToolUse — enforces discover menu flow | Core WorkflowEngine rule | none | Port to workflow engine |
| menu-halt-enforcer | T2 | PreToolUse — blocks non-menu actions | Core WorkflowEngine rule | none | Port to workflow engine |
| branch-guard | T3 | PreToolUse — blocks commits to main | AGENTS.md instruction | moderate | Instruction + Antigravity commit wrapper |
| explore-readonly-enforcer | T3 | PreToolUse — blocks writes in explore mode | AGENTS.md instruction | moderate | Instruction + read-only agent role |
| state-file-guard | T3 | PreToolUse — blocks Bash writes to state.json | AGENTS.md instruction + Core StateStore | low | Core StateStore is hard boundary; instruction is defense-in-depth |
| skill-delegation-enforcer | T3 | PreToolUse — enforces agent-skill mapping | AGENTS.md instruction | low | Observability-only in practice; instruction sufficient |
| delegation-gate | T3 | PreToolUse — blocks wrong agent delegation | AGENTS.md instruction + Core WorkflowEngine | low | Core engine controls delegation; instruction is advisory |
| skill-validator | T4 | PostToolUse — logs skill usage | Core observability service | none | Port to telemetry service |
| log-skill-usage | T4 | PostToolUse — appends to skill_usage_log | Core observability service | none | Port to telemetry service |
| menu-tracker | T4 | PostToolUse — tracks menu interactions | Core observability service | none | Port to telemetry service |
| walkthrough-tracker | T4 | PostToolUse — tracks walkthrough progress | Core observability service | none | Port to telemetry service |
| review-reminder | T4 | Stop — reminds about code review | Core observability service | none | Port to telemetry service |
| atdd-completeness-validator | T4 | PostToolUse — checks ATDD coverage | Core observability service | none | Port to telemetry service |
| inject-session-cache | T5 | Notification — injects context at session start | Codex instruction assembly / AGENTS.md | adapter-specific | Each adapter builds its own projection pipeline |

## 3. Gap Severity Schema

| Severity | Definition | Count |
|----------|-----------|-------|
| none | Codex has equivalent or better enforcement via core code | 22 |
| low | Codex enforcement is instruction-level but core provides hard boundary on the critical path | 3 |
| moderate | Codex enforcement is instruction-level only; no external fallback for this specific surface | 2 |
| adapter-specific | Mechanism differs fundamentally between providers; each adapter implements its own approach | 1 |

## 4. Tier Analysis Detail

### Tier 1: Core Validators (9 hooks) — Gap: none
These hooks validate correctness at checkpoints. They map directly to `ValidatorEngine.run(checkpoint, context)` calls in the core. Both Claude and Codex invoke the same deterministic validation code. Claude hooks become thin verification wrappers that check core validation evidence exists.

### Tier 2: Workflow Guards (7 hooks) — Gap: none
These hooks enforce workflow sequencing and iteration rules. They map to `WorkflowEngine` methods (runPhase, advancePhase, finalizeWorkflow). The engine is deterministic code — both providers call the same transition API. No enforcement gap.

### Tier 3: File Protection (5 hooks) — Gap: low to moderate
These hooks prevent the LLM from taking prohibited file-system actions (committing to main, writing state.json via Bash, modifying files in explore mode). Claude uses external PreToolUse interception. Codex relies on AGENTS.md instructions (P6 verified).

**Mitigations**:
- `state-file-guard` → Core StateStore is the hard boundary. The hook just prevents Bash bypass. Gap is **low** because the critical path (state mutation) goes through core code regardless.
- `branch-guard` → Antigravity commit/merge scripts enforce branch rules in deterministic code. The hook prevents ad-hoc `git commit` on main. Gap is **moderate** — instruction-level only for the git command surface.
- `explore-readonly-enforcer` → Read-only agent roles can be enforced via AGENTS.md instructions and sub-agent role assignment. Gap is **moderate** — softer than external interception.
- `skill-delegation-enforcer`, `delegation-gate` → Core WorkflowEngine controls which agent runs which phase. The hooks are advisory enforcement. Gap is **low** — core provides the real boundary.

### Tier 4: Observability (6 hooks) — Gap: none
These hooks log events for visibility. They become workflow-time telemetry services. No enforcement boundary involved — both providers write to the same observability layer.

### Tier 5: Context Injection (1 hook) — Gap: adapter-specific
`inject-session-cache` assembles context at session start. Claude uses Notification hooks. Codex uses instruction assembly into AGENTS.md or per-task projection. The mechanism is fundamentally different but the outcome (context delivered to the LLM) is equivalent.

## 5. Enforcement Layering Recommendation

Post-extraction governance model:

1. **Core validates** — ValidatorEngine, WorkflowEngine, StateStore own all hard enforcement. Deterministic code. Both providers call the same APIs.
2. **Antigravity enforces critical paths** — workflow-init, phase-advance, validate-gate, workflow-finalize are Node.js CLI tools. Both providers invoke them. Cannot be bypassed by the LLM.
3. **Claude hooks verify** — Thin wrappers check that core validation evidence exists before allowing tool execution. Defense-in-depth on the Claude path.
4. **Codex instructions advise** — AGENTS.md instructions replicate Tier 3 hook behavior. Defense-in-depth on the Codex path. Not hard-enforced but proactively respected (P6 evidence).
5. **Monitoring detects drift** — Observability services (Tier 4) detect any enforcement bypass after the fact, regardless of provider.

**Net result**: 22 of 27 hooks have zero governance gap. 3 have low gap (core provides hard boundary anyway). 2 have moderate gap (instruction-level only). 1 is adapter-specific (different mechanism, equivalent outcome).

## 6. Downstream Item Mapping

| Tier | Hooks | Conversion Item | Action |
|------|-------|----------------|--------|
| T1 | 9 core validators | REQ-0090 | Port to provider-neutral ValidatorEngine modules |
| T2 | 7 workflow guards | REQ-0091 | Port to WorkflowEngine rules/checkpoints |
| T3 | 5 file-protection | Stay Claude-only + AGENTS.md equivalents | Claude hooks remain; Codex gets instruction-level equivalents |
| T4 | 6 observability | REQ-0092 | Port to provider-neutral telemetry services |
| T5 | 1 context injection | Adapter-specific | Each adapter owns its projection pipeline |
| All | Enforcement layering | REQ-0088 | Implement the 5-layer model above |
| All | Codex checkpoints | REQ-0117 | Wire Codex adapter to core validators |
