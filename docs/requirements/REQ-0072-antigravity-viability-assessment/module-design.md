# Design Specification: Antigravity Viability Assessment

**Item**: REQ-0072 | **GitHub**: #136

---

## 1. Per-Script Decomposition

| Script | Current Dependencies | Core Logic (→ src/core/) | Adapter Logic (→ src/providers/antigravity/) | Target Core Service |
|--------|---------------------|-------------------------|---------------------------------------------|-------------------|
| workflow-init.cjs | common, user-hooks, workflow-loader | Workflow creation, state initialization, phase array setup | CLI arg parsing, branch creation via git, user-hook invocation | WorkflowEngine.startWorkflow() |
| phase-advance.cjs | common, gate-logic, user-hooks | Gate validation, phase transition, state update | CLI invocation wrapper, user-hook invocation | WorkflowEngine.advancePhase() |
| validate-gate.cjs | common, gate-logic | Gate requirement checking, validation logic | CLI output formatting | ValidatorEngine.run() |
| workflow-finalize.cjs | common, user-hooks | Workflow completion, state cleanup, history append | Branch merge via git, user-hook invocation | WorkflowEngine.finalizeWorkflow() |
| workflow-retry.cjs | common | Phase reset, iteration increment | CLI arg parsing | WorkflowEngine.retryPhase() |
| workflow-rollback.cjs | common | Phase rollback, state restoration | CLI arg parsing | WorkflowEngine.rollbackPhase() |
| validate-state.cjs | common, state-logic | State schema validation, integrity checks | CLI output formatting | StateStore.validate() |
| analyze-finalize.cjs | common | Meta.json update, BACKLOG.md marker sync, GitHub comment | CLI arg parsing, `gh` CLI invocation | ItemStateService.finalizeAnalysis() |
| analyze-item.cjs | common, persona-loader, roundtable-config, mode-selection | **Heavy** — item resolution, draft loading, meta management, sizing | Persona loading, roundtable dispatch, interactive UX | **Needs redesign** — depends on REQ-0073 |
| analyze-sizing.cjs | common | Sizing metric extraction, recommendation computation | CLI output formatting | SizingService.compute() |
| change-summary-generator.cjs | common | Git diff analysis, summary generation | CLI invocation | ChangeService.generateSummary() |
| prime-session.cjs | common | Session cache assembly, context projection | CLI output, cache file writing | SessionCacheService.build() |
| antigravity-bridge.cjs | common | Project root resolution, framework dir detection | Antigravity-specific path mapping | ProjectRootService (already planned) |
| mode-selection.cjs | (internal) | Mode flag parsing | Antigravity-specific flag handling | Absorbed into analyze redesign |
| ANTIGRAVITY.md.template | N/A | Template content for Antigravity instructions | Template projection | Move to src/core/templates/ |

## 2. Decomposition Summary

| Category | Count | Scripts |
|----------|-------|---------|
| Rewire to core (straightforward) | 12 | workflow-init, phase-advance, validate-gate, workflow-finalize, workflow-retry, workflow-rollback, validate-state, analyze-finalize, analyze-sizing, change-summary-generator, prime-session, antigravity-bridge |
| Needs redesign (pending REQ-0073) | 1 | analyze-item |
| Internal (absorbed) | 1 | mode-selection |
| Template (move as-is) | 1 | ANTIGRAVITY.md.template |

## 3. Extraction Sequence

Ordered by: dependency chain alignment with Phase 2 backlog items, lowest risk first.

| Order | Script(s) | Yields Core Service | Backlog Item | Rationale |
|-------|-----------|-------------------|-------------|-----------|
| 1 | validate-state.cjs | StateStore.validate() | REQ-0080 | Foundation — everything depends on state |
| 2 | workflow-init.cjs, workflow-finalize.cjs | WorkflowEngine.start/finalize() | REQ-0082 | Core workflow lifecycle |
| 3 | phase-advance.cjs, validate-gate.cjs | WorkflowEngine.advance(), ValidatorEngine.run() | REQ-0081, REQ-0082 | Gate validation + phase transitions |
| 4 | workflow-retry.cjs, workflow-rollback.cjs | WorkflowEngine.retry/rollback() | REQ-0082 | Workflow recovery paths |
| 5 | analyze-finalize.cjs | ItemStateService.finalizeAnalysis() | REQ-0083 | Backlog/item state management |
| 6 | analyze-sizing.cjs | SizingService.compute() | REQ-0083 | Sizing computation |
| 7 | prime-session.cjs | SessionCacheService.build() | REQ-0085 | Session/cache assembly |
| 8 | change-summary-generator.cjs | ChangeService.generateSummary() | — | Low priority, nice-to-have |
| 9 | analyze-item.cjs | **Pending REQ-0073** | REQ-0108 | Depends on analyze lifecycle decision |

## 4. Antigravity Unique Characteristics

### What Antigravity provides that Claude/Codex don't
- **Fully deterministic execution** — no LLM in the loop for workflow control. State transitions are guaranteed correct.
- **Scriptable/automatable** — CLI tools can be chained in shell scripts, CI pipelines, or external orchestrators
- **Lowest latency** — no LLM round-trip for control operations. `workflow-init` completes in milliseconds, not seconds.
- **Testable** — every script can be unit/integration tested with fixture state. No LLM mocking needed.
- **Offline capable** — control plane works without network access (no LLM API calls)

### What Antigravity lacks vs Claude/Codex
- **No sub-agents** — single-threaded CLI. Cannot run parallel team execution (impact analysis fan-out, quality loop tracks)
- **No conversational UX** — menus and prompts, not natural language. Cannot run the roundtable conversation.
- **No LLM-driven analysis** — cannot generate requirements, architecture, or design artifacts. Relies on other providers for content generation.
- **No instruction compliance** — there's no LLM to give instructions to. Governance is purely code-level.

### Antigravity's Role Post-Extraction
Antigravity becomes the **deterministic control plane** for iSDLC — the provider you use when you want guaranteed-correct workflow operations without LLM involvement. It's ideal for:
- CI/CD integration (automated workflow advancement)
- Scripted testing (fixture-based workflow testing)
- Recovery operations (rollback, retry)
- State inspection and validation

Content generation (analysis, implementation, review) requires Claude or Codex. Antigravity handles the workflow lifecycle around that content.

## 5. Open Questions

- Does Antigravity need sub-agent support? (Likely no — its value is deterministic single-threaded control)
- Should Antigravity get a conversational mode? (Likely no — that's what Claude/Codex are for)
- How does Antigravity invoke LLM providers when it needs content generation? (Possible: Antigravity delegates to Claude/Codex for content phases, handles workflow phases itself)
