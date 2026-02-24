# Non-Functional Requirements Matrix: BUG-0030-GH-24

## Impact Analysis Sub-Agents Independent Search

| NFR ID | Category | Requirement | Metric | Target | Priority |
|--------|----------|-------------|--------|--------|----------|
| NFR-01 | Quality | No regression in analysis quality | Agent analysis depth | Same or better coverage | High |
| NFR-02 | Maintainability | Prompt-only changes | Files changed type | .md files only | High |
| NFR-03 | Compatibility | Backward compatible with existing workflows | Existing delegation format | No changes to orchestrator delegation | High |

## Details

### NFR-01: No Regression in Analysis Quality
- Agents must still use quick scan output as supplementary context
- The independent search adds to (not replaces) existing analysis methodology
- Risk: Over-broad search could slow analysis. Mitigation: Focus search on domain-specific keywords from requirements

### NFR-02: Prompt-Only Changes
- All changes are to `.md` agent prompt files in `src/claude/agents/impact-analysis/`
- No code changes to hooks, CLI, runtime configuration, or state.json schema
- No changes to workflow definitions in `.isdlc/config/workflows.json`

### NFR-03: Backward Compatibility
- Quick scan output remains available to agents as supplementary context
- No changes to the M0 orchestrator delegation format or prompts
- No changes to agent output JSON schemas (M1/M2/M3/M4 output format unchanged)
- Agents that receive no quick scan context (e.g., fix workflow without Phase 00) are unaffected
