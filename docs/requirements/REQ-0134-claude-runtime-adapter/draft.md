# Claude ProviderRuntime adapter

| Field       | Value                                      |
|-------------|--------------------------------------------|
| ID          | REQ-0134                                   |
| Slug        | REQ-0134-claude-runtime-adapter            |
| GitHub      | GH-200                                     |
| Codex       | CODEX-065                                  |
| Workstream  | G                                          |
| Phase       | 10                                         |
| Depends on  | REQ-0128, REQ-0087                         |

## Summary

Implements the ProviderRuntime interface for Claude Code. Provides Task tool delegation for phase agent execution, uses agent `.md` files as the prompt source, and implements the relay-and-resume pattern for interactive phases (roundtable, requirements elicitation).
