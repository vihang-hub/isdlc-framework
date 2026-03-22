# Requirements Specification: REQ-0102 — Topic Content Classification

## 1. Business Context
6 topic files define what the roundtable analyzes. Topics are the most portable content type — coverage criteria, depth guidance, and analytical knowledge are provider-neutral. Only source_step_files references are Claude-specific.

**Source**: GitHub #166 (CODEX-033)

## 2. Functional Requirements

### FR-001: Topic Section Classification
**Confidence**: High
- AC-001-01: Each topic file mapped to classified sections
- AC-001-02: Each section has type and portability

### FR-002: Standard Topic Classifications
**Confidence**: High
- AC-002-01: Frontmatter (topic_id, topic_name, primary_persona, coverage_criteria) classified as role_spec/full
- AC-002-02: Depth guidance (brief/standard/deep behavior, acceptance, inference_policy) classified as role_spec/full
- AC-002-03: Analytical knowledge sections classified as role_spec/full
- AC-002-04: Validation criteria classified as role_spec/full
- AC-002-05: Artifact instructions classified as role_spec/full
- AC-002-06: source_step_files references classified as runtime_packaging/none

### FR-003: Portability Summary
**Confidence**: High
- AC-003-01: Topics are >95% portable (only source_step_files is Claude-specific)
- AC-003-02: `getTopicClassification(topicId)` returns classification

## 3. Out of Scope
- Modifying topic files. Codex-specific topic packaging.

## 4. MoSCoW
All FRs are Must Have.
