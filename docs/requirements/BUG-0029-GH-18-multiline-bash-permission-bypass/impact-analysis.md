# Impact Analysis: BUG-0029-GH-18 -- Multiline Bash Permission Bypass

**Generated**: 2026-02-18T23:45:00Z
**Bug ID**: BUG-0029-GH-18
**Based On**: Phase 01 Requirements (finalized)
**Phase**: 02-impact-analysis

---

## Scope Comparison

| Aspect | Original (Phase 00) | Clarified (Phase 01) |
|--------|---------------------|----------------------|
| Description | 25 multiline Bash blocks bypass permission auto-allow | Same root cause + convention/template additions |
| Keywords | bash, multiline, permission, node-e | bash, multiline, permission, node-e, convention, template, bin/ |
| Estimated Files | 5 source files | 5 source + 2 protocol/template + 0-1 bin/ scripts |
| Scope Change | - | REFINED (same core files, added convention infrastructure) |

---

## Executive Summary

This bug fix targets 25 multiline Bash code blocks across 5 agent/command prompt files that teach the LLM to generate multiline Bash commands, which bypass Claude Code's `*` glob permission matching (newlines are not matched by `*`). The fix rewrites all blocks to single-line equivalents or script references, adds a convention section to CLAUDE.md and CLAUDE.md.template, and potentially extracts one complex `node -e` pattern to a bin/ script.

The blast radius is LOW -- changes are confined to Markdown documentation patterns within prompt files. No runtime code, hooks, state management, or workflow logic is affected. The risk is also LOW because the changes are cosmetic/pattern-level within .md files, though care is needed to preserve functional equivalence (NFR-002) and not alter agent behavior.

**Blast Radius**: LOW (7-8 files, 2 modules)
**Risk Level**: LOW
**Affected Files**: 7-8 (5 source + 2 protocol/template + 0-1 scripts)
**Affected Modules**: 2 (agents, commands)

---

## Impact Analysis

### Directly Affected Files

The following files contain multiline Bash code blocks that must be rewritten. Each block is cataloged with its line range, pattern type, and proposed transformation.

#### 1. src/claude/agents/05-software-developer.md

| Block # | Lines | Pattern Type | Content Summary | Multiline? | Transformation |
|---------|-------|-------------|-----------------|------------|----------------|
| 1 | 169-175 | comment-interleaved | Test command examples (npm, pytest, go) | YES (7 lines, 4 comments + 4 commands) | Move comments to prose above; list each command as separate single-line block OR merge as `;`-separated alternatives |
| 2 | 201-210 | comment-interleaved + node-e | CPU core detection: nproc, sysctl, node -e | YES (10 lines, 3 OS-specific blocks) | CRITICAL: `node -e` pattern. Split into 3 separate single-line examples with prose labels. No script extraction needed -- each is already single-line within its section |
| 3 | 392-400 | comment-interleaved | Test command discovery (npm test, pytest) | YES (9 lines, 3 comments + 3 commands) | Move comments to prose; each command is already single-line |
| 4 | 522-524 | single-line | `npm test -- --testNamePattern="AC1"` | NO (1 line) | No change needed |
| 5 | 566-568 | single-line | `npm test -- --testNamePattern="AC1"` | NO (1 line) | No change needed |

**Multiline blocks requiring change: 3 of 5**

#### 2. src/claude/agents/06-integration-tester.md

| Block # | Lines | Pattern Type | Content Summary | Multiline? | Transformation |
|---------|-------|-------------|-----------------|------------|----------------|
| 1 | 128-136 | comment-interleaved | Command discovery protocol (cat, jq pipes) | YES (9 lines, 3 steps with comments) | Move step labels to prose; each piped command is single-line |
| 2 | 522-531 | for-loop equivalent | Grep for skip patterns (JS, Python, Java) | YES (10 lines, 3 language-specific greps) | Split into 3 separate single-line code blocks by language |
| 3 | 602-607 | piped-commands | Extract test names from checklist | YES (6 lines, 2 piped commands) | Each pipe chain is already single-line; move to separate blocks |
| 4 | 621-627 | piped-commands | Run acceptance tests | YES (7 lines, 2 commands with comments) | Move comments to prose; keep commands as separate single-line blocks |
| 5 | 659-662 | piped-commands | Mutation test command | YES (4 lines, 1 comment + 1 command) | Move comment to prose; command is single-line |

**Multiline blocks requiring change: 5 of 5**

#### 3. src/claude/commands/discover.md

| Block # | Lines | Pattern Type | Content Summary | Multiline? | Transformation |
|---------|-------|-------------|-----------------|------------|----------------|
| 1 | 102-126 | comment-interleaved | Example /discover invocations (8 examples) | YES (25 lines, 8 comments + 8 commands) | These are slash command examples (not Bash commands). However, they are inside a ```bash block which may cause LLM to generate multiline Bash. Restructure as individual single-line examples or use non-bash code fence. |

**Multiline blocks requiring change: 1 of 1**

#### 4. src/claude/commands/provider.md

| Block # | Lines | Pattern Type | Content Summary | Multiline? | Transformation |
|---------|-------|-------------|-----------------|------------|----------------|
| 1 | 88-102 | comment-interleaved | Free cloud provider setup (4 steps) | YES (15 lines) | Move numbered steps to prose; keep single-line commands |
| 2 | 111-113 | comment + single-line | Setup-ollama invocation | YES (3 lines, 1 comment + 1 command) | Move comment to prose |
| 3 | 125-142 | comment-interleaved | Manual Ollama setup (5 steps) | YES (18 lines) | Move numbered steps to prose; split into individual commands |
| 4 | 145-148 | minimal | Air-gapped setup (2 commands) | YES (4 lines) | Join with `&&` or split to separate blocks |
| 5 | 207-212 | comment-interleaved | Ollama troubleshooting (2 commands) | YES (6 lines) | Move comments to prose |
| 6 | 216-222 | comment-interleaved | API key troubleshooting (2 commands) | YES (7 lines) | Move comments to prose |
| 7 | 225-229 | comment-interleaved | Provider override (2 exports) | YES (5 lines) | Join with `&&` or split |
| 8 | 232-235 | comment + command | Debug flag (1 export + 1 comment) | YES (4 lines) | Move comment to prose |
| 9 | 375-377 | single-line | /provider setup-ollama | YES (3 lines, 1 command) | Actually single-line -- verify |
| 10 | 390-396 | comment-interleaved | macOS install (2 alternatives) | YES (7 lines) | Move labels to prose; split to separate examples |
| 11 | 399-401 | single-line | Linux install (1 command) | YES (3 lines) | Single command -- verify line count |
| 12 | 417-429 | comment-interleaved | Pull models (4 commands) | YES (13 lines) | Move comments to prose; each command is single-line |
| 13 | 433-438 | comment-interleaved | Verify setup (2 commands) | YES (6 lines) | Move comments to prose |

**Multiline blocks requiring change: 13 of 13**

#### 5. src/claude/commands/isdlc.md

| Block # | Lines | Pattern Type | Content Summary | Multiline? | Transformation |
|---------|-------|-------------|-----------------|------------|----------------|
| 1 | 665-674 | comment-interleaved | Discover quick start (3 examples) | YES (10 lines) | Move comments to prose; split into separate single-line blocks |

**Multiline blocks requiring change: 1 of 1**

### Summary of Multiline Blocks

| File | Total Bash Blocks | Multiline Blocks | Single-Line (No Change) |
|------|-------------------|------------------|------------------------|
| 05-software-developer.md | 5 | 3 | 2 |
| 06-integration-tester.md | 5 | 5 | 0 |
| discover.md | 1 | 1 | 0 |
| provider.md | 13 | 13 | 0 |
| isdlc.md | 1 | 1 | 0 |
| **Total** | **25** | **23** | **2** |

**Corrected count**: 23 blocks require modification (not 25). Two blocks in 05-software-developer.md (lines 522-524 and 566-568) are already single-line.

### Protocol/Template Files (New Content)

| File | Change Type | Description |
|------|------------|-------------|
| CLAUDE.md | ADD section | New "Single-Line Bash Convention" section under "Agent Framework Context" (FR-002) |
| src/claude/CLAUDE.md.template | ADD section | Mirror the same convention section (FR-004) |

### Potential Script Extraction (FR-003)

| File | Lines | Pattern | Extraction Needed? |
|------|-------|---------|-------------------|
| 05-software-developer.md | 201-210 | CPU core detection with `node -e` | UNLIKELY -- each OS variant is already a single-line command. The block is multiline only because it shows 3 alternatives with comments. Rewriting as 3 separate single-line examples suffices. |

**Assessment**: No bin/ script extraction is likely needed. The `node -e` pattern identified as critical in Phase 00 (`node -e "console.log(require('os').cpus().length)"`) is already a single-line command. The multiline issue is caused by the surrounding comments and alternative OS commands being in the same code block, not by the `node -e` itself being multi-statement.

### Dependency Analysis

**Outward dependencies** (what depends on these files):

| Affected File | Depended On By | Coupling |
|---------------|---------------|----------|
| 05-software-developer.md | sdlc-orchestrator (delegates to it), isdlc.md (PHASE_AGENT_MAP), implementation-reviewer, implementation-updater | LOW -- changes are to example blocks, not agent metadata or behavior |
| 06-integration-tester.md | sdlc-orchestrator (delegates to it), isdlc.md (PHASE_AGENT_MAP) | LOW |
| discover.md | discover-orchestrator (invoked by it) | LOW |
| provider.md | No runtime dependencies (user-facing command) | NONE |
| isdlc.md | All other agents (entry point for all workflows) | LOW -- the bash block in isdlc.md is documentation, not workflow logic |
| CLAUDE.md | All agents reference shared protocol sections | LOW -- adding a new section has no breaking impact on existing references |
| CLAUDE.md.template | New project initialization (isdlc init) | LOW -- additive change |

**Inward dependencies** (what these files depend on):

| Affected File | Depends On | Coupling |
|---------------|-----------|----------|
| 05-software-developer.md | CLAUDE.md shared protocols, state.json schema | NONE affected |
| 06-integration-tester.md | CLAUDE.md shared protocols, state.json schema | NONE affected |
| discover.md | discover-orchestrator agent | NONE affected |
| provider.md | providers.yaml template | NONE affected |
| isdlc.md | workflows.json, state.json schema, orchestrator | NONE affected |

**Change propagation**: Changes do NOT propagate. The modification is to Markdown documentation patterns (Bash code blocks), not to runtime code, hook logic, state schemas, or workflow sequences. No cascading changes expected.

---

## Entry Points

### Implementation Entry Points

Since this is a bug fix modifying documentation patterns in .md files, the "entry points" are the files themselves. There are no API endpoints, database schemas, or runtime entry points involved.

#### Recommended Implementation Order

The implementation should proceed from highest-impact to lowest-impact, with convention documentation first to establish the standard.

| Order | File | Rationale |
|-------|------|-----------|
| 1 | CLAUDE.md | Create convention section first (FR-002) -- establishes the standard all other changes follow |
| 2 | src/claude/CLAUDE.md.template | Mirror convention (FR-004) -- ensures downstream consistency |
| 3 | src/claude/agents/05-software-developer.md | 3 multiline blocks including the critical `node -e` pattern -- highest-risk agent file |
| 4 | src/claude/agents/06-integration-tester.md | 5 multiline blocks -- most blocks in an agent file |
| 5 | src/claude/commands/provider.md | 13 multiline blocks -- most blocks overall, but all are documentation examples with low risk |
| 6 | src/claude/commands/discover.md | 1 block -- slash command examples, low risk |
| 7 | src/claude/commands/isdlc.md | 1 block -- documentation examples, low risk |

#### Entry Point Chain

```
Convention (CLAUDE.md + template)
  |
  +-> Agent files (05-software-developer.md, 06-integration-tester.md)
  |     Apply convention to agent prompt bash blocks
  |
  +-> Command files (provider.md, discover.md, isdlc.md)
        Apply convention to command documentation bash blocks
```

No new entry points need to be created. No bin/ scripts are needed (the `node -e` pattern is already single-line within its multiline container block).

---

## Risk Assessment

### Overall Risk: LOW

This is a documentation-pattern bug fix. The changes modify Markdown code blocks in agent prompt files, not executable code. The primary risk is **functional regression** (NFR-002) -- ensuring agents still produce the correct behavior after pattern rewriting.

### Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Agent generates different output after rewrite | LOW | MEDIUM | Review each transformation for functional equivalence; test with sample prompts |
| Missed multiline block in an unscanned file | LOW | LOW | Confirmed: grep shows only 5 files have ```bash blocks in agents/ and commands/ |
| Convention section conflicts with existing CLAUDE.md sections | LOW | LOW | Convention is a new additive section under "Agent Framework Context" |
| CLAUDE.md.template out of sync with CLAUDE.md | LOW | LOW | Template mirroring is explicit in FR-004/AC-004-02 |
| Breaking existing agent skill/hook references | NONE | N/A | Changes are to Bash code blocks, not frontmatter, skill declarations, or phase gate criteria |
| Auto-allow rules need updating | NONE | N/A | Constraint CON-002: existing rules are sufficient for single-line commands |

### Test Coverage for Affected Files

| File | Direct Test Coverage | Test Type |
|------|---------------------|-----------|
| 05-software-developer.md | NONE | No tests for .md prompt content |
| 06-integration-tester.md | NONE | No tests for .md prompt content |
| discover.md | NONE | No tests for .md prompt content |
| provider.md | NONE | No tests for .md prompt content |
| isdlc.md | NONE | No tests for .md prompt content |
| CLAUDE.md | NONE | No tests for shared protocol sections |
| CLAUDE.md.template | NONE | No tests for template content |

**Coverage gap**: All 7 affected files have ZERO test coverage for their Markdown content. This is expected -- these are LLM prompt files, not executable code. Testing will rely on manual verification (NFR-002 acceptance criteria) and potentially an end-to-end workflow test to confirm no permission prompts occur.

### Complexity Hotspots

| File | Complexity | Reason |
|------|-----------|--------|
| provider.md | LOW-MEDIUM | 13 blocks is the most, but all follow the same comment-to-prose pattern |
| 05-software-developer.md | LOW | 3 blocks including the `node -e` pattern, but the pattern is simpler than Phase 00 suggested |
| 06-integration-tester.md | LOW | 5 blocks, all are comment-interleaved patterns |

### Technical Debt Markers

- **No existing lint/check for multiline Bash in .md files**: After this fix, there is no automated enforcement to prevent regression. FR-002 (convention) addresses this documentarily. Automated enforcement (a lint rule or hook) is explicitly out of scope per Section 6 of the requirements.
- **CLAUDE.md.template sync**: The template must be manually kept in sync with CLAUDE.md. No automated sync mechanism exists.

---

## Cross-Validation

### File List Consistency (M1 vs M2)

M1 identified 7-8 files (5 source + 2 protocol/template + 0-1 scripts). M2 identified the same 7 files in its implementation order. The `node -e` script extraction (FR-003) was evaluated and found unnecessary, reducing the count from 8 to 7.

**Status**: CONSISTENT

### Risk vs Coupling Consistency (M1 vs M3)

M1 assessed coupling as LOW/NONE across all affected files. M3 assessed overall risk as LOW. These are consistent -- low coupling implies low change propagation risk.

**Status**: CONSISTENT

### Multiline Block Count Reconciliation

Phase 00 Quick Scan reported 25 multiline blocks. Detailed analysis found 25 total ```bash blocks but only 23 are actually multiline (2 in 05-software-developer.md are single-line). This is a minor refinement, not a discrepancy.

**Status**: CONSISTENT (refined from 25 to 23 actionable blocks)

### Completeness Check

- All 4 Functional Requirements (FR-001 through FR-004) have corresponding affected files identified.
- All 12 Acceptance Criteria have clear implementation paths.
- FR-003 (script extraction) was evaluated and found likely unnecessary -- this should be confirmed during implementation.
- No additional affected files were discovered beyond those in the Quick Scan.

**Verification Status**: PASS

---

## Implementation Recommendations

Based on the impact analysis:

1. **Suggested Order**: CLAUDE.md convention first (establishes standard), then agent files (higher risk), then command files (lower risk)
2. **High-Risk Areas**: None identified. All changes are LOW risk. The 05-software-developer.md `node -e` block (originally flagged CRITICAL) is simpler than expected -- the `node -e` command itself is single-line.
3. **Dependencies to Resolve**: None. All files are independently modifiable. No cascading changes.
4. **Script Extraction Decision**: Likely not needed. Confirm during implementation by verifying the `node -e` rewrite works as a single-line block without requiring a bin/ script.
5. **Testing Strategy**: Manual verification of NFR-001 (no permission prompts) and NFR-002 (functional equivalence). No automated test infrastructure exists for .md prompt content.
6. **Dominant Pattern**: 22 of 23 multiline blocks follow the same "comment-interleaved" pattern (comments between commands in a single code block). The fix is mechanical: move comments to Markdown prose above the code block, leave each command as its own single-line code block.

---

## Impact Analysis Metadata

The following JSON block is required for automated sizing analysis (REQ-0011).
All fields are required. The `parseSizingFromImpactAnalysis()` function reads
the LAST JSON block in the file to extract sizing metrics.

```json
{
  "analysis_completed_at": "2026-02-18T23:45:00Z",
  "sub_agents": ["M1", "M2", "M3", "M4"],
  "verification_status": "PASS",
  "requirements_document": "docs/requirements/BUG-0029-GH-18-multiline-bash-permission-bypass/requirements-spec.md",
  "quick_scan_used": "docs/requirements/BUG-0029-GH-18-multiline-bash-permission-bypass/quick-scan.md",
  "scope_change_from_original": "refined",
  "requirements_keywords": ["bash", "multiline", "permission", "node-e", "convention", "template", "auto-allow", "glob"],
  "files_directly_affected": 7,
  "modules_affected": 2,
  "risk_level": "low",
  "blast_radius": "low",
  "coverage_gaps": 7
}
```
