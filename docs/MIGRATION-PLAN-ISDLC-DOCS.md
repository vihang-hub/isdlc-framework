# Migration Plan: User Documents from `.isdlc/` to `docs/isdlc/`

**Created:** 2026-02-04
**Status:** Draft
**Author:** Migration Planning Agent

---

## Executive Summary

This migration plan moves all user-generated documents from `.isdlc/` to `docs/isdlc/`. After migration:

- `.isdlc/` contains **framework runtime files ONLY** (state, config, manifests)
- `docs/isdlc/` contains **all user-generated documents** (constitution, reports, checklists)

---

## 1. Files to Relocate

### 1.1 Single-Project Mode

| Current Path | New Path | Description |
|-------------|----------|-------------|
| `.isdlc/constitution.md` | `docs/isdlc/constitution.md` | Project constitution |
| `.isdlc/constitution.draft.md` | `docs/isdlc/constitution.draft.md` | Draft constitution |
| `.isdlc/test-evaluation-report.md` | `docs/isdlc/test-evaluation-report.md` | Test infrastructure analysis |
| `.isdlc/tasks.md` | `docs/isdlc/tasks.md` | Orchestrator task plan |
| `.isdlc/skill-customization-report.md` | `docs/isdlc/skill-customization-report.md` | External skills summary |
| `.isdlc/atdd-checklist.json` | `docs/isdlc/atdd-checklist.json` | ATDD tracking file |
| `.isdlc/external-skills-manifest.json` | `docs/isdlc/external-skills-manifest.json` | External skills registry |
| `.isdlc/reverse-engineer-report.md` | `docs/isdlc/reverse-engineer-report.md` | Reverse engineering summary |
| `.isdlc/atdd-checklist-{domain}.json` | `docs/isdlc/atdd-checklist-{domain}.json` | Per-domain ATDD checklists |
| `.isdlc/checklists/` | `docs/isdlc/checklists/` | Gate checklist responses |

### 1.2 Monorepo Mode

| Current Path | New Path | Description |
|-------------|----------|-------------|
| `.isdlc/projects/{id}/constitution.md` | `docs/isdlc/projects/{id}/constitution.md` | Project-specific constitution |
| `.isdlc/projects/{id}/skill-customization-report.md` | `docs/isdlc/projects/{id}/skill-customization-report.md` | Project skills report |
| `.isdlc/projects/{id}/external-skills-manifest.json` | `docs/isdlc/projects/{id}/external-skills-manifest.json` | Project external skills |
| `.isdlc/projects/{id}/test-evaluation-report.md` | `docs/isdlc/projects/{id}/test-evaluation-report.md` | Project test evaluation |

### 1.3 Files Remaining in `.isdlc/` (Framework Runtime)

| Path | Purpose |
|------|---------|
| `.isdlc/state.json` | Runtime state (phases, workflow, counters) |
| `.isdlc/monorepo.json` | Monorepo configuration |
| `.isdlc/installed-files.json` | Installation manifest |
| `.isdlc/config/` | Framework configuration files |
| `.isdlc/templates/` | Framework templates |
| `.isdlc/scripts/` | Utility scripts |
| `.isdlc/projects/{id}/state.json` | Per-project runtime state |
| `.isdlc/projects/{id}/skills/external/` | External skill files (runtime) |

---

## 2. Affected Framework Files

### 2.1 Agents (23 files)

| File | References |
|------|------------|
| `src/claude/agents/00-sdlc-orchestrator.md` | constitution, tasks, skill-customization-report, external-skills-manifest |
| `src/claude/agents/01-requirements-analyst.md` | constitution, tasks |
| `src/claude/agents/02-solution-architect.md` | constitution, tasks |
| `src/claude/agents/03-system-designer.md` | constitution, tasks |
| `src/claude/agents/04-test-design-engineer.md` | constitution, tasks, test-evaluation-report, atdd-checklist |
| `src/claude/agents/05-software-developer.md` | constitution, tasks, test-evaluation-report, atdd-checklist |
| `src/claude/agents/06-integration-tester.md` | constitution, tasks, test-evaluation-report, atdd-checklist |
| `src/claude/agents/07-qa-engineer.md` | constitution, tasks |
| `src/claude/agents/08-security-compliance-auditor.md` | constitution, tasks |
| `src/claude/agents/09-cicd-engineer.md` | constitution, tasks |
| `src/claude/agents/10-dev-environment-engineer.md` | constitution, tasks |
| `src/claude/agents/11-deployment-engineer-staging.md` | constitution, tasks |
| `src/claude/agents/12-release-manager.md` | constitution, tasks |
| `src/claude/agents/13-site-reliability-engineer.md` | constitution, tasks |
| `src/claude/agents/14-upgrade-engineer.md` | tasks |
| `src/claude/agents/discover-orchestrator.md` | constitution, test-evaluation-report, skill-customization-report |
| `src/claude/agents/discover/constitution-generator.md` | constitution, constitution.draft |
| `src/claude/agents/discover/test-evaluator.md` | test-evaluation-report |
| `src/claude/agents/discover/skills-researcher.md` | skill-customization-report, external-skills-manifest |
| `src/claude/agents/reverse-engineer/behavior-analyzer.md` | constitution, test-evaluation-report |
| `src/claude/agents/reverse-engineer/characterization-test-generator.md` | constitution, test-evaluation-report |
| `src/claude/agents/reverse-engineer/atdd-bridge.md` | constitution, atdd-checklist, reverse-engineer-report |
| `src/claude/agents/reverse-engineer/artifact-integration.md` | constitution, reverse-engineer-report |

### 2.2 Skills (11 files)

| File | References |
|------|------------|
| `src/claude/skills/orchestration/autonomous-constitution-validate.md` | constitution |
| `src/claude/skills/orchestration/generate-plan/SKILL.md` | tasks |
| `src/claude/skills/orchestration/skill-validation/SKILL.md` | (state.json only - no change needed) |
| `src/claude/skills/testing/atdd-checklist/SKILL.md` | atdd-checklist |
| `src/claude/skills/testing/atdd-scenario-mapping/SKILL.md` | atdd-checklist |
| `src/claude/skills/discover/interactive-review/SKILL.md` | constitution |
| `src/claude/skills/discover/web-research-fallback/SKILL.md` | external-skills-manifest |
| `src/claude/skills/discover/skill-installation/SKILL.md` | external-skills-manifest |
| `src/claude/skills/development/autonomous-iterate.md` | (state.json only - no change needed) |
| `src/claude/skills/reverse-engineer/atdd-checklist-generation/SKILL.md` | atdd-checklist |
| `src/claude/skills/reverse-engineer/report-generation/SKILL.md` | reverse-engineer-report |

### 2.3 Commands (2 files)

| File | References |
|------|------------|
| `src/claude/commands/sdlc.md` | constitution, test-evaluation-report |
| `src/claude/commands/discover.md` | constitution, test-evaluation-report, skill-customization-report |

### 2.4 Hooks (3 files)

| File | References |
|------|------------|
| `src/claude/hooks/lib/common.js` | constitution, external-skills-manifest, skill-customization-report |
| `src/claude/hooks/constitution-validator.js` | constitution |
| `src/claude/hooks/test-watcher.js` | constitution |

### 2.5 Config (1 file)

| File | References |
|------|------------|
| `src/claude/hooks/config/iteration-requirements.json` | atdd-checklist |

---

## 3. Reference Changes

### 3.1 Constitution References

**Pattern:** `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

**Affected files (51 occurrences across 24 files):**

```
src/claude/agents/00-sdlc-orchestrator.md
  Line 61: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`
  Line 101: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`
  Line 173, 197, 296, 297, 312, 315, 352, 355, 363: (multiple occurrences)
  Line 1222, 1449: (additional references)

src/claude/agents/01-requirements-analyst.md
  Line 1203, 1518: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/02-solution-architect.md
  Line 35, 527: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/03-system-designer.md
  Line 33, 224: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/04-test-design-engineer.md
  Line 94, 516: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/05-software-developer.md
  Line 139, 608: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/06-integration-tester.md
  Line 172, 702: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/07-qa-engineer.md
  Line 23, 154: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/08-security-compliance-auditor.md
  Line 35, 182: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/09-cicd-engineer.md
  Line 28, 162: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/10-dev-environment-engineer.md
  Line 105, 231: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/11-deployment-engineer-staging.md
  Line 26, 145: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/12-release-manager.md
  Line 27, 171: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/13-site-reliability-engineer.md
  Line 36, 258: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/agents/discover-orchestrator.md
  Line 413, 421, 526, 547, 553, 814, 825, 998, 1022, 1027: (multiple occurrences)

src/claude/agents/discover/constitution-generator.md
  Line 234, 235, 279, 305, 319: (multiple occurrences)

src/claude/agents/reverse-engineer/*.md
  (4 files with 2 occurrences each)

src/claude/commands/sdlc.md
  Line 36, 109, 132, 383, 731: (multiple occurrences)

src/claude/commands/discover.md
  Line 72, 80, 141: (multiple occurrences)

src/claude/skills/orchestration/autonomous-constitution-validate.md
  Line 52, 85, 377, 535: (multiple occurrences)

src/claude/skills/discover/interactive-review/SKILL.md
  Line 64: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/hooks/constitution-validator.js
  Line 297: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`

src/claude/hooks/test-watcher.js
  Line 465: `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`
```

### 3.2 Test Evaluation Report References

**Pattern:** `.isdlc/test-evaluation-report.md` -> `docs/isdlc/test-evaluation-report.md`

**Affected files (16 occurrences across 9 files):**

```
src/claude/agents/04-test-design-engineer.md
  Line 34, 41, 87: `.isdlc/test-evaluation-report.md` -> `docs/isdlc/test-evaluation-report.md`

src/claude/agents/05-software-developer.md
  Line 51: `.isdlc/test-evaluation-report.md` -> `docs/isdlc/test-evaluation-report.md`

src/claude/agents/06-integration-tester.md
  Line 67: `.isdlc/test-evaluation-report.md` -> `docs/isdlc/test-evaluation-report.md`

src/claude/agents/discover-orchestrator.md
  Line 1021: `.isdlc/test-evaluation-report.md` -> `docs/isdlc/test-evaluation-report.md`

src/claude/agents/discover/test-evaluator.md
  Line 215, 392, 403: `.isdlc/test-evaluation-report.md` -> `docs/isdlc/test-evaluation-report.md`

src/claude/agents/reverse-engineer/behavior-analyzer.md
  Line 46, 60, 164: `.isdlc/test-evaluation-report.md` -> `docs/isdlc/test-evaluation-report.md`

src/claude/agents/reverse-engineer/characterization-test-generator.md
  Line 181: `.isdlc/test-evaluation-report.md` -> `docs/isdlc/test-evaluation-report.md`

src/claude/commands/sdlc.md
  Line 482: `.isdlc/test-evaluation-report.md` -> `docs/isdlc/test-evaluation-report.md`

src/claude/commands/discover.md
  Line 71: `.isdlc/test-evaluation-report.md` -> `docs/isdlc/test-evaluation-report.md`
```

### 3.3 Tasks.md References

**Pattern:** `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

**Affected files (20 occurrences across 17 files):**

```
src/claude/agents/00-sdlc-orchestrator.md
  Line 658, 1023: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/01-requirements-analyst.md
  Line 1467: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/02-solution-architect.md
  Line 589: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/03-system-designer.md
  Line 264: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/04-test-design-engineer.md
  Line 556: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/05-software-developer.md
  Line 648: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/06-integration-tester.md
  Line 745: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/07-qa-engineer.md
  Line 193: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/08-security-compliance-auditor.md
  Line 222: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/09-cicd-engineer.md
  Line 201: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/10-dev-environment-engineer.md
  Line 290: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/11-deployment-engineer-staging.md
  Line 184: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/12-release-manager.md
  Line 210: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/13-site-reliability-engineer.md
  Line 298: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/agents/14-upgrade-engineer.md
  Line 452: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`

src/claude/skills/orchestration/generate-plan/SKILL.md
  Line 17, 83, 175, 180: `.isdlc/tasks.md` -> `docs/isdlc/tasks.md`
```

### 3.4 Skill Customization Report References

**Pattern:** `.isdlc/skill-customization-report.md` -> `docs/isdlc/skill-customization-report.md`

**Affected files (8 occurrences across 4 files):**

```
src/claude/agents/00-sdlc-orchestrator.md
  Line 64: `.isdlc/skill-customization-report.md` -> `docs/isdlc/skill-customization-report.md`

src/claude/agents/discover-orchestrator.md
  Line 847, 1023: `.isdlc/skill-customization-report.md` -> `docs/isdlc/skill-customization-report.md`

src/claude/agents/discover/skills-researcher.md
  Line 210, 282, 327: `.isdlc/skill-customization-report.md` -> `docs/isdlc/skill-customization-report.md`

src/claude/commands/discover.md
  Line 73: `.isdlc/skill-customization-report.md` -> `docs/isdlc/skill-customization-report.md`

src/claude/hooks/lib/common.js
  Line 284, 285: `.isdlc/skill-customization-report.md` -> `docs/isdlc/skill-customization-report.md`
```

### 3.5 ATDD Checklist References

**Pattern:** `.isdlc/atdd-checklist.json` -> `docs/isdlc/atdd-checklist.json`

**Affected files (17 occurrences across 7 files):**

```
src/claude/agents/04-test-design-engineer.md
  Line 421, 486, 497: `.isdlc/atdd-checklist.json` -> `docs/isdlc/atdd-checklist.json`

src/claude/agents/05-software-developer.md
  Line 361, 531, 535, 548: `.isdlc/atdd-checklist.json` -> `docs/isdlc/atdd-checklist.json`

src/claude/agents/06-integration-tester.md
  Line 548, 584, 628: `.isdlc/atdd-checklist.json` -> `docs/isdlc/atdd-checklist.json`

src/claude/agents/reverse-engineer/atdd-bridge.md
  Line 132, 158: `.isdlc/atdd-checklist-{domain}.json` -> `docs/isdlc/atdd-checklist-{domain}.json`

src/claude/skills/testing/atdd-checklist/SKILL.md
  Line 3, 112, 244, 256, 295: `.isdlc/atdd-checklist.json` -> `docs/isdlc/atdd-checklist.json`

src/claude/skills/testing/atdd-scenario-mapping/SKILL.md
  Line 138: `.isdlc/atdd-checklist.json` -> `docs/isdlc/atdd-checklist.json`

src/claude/skills/reverse-engineer/atdd-checklist-generation/SKILL.md
  Line 88: `.isdlc/atdd-checklist-{domain}.json` -> `docs/isdlc/atdd-checklist-{domain}.json`

src/claude/hooks/config/iteration-requirements.json
  Line 140: `.isdlc/atdd-checklist.json` -> `docs/isdlc/atdd-checklist.json`
```

### 3.6 External Skills Manifest References

**Pattern:** `.isdlc/external-skills-manifest.json` -> `docs/isdlc/external-skills-manifest.json`

**Affected files (6 occurrences across 4 files):**

```
src/claude/agents/00-sdlc-orchestrator.md
  Line 63: `.isdlc/external-skills-manifest.json` -> `docs/isdlc/external-skills-manifest.json`

src/claude/agents/discover/skills-researcher.md
  Line 155, 329: `.isdlc/external-skills-manifest.json` -> `docs/isdlc/external-skills-manifest.json`

src/claude/skills/discover/web-research-fallback/SKILL.md
  Line 47: `.isdlc/external-skills-manifest.json` -> `docs/isdlc/external-skills-manifest.json`

src/claude/skills/discover/skill-installation/SKILL.md
  Line 52: `.isdlc/external-skills-manifest.json` -> `docs/isdlc/external-skills-manifest.json`

src/claude/hooks/lib/common.js
  Line 264, 265: `.isdlc/external-skills-manifest.json` -> `docs/isdlc/external-skills-manifest.json`
```

### 3.7 Reverse Engineer Report References

**Pattern:** `.isdlc/reverse-engineer-report.md` -> `docs/isdlc/reverse-engineer-report.md`

**Affected files (4 occurrences across 3 files):**

```
src/claude/agents/reverse-engineer/atdd-bridge.md
  Line 64: `.isdlc/reverse-engineer-report.md` -> `docs/isdlc/reverse-engineer-report.md`

src/claude/agents/reverse-engineer/artifact-integration.md
  Line 117, 173: `.isdlc/reverse-engineer-report.md` -> `docs/isdlc/reverse-engineer-report.md`

src/claude/skills/reverse-engineer/report-generation/SKILL.md
  Line 84: `.isdlc/reverse-engineer-report.md` -> `docs/isdlc/reverse-engineer-report.md`
```

### 3.8 Monorepo Project Paths

**Pattern:** `.isdlc/projects/{project-id}/` -> `docs/isdlc/projects/{project-id}/` (for document files only)

**Affected files (32 occurrences across 10 files):**

```
src/claude/agents/00-sdlc-orchestrator.md
  Line 61, 64, 79, 82, 83, 84: monorepo paths

src/claude/agents/discover-orchestrator.md
  Line 58, 62, 63, 64, 71, 72, 73, 74: monorepo paths

src/claude/agents/discover/skills-researcher.md
  Line 133, 142, 156, 211, 327, 328, 329: monorepo paths

src/claude/agents/discover/constitution-generator.md
  Line 235: monorepo constitution path

src/claude/skills/orchestration/generate-plan/SKILL.md
  Line 84, 181: monorepo tasks path

src/claude/skills/discover/web-research-fallback/SKILL.md
  Line 42, 48: monorepo paths

src/claude/skills/discover/skill-installation/SKILL.md
  Line 20, 36, 53: monorepo paths

src/claude/commands/discover.md
  Line 87, 88, 89, 90, 91: monorepo paths

src/claude/commands/sdlc.md
  Line 584: monorepo paths

src/claude/hooks/lib/common.js
  Line 172, 245, 265, 285: monorepo paths (these are utility functions that need updating)
```

---

## 4. Install Script Changes

**File:** `/Users/vihangshah/enactor-code/isdlc/install.sh`

### 4.1 Changes Required

1. **Create `docs/isdlc/` directory structure** (around line 448):

```bash
# Create docs/isdlc structure for user documents
mkdir -p docs/isdlc/checklists
echo -e "${GREEN}  + Created docs/isdlc/${NC}"
```

2. **Move constitution copy destination** (around line 566):

Change:
```bash
cp "$FRAMEWORK_DIR/isdlc/templates/constitution.md" ".isdlc/constitution.md"
```

To:
```bash
cp "$FRAMEWORK_DIR/isdlc/templates/constitution.md" "docs/isdlc/constitution.md"
```

3. **Update state.json constitution path** (around line 604):

Change:
```json
"constitution": {
    "enforced": true,
    "path": ".isdlc/constitution.md",
    ...
}
```

To:
```json
"constitution": {
    "enforced": true,
    "path": "docs/isdlc/constitution.md",
    ...
}
```

4. **Update constitution generation** (around line 874):

Change:
```bash
cat > .isdlc/constitution.md << CONSTEOF
```

To:
```bash
cat > docs/isdlc/constitution.md << CONSTEOF
```

5. **Update monorepo project setup** (around line 831):

Change:
```bash
mkdir -p ".isdlc/projects/$PROJ_NAME"
```

To also create:
```bash
mkdir -p "docs/isdlc/projects/$PROJ_NAME"
```

6. **Update per-project manifest creation** (around line 831):

Change:
```bash
cat > ".isdlc/projects/$PROJ_NAME/external-skills-manifest.json"
```

To:
```bash
cat > "docs/isdlc/projects/$PROJ_NAME/external-skills-manifest.json"
```

7. **Update docs/README.md** (around line 463):

Update the README content to mention `docs/isdlc/` for iSDLC documents.

---

## 5. Uninstall Script Changes

**File:** `/Users/vihangshah/enactor-code/isdlc/uninstall.sh`

### 5.1 Changes Required

1. **Update user artifact preservation list** (comments around line 31-41):

Add to preservation list:
```bash
#       - docs/isdlc/constitution.md (project constitution)
#       - docs/isdlc/constitution.draft.md (draft constitution)
#       - docs/isdlc/tasks.md (orchestrator task plan)
#       - docs/isdlc/test-evaluation-report.md (test infrastructure analysis)
#       - docs/isdlc/atdd-checklist.json (ATDD compliance tracking)
#       - docs/isdlc/skill-customization-report.md (external skills summary)
#       - docs/isdlc/external-skills-manifest.json (external skills registry)
#       - docs/isdlc/checklists/ (gate checklist responses)
#       - docs/isdlc/projects/ (monorepo project documents)
```

2. **Update preserved items logic** (around line 645-671):

Change from checking `.isdlc/` to also check `docs/isdlc/`:
```bash
[ -f "$PROJECT_ROOT/docs/isdlc/constitution.md" ] && PRESERVED_ITEMS+=("docs/isdlc/constitution.md")
[ -f "$PROJECT_ROOT/docs/isdlc/constitution.draft.md" ] && PRESERVED_ITEMS+=("docs/isdlc/constitution.draft.md")
[ -f "$PROJECT_ROOT/docs/isdlc/tasks.md" ] && PRESERVED_ITEMS+=("docs/isdlc/tasks.md")
# ... etc
```

3. **Update PURGE_ALL behavior** (around line 596-605):

If `--purge-all` is used, also remove `docs/isdlc/`:
```bash
if [ "$PURGE_ALL" = true ]; then
    rm -rf "$PROJECT_ROOT/.isdlc"
    rm -rf "$PROJECT_ROOT/docs/isdlc"
fi
```

---

## 6. State.json Schema Changes

### 6.1 Constitution Path Update

In `state.json`, the `constitution.path` field needs to change:

**Before:**
```json
{
  "constitution": {
    "enforced": true,
    "path": ".isdlc/constitution.md",
    "validated_at": null
  }
}
```

**After:**
```json
{
  "constitution": {
    "enforced": true,
    "path": "docs/isdlc/constitution.md",
    "validated_at": null
  }
}
```

### 6.2 Monorepo Override Path

For monorepo mode, the override path also needs updating:

**Before:**
```json
{
  "constitution": {
    "enforced": true,
    "path": ".isdlc/constitution.md",
    "override_path": ".isdlc/projects/{id}/constitution.md",
    "validated_at": null
  }
}
```

**After:**
```json
{
  "constitution": {
    "enforced": true,
    "path": "docs/isdlc/constitution.md",
    "override_path": "docs/isdlc/projects/{id}/constitution.md",
    "validated_at": null
  }
}
```

---

## 7. Migration Order (Dependency-aware)

### Phase 1: Utility Functions (Foundation)

1. **Update `src/claude/hooks/lib/common.js`**
   - Update `resolveConstitutionPath()` to return `docs/isdlc/...`
   - Update `resolveExternalManifestPath()` to return `docs/isdlc/...`
   - Update `resolveSkillReportPath()` to return `docs/isdlc/...`
   - Add new `resolveTasksPath()` function for tasks.md
   - Add new `resolveTestEvaluationPath()` function for test-evaluation-report.md
   - Add new `resolveAtddChecklistPath()` function for atdd-checklist.json

### Phase 2: Install/Uninstall Scripts

2. **Update `install.sh`**
   - Create `docs/isdlc/` directory
   - Move constitution creation to `docs/isdlc/`
   - Update state.json constitution path
   - Update monorepo project setup

3. **Update `uninstall.sh`**
   - Update preservation lists
   - Update purge behavior

### Phase 3: Core Orchestrators

4. **Update `src/claude/agents/00-sdlc-orchestrator.md`**
5. **Update `src/claude/agents/discover-orchestrator.md`**

### Phase 4: Commands

6. **Update `src/claude/commands/sdlc.md`**
7. **Update `src/claude/commands/discover.md`**

### Phase 5: Phase Agents (01-14)

8. Update all phase agents (01 through 14)
   - Each agent has ~2 constitution references
   - Each agent has ~1 tasks.md reference

### Phase 6: Discover Sub-agents

9. **Update `src/claude/agents/discover/constitution-generator.md`**
10. **Update `src/claude/agents/discover/test-evaluator.md`**
11. **Update `src/claude/agents/discover/skills-researcher.md`**

### Phase 7: Reverse Engineer Agents

12. **Update all 4 reverse-engineer agents**

### Phase 8: Skills

13. Update all affected skills:
    - orchestration/autonomous-constitution-validate.md
    - orchestration/generate-plan/SKILL.md
    - testing/atdd-checklist/SKILL.md
    - testing/atdd-scenario-mapping/SKILL.md
    - discover/interactive-review/SKILL.md
    - discover/web-research-fallback/SKILL.md
    - discover/skill-installation/SKILL.md
    - reverse-engineer/atdd-checklist-generation/SKILL.md
    - reverse-engineer/report-generation/SKILL.md

### Phase 9: Hooks

14. **Update `src/claude/hooks/constitution-validator.js`**
15. **Update `src/claude/hooks/test-watcher.js`**

### Phase 10: Config

16. **Update `src/claude/hooks/config/iteration-requirements.json`**

---

## 8. Backward Compatibility

### 8.1 Migration Script for Existing Installations

Create a migration script (`scripts/migrate-docs.sh`) that:

1. Checks if old paths exist
2. Creates new directory structure
3. Moves files to new locations
4. Updates state.json paths

```bash
#!/bin/bash
# Migration script for existing installations

# Create new directory structure
mkdir -p docs/isdlc/checklists
mkdir -p docs/isdlc/projects

# Move files if they exist at old locations
[ -f ".isdlc/constitution.md" ] && mv ".isdlc/constitution.md" "docs/isdlc/constitution.md"
[ -f ".isdlc/constitution.draft.md" ] && mv ".isdlc/constitution.draft.md" "docs/isdlc/constitution.draft.md"
[ -f ".isdlc/test-evaluation-report.md" ] && mv ".isdlc/test-evaluation-report.md" "docs/isdlc/test-evaluation-report.md"
[ -f ".isdlc/tasks.md" ] && mv ".isdlc/tasks.md" "docs/isdlc/tasks.md"
[ -f ".isdlc/skill-customization-report.md" ] && mv ".isdlc/skill-customization-report.md" "docs/isdlc/skill-customization-report.md"
[ -f ".isdlc/atdd-checklist.json" ] && mv ".isdlc/atdd-checklist.json" "docs/isdlc/atdd-checklist.json"
[ -f ".isdlc/external-skills-manifest.json" ] && mv ".isdlc/external-skills-manifest.json" "docs/isdlc/external-skills-manifest.json"
[ -f ".isdlc/reverse-engineer-report.md" ] && mv ".isdlc/reverse-engineer-report.md" "docs/isdlc/reverse-engineer-report.md"

# Move checklists directory if it exists
[ -d ".isdlc/checklists" ] && mv ".isdlc/checklists/"* "docs/isdlc/checklists/" 2>/dev/null

# Move domain-specific ATDD checklists
for f in .isdlc/atdd-checklist-*.json; do
    [ -f "$f" ] && mv "$f" "docs/isdlc/"
done

# Handle monorepo project directories
if [ -d ".isdlc/projects" ]; then
    for project_dir in .isdlc/projects/*/; do
        [ -d "$project_dir" ] || continue
        project_id=$(basename "$project_dir")
        mkdir -p "docs/isdlc/projects/$project_id"

        # Move document files (keep state.json and skills/ in .isdlc)
        [ -f "$project_dir/constitution.md" ] && mv "$project_dir/constitution.md" "docs/isdlc/projects/$project_id/"
        [ -f "$project_dir/skill-customization-report.md" ] && mv "$project_dir/skill-customization-report.md" "docs/isdlc/projects/$project_id/"
        [ -f "$project_dir/external-skills-manifest.json" ] && mv "$project_dir/external-skills-manifest.json" "docs/isdlc/projects/$project_id/"
        [ -f "$project_dir/test-evaluation-report.md" ] && mv "$project_dir/test-evaluation-report.md" "docs/isdlc/projects/$project_id/"
    done
fi

# Update state.json if it exists
if [ -f ".isdlc/state.json" ] && command -v jq &> /dev/null; then
    jq '.constitution.path = "docs/isdlc/constitution.md"' .isdlc/state.json > .isdlc/state.json.tmp
    mv .isdlc/state.json.tmp .isdlc/state.json
fi

echo "Migration complete. User documents moved to docs/isdlc/"
```

### 8.2 Fallback Logic in common.js

Add fallback logic to check both locations during transition period:

```javascript
function resolveConstitutionPath(projectId) {
    const projectRoot = getProjectRoot();

    // New location (preferred)
    const newPath = path.join(projectRoot, 'docs', 'isdlc', 'constitution.md');
    if (fs.existsSync(newPath)) {
        return newPath;
    }

    // Legacy location (fallback)
    const legacyPath = path.join(projectRoot, '.isdlc', 'constitution.md');
    if (fs.existsSync(legacyPath)) {
        return legacyPath;
    }

    // Default to new location for creation
    return newPath;
}
```

### 8.3 Version Check

Add a version check in hooks to warn users about migration:

```javascript
function checkMigrationNeeded() {
    const projectRoot = getProjectRoot();
    const legacyConstitution = path.join(projectRoot, '.isdlc', 'constitution.md');
    const newConstitution = path.join(projectRoot, 'docs', 'isdlc', 'constitution.md');

    if (fs.existsSync(legacyConstitution) && !fs.existsSync(newConstitution)) {
        console.warn('[iSDLC] Migration needed: Run ./scripts/migrate-docs.sh to move documents to docs/isdlc/');
    }
}
```

---

## 9. Testing Checklist

After migration, verify:

- [ ] New installation creates `docs/isdlc/` directory
- [ ] Constitution is created at `docs/isdlc/constitution.md`
- [ ] `/discover` writes to `docs/isdlc/` locations
- [ ] All agents can read constitution from new location
- [ ] All agents can read/write tasks.md at new location
- [ ] ATDD checklist works at new location
- [ ] Monorepo mode creates `docs/isdlc/projects/{id}/` structure
- [ ] Uninstall preserves `docs/isdlc/` user documents
- [ ] Migration script moves existing files correctly
- [ ] Fallback logic works during transition period

---

## 10. Summary

**Total files to update:** 47 unique files

| Category | Count |
|----------|-------|
| Agents | 23 |
| Skills | 11 |
| Commands | 2 |
| Hooks | 3 |
| Config | 1 |
| Scripts | 2 |
| **Total** | **42** (framework files) + 5 new migration files |

**Total string replacements:** ~120 occurrences

**Estimated effort:** 4-6 hours for complete migration

---

## Appendix A: Full File List for Bulk Replace

Files requiring `.isdlc/constitution.md` -> `docs/isdlc/constitution.md`:

```
src/claude/agents/00-sdlc-orchestrator.md
src/claude/agents/01-requirements-analyst.md
src/claude/agents/02-solution-architect.md
src/claude/agents/03-system-designer.md
src/claude/agents/04-test-design-engineer.md
src/claude/agents/05-software-developer.md
src/claude/agents/06-integration-tester.md
src/claude/agents/07-qa-engineer.md
src/claude/agents/08-security-compliance-auditor.md
src/claude/agents/09-cicd-engineer.md
src/claude/agents/10-dev-environment-engineer.md
src/claude/agents/11-deployment-engineer-staging.md
src/claude/agents/12-release-manager.md
src/claude/agents/13-site-reliability-engineer.md
src/claude/agents/discover-orchestrator.md
src/claude/agents/discover/constitution-generator.md
src/claude/agents/reverse-engineer/behavior-analyzer.md
src/claude/agents/reverse-engineer/characterization-test-generator.md
src/claude/agents/reverse-engineer/atdd-bridge.md
src/claude/agents/reverse-engineer/artifact-integration.md
src/claude/commands/sdlc.md
src/claude/commands/discover.md
src/claude/skills/orchestration/autonomous-constitution-validate.md
src/claude/skills/discover/interactive-review/SKILL.md
src/claude/hooks/constitution-validator.js
src/claude/hooks/test-watcher.js
src/claude/hooks/lib/common.js
```

---

**End of Migration Plan**
