# Architecture Overview: REQ-0008 -- Update Node Version

**Phase**: 03-architecture
**Created**: 2026-02-10
**Status**: APPROVED
**Traces To**: REQ-001 through REQ-007, NFR-001 through NFR-004

---

## 1. Executive Summary

This feature is a **configuration-only change** that updates the iSDLC framework's Node.js version requirements. No runtime code, no new modules, no architectural pattern changes. The existing modular monolith architecture (ESM lib + CJS hooks) is fully retained.

### Architectural Drivers

| Driver | Source | Decision |
|--------|--------|----------|
| Node 18 EOL (April 2025) | REQ-001 | Drop Node 18 from minimum and CI matrix |
| Node 24 is Active LTS | REQ-002, REQ-003 | Add Node 24 to CI matrix |
| Zero API incompatibility | Impact Analysis (M3) | No code changes required |
| Constitution governance | REQ-004 | Amend Article XII (version bump 1.1.0 -> 1.2.0) |
| Documentation consistency | NFR-004 | All version references updated atomically |

### Scope Boundary

This architecture covers ONLY the version update. The following are explicitly out of scope:

- Adopting Node 24-only features (e.g., stable `require(esm)`)
- Changing the ESM/CJS dual-module architecture
- Updating npm dependencies
- Performance benchmarking across Node versions

---

## 2. Existing Architecture (Retained As-Is)

The iSDLC framework architecture is **unchanged** by this feature. For reference:

```
iSDLC Framework (Modular Monolith)
├── CLI Entry Point (bin/isdlc.js)         -- ESM
├── Library Modules (lib/*.js)              -- ESM
│   ├── cli.js, installer.js, updater.js, uninstaller.js
│   ├── doctor.js, project-detector.js, monorepo-handler.js
│   └── utils/ (fs-helpers.js, logger.js, prompts.js)
├── Runtime Hooks (src/claude/hooks/*.cjs)  -- CJS
│   ├── 5 dispatchers (pre-task, pre-skill, post-task, post-bash, post-write-edit)
│   ├── 4 standalone hooks (branch-guard, explore-readonly, skill-delegation, delegation-gate)
│   └── 21 individual hook modules (loaded by dispatchers)
├── Agent Definitions (src/claude/agents/)  -- 48 .md files
├── Skill Definitions (src/claude/skills/)  -- 240 skills
├── CI/CD (.github/workflows/)              -- ci.yml, publish.yml
└── State Management (.isdlc/state.json)    -- JSON on filesystem
```

**Module System**: ESM (`"type": "module"` in package.json) for CLI/lib, CJS (`.cjs` extension) for hooks. This dual architecture is maintained across all Node versions 20-24 without any changes. Article XIII of the constitution governs this.

---

## 3. Change Architecture

### 3.1 Change Topology

All changes are **leaf-node edits** -- no cascading dependencies, no import chain modifications.

```
Changes (all independent, no ordering dependency):
┌─────────────────────────┐
│  package.json            │  engines.node: ">=18.0.0" -> ">=20.0.0"
├─────────────────────────┤
│  ci.yml                  │  matrix: [18,20,22] -> [20,22,24]
│                          │  lint job: node 20 -> 22
│                          │  integration job: node 20 -> 22
├─────────────────────────┤
│  publish.yml             │  matrix: [18,20,22] -> [20,22,24]
│                          │  publish jobs: node 20 -> 22
├─────────────────────────┤
│  constitution.md         │  Article XII req 4: "18, 20, 22" -> "20, 22, 24"
│                          │  Version: 1.1.0 -> 1.2.0
│                          │  Amendment log entry
├─────────────────────────┤
│  README.md               │  "Node 18+" -> "Node 20+"
├─────────────────────────┤
│  state.json              │  runtime: "node-18+" -> "node-20+"
├─────────────────────────┤
│  project-discovery-report│  ">= 18.0.0" -> ">= 20.0.0"
│                          │  "18, 20, 22" -> "20, 22, 24"
├─────────────────────────┤
│  test-strategy template  │  "{18+}" -> "{20+}"
└─────────────────────────┘
```

### 3.2 CI Matrix Strategy

**Current matrix**: 3 OS (ubuntu, macos, windows) x 3 Node (18, 20, 22) = 9 jobs
**New matrix**: 3 OS (ubuntu, macos, windows) x 3 Node (20, 22, 24) = 9 jobs

The matrix size is preserved. Node 18 is swapped for Node 24. This satisfies:
- NFR-001: Node 20/22 users unaffected (still in matrix)
- NFR-002: Same job count, similar execution time
- NFR-003: All three active/maintenance LTS versions tested
- Article XII: Cross-platform coverage maintained (9 combinations)

### 3.3 Node Version Selection Rationale

| Version | LTS Status | EOL Date | Decision |
|---------|-----------|----------|----------|
| Node 18 | EOL | April 2025 (past) | DROP -- no security patches |
| Node 20 | Maintenance LTS | April 2026 | KEEP as minimum -- 2.5 months remaining, widely deployed |
| Node 22 | Maintenance LTS | April 2027 | KEEP in matrix -- solid middle ground |
| Node 24 | Active LTS | ~April 2028 | ADD to matrix -- current recommended version |

Setting minimum to Node 20 (not 22) provides a reasonable migration window for users still on Node 20. This balances security (dropping EOL) with usability (not forcing immediate upgrade to 22+).

### 3.4 Single-Job Node Version (Lint, Integration, Publish)

Jobs that run on a single Node version (not matrix-based) will be bumped from Node 20 to Node 22.

Rationale: Node 22 is the stable middle ground -- not the oldest supported (20) and not the newest (24). This avoids running CI infrastructure on a version nearing EOL (20) while not being on the bleeding edge (24).

---

## 4. Risk Assessment

### 4.1 API Compatibility

**Risk: NONE**

The impact analysis confirmed zero Node 18-specific API usage in the codebase. All APIs used are core stable APIs unchanged since before Node 18:
- `fs`, `path`, `os`, `child_process`, `http`/`https` (CJS hooks)
- `node:test`, `node:assert/strict` (test runner)
- Standard ESM `import`/`export` (lib modules)

### 4.2 CI Action Compatibility

**Risk: NONE**

`actions/setup-node@v4` supports Node 24. No changes to GitHub Actions dependencies needed.

### 4.3 Constitution Amendment

**Risk: LOW**

Article XII amendment follows the established amendment process:
1. Bump version (1.1.0 -> 1.2.0)
2. Add amendment log entry with date and justification
3. Update the specific requirement text only

No other articles need modification.

---

## 5. Architecture Decision Records

One ADR created for this feature (proportional to scope):

| ADR | Title | Status |
|-----|-------|--------|
| ADR-0008-node-version-minimum | Node 20 Minimum with CI Matrix [20, 22, 24] | Accepted |

The ADR covers the combined decision of minimum version selection, CI matrix strategy, and constitution amendment approach. A single ADR is appropriate because these are facets of one architectural decision (which Node versions to support), not independent decisions.

---

## 6. Constitutional Compliance

| Article | Compliance | Notes |
|---------|-----------|-------|
| Article III (Security by Design) | COMPLIANT | Dropping EOL Node 18 improves security posture |
| Article IV (Explicit Over Implicit) | COMPLIANT | All decisions documented with rationale |
| Article V (Simplicity First) | COMPLIANT | Config-only change, no over-engineering |
| Article VII (Artifact Traceability) | COMPLIANT | All changes trace to REQ-001 through REQ-007 |
| Article IX (Quality Gate Integrity) | COMPLIANT | Gate artifacts produced |
| Article X (Fail-Safe Defaults) | COMPLIANT | No runtime behavior changes |
| Article XII (Cross-Platform) | COMPLIANT | 9 CI combinations maintained |
| Article XIII (Module System) | COMPLIANT | ESM/CJS architecture unchanged |

---

## 7. Handoff to System Designer (Phase 04)

### What Phase 04 Needs to Do

1. **Detailed file edit specifications**: Exact line-by-line changes for each of the 8-10 files
2. **Constitution amendment text**: Precise wording for Article XII update and amendment log entry
3. **Validation checklist**: Grep patterns to verify all "18" references are updated
4. **Implementation order**: Sequence the edits for the implementation phase

### What Phase 04 Does NOT Need to Do

- No API contracts (no APIs changing)
- No database design (no database)
- No sequence diagrams (no new flows)
- No component design (no new components)

This is a design-for-configuration phase, not a design-for-code phase.
