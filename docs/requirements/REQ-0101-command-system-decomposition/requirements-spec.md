# Requirements Specification: REQ-0101 — Command System Decomposition

## 1. Business Context
4 command files (isdlc.md, provider.md, discover.md, tour.md) define workflow orchestration. isdlc.md (~4000 lines) contains the Phase-Loop Controller, build/analyze/add handlers, and workflow definitions. The workflow semantics are provider-neutral but the implementation uses Claude-specific tool patterns. This classification identifies what can be shared vs what needs per-provider implementation.

**Source**: GitHub #165 (CODEX-032)

## 2. Functional Requirements

### FR-001: Command Section Classification
**Confidence**: High
- AC-001-01: Each command file mapped to classified sections
- AC-001-02: Each section has type and portability

### FR-002: isdlc.md Classifications
**Confidence**: High
- AC-002-01: Workflow definitions (action mappings, phase sequences) classified as role_spec/full
- AC-002-02: Build handler workflow logic (auto-detection, staleness, sizing) classified as role_spec/full
- AC-002-03: Analyze handler roundtable protocol classified as mixed/partial
- AC-002-04: Phase-Loop Controller (Task tool delegation, skill injection steps) classified as runtime_packaging/none
- AC-002-05: Interactive relay protocol classified as runtime_packaging/none
- AC-002-06: Add handler (backlog operations) classified as role_spec/full

### FR-003: Other Command Classifications
**Confidence**: High
- AC-003-01: provider.md — provider management semantics (role_spec), Claude settings UI (runtime_packaging)
- AC-003-02: discover.md — discovery workflow (role_spec), agent delegation patterns (runtime_packaging)
- AC-003-03: tour.md — tour content (role_spec), interactive presentation (runtime_packaging)

## 3. Out of Scope
- Splitting isdlc.md into separate files. Rewriting commands for Codex.

## 4. MoSCoW
All FRs are Must Have.
