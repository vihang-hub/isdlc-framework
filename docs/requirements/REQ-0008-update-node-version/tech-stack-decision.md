# Technology Stack Decision: REQ-0008 -- Update Node Version

**Phase**: 03-architecture
**Created**: 2026-02-10
**Status**: APPROVED

---

## Summary

This feature modifies the Node.js version requirements for the iSDLC framework. No other technology stack components change.

## Runtime

### Current Stack (Unchanged)

| Component | Technology | Version | Status |
|-----------|-----------|---------|--------|
| Language | JavaScript | ES2022+ | RETAINED |
| Runtime | Node.js | **>=20.0.0** (changed from >=18.0.0) | UPDATED |
| Module System | ESM (lib) + CJS (hooks) | Dual | RETAINED |
| Package Manager | npm | 10+ | RETAINED |
| Test Runner | node:test (built-in) | Stable | RETAINED |

### Dependencies (Unchanged)

| Package | Version | Purpose |
|---------|---------|---------|
| chalk | ^5.3.0 | Terminal colors (ESM) |
| fs-extra | ^11.2.0 | Enhanced file system operations |
| prompts | ^2.4.2 | Interactive CLI prompts |
| semver | ^7.6.0 | Semantic version parsing |

All four dependencies are compatible with Node 20-24. No version bumps needed.

## CI/CD

### GitHub Actions

| Action | Current Version | Status |
|--------|----------------|--------|
| actions/checkout | @v4 | RETAINED (supports Node 24) |
| actions/setup-node | @v4 | RETAINED (supports Node 24) |

### CI Matrix Change

| Dimension | Current | New |
|-----------|---------|-----|
| Operating Systems | ubuntu-latest, macos-latest, windows-latest | UNCHANGED |
| Node Versions | 18, 20, 22 | **20, 22, 24** |
| Total Jobs | 9 (3 OS x 3 Node) | 9 (3 OS x 3 Node) |

### Single-Job Node Version

| Job | Current | New | Rationale |
|-----|---------|-----|-----------|
| Lint | Node 20 | **Node 22** | Stable middle ground |
| Integration Tests | Node 20 | **Node 22** | Stable middle ground |
| npm Publish | Node 20 | **Node 22** | Stable middle ground |
| GitHub Packages Publish | Node 20 | **Node 22** | Stable middle ground |

## Evaluation Criteria

This is not a technology selection -- all technologies are retained. The only decision is the Node.js version boundary.

| Criterion | Node 20 as Minimum | Node 22 as Minimum | Decision |
|-----------|--------------------|--------------------|----------|
| User disruption | Minimal (only Node 18 users affected) | Higher (Node 20 users also affected) | Node 20 |
| Security | Removes EOL version | Also removes near-EOL version | Node 20 (sufficient) |
| LTS support remaining | 2.5 months (Node 20) | 14 months (Node 22) | Node 22 is better long-term |
| Ecosystem compatibility | Wider (more users on 20) | Narrower | Node 20 |
| **Selected** | **Yes** | No | **Node 20** |

The rationale for choosing Node 20 over 22 as the minimum is documented in ADR-0008.

## Cost Impact

- **CI cost change**: None. Same number of matrix jobs (9). Node 24 runners use the same GitHub Actions minutes as Node 18 runners.
- **Infrastructure cost**: None. No infrastructure changes.
- **Dependency cost**: None. No new dependencies.
- **Maintenance cost**: Marginally reduced. Removing EOL version reduces the surface area for version-specific bug reports.
