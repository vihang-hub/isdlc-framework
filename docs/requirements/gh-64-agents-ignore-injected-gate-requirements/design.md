# Design: GH-64 - Agents Ignore Injected Gate Requirements

**Generated:** 2026-02-20
**Phase:** 04-design
**Issue:** GH-64

---

## 1. Module Design

### 1.1 gate-requirements-injector.cjs Changes

**Current:** `buildGateRequirementsBlock(phaseKey, artifactFolder, workflowType, projectRoot)` returns a plain text block with iteration requirements, artifact paths, and constitutional articles.

**New behavior:**

```
function buildGateRequirementsBlock(phaseKey, artifactFolder, workflowType, projectRoot) {
  // 1. Load phase config from iteration-requirements.json (existing)
  // 2. NEW: Read prohibited_actions[] from phase config
  // 3. Format block with new structure:
  //    ━━━ GATE REQUIREMENTS FOR PHASE {NN} ({Name}) ━━━
  //    ⛔ PROHIBITED ACTIONS:
  //      - Do NOT run git add, git commit, or git push
  //      - {other prohibited actions from config}
  //
  //    Iteration Requirements:
  //      - test_iteration: enabled (max 10, coverage >= 80%)
  //      - constitutional_validation: enabled (Articles: ...)
  //
  //    Required Artifacts:
  //      - {path1}
  //      - {path2}
  //
  //    ⚠️ REMINDER: Do NOT run git commit. Leave changes uncommitted.
  //    ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. NEW: Log injection result to hook-activity.log
  // 5. Return formatted block (max 30 lines)
}
```

**Key design decisions:**
- PROHIBITED ACTIONS section appears first (highest salience)
- Closing reminder repeats the most critical prohibition
- Unique `━━━` separator not used by any other injection block
- Block capped at 30 lines; overflow truncated with reference

### 1.2 iteration-requirements.json Schema Extension

Add `prohibited_actions` to phase configs:

```json
{
  "06-implementation": {
    "prohibited_actions": [
      { "action": "git commit", "message": "Do NOT run git add, git commit, or git push. The orchestrator handles commits at workflow finalization." },
      { "action": "git push", "message": "Do NOT push to remote. The orchestrator handles merging." }
    ],
    "test_iteration": { ... },
    "constitutional_validation": { ... }
  }
}
```

Phases without `prohibited_actions` key: no PROHIBITED ACTIONS section rendered (backward compatible).

### 1.3 isdlc.md STEP 3d Prompt Reordering

**Current order (11 sections):**
1. Execute Phase line
2. Artifact folder
3. Phase key
4. Workflow modifiers
5. Discovery context
6. Skill index
7. External skills
8. **Gate requirements** (current position)
9. Budget degradation
10. PHASE_TIMING_REPORT
11. Do NOT emit SUGGESTED NEXT STEPS

**New order (same sections, reordered):**
1. **Gate requirements** (moved to top)
2. Execute Phase line
3. Artifact folder
4. Phase key
5. Workflow modifiers
6. Discovery context
7. Skill index
8. External skills
9. Budget degradation
10. PHASE_TIMING_REPORT
11. Do NOT emit SUGGESTED NEXT STEPS

### 1.4 Agent File Updates

**05-software-developer.md** — Replace line 29 cross-reference:
```markdown
> See **Git Commit Prohibition** in CLAUDE.md.
```
With inline reinforcement:
```markdown
> **CRITICAL**: Do NOT run `git add`, `git commit`, or `git push` during phase work. All file changes must remain uncommitted. The orchestrator handles git operations at workflow finalization. See **Git Commit Prohibition** in CLAUDE.md.
```

Same treatment for **16-quality-loop-engineer.md**.

### 1.5 Constitution Article VII Clarification

Add clarifying sentence to Article VII:

```markdown
### Article VII: Artifact Traceability

**Principle**: Every code element MUST trace back to a requirement.

> **Note**: Commit management (git add, commit, push, merge) is handled exclusively by the orchestrator at workflow finalization. Phase agents must NOT run git commit operations — they produce artifacts and leave changes uncommitted.
```

### 1.6 branch-guard.cjs Block Message Enhancement

Update the commit block message to reference gate requirements:

```javascript
// Current:
outputBlockResponse(`COMMIT BLOCKED: ...`);

// New:
outputBlockResponse(
  `COMMIT BLOCKED: Git commit is prohibited during phase '${phase}'.\n` +
  `This was listed in your GATE REQUIREMENTS as a PROHIBITED ACTION.\n` +
  `Leave changes uncommitted — the orchestrator commits at workflow finalization.`
);
```

---

## 2. Error Taxonomy

| Error | Source | Handling |
|-------|--------|----------|
| Missing iteration-requirements.json | gate-requirements-injector.cjs | Return empty string, log warning |
| Missing prohibited_actions field | gate-requirements-injector.cjs | Skip PROHIBITED ACTIONS section (backward compat) |
| Block exceeds 30 lines | gate-requirements-injector.cjs | Truncate with overflow reference |
| Logging failure | gate-requirements-injector.cjs | Swallow error, continue (fail-open) |

---

## 3. Validation Rules

- `prohibited_actions` must be an array (or absent)
- Each entry must have `action` (string) and `message` (string)
- Block output must not exceed 30 lines
- Separators must use `━━━` characters exclusively

---

## 4. Test Strategy Preview

| Test | Type | Target |
|------|------|--------|
| Prohibited actions rendering | Unit | gate-requirements-injector.cjs |
| Empty prohibited actions | Unit | gate-requirements-injector.cjs |
| 30-line cap enforcement | Unit | gate-requirements-injector.cjs |
| Config backward compatibility | Unit | gate-requirements-injector.cjs |
| Block message format | Unit | branch-guard.cjs |
| Injection logging | Unit | gate-requirements-injector.cjs |
| Agent file audit | Manual | All agent files |
| E2E: agent respects prohibition | Integration | Full workflow |
