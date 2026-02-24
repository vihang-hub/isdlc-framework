# Tech Stack Decision: REQ-0003 - Framework-Controlled Suggested Prompts

**Artifact ID:** REQ-0003-suggested-prompts
**Phase:** 03 - Architecture
**Created:** 2026-02-08
**Status:** Final

---

## 1. Summary

This feature requires **no technology additions or changes**. The implementation is entirely within existing markdown agent instruction files. This document records the explicit decision to NOT introduce new technology, per Article IV (Explicit Over Implicit).

---

## 2. Technology Assessment

### 2.1 What Was Considered

| Option | Description | Decision |
|--------|-------------|----------|
| **Prompt template engine** (Handlebars, Mustache, Nunjucks) | Parse prompt templates with variable substitution | REJECTED -- over-engineering for text interpolation that LLM agents perform natively |
| **Centralized prompt registry** (JSON/YAML config) | Single file mapping agents to prompts | REJECTED -- ADR-001 favors colocation in agent markdown (simpler, self-documenting) |
| **Runtime prompt generator** (new lib/ module) | JavaScript module that reads state and generates prompt text | REJECTED -- agents already read state and generate text; adding a module creates unnecessary coupling |
| **PostToolUse hook for prompt injection** | Hook that appends prompts to agent output | REJECTED -- CON-002 explicitly prohibits hook-based prompt injection |
| **No new technology** | Embed prompt templates in existing agent markdown files | SELECTED |

### 2.2 Rationale for No New Technology

1. **Article V (Simplicity First):** The simplest solution is to add instructions to markdown files that agents already read and follow. No new parsing, no new runtime, no new config format.

2. **NFR-003 (No New Dependencies):** Adding any template engine or registry would violate the zero-dependency constraint.

3. **NFR-007 (Performance):** New modules or hooks would add latency. Markdown instructions add zero runtime overhead -- the agent already reads its markdown file.

4. **Existing capabilities are sufficient:** Claude Code agents are LLMs that follow markdown instructions. They can read state.json, derive the next phase name, and format a text block -- no code assistance needed.

---

## 3. Existing Technology Used

| Technology | Role in This Feature | Already Exists? |
|------------|---------------------|-----------------|
| Markdown (.md files) | Agent instruction format | YES -- all 36 agent files |
| state.json | Source of `active_workflow` context | YES -- agents already read this |
| workflows.json | Phase sequence definitions | YES -- orchestrator already uses this |
| YAML frontmatter | Agent metadata (unchanged) | YES -- all agent files |

---

## 4. Impact on Existing Stack

| Component | Impact |
|-----------|--------|
| Node.js runtime | NONE -- no runtime code changes |
| ESM modules (lib/) | NONE -- no library changes |
| CommonJS hooks (.cjs) | NONE -- no hook changes |
| npm dependencies | NONE -- no new packages |
| CI/CD pipeline | NONE -- existing pipeline sufficient |
| Test infrastructure | MINIMAL -- new format validation tests use existing node:test framework |

---

## 5. Conclusion

The tech stack decision for REQ-0003 is explicitly **no change**. This is not a deferral -- it is an intentional architectural choice aligned with Article V (Simplicity First) and the constraint analysis from requirements (CON-001 through CON-004). The existing technology stack fully supports this feature without modification.
