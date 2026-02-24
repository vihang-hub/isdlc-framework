# Blast Radius Coverage — REQ-0011

| File | Change Type | Coverage | Notes |
|------|-------------|----------|-------|
| `src/claude/commands/isdlc.md` | MODIFY | covered | STEP 3e-sizing block and -light flag parsing added |
| `.isdlc/config/workflows.json` | MODIFY | covered | Symlink to src/isdlc/config/workflows.json which has sizing block and -light option added |
| `src/claude/hooks/lib/common.cjs` | MODIFY | covered | 3 sizing functions added (parse, compute, apply) |
| `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` | MODIFY | covered | JSON metadata block format specified |
| `src/claude/hooks/workflow-completion-enforcer.cjs` | MODIFY | covered | Variable-length phase array support and sizing record preservation |
| `src/claude/agents/00-sdlc-orchestrator.md` | MODIFY | deferred | Flag passing for -light is handled in isdlc.md STEP 1 init (orchestrator receives flags via prompt); orchestrator agent file change not needed for MVP |
| `src/claude/hooks/state-write-validator.cjs` | MODIFY | deferred | active_workflow.sizing is a nested object under active_workflow which is already an allowed writable field; no allowlist change needed |
| `src/claude/hooks/config/iteration-requirements.json` | MODIFY | deferred | Impact analysis noted "may need a sizing section" — current gate requirements work without changes since light skips phases entirely |
| `src/claude/hooks/blast-radius-validator.cjs` | MODIFY | deferred | Impact analysis itself notes "No logic change needed" — hook reads impact-analysis.md and checks git diff regardless of intensity; phase-gating already handled by shouldActivate guard in pre-task-dispatcher |
| `src/claude/hooks/gate-blocker.cjs` | MODIFY | deferred | Impact analysis notes gate-blocker "already implicitly handled" — Phase-Loop Controller only iterates active_workflow.phases, so removed phases never reach gate-blocker |
