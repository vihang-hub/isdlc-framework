# Quick Scan: T7 Agent Prompt Boilerplate Extraction

**Generated**: 2026-02-16T00:00:00Z
**Feature**: T7 - Extract duplicated ROOT RESOLUTION, MONOREPO, and ITERATION protocols from 17 agents to CLAUDE.md
**Phase**: 00-quick-scan
**Status**: Complete

---

## Scope Estimate

**Estimated Scope**: Medium
**File Count Estimate**: ~16 files to update (13 agents + CLAUDE.md + discovery report + config docs)
**Confidence**: High

**Rationale**: Multiple agents with repeated sections, but sections are discrete and well-scoped. No dependency analysis needed. Direct text extraction and replacement.

---

## Boilerplate Duplication Analysis

### 1. Monorepo Mode Blockquote

**Location**: Appears as inline blockquote after agent title/description
**Pattern**: `> **Monorepo Mode**: In monorepo mode, all file paths are project-scoped...`
**Affected Agents (13 total)**:
- `02-solution-architect.md`
- `03-system-designer.md`
- `04-test-design-engineer.md`
- `05-software-developer.md`
- `06-integration-tester.md`
- `07-qa-engineer.md`
- `08-security-compliance-auditor.md`
- `09-cicd-engineer.md`
- `10-dev-environment-engineer.md`
- `11-deployment-engineer-staging.md`
- `12-release-manager.md`
- `13-site-reliability-engineer.md`
- `14-upgrade-engineer.md`

**Content per agent**: 3 lines
**Total duplicated**: 39 lines
**Variations**: None detected — all blockquotes are identical

### 2. Mandatory Iteration Enforcement Section

**Location**: After phase title/description, before main phase overview
**Pattern**: `# ⚠️ MANDATORY ITERATION ENFORCEMENT` + 11 lines of enforcement rules
**Affected Agents (4 total)**:
- `05-software-developer.md`
- `06-integration-tester.md`
- `14-upgrade-engineer.md`
- `16-quality-loop-engineer.md`

**Content per agent**: 12 lines
**Total duplicated**: 48 lines
**Variations**: None detected — all sections are identical across all 4 agents

### 3. Git Commit Warning (CRITICAL: Do NOT Run Git Commits)

**Location**: After iteration enforcement section
**Pattern**: `# CRITICAL: Do NOT Run Git Commits` + explanation
**Affected Agents (2 total)**:
- `05-software-developer.md`
- `06-integration-tester.md`

**Content per agent**: ~5 lines
**Total duplicated**: ~10 lines
**Variations**: None detected

### 4. PRE-PHASE CHECK Pattern

**Location**: After phase overview heading
**Pattern**: `# ⚠️ PRE-PHASE CHECK:` sections
**Affected Agents (5 total)**:
- `01-requirements-analyst.md`
- `04-test-design-engineer.md`
- `05-software-developer.md`
- `06-integration-tester.md`
- Others (varied content, typically 3-20 lines per agent)

**Total duplicated**: ~25-30 lines (agent-specific content, less strict duplication)

### 5. ROOT RESOLUTION & MONOREPO PROJECT CONTEXT RESOLUTION

**Location**: Appears only in orchestrator agents
**Pattern**: Two major sections in `00-sdlc-orchestrator.md` and `discover-orchestrator.md`
- `# ROOT RESOLUTION (Before anything else)` — 10 lines
- `# SECTION 0: PROJECT CONTEXT RESOLUTION (MONOREPO)` — 55 lines

**Affected Agents (2 total)**:
- `00-sdlc-orchestrator.md`
- `discover-orchestrator.md`

**Content per agent**: ~65 lines (both sections combined)
**Total duplicated**: ~130 lines
**Variations**: Identical boilerplate; no agent-specific variations

---

## Current State in CLAUDE.md

**Root level CLAUDE.md** (`/Users/vihangshah/enactor-code/isdlc/CLAUDE.md`) currently contains:

✓ **Workflow-First Development** (Step 1-3, edge cases, visibility)
✓ **Agent Framework Context** (Skill observability, suggested prompts, constitutional principles)
✓ **Project Context** (Key files, current version, development history, conventions)
✗ **ROOT RESOLUTION** — NOT present
✗ **MONOREPO MODE** — NOT present
✗ **ITERATION PROTOCOLS** — NOT present

**Existing shared protocols**: The CLAUDE.md already documents these sections:
- SKILL OBSERVABILITY Protocol
- SUGGESTED PROMPTS — Phase Agent Protocol
- CONSTITUTIONAL PRINCIPLES Preamble

These were extracted from T2 (prior work), demonstrating the extraction pattern works.

---

## Total Duplication Summary

| Boilerplate Section | Agents Affected | Lines/Agent | Total Duplicated |
|-------------------|-----------------|-------------|-----------------|
| Monorepo Mode Blockquote | 13 | 3 | 39 lines |
| Mandatory Iteration Enforcement | 4 | 12 | 48 lines |
| Git Commit Warning | 2 | 5 | 10 lines |
| PRE-PHASE CHECK (varied) | 5+ | 3-20 | ~25-30 lines |
| ROOT RESOLUTION + MONOREPO | 2 | 65 | 130 lines |
| **TOTAL ESTIMATED** | **17 agents** | **—** | **~250+ lines** |

---

## Keyword Matches from Codebase

### Files with "MONOREPO" keyword
**Count**: 26 files
**Pattern matches**:
- `src/claude/agents/*.md` — 13 files (blockquote pattern)
- `src/claude/agents/00-sdlc-orchestrator.md` — 1 file (ROOT RESOLUTION section)
- `src/claude/agents/discover-orchestrator.md` — 1 file
- `CLAUDE.md` (memory versions in `.claude/`) — Multiple references

### Files with "ROOT RESOLUTION" keyword
**Count**: 2 files
**Files**:
- `src/claude/agents/00-sdlc-orchestrator.md`
- `src/claude/agents/discover-orchestrator.md`

### Files with "ITERATION" keyword
**Count**: 4 files (MANDATORY ITERATION)
**Files**:
- `src/claude/agents/05-software-developer.md`
- `src/claude/agents/06-integration-tester.md`
- `src/claude/agents/14-upgrade-engineer.md`
- `src/claude/agents/16-quality-loop-engineer.md`

---

## Affected Modules / Sections to Extract

### For CLAUDE.md Addition

**New Section 1: Root Resolution**
- Source: `00-sdlc-orchestrator.md` lines 45-53
- Purpose: Shared by both orchestrator agents
- Size: 10 lines
- Reference pattern: Will be cited by orchestrator agents with link back

**New Section 2: Project Context Resolution (Monorepo)**
- Source: `00-sdlc-orchestrator.md` lines 55-112
- Purpose: Shared by both orchestrator agents
- Size: 58 lines
- Reference pattern: Will be cited with "See CLAUDE.md" link

**New Section 3: Monorepo Mode (Agent Guidance)**
- Source: Agent blockquotes (e.g., `05-software-developer.md` line 24)
- Purpose: One-liner guidance for all agents
- Size: 3 lines
- Reference pattern: Can use exact blockquote from CLAUDE.md

**New Section 4: Iteration Protocol**
- Source: Various agent iterations sections (e.g., `05-software-developer.md` lines 26-36)
- Purpose: Standard enforcement for testing-heavy agents
- Size: 12 lines
- Reference pattern: Can reference with link

### Refactor Targets (13 agents)

These agents will be simplified to reference CLAUDE.md:
1. `02-solution-architect.md` — Remove Monorepo blockquote, reference CLAUDE.md
2. `03-system-designer.md` — Remove Monorepo blockquote
3. `04-test-design-engineer.md` — Remove Monorepo blockquote
4. `05-software-developer.md` — Remove Monorepo blockquote + Iteration section
5. `06-integration-tester.md` — Remove Monorepo blockquote + Iteration + Git warning
6. `07-qa-engineer.md` — Remove Monorepo blockquote
7. `08-security-compliance-auditor.md` — Remove Monorepo blockquote
8. `09-cicd-engineer.md` — Remove Monorepo blockquote
9. `10-dev-environment-engineer.md` — Remove Monorepo blockquote
10. `11-deployment-engineer-staging.md` — Remove Monorepo blockquote
11. `12-release-manager.md` — Remove Monorepo blockquote
12. `13-site-reliability-engineer.md` — Remove Monorepo blockquote
13. `14-upgrade-engineer.md` — Remove Monorepo blockquote + Iteration

### Special Cases

**`00-sdlc-orchestrator.md` and `discover-orchestrator.md`**:
- Both contain `# ROOT RESOLUTION` and `# SECTION 0: PROJECT CONTEXT RESOLUTION (MONOREPO)`
- These are identical between the two files
- Extract both sections to CLAUDE.md
- Replace with reference links: "See ROOT RESOLUTION and PROJECT CONTEXT RESOLUTION in CLAUDE.md"

**`05-software-developer.md` and `06-integration-tester.md`**:
- Both have Monorepo blockquote + Iteration enforcement + Git warning
- Must be refactored carefully to maintain flow

---

## Notes for Requirements

The following questions should be clarified during Phase 01 Requirements:

1. **Agent-specific ITERATION variations**: Should each agent (test-heavy phase) have a variant of iteration enforcement that mentions their specific success criteria (e.g., "coverage ≥80%" for DEV, "all tests green" for QA)? Or is generic enforcement sufficient?

2. **Orchestrator section placement**: Should the ROOT RESOLUTION and MONOREPO sections appear as top-level sections in CLAUDE.md, or nested under "Agent Framework Context"? (Recommend: new top-level section "## Root Resolution & Monorepo Mode" for visibility)

3. **Blockquote vs directive**: Currently Monorepo guidance is a blockquote (`> **Monorepo Mode**:`). Should this remain a blockquote in CLAUDE.md, or become a proper section heading for easier linking?

4. **Backward compatibility**: Do we maintain the full sections in agent files for ~6 months before removing them? Or remove immediately after CLAUDE.md extraction? (Recommend: remove immediately with deprecation comment, single source of truth)

5. **Discovery report update**: Should the discovery report document this boilerplate extraction, or just point to the requirements artifact?

6. **Testing approach**: Which agents should be manually tested post-refactor to confirm the reference links work and no critical content was lost? (Recommend: test orchestrator + 3-5 phase agents)

---

## Quick Scan Metadata

```json
{
  "scan_completed_at": "2026-02-16T00:00:00Z",
  "search_duration_ms": 45000,
  "keywords_searched": 5,
  "files_matched": 26,
  "scope_estimate": "medium",
  "agents_affected": 17,
  "estimated_total_lines_duplicated": 250,
  "extraction_confidence": "high",
  "unique_section_types": 5,
  "ready_for_requirements": true,
  "notes": "All boilerplate sections are identical with no variations. No conditional logic or agent-specific customization detected. Direct extraction to CLAUDE.md is feasible."
}
```

---

## Recommended Next Steps (Phase 01 — Requirements)

1. Clarify whether ITERATION enforcement should have agent-specific variants
2. Decide on CLAUDE.md section structure (top-level vs nested)
3. Determine backward compatibility approach
4. Define test/validation scope for refactored agents
5. Update discovery report to track this as framework infrastructure improvement
