# Architecture Overview: Codex Adapter for Implementation Loop

**Item**: REQ-0078 | **GitHub**: #142

---

## 1. Adapter Architecture

```
isdlc-codex repo (external)
  │
  ├── imports: isdlc/core/teams (npm package)
  ├── imports: isdlc/core/state (npm package)
  │
  └── codex-adapter/
        implementation-loop-runner.js
          │
          ├── creates ImplementationLoop from core
          ├── for each file:
          │     ├── builds WriterContext from core
          │     ├── spawns Writer sub-agent with Codex-packaged instructions
          │     ├── collects FILE_PRODUCED result
          │     ├── builds ReviewContext from core
          │     ├── spawns Reviewer sub-agent
          │     ├── collects PASS/REVISE verdict
          │     ├── if REVISE: builds UpdateContext, spawns Updater
          │     └── calls processVerdict(), loops
          └── writes loop state via core StateStore
```

## 2. Codex Sub-Agent Mapping

| Role | Codex Sub-Agent | Model | Instructions Source |
|------|----------------|-------|-------------------|
| Writer | Codex agent (e.g., "Writer [implementer]") | configurable | Codex-packaged writer instructions |
| Reviewer | Codex agent (e.g., "Reviewer [analyst]") | configurable | Codex-packaged reviewer instructions |
| Updater | Codex agent (e.g., "Updater [fixer]") | configurable | Codex-packaged updater instructions |

Each sub-agent receives the core contract (WRITER_CONTEXT/REVIEW_CONTEXT/UPDATE_CONTEXT) as structured input and returns structured output.

## 3. Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Adapter location | isdlc-codex repo | External consumer of core package |
| Sub-agent model | One per role (Writer, Reviewer, Updater) | Maps to Codex's native sub-agent spawning |
| State management | Core StateStore via npm import | Same state evolution guarantee |
