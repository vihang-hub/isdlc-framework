# ADR-0008: Node 20 Minimum with CI Matrix [20, 22, 24]

## Status

Accepted

## Date

2026-02-10

## Context

The iSDLC framework currently sets `engines.node >= 18.0.0` and tests against Node 18, 20, 22 in CI. Node 18 reached end-of-life on April 30, 2025, meaning it no longer receives security patches. The developer's local environment runs Node 24 (v24.10.0), which is the current Active LTS. Node 20 is in Maintenance LTS until April 2026, and Node 22 is in Maintenance LTS until April 2027.

The codebase uses only core stable Node.js APIs (`fs`, `path`, `os`, `child_process`, `http/https`, `node:test`) with zero Node 18-specific patterns identified. The impact analysis confirmed zero API compatibility risk.

We need to decide: (1) which Node version to set as the new minimum, (2) which versions to include in the CI matrix, and (3) which Node version to use for single-version CI jobs.

### Requirements Driving This Decision

- REQ-001: Update `engines.node` in package.json
- REQ-002: Update CI workflow matrix
- REQ-003: Update publish workflow matrix
- REQ-004: Amend constitution Article XII
- NFR-001: Node 20/22 users must not be affected
- NFR-003: Zero test regressions on all target versions

## Decision

### Minimum Version: Node 20 (>=20.0.0)

Set the `engines.node` field to `>=20.0.0`, dropping Node 18 support entirely.

### CI Matrix: [20, 22, 24]

Replace Node 18 with Node 24 in the CI test matrix, maintaining the 3-version x 3-OS = 9 job configuration.

### Single-Job Version: Node 22

For CI jobs that run on a single Node version (lint, integration tests, npm publish, GitHub Packages publish), use Node 22 as the standard version.

### Constitution Amendment: v1.1.0 -> v1.2.0

Amend Article XII requirement 4 to reference "Node 20, 22, 24" and add an amendment log entry.

## Rationale

### Why Node 20 as minimum (not 22)

- Node 20 is still in Maintenance LTS with 2.5 months remaining (EOL April 2026)
- Many production environments still run Node 20
- Setting minimum to 22 would force premature upgrades on users
- The framework uses no Node 22+ specific features
- Article V (Simplicity First): the simplest change is dropping only the EOL version

### Why Node 22 for single-job versions (not 20 or 24)

- Node 20 is approaching EOL; running CI infrastructure on it is suboptimal
- Node 24 is the newest LTS; using the middle version reduces risk
- Node 22 has the longest remaining support window among non-active versions

### Why not skip Node 20 in the matrix

- NFR-001 requires that Node 20 users are unaffected
- Testing on Node 20 validates that the minimum version actually works
- Standard practice: test the minimum, a middle version, and the latest

## Consequences

**Positive:**
- Node 18 (EOL, no security patches) is removed from the supported set
- CI tests the full range of active/maintenance LTS versions
- No code changes required (zero API risk)
- Users on Node 20/22 experience zero disruption
- Constitution and documentation are consistent

**Negative:**
- Node 20 reaches EOL in April 2026; another version bump will be needed in ~2.5 months
- Users still on Node 18 must upgrade (unavoidable -- Node 18 is EOL)

## Alternatives Considered

### Set minimum to Node 22

- **Rejected**: Would force Node 20 users to upgrade immediately, violating the principle of minimal disruption. Node 20 is still in Maintenance LTS.

### Set minimum to Node 24

- **Rejected**: Too aggressive. Would exclude both Node 20 and 22 users. Node 22 has support through April 2027.

### Keep Node 18 in matrix but deprecate

- **Rejected**: Testing against an EOL version wastes CI resources and gives false confidence. Article III (Security by Design) requires dropping unsupported dependencies.

### Use Node 24 for single-job versions

- **Rejected**: Node 22 is the safer middle ground. Node 24, while Active LTS, is the newest and may have edge cases in third-party tooling.
