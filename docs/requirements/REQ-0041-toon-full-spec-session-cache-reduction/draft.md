# REQ-0041: Upgrade TOON Encoder to Full Spec Compliance

## Problem Statement

The current TOON encoder (`src/claude/hooks/lib/toon-encoder.cjs`) only implements tabular array encoding (`isUniformArray()` guard). The full TOON specification supports:

- **Nested objects** via indentation (no braces/brackets)
- **Key-value pairs** (`key: value` instead of `"key": "value"`)
- **Inline primitive arrays** (`tags[3]: a,b,c`)
- **Non-uniform/mixed arrays** (list form with `- ` prefix)
- **Key folding** (`a.b.c: 1`)

The session cache is ~44,400 tokens after `/clear`. REQ-0040 targeted 30% reduction but achieved 0% because the TOON encoder's `isUniformArray()` guard prevents activation on the cache's nested JSON structures.

## Opportunity

Every JSON section in the session cache (CONSTITUTION, WORKFLOW_CONFIG, ITERATION_REQUIREMENTS, SKILLS_MANIFEST, ARTIFACT_PATHS) could benefit from full TOON encoding:

| Section | Est. Tokens (JSON) | TOON Potential |
|---------|-------------------|----------------|
| SKILLS_MANIFEST | ~10,200 | High — nested objects, repetitive keys |
| WORKFLOW_CONFIG | ~4,700 | High — deeply nested, many braces |
| ITERATION_REQUIREMENTS | ~215 | Medium — nested structure |
| ARTIFACT_PATHS | ~5,200 | Medium — nested objects |
| CONSTITUTION | ~2,800 | Low — mostly prose markdown |

## Context from REQ-0040

- TOON encoder exists at `src/claude/hooks/lib/toon-encoder.cjs` (47 tests)
- Session cache is rebuilt by `bin/rebuild-cache.js` via `rebuildSessionCache()` in `common.cjs`
- The encoder needs to be upgraded from tabular-only to full spec compliance
- Quality of cache content must not be compromised — LLM must parse TOON as well or better than JSON

## TOON Spec Reference

- Official spec: https://github.com/toon-format/spec
- TOON supports indentation-based nesting, eliminating `{`, `}`, `[`, `]`, `"` overhead
- Benchmarks show 39.6% fewer tokens with equal or better LLM accuracy
