# Bug Report: Blast radius validator regex doesn't match roundtable impact-analysis.md format

**Source**: github GH-127
**Severity**: High
**Generated**: 2026-03-21

## Expected Behavior

The blast radius validator should parse all Tier 1 affected files from impact-analysis.md regardless of whether the table has 3 columns (`| File | Change Type | Risk |`) or 4 columns (`| File | Module | Change Type | Traces |`). When unaddressed files exist, it should block phase advancement.

## Actual Behavior

The `IMPACT_TABLE_ROW` regex at `blast-radius-validator.cjs:32` expects the change type (`CREATE|MODIFY|DELETE`) in the second column immediately after the backtick-wrapped file path. The roundtable analysis produces a 4-column table where the change type is in the third column (after a Module column). The regex fails on every row, `parseImpactAnalysis()` returns an empty array, and the validator trivially passes at line 309 (`if (affectedFiles.length === 0) return allow`).

## Symptoms

- Blast radius validator is a no-op for all roundtable-analyzed features
- Implementation agents can skip files listed in impact-analysis.md Tier 1 without any gate blocking
- No warning or error is logged when the parser extracts zero files from a non-empty impact-analysis.md
- Discovered when REQ-0066 shipped without `src/claude/commands/isdlc.md` despite it being a Tier 1 direct change

## Error Messages

None — the validator silently passes. This is the core problem: silent failure with no diagnostic output.

## Reproduction Steps

1. Run any feature through roundtable analysis (`/isdlc analyze`)
2. The analysis produces `impact-analysis.md` with format: `| \`file/path\` | module | Modify | FR-NNN |`
3. Start a build (`/isdlc build`)
4. In Phase 06, skip one of the Tier 1 files
5. The blast radius validator parses 0 affected files and allows advancement
6. Phase 16 and Phase 08 both pass without catching the gap

## Affected Area

- **Files**: `src/claude/hooks/blast-radius-validator.cjs` (regex + zero-file guard), `src/claude/hooks/tests/test-blast-radius-validator.test.cjs` (test fixtures use wrong format)
- **Modules**: blast-radius-validator hook, Phase-Loop Controller step 3f-blast-radius, quality-loop-engineer, qa-engineer

## Additional Context

- The test suite passes because test fixtures use the 3-column format that matches the regex. No test uses a 4-column table matching actual roundtable output.
- The `blast-radius-step3f-helpers.cjs` (Phase-Loop Controller re-delegation) also depends on the same parser indirectly.
- GH-127 was originally filed as "fails-open when coverage artifact missing" — the real root cause is the regex/format mismatch, which is more fundamental.
- Every past feature build that went through roundtable analysis had zero blast radius enforcement.
