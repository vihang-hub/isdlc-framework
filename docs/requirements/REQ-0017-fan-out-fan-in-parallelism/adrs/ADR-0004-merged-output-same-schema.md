# ADR-0004: Merged Fan-Out Output Uses Identical Schema to Single-Agent Output

## Status

Accepted

## Context

The fan-out engine produces merged results from N parallel chunk agents. These results feed into the existing gate validation pipeline:
- Phase 16: `gate-blocker.cjs` reads `phases[phase].test_results` from state.json and validates against `success_criteria` in `iteration-requirements.json`
- Phase 08: `gate-blocker.cjs` validates the existence of `docs/reviews/{artifact_folder}/review-summary.md`

We need to decide whether the merged output should use a new schema (with fan-out metadata) or the existing single-agent schema.

### Options Considered

1. **Same schema as single-agent**: The merged output populates the same fields (`all_tests_passing`, `lint_passing`, `coverage_percent`, etc.) that gate-blocker already reads. Fan-out metadata (chunk count, per-agent timing) is stored in a separate optional field that gate-blocker ignores.

2. **New schema with fan-out envelope**: Wrap the merged results in a fan-out envelope (`{ fan_out: { used: true, chunks: [...] }, results: { ... } }`). Gate-blocker would need to unwrap the envelope.

3. **Dual-write**: Write both the legacy schema (for gate-blocker) and a new fan-out schema (for observability) as separate state.json sections.

## Decision

We will use **Option 1: Same schema as single-agent output**.

The merged output from the fan-out engine populates the exact same state.json fields that gate-blocker reads:
- `test_results.all_tests_passing` (boolean)
- `test_results.lint_passing` (boolean)
- `test_results.type_check_passing` (boolean)
- `test_results.no_critical_vulnerabilities` (boolean)
- `test_results.coverage_percent` (number, >= 80)

Fan-out metadata is stored in an OPTIONAL nested field:
- `test_results.parallel_execution.fan_out` (object with chunk details)

This field is already within the `parallel_execution` structure that the Phase 16 agent uses for track-level timing. Gate-blocker reads only the top-level `test_results` fields and ignores nested `parallel_execution` details.

## Consequences

### Positive

- **Zero changes to gate-blocker.cjs**: The hook code is not modified. This eliminates a high-risk integration point identified in the impact analysis.
- **Zero changes to iteration-requirements.json**: The success_criteria schema is unchanged. No new validation fields needed.
- **Zero changes to iteration-corridor.cjs**: The corridor only sees phase-level iterations. Fan-out chunk iterations are internal to Track A.
- **Backward compatible by construction**: Any tool that reads the test_results schema today will work identically with fan-out output.
- **Reduced blast radius**: The feature touches only agent markdown files and skill definitions, not hook code. This lowers risk significantly.

### Negative

- **Fan-out is invisible to gate-blocker**: If a fan-out merge is buggy (e.g., incorrectly sets `all_tests_passing: true` when some tests failed), gate-blocker cannot detect the inconsistency because it only reads the top-level fields.
- **Mitigation**: The merger performs a sanity check: `all_tests_passing = (fail_count == 0)`. This is the same logic a single agent uses. The risk of a merge bug is equivalent to the risk of a single agent miscounting test results.

### Schema Mapping

| Gate-Blocker Field | Single-Agent Source | Merged Fan-Out Source |
|-------------------|--------------------|-----------------------|
| `all_tests_passing` | Track A test run | `fail_count == 0` across all chunks |
| `lint_passing` | Track A lint check | `all(chunk.checks.lint == 'PASS')` across all chunks |
| `type_check_passing` | Track A type check | `all(chunk.checks.type_check == 'PASS')` |
| `no_critical_vulnerabilities` | Track B security scan | Unchanged (Track B is not fanned out) |
| `coverage_percent` | Track A coverage | Union of covered lines across all chunks |

The mapping is straightforward. Each merged field is a simple aggregation (all-pass for booleans, union for coverage).

## Alternatives Rejected

### Option 2: New Schema with Fan-Out Envelope

Rejected because:
- Requires modifying gate-blocker.cjs to unwrap the envelope
- gate-blocker is a complex hook (3.2.0, high complexity per impact analysis)
- Modifying it for a formatting change introduces regression risk
- Violates Article V (Simplicity First): same data, different shape, for no consumer benefit

### Option 3: Dual-Write

Rejected because:
- Writes the same data twice in different formats
- Increases state.json size without benefit
- Gate-blocker only reads one format; the second format has no consumer
- Unnecessary complexity (Article V)

## Traces

- NFR-003 (Backward Compatibility: gates unaware of fan-out)
- FR-005 (Phase 16 Fan-Out: compatible with existing gate validation)
- FR-006 (Phase 08 Fan-Out: compatible with existing gate validation)
- Impact Analysis M3: "Gate-blocker reads Phase 16 test_results from state.json"
- Article V (Simplicity First)
- Article X (Fail-Safe Defaults: existing validation continues to work)
