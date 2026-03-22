# Requirements Specification: REQ-0100 — Skill Content Audit

## 1. Business Context
245 SKILL.md files need classification. Skill metadata (frontmatter) is portable. Skill content is mixed: analytical guidance is portable, tool-specific instructions are not. This classification tells the Codex adapter which skill content can be reused as-is vs needs repackaging.

**Source**: GitHub #164 (CODEX-031)

## 2. Functional Requirements

### FR-001: Skill Section Classification Schema
**Confidence**: High
- AC-001-01: Classification maps skill sections to type and portability
- AC-001-02: Each entry has: name, type ('role_spec'|'runtime_packaging'|'mixed'), portability

### FR-002: Standard Skill Section Classifications
**Confidence**: High
- AC-002-01: Frontmatter (name, skill_id, owner, version) classified as role_spec/full
- AC-002-02: Purpose and When-to-Use classified as role_spec/full
- AC-002-03: Prerequisites classified as role_spec/full
- AC-002-04: Process steps with analytical guidance classified as mixed/partial
- AC-002-05: Tool-specific commands (Bash, Read, Write) within steps classified as runtime_packaging/none
- AC-002-06: Output format requirements classified as mixed/partial

### FR-003: Category-Level Summary
**Confidence**: High
- AC-003-01: Each of 17 skill categories has a portability summary (% full, % partial, % none)
- AC-003-02: `getSkillClassification(skillId)` returns classification for a skill
- AC-003-03: `getCategoryPortability(category)` returns the category summary

## 3. Out of Scope
- Rewriting skill files. Modifying SKILL.md content.

## 4. MoSCoW
All FRs are Must Have.
