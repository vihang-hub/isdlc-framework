# iSDLC Framework - Backlog

> Lightweight index. Detailed specs live in `docs/requirements/{slug}/`.
> This file is NOT loaded into every conversation -- reference it explicitly when needed.

## Open

### 1. Spec-Kit Learnings

- 1.1 [ ] Spike/explore workflow -> [requirements](docs/requirements/1.1-spike-explore-workflow/)
- 1.2 [ ] /isdlc validate command -> [requirements](docs/requirements/1.2-isdlc-validate-command/)
- 1.3 [ ] Progressive disclosure / lite mode -> [requirements](docs/requirements/1.3-progressive-disclosure/)

### 2. Performance

- 2.2 [ ] T6: Hook I/O optimization -> [requirements](docs/requirements/2.2-hook-io-optimization/)
- 2.3 [ ] T7: Agent prompt boilerplate extraction -> [requirements](docs/requirements/2.3-prompt-boilerplate-extraction/)
- 2.4 [ ] Performance budget and guardrail system -> [requirements](docs/requirements/2.4-performance-budget/)

### 3. Parallel Workflows (Architecture)

- 3.1 [ ] Parallel workflow support -> [requirements](docs/requirements/3.1-parallel-workflow-support/)
- 3.2 [x] Preparation pipeline -> [requirements](docs/requirements/REQ-0019-preparation-pipeline/)

### 4. Multi-Agent Teams (Architecture)

- 4.2 [~] Impact Analysis cross-validation (Approach B) -> [requirements](docs/requirements/4.2-ia-cross-validation/)
- 4.3 [ ] Fan-out/fan-in parallelism -> [requirements](docs/requirements/4.3-fan-out-fan-in/)

### 5. Developer Engagement Modes

- 5.2 [ ] Collaborative mode -> [requirements](docs/requirements/5.2-collaborative-mode/)

### 6. Framework Features

- 6.1 [ ] TOON format integration -> [requirements](docs/requirements/6.1-toon-format/)
- 6.2 [ ] Improve search capabilities -> [requirements](docs/requirements/6.2-search-capabilities/)
- 6.3 [ ] Implementation learning capture -> [requirements](docs/requirements/6.3-learning-capture/)
- 6.4 [ ] /isdlc refactor command -> [requirements](docs/requirements/6.4-refactor-command/)
- 6.5 [ ] Separate deployment/operations commands -> [requirements](docs/requirements/6.5-deployment-commands/)
- 6.6 [ ] State.json pruning at workflow completion -> [requirements](docs/requirements/6.6-state-pruning/)
- 6.7 [ ] Epic decomposition -> [requirements](docs/requirements/6.7-epic-decomposition/)
- 6.8 [~] Ollama / local LLM support -> [requirements](docs/requirements/REQ-0007-ollama-support/)
- 6.9 [ ] SonarQube integration -> [requirements](docs/requirements/6.9-sonarqube/)

### 7. Product/Vision

- 7.1 [ ] Board-driven autonomous development -> [requirements](docs/requirements/7.1-board-driven-dev/)
- 7.2 [ ] Design systems using variant.ai -> [requirements](docs/requirements/7.2-design-systems/)
- 7.3 [ ] Feedback collector and roadmap creator -> [requirements](docs/requirements/7.3-feedback-roadmap/)
- 7.4 [ ] Analytics manager -> [requirements](docs/requirements/7.4-analytics-manager/)
- 7.5 [ ] User auth and profile management -> [requirements](docs/requirements/7.5-user-auth/)
- 7.6 [ ] Marketing integration for SMBs -> [requirements](docs/requirements/7.6-marketing-integration/)
- 7.8 [ ] GitHub Issues adapter -> [requirements](docs/requirements/7.8-github-issues-adapter/)

### 8. Workflow Quality

- 8.1 [ ] Requirements debate before workflow start -> [requirements](docs/requirements/8.1-requirements-debate/)
- 8.2 [ ] Sizing decision must always prompt user -> [requirements](docs/requirements/8.2-sizing-prompt/)

### 9. Code Quality Gaps

- 9.1 [ ] Coverage threshold discrepancy -> [requirements](docs/requirements/9.1-coverage-threshold/)
- 9.2 [ ] No automated complexity measurement -> [requirements](docs/requirements/9.2-complexity-measurement/)
- 9.3 [ ] Agent-judgment quality checks lack automated backing -> [requirements](docs/requirements/9.3-quality-checks-automation/)

### 10. Investigation

- 10.1 [ ] Phase handshake audit -> [requirements](docs/requirements/10.1-phase-handshake-audit/)

### 11. Developer Experience

- 11.1 [ ] Install script landing page and demo GIF -> [requirements](docs/requirements/11.1-install-landing-page/)

### 12. Bugs

- 12.1 [ ] Backlog picker pattern mismatch after BACKLOG.md restructure (REQ-0019 follow-up) — [GitHub #2](https://github.com/vihang-hub/isdlc-framework/issues/2)
  - Orchestrator backlog picker in `00-sdlc-orchestrator.md` needs pattern update for new index format
  - `workflows.json` may need `start` workflow entry for Phase B
  - 5 backlog test files need verification against new format

## Completed

- [x] 3.2 Preparation pipeline (2026-02-16, REQ-0019)
- [x] 2.1 Quality Loop true parallelism (2026-02-15, REQ-0018)
- [x] 4.1 Multi-agent debate teams (2026-02-15, REQ-0014/0015/0016/0017)
- [x] 5.1 Supervised mode (2026-02-14, REQ-0013)
- [x] 7.7 Backlog management integration (2026-02-14, REQ-0008)
- [x] 8.3 Requirements elicitation redesign (2026-02-14, REQ-0014)
- [x] BUG-0009 Batch D tech debt (2026-02-15)
- [x] BUG-0017 Batch C hook bugs (2026-02-15)
- [x] BUG-0008 Batch B inconsistent hook behavior (2026-02-15)
- [x] BUG-0007 Batch A gate bypass bugs (2026-02-15)
- [x] BUG-0006 Batch B hook bugs (2026-02-15)
- [x] BUG-0004 Orchestrator conversational opening (2026-02-15)
- [x] REQ-0015 IA cross-validation Verifier (2026-02-15)
- [x] REQ-0016 Multi-agent Test Strategy Team (2026-02-15)
- [x] REQ-0017 Multi-agent Implementation Team (2026-02-15)
- [x] REQ-0016 Multi-agent Design Team (2026-02-14)
- [x] REQ-0015 Multi-agent Architecture Team (2026-02-14)
- [x] REQ-0014 Multi-agent Requirements Team (2026-02-14)
- [x] REQ-0008 Backlog management integration (2026-02-14)
- [x] REQ-0013 Supervised mode (2026-02-14)
- [x] BUG-0015 branch-guard false positive (2026-02-14)
- [x] BUG-0016 state-file-guard false positive (2026-02-14)
- [x] BUG-0017 Orchestrator scope exceed (2026-02-14)
- [x] BUG-0014 Early branch creation (2026-02-13)
- [x] REQ-0012 Invisible framework (2026-02-13)
- [x] BUG-0013 Phase-loop-controller false blocks (2026-02-13)
- [x] BUG-0012 Premature git commits (2026-02-13)
- [x] REQ-0011 Adaptive workflow sizing (2026-02-13)
- [x] BUG-0011 Subagent phase state overwrite (2026-02-13)
- [x] BUG-0010 Orchestrator finalize stale tasks (2026-02-12)
- [x] BUG-0009 Subagent state.json drift (2026-02-12)
- [x] REQ-0010 Blast radius coverage validation (2026-02-12)
- [x] BUG-0008 Constitution validator false positive (2026-02-12)
- [x] BUG-0007 Test watcher circuit breaker false positives (2026-02-12)
- [x] REQ-0009 Enhanced plan-to-tasks pipeline (2026-02-11)
- [x] REQ-0005 Workflow progress snapshots (2026-02-10)
- [x] REQ-0010 Performance optimization T1-T3 (2026-02-10)
- [x] Self-healing hook system (2026-02-09)
- [x] REQ-0003 Hooks API and suggested prompts (2026-02-08)
- [x] REQ-0002 PowerShell and code review (2026-02-08)
- [x] npm publishing and Node version update (2026-02-11)
