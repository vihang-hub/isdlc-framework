# Requirements Specification: REQ-0099 — Agent Content Decomposition

## 1. Business Context
47 agent markdown files contain mixed content: durable role semantics interleaved with Claude-specific runtime instructions. Codex needs to know which sections are portable (RoleSpec) and which are Claude-specific (RuntimePackaging). This classification enables the Codex adapter (Phase 8) to consume role semantics without Claude-specific noise.

**Source**: GitHub #163 (CODEX-030)

## 2. Functional Requirements

### FR-001: Agent Section Classification Schema
**Confidence**: High
- AC-001-01: Classification maps each agent file to an array of section entries
- AC-001-02: Each entry has: name, type ('role_spec'|'runtime_packaging'|'mixed'), portability ('full'|'partial'|'none')

### FR-002: Standard Section Classifications
**Confidence**: High
- AC-002-01: Frontmatter (name, description, model, owned_skills) classified as role_spec/full
- AC-002-02: Role description and purpose classified as role_spec/full
- AC-002-03: Phase overview (inputs, outputs, gate) classified as role_spec/full
- AC-002-04: Tool usage instructions (Read, Write, Bash, Task) classified as runtime_packaging/none
- AC-002-05: Writer/reviewer mode detection classified as runtime_packaging/none
- AC-002-06: Constitutional principles section classified as role_spec/full
- AC-002-07: Iteration protocol references classified as mixed/partial
- AC-002-08: Suggested prompts section classified as runtime_packaging/none

### FR-003: Classification Coverage
**Confidence**: High
- AC-003-01: All 47 agent files have classification entries
- AC-003-02: `getAgentClassification(agentName)` returns the classification for a given agent
- AC-003-03: `listClassifiedAgents()` returns all 47 agent names

## 3. Out of Scope
- Actually splitting agent files into separate RoleSpec/RuntimePackaging files
- Modifying any agent markdown files
- Codex-specific packaging (Phase 8)

## 4. MoSCoW
All FRs are Must Have.
