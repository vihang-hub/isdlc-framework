# Impact Analysis: Wire Skill Index Block Injection and Unify Skill Injection

**Generated**: 2026-02-23T21:15:00Z
**Feature**: Wire SKILL INDEX BLOCK injection in isdlc.md phase delegation (#84) and unify built-in + external skill injection into single AVAILABLE SKILLS block (#85)
**Based On**: Phase 01 Requirements (finalized) -- requirements-spec.md
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | Wire SKILL INDEX BLOCK injection + unify skill injection blocks | 6 FRs, 22 ACs: Wire built-in + external injection, unify AVAILABLE SKILLS, convert comments to instructions, monorepo paths, fail-open |
| Keywords | skill, index, injection, delegation, AVAILABLE SKILLS | +Bash tool invocation, delivery_type, truncation, curly-brace comments, imperative instructions |
| Estimated Files | ~8-12 files | ~8-10 files (refined -- no new files needed) |
| Scope Change | - | REFINED (same scope, more precise acceptance criteria and constraints) |

---

## Executive Summary

This feature rewrites the SKILL INDEX BLOCK and EXTERNAL SKILL INJECTION sections of isdlc.md STEP 3d from ambiguous curly-brace comment specifications into clear, imperative numbered instructions that the Phase-Loop Controller (LLM) can unambiguously execute. The primary change target is a ~25-line section of `src/claude/commands/isdlc.md` (lines 1724-1744). The underlying JavaScript infrastructure (`getAgentSkillIndex()`, `formatSkillIndexBlock()`, `loadExternalManifest()`, `formatSkillInjectionBlock()`) already exists and is well-tested (178 tests, all passing). The core task is wiring -- connecting existing, tested code to the delegation prompt construction through explicit LLM-executable instructions. No new source files need to be created. Test file TC-09 in `skill-injection.test.cjs` validates the STEP 3d template structure and may need updates to match new instruction wording.

**Blast Radius**: LOW (2 files modified, 51 agent files consume output but are NOT modified)
**Risk Level**: LOW
**Affected Files**: 2 directly modified, 3 test files may need updates
**Affected Modules**: 1 (phase delegation in isdlc.md STEP 3d)

---

## Impact Analysis

### Files Directly Affected

| # | File | Change Type | Requirement | Impact |
|---|------|-------------|-------------|--------|
| 1 | `src/claude/commands/isdlc.md` | MODIFY | FR-001, FR-002, FR-003, FR-004 | Primary change target. Lines 1724-1744 rewritten from curly-brace comments to numbered imperative instructions. |
| 2 | `src/claude/hooks/tests/skill-injection.test.cjs` | MODIFY | FR-004 | TC-09 (STEP 3d Prompt Template) tests validate isdlc.md contains "SKILL INDEX BLOCK" text. After rewrite, tests must match new instruction wording. |

### Files Potentially Affected (Validation/Test Updates)

| # | File | Change Type | Requirement | Impact |
|---|------|-------------|-------------|--------|
| 3 | `src/claude/hooks/tests/test-bug-0035-skill-index.test.cjs` | REVIEW | CON-002 | 27 tests validate getAgentSkillIndex/formatSkillIndexBlock. These functions are NOT being modified (CON-002), but should be re-run to confirm no regressions. |
| 4 | `src/claude/hooks/tests/external-skill-management.test.cjs` | REVIEW | FR-002 | 111 tests validate external skill infrastructure. Functions NOT being modified, but TC-12 (Runtime Injection Pipeline) tests confirm the injection pattern works correctly. |

### Files NOT Modified (Consumers -- Read-Only Dependencies)

| # | File | Relationship | Notes |
|---|------|-------------|-------|
| 5 | `src/claude/hooks/lib/common.cjs` | Provider (read-only) | Contains getAgentSkillIndex(), formatSkillIndexBlock(), loadExternalManifest(), formatSkillInjectionBlock(), resolveExternalSkillsPath(), resolveExternalManifestPath(). All 6 functions already exist and are tested. CON-002 prohibits modification. |
| 6 | `src/claude/hooks/config/skills-manifest.json` | Data source (read-only) | Contains ownership section mapping 41 agents to their skills. Read by getAgentSkillIndex(). Not modified. |
| 7-57 | `src/claude/agents/*.md` (51 files) | Consumers | All 51 agent files contain `## Skills` section referencing "AVAILABLE SKILLS in your Task prompt". These agents are the beneficiaries of this feature -- they will start receiving skill context in delegation prompts. Not modified. |

### Dependency Graph

```
                   isdlc.md STEP 3d (MODIFIED)
                   |
                   | invokes via Bash tool
                   v
        +----------------------------+
        | common.cjs (NOT MODIFIED)  |
        |  - getAgentSkillIndex()    |
        |  - formatSkillIndexBlock() |
        |  - loadExternalManifest()  |
        |  - formatSkillInjectionBlock() |
        +----------------------------+
                   |
                   | reads
                   v
        +----------------------------+
        | skills-manifest.json       |  (built-in skills)
        | external-skills-manifest   |  (external skills, may not exist)
        +----------------------------+
                   |
                   | produces
                   v
        +----------------------------+
        | AVAILABLE SKILLS block     |
        | + external skill blocks    |
        +----------------------------+
                   |
                   | injected into
                   v
        +----------------------------+
        | Task tool delegation prompt|
        | (received by 51 agents)    |
        +----------------------------+
```

### Change Propagation Analysis

1. **Direct change**: `isdlc.md` lines 1724-1744 -- curly-brace comments become numbered imperative instructions
2. **Test adaptation**: `skill-injection.test.cjs` TC-09 -- string matching patterns must reflect new instruction text
3. **No cascading changes**: The JavaScript functions in `common.cjs` are NOT modified (CON-002). The skills-manifest.json schema is NOT modified. Agent files are NOT modified. The output format (AVAILABLE SKILLS block) is unchanged since it uses the existing `formatSkillIndexBlock()` function.
4. **Runtime effect**: After this change, all 41 agents with owned skills will receive AVAILABLE SKILLS blocks in their delegation prompts. The 10 agents with no skills will see no change (empty result = no-op).

---

## Entry Points

### Primary Entry Point

**File**: `src/claude/commands/isdlc.md`
**Location**: STEP 3d -- DIRECT PHASE DELEGATION (lines 1717-1794)
**Trigger**: Phase-Loop Controller constructing a Task tool delegation prompt

The Phase-Loop Controller reads STEP 3d as procedural instructions. Currently, lines 1724-1744 contain curly-brace comment blocks that are ambiguous. The implementation must:

1. Replace lines 1724 (SKILL INDEX BLOCK comment) with numbered imperative instructions:
   - Step A: Read skills-manifest.json using `node -e` via Bash tool
   - Step B: Call getAgentSkillIndex(agentName) to get skill entries
   - Step C: Call formatSkillIndexBlock(entries) to get formatted text
   - Step D: If non-empty, append AVAILABLE SKILLS block to delegation prompt
   - Step E: On any error, skip (fail-open)

2. Replace lines 1725-1744 (EXTERNAL SKILL INJECTION comment) with numbered imperative instructions:
   - Step F: Read external-skills-manifest.json using Read tool (monorepo-aware path)
   - Step G: Filter skills by phase/agent bindings
   - Step H: Read matched skill files, format by delivery_type
   - Step I: Append formatted blocks to delegation prompt
   - Step J: On any error, skip (fail-open)

3. Add unification logic (FR-003):
   - Built-in skills appear FIRST as AVAILABLE SKILLS reference list
   - External skills appear AFTER as injection blocks
   - Clear section separation with double newlines

### Implementation Chain

```
User request -> isdlc.md Phase-Loop Controller
  -> STEP 3c: resolve phase_key + agent_name
  -> STEP 3d: construct delegation prompt
     -> [NEW] Built-in Skill Injection (Steps A-E)
        -> Bash: node -e "const c = require('./common.cjs'); ..."
        -> Read: skills-manifest.json (via getAgentSkillIndex)
        -> Output: AVAILABLE SKILLS block text
     -> [NEW] External Skill Injection (Steps F-J)
        -> Read: external-skills-manifest.json
        -> Filter: by phase_key, agent_name
        -> Read: matched .md files from .claude/skills/external/
        -> Format: by delivery_type (context/instruction/reference)
        -> Output: external skill blocks
     -> [EXISTING] Gate Requirements Injection (unchanged)
     -> [EXISTING] Budget Degradation Injection (unchanged)
  -> Task tool call with complete prompt
  -> STEP 3e: post-phase state update
```

### Recommended Implementation Order

1. **First**: Write the built-in skill injection instructions (FR-001, FR-004) -- this is the core wiring
2. **Second**: Write the external skill injection instructions (FR-002, FR-004) -- extends the pattern
3. **Third**: Add unification wrapper (FR-003) -- ensures both blocks are coherent
4. **Fourth**: Add monorepo path resolution notes (FR-005) -- already handled by common.cjs functions
5. **Fifth**: Verify fail-open behavior throughout (FR-006) -- each instruction includes error handling
6. **Sixth**: Update TC-09 tests to match new instruction wording

### New Entry Points Created

None. This feature wires existing entry points together. No new files, no new functions, no new API endpoints.

---

## Risk Assessment

### Overall Risk Level: LOW

The primary risk factors are:

1. **Markdown-as-code**: The change target is a markdown file (`isdlc.md`) that serves as procedural instructions for an LLM. Changes cannot be validated by a compiler or type checker -- only by LLM execution and test assertions.
2. **Bash tool invocation**: The instructions must tell the LLM to use `node -e` via Bash tool to call JavaScript functions. This pattern must follow the Single-Line Bash Convention (CLAUDE.md).
3. **Scope constraint**: The GATE REQUIREMENTS INJECTION and BUDGET DEGRADATION INJECTION blocks (CON-006) must NOT be touched.

### Risk Matrix

| Risk | Severity | Likelihood | Mitigation |
|------|----------|------------|------------|
| LLM misinterprets new instructions | Medium | Low | Use clear numbered imperative steps with explicit error handling. Follow pattern of existing GATE REQUIREMENTS INJECTION block (lines 1745-1768) which already works. |
| TC-09 tests break after rewrite | Low | High | Expected and planned -- TC-09 checks for "SKILL INDEX BLOCK" string presence. Must update to match new text. |
| Bash tool invocation fails at runtime | Low | Low | Fail-open semantics (FR-006) ensure delegation continues without skills. getAgentSkillIndex already returns [] on any error. |
| External manifest not found | None | Medium | Already handled -- loadExternalManifest returns null, injection is skipped (no-op). |
| Monorepo path resolution fails | Low | Low | resolveExternalManifestPath/resolveExternalSkillsPath already handle monorepo mode with dual-path resolution. |
| Prompt size exceeds limits | Low | Very Low | NFR-001: formatSkillIndexBlock stays within 30 lines for 14 entries. NFR-006: 10K char truncation for external skills. |

### Test Coverage Analysis

| File | Tests | Coverage | Status |
|------|-------|----------|--------|
| `src/claude/hooks/lib/common.cjs` (skill functions) | 67 tests (40 in skill-injection + 27 in bug-0035) | HIGH | All pass. Functions NOT being modified. |
| `src/claude/hooks/lib/common.cjs` (external skill functions) | 111 tests (external-skill-management) | HIGH | All pass. Functions NOT being modified. |
| `src/claude/commands/isdlc.md` (STEP 3d template) | 3 tests (TC-09) | LOW | TC-09 only checks string presence, not instruction execution. |
| Integration (delegation + injection end-to-end) | 0 tests | NONE | No test validates that a phase agent actually receives AVAILABLE SKILLS in its prompt. |

### Complexity Hotspots

| Location | Cyclomatic Complexity | Concern |
|----------|----------------------|---------|
| isdlc.md STEP 3d lines 1717-1794 | Medium (4 injection blocks, sequential) | The delegation template is already complex with 4 injection blocks. Adding executable instructions to the first two makes this section longer but more explicit. |
| common.cjs getAgentSkillIndex() (lines 1262-1421) | High (nested loops, dual schema, dual path) | Already tested with 67 tests. NOT being modified (CON-002). |

### Technical Debt Markers

1. **Curly-brace comment pattern**: After this feature, 2 of 4 injection blocks will be executable instructions (skill index, external skills). The remaining 2 (gate requirements, budget degradation) still use the same curly-brace pattern but are already functional because they use Read tool directly (not JavaScript invocation). No immediate debt.
2. **No integration test for delegation prompts**: There is no test that validates the complete delegation prompt as seen by the target agent. This is a pre-existing gap, not introduced by this feature.
3. **Session cache not implemented**: External skills use file-read pattern (read manifest each time). Issue #91 (SessionStart cache) is out of scope per CON-003.

### Recommendations

1. **Add tests BEFORE modifying isdlc.md**: Update TC-09 to expect the new instruction wording FIRST, then make the isdlc.md changes. This ensures test-driven validation.
2. **Follow the GATE REQUIREMENTS INJECTION pattern**: Lines 1745-1768 already demonstrate the correct pattern for executable injection instructions in isdlc.md. Use the same numbered-step style.
3. **Validate with a dry run**: After implementation, manually execute Phase 06 (software-developer) which has the most skills (14) to verify AVAILABLE SKILLS appears in the delegation prompt.
4. **Keep fail-open at every step**: Each instruction step must include "If this fails: skip and continue with the prompt as-is."

---

## Cross-Validation

### File List Consistency (M1 vs M2)

M1 identifies 2 files directly affected: `isdlc.md` and `skill-injection.test.cjs`. M2 identifies the same primary entry point (`isdlc.md` STEP 3d) and the same test file for updates. CONSISTENT.

### Risk vs Coupling Consistency (M1 vs M3)

M1 reports LOW blast radius (2 files modified, no cascading changes). M3 reports LOW risk (well-tested infrastructure, fail-open semantics). The low coupling (isdlc.md calls common.cjs functions that already exist and are tested) aligns with the low risk assessment. CONSISTENT.

### Completeness Check

- All 6 functional requirements (FR-001 through FR-006) are covered in the file impact mapping.
- All 22 acceptance criteria can be satisfied by modifying only `isdlc.md` STEP 3d.
- CON-002 (no modification of common.cjs functions) is respected -- common.cjs is listed as read-only.
- CON-006 (no modification of gate/budget blocks) is respected -- those blocks are explicitly excluded.

### Verification Status: PASS

No conflicts, gaps, or inconsistencies detected across the three analysis perspectives.

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**:
   1. Update TC-09 test expectations in `skill-injection.test.cjs` to match planned new wording
   2. Rewrite SKILL INDEX BLOCK (line 1724) as numbered imperative instructions (FR-001, FR-004)
   3. Rewrite EXTERNAL SKILL INJECTION (lines 1725-1744) as numbered imperative instructions (FR-002, FR-004)
   4. Add unification logic ensuring built-in FIRST, external SECOND (FR-003)
   5. Verify monorepo path notes are included (FR-005)
   6. Add fail-open instructions at each step (FR-006)
   7. Run all 178 tests to confirm no regressions

2. **High-Risk Areas**: None identified. All underlying functions are well-tested (178 tests, 100% pass). The change is purely in the instruction layer.

3. **Dependencies to Resolve**: None. All dependencies (common.cjs functions, skills-manifest.json, agent ## Skills sections) already exist and are stable.

---

## Impact Analysis Metadata

```json
{
  "analysis_completed_at": "2026-02-23T21:15:00Z",
  "sub_agents": ["M1", "M2", "M3", "M4"],
  "verification_status": "PASS",
  "requirements_document": "docs/requirements/REQ-0033-skill-index-injection-unify-blocks/requirements-spec.md",
  "quick_scan_used": "docs/requirements/REQ-0033-skill-index-injection-unify-blocks/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["skill", "index", "injection", "delegation", "AVAILABLE SKILLS", "external", "monorepo", "fail-open", "Bash tool", "delivery_type"],
  "files_directly_affected": 2,
  "modules_affected": 1,
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": 0
}
```
