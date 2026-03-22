# Codex ProviderRuntime adapter

| Field       | Value                                      |
|-------------|--------------------------------------------|
| ID          | REQ-0135                                   |
| Slug        | REQ-0135-codex-runtime-adapter             |
| GitHub      | GH-201                                     |
| Codex       | CODEX-066                                  |
| Workstream  | G                                          |
| Phase       | 10                                         |
| Depends on  | REQ-0128, REQ-0114, REQ-0116              |

## Summary

Implements the ProviderRuntime interface for Codex. Provides `codex exec` invocation for phase agent execution, uses instruction projection to build per-task markdown bundles, and supports interactive sessions for conversational phases.
