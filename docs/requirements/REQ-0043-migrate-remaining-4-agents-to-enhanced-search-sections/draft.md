# Migrate remaining 4 agents to Enhanced Search sections

**Source**: GitHub #96
**Type**: Feature (REQ)

## Problem

REQ-0042 migrated 6 high-impact agents to use the Enhanced Search abstraction layer. 4 agents that perform Glob/Grep search operations remain unmigrated:

1. **14-upgrade-engineer** — Uses Glob/Grep for breaking changes and affected file discovery
2. **execution-path-tracer** — Traces call chains, needs function/definition search
3. **cross-validation-verifier** — Cross-references file lists with independent search
4. **roundtable-analyst** — Occasional codebase search for design analysis

## Expected Outcome

All 4 agents have ENHANCED SEARCH sections following the same pattern established in REQ-0042, enabling them to leverage structural search (ast-grep), enhanced lexical search (BM25 ranking), and the search abstraction layer when available.

## Reference

- REQ-0041: Search abstraction layer implementation (180 tests)
- REQ-0042: Setup pipeline wiring + 6 agent migrations (47 tests)
- Existing pattern: See `src/claude/agents/quick-scan/quick-scan-agent.md` ENHANCED SEARCH section
