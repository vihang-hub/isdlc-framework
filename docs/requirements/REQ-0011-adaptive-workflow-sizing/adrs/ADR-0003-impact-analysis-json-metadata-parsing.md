# ADR-0003: Parse JSON Metadata Block from Impact Analysis

## Status
Accepted

## Context

The sizing parser (`parseSizingFromImpactAnalysis`) needs to extract structured data from `impact-analysis.md`:
- File count (directly affected)
- Module count
- Risk score (low/medium/high)
- Blast radius / coupling (low/medium/high)
- Coverage gaps

The impact-analysis.md file contains this data in two forms:
1. **Markdown tables and prose** -- e.g., `**Affected Files**: 12 direct, ~8 transitive` in the Executive Summary
2. **JSON metadata block** -- a structured JSON object inside a fenced code block at the bottom of the file, under the `## Impact Analysis Metadata` heading

Two parsing strategies were evaluated:
- Parse markdown tables and prose using regex
- Parse the JSON metadata block

## Decision

Use the **JSON metadata block** as the primary parsing target. Fall back to markdown prose parsing if the JSON block is not found. If both fail, return null (caller defaults to `standard` intensity).

### Parsing Priority

1. **Primary**: Find the last ` ```json ` fenced block in the file. Parse it as JSON. Extract `files_directly_affected`, `modules_affected`, `risk_level`, `blast_radius`.
2. **Fallback**: Scan for `**Affected Files**: N` and `**Risk Level**: X` patterns in Executive Summary.
3. **Default**: Return null.

### Required JSON Metadata Fields

The IA agent must output at minimum:
```json
{
  "files_directly_affected": 10,
  "modules_affected": 5,
  "risk_level": "medium",
  "blast_radius": "medium"
}
```

Optional field (desirable for richer sizing):
```json
{
  "coverage_gaps": 2
}
```

## Consequences

**Positive:**
- JSON parsing is deterministic and reliable (`JSON.parse()` -- no regex fragility)
- The IA agent already outputs this block in the current format
- Easy to extend with new fields without breaking the parser
- Testable with simple JSON fixtures (no complex markdown fixtures needed)

**Negative:**
- Depends on the IA agent continuing to output the JSON metadata block
- If a user manually creates impact-analysis.md without the JSON block, only the fallback path works
- The JSON block is at the end of the file, requiring scanning the full content

**Mitigations:**
- The IA agent specification (impact-analysis-orchestrator.md) will be updated to mark the JSON metadata block as a required output
- The fallback markdown parser provides resilience
- File sizes are small (<50KB) -- scanning is negligible

## Alternatives Considered

**Parse markdown tables only (no JSON block)**
- Rejected: markdown table format is fragile. Column names, alignment, and whitespace can vary. The Executive Summary section has free-form prose that requires complex regex. Multiple IA sub-agents contribute to the output format, increasing variability.

**Add a YAML frontmatter block**
- Rejected: YAML frontmatter is not an established convention in iSDLC markdown files. Adding it would be inconsistent with other artifacts. JSON is already used (workflows.json, state.json, iteration-requirements.json).

## Traces To
FR-01 (AC-01, AC-03), NFR-01 (Performance -- JSON.parse is fast)
