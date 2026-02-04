---
name: impact-analysis
description: Two-phase impact analysis with preliminary risk assessment and optional comprehensive blast radius analysis via IA delegation
skill_id: UPG-003
owner: upgrade-engineer
collaborators: [impact-analysis-orchestrator, impact-analyzer, entry-point-finder, risk-assessor, security-compliance-auditor, solution-architect]
project: sdlc-framework
version: 2.0.0
when_to_use: After target version selected to understand upgrade risk and determine analysis depth
dependencies: [UPG-001, UPG-002]
delegates_to: [IA-001, IA-002, IA-003]
---

# Impact Analysis

## Purpose

Perform upgrade impact analysis in two phases:
1. **Phase A (Preliminary)**: Quick changelog-based risk assessment to inform user decision
2. **Phase B (Conditional)**: User chooses analysis depth - quick, comprehensive (IA delegation), or skip

This skill bridges the upgrade workflow with the comprehensive Impact Analysis infrastructure (IA agents) when deeper analysis is warranted.

## When to Use

- After target version is selected (UPG-002 complete)
- Before generating the migration plan (UPG-004)
- When assessing risk of an upgrade

## Prerequisites

- Current and target versions known (UPG-001, UPG-002)
- Codebase accessible for scanning
- Internet access for changelog/migration guide lookup
- Impact Analysis agents available for comprehensive analysis delegation

## Process Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  PHASE A: Preliminary Risk Assessment (Always Runs)             │
│  Steps 1-5: Fetch changelogs, extract breaking changes,        │
│             quick scan, calculate preliminary risk              │
├─────────────────────────────────────────────────────────────────┤
│  USER DECISION POINT (Step 6)                                   │
│  Present risk + offer choice: Quick / Comprehensive / Skip      │
├─────────────────────────────────────────────────────────────────┤
│  PHASE B: Conditional Deep Analysis (Step 7)                    │
│  Execute based on user choice                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## PHASE A: Preliminary Risk Assessment

### Step 1: Fetch Changelogs

```
Use WebSearch to find:
- Official changelog/release notes between current → target version
- Migration guides (especially for major version bumps)
- Known issues / gotchas

Search queries:
- "<name> changelog <current> to <target>"
- "<name> migration guide v<major>"
- "<name> breaking changes v<target>"
- "<name> upgrade guide"

Sources to check:
- GitHub releases page
- Official documentation
- CHANGELOG.md in repository
- Blog posts announcing the release
```

### Step 2: Extract Breaking Changes

```
From changelogs, identify:
- Removed APIs / functions / methods
- Changed function signatures
- Renamed exports or modules
- Deprecated features scheduled for removal
- Changed default behaviors
- New required configuration
- Dropped platform support (Node version, OS, etc.)

Store as breaking_changes array:
[
  {
    "id": "BC-001",
    "type": "removed_api",
    "name": "componentWillMount",
    "description": "Lifecycle method removed in React 19",
    "replacement": "useEffect or constructor",
    "severity": "CRITICAL"
  },
  ...
]
```

### Step 3: Quick Codebase Scan

```
For each breaking change identified:
1. Search codebase for usage of affected API
   - Use Grep to find imports, function calls, config references
   - Count number of files and lines affected (quick count, not exhaustive)
2. Categorize impact:
   - CRITICAL: Removed API in active use → code will break
   - HIGH: Changed behavior in active use → tests may fail
   - MEDIUM: Deprecated API in active use → works now, will break later
   - LOW: Changed default → may need config update
   - NONE: Breaking change not applicable to this codebase

Note: This is a QUICK scan. Comprehensive analysis in Phase B will find
indirect dependencies and coupling issues.
```

### Step 4: Check Dependency Compatibility

```
Verify peer/transitive dependencies:
- Will other dependencies conflict with the new version?
- Are there known incompatibilities?
- Do peer dependency ranges allow the target version?

npm: npm ls <name> (check peer dep warnings)
PyPI: check requires-python and dependency ranges
Maven: check dependency convergence
```

### Step 5: Calculate Preliminary Risk Score

```
Risk Score Calculation:
- Count CRITICAL impacts (weight: 10)
- Count HIGH impacts (weight: 5)
- Count MEDIUM impacts (weight: 2)
- Count LOW impacts (weight: 1)

Preliminary Risk Level:
- Score 0-5:   LOW    — straightforward upgrade
- Score 6-15:  MEDIUM — careful testing needed
- Score 16-30: HIGH   — significant refactoring required
- Score 30+:   CRITICAL — consider stepwise upgrade

Store in state.json → phases["15-upgrade"].sub_phases["15-upgrade-preliminary-analysis"]
```

### Step 6: Present Risk and User Decision

**CRITICAL**: Present the preliminary assessment to the user and ask them to choose analysis depth.

```
Display to user:
════════════════════════════════════════════════════════════════════════
  UPGRADE RISK ASSESSMENT: {name} {current} → {target}
════════════════════════════════════════════════════════════════════════

Preliminary Analysis Complete
─────────────────────────────
Risk Level:           {LOW|MEDIUM|HIGH|CRITICAL}
Risk Score:           {score} / 30+
Breaking Changes:     {count} identified
Deprecated APIs:      {count} in use
Files Affected:       ~{estimate} (preliminary)
Peer Dep Conflicts:   {count}

Breaking Changes Summary:
┌────────┬──────────┬───────────────────────────────────────────────┐
│ ID     │ Severity │ Description                                   │
├────────┼──────────┼───────────────────────────────────────────────┤
│ BC-001 │ CRITICAL │ componentWillMount removed                    │
│ BC-002 │ HIGH     │ defaultProps behavior changed                 │
│ BC-003 │ MEDIUM   │ StrictMode warnings now errors                │
└────────┴──────────┴───────────────────────────────────────────────┘

Choose analysis depth:

[1] Quick Analysis {recommended_marker_if_LOW}
    • Uses changelog-based impact estimation
    • Completes in ~30 seconds
    • Best for: LOW risk upgrades, minor version bumps
    • Limitation: May miss indirect dependencies

[2] Comprehensive Analysis {recommended_marker_if_MEDIUM_or_higher}
    • Full blast radius analysis with parallel sub-agents
    • Analyzes: file impact, entry points, risk zones
    • Completes in ~2-5 minutes
    • Best for: MEDIUM/HIGH/CRITICAL risk, major version bumps
    • Benefit: Finds coupling issues, test coverage gaps

[3] Skip Analysis
    • Proceed directly to migration planning
    • Uses preliminary assessment only
    • Best for: Urgent upgrades with known scope
    • Warning: Higher risk of unexpected issues

════════════════════════════════════════════════════════════════════════
```

Use AskUserQuestion tool:
```json
{
  "questions": [{
    "question": "What level of impact analysis would you like for this upgrade?",
    "header": "Analysis",
    "options": [
      {
        "label": "Quick Analysis" + (risk === "LOW" ? " (Recommended)" : ""),
        "description": "Changelog-based estimation. Fast but may miss indirect dependencies."
      },
      {
        "label": "Comprehensive Analysis" + (risk !== "LOW" ? " (Recommended)" : ""),
        "description": "Full blast radius with parallel agents. Finds coupling issues and test gaps."
      },
      {
        "label": "Skip Analysis",
        "description": "Proceed with preliminary assessment only. Higher risk of surprises."
      }
    ],
    "multiSelect": false
  }]
}
```

---

## PHASE B: Conditional Deep Analysis

### Step 7: Execute Based on User Choice

#### Path A: Quick Analysis (User chose option 1)

```
1. Complete the inline analysis (current behavior):
   - Exhaustive grep for each breaking change
   - Build affected_files list with line counts
   - No dependency graph analysis

2. Write preliminary-analysis.md:
   docs/requirements/UPG-NNNN-{name}-v{version}/preliminary-analysis.md

3. Write upgrade-analysis.md (final):
   docs/requirements/UPG-NNNN-{name}-v{version}/upgrade-analysis.md

4. Update state.json:
   phases["15-upgrade"].sub_phases["15-upgrade-impact-analysis"] = {
     "status": "completed",
     "user_choice": "quick",
     "analysis_type": "changelog_based",
     "completed_at": "<timestamp>"
   }

5. Proceed to UPG-004 (Migration Planning)
```

#### Path B: Comprehensive Analysis (User chose option 2)

```
1. Write preliminary-analysis.md first:
   docs/requirements/UPG-NNNN-{name}-v{version}/preliminary-analysis.md

2. Update state.json to track delegation:
   phases["15-upgrade"].sub_phases["15-upgrade-impact-analysis"] = {
     "status": "in_progress",
     "user_choice": "comprehensive",
     "delegated_to": "impact-analysis-orchestrator"
   }

3. Delegate to Impact Analysis Orchestrator using Task tool:

   Task prompt:
   ───────────────────────────────────────────────────────────────
   Execute comprehensive impact analysis for UPGRADE workflow.

   WORKFLOW CONTEXT:
   {
     "workflow": "upgrade",
     "upgrade_target": "{name}",
     "current_version": "{current}",
     "target_version": "{target}",
     "ecosystem": "{ecosystem}",
     "preliminary_risk": "{risk_level}",
     "breaking_changes": [{breaking_changes_array}],
     "deprecated_apis_in_use": [{deprecated_apis_array}],
     "preliminary_affected_files": [{files_array}]
   }

   ARTIFACT FOLDER: docs/requirements/UPG-NNNN-{name}-v{version}/

   SPECIAL INSTRUCTIONS FOR UPGRADE WORKFLOW:
   - M1 (Impact Analyzer): Focus on files using deprecated/removed APIs
   - M2 (Entry Point Finder): Identify entry points affected by API changes
   - M3 (Risk Assessor): Assess test coverage for affected areas

   Write output to: {artifact_folder}/impact-analysis.md

   Return consolidated analysis when complete.
   ───────────────────────────────────────────────────────────────

4. Wait for IA Orchestrator to complete (runs M1, M2, M3 in parallel)

5. Receive impact-analysis.md from IA Orchestrator

6. Merge preliminary + comprehensive into upgrade-analysis.md:
   - Include breaking changes from preliminary
   - Add blast radius from comprehensive
   - Add entry points from comprehensive
   - Add risk zones from comprehensive

7. Update state.json:
   phases["15-upgrade"].sub_phases["15-upgrade-impact-analysis"] = {
     "status": "completed",
     "user_choice": "comprehensive",
     "delegated_to": "impact-analysis-orchestrator",
     "sub_agents": {
       "M1-impact-analyzer": { "status": "completed" },
       "M2-entry-point-finder": { "status": "completed" },
       "M3-risk-assessor": { "status": "completed" }
     },
     "completed_at": "<timestamp>"
   }

8. Proceed to UPG-004 (Migration Planning)
```

#### Path C: Skip Analysis (User chose option 3)

```
1. Write preliminary-analysis.md only:
   docs/requirements/UPG-NNNN-{name}-v{version}/preliminary-analysis.md

2. Copy to upgrade-analysis.md with warning banner:
   # Upgrade Analysis: {name} {current} → {target}

   > ⚠️ **ANALYSIS SKIPPED**: User chose to skip comprehensive analysis.
   > This assessment is based on preliminary changelog review only.
   > Unexpected issues may arise during migration.

   [preliminary content]

3. Update state.json:
   phases["15-upgrade"].sub_phases["15-upgrade-impact-analysis"] = {
     "status": "completed",
     "user_choice": "skip",
     "analysis_type": "preliminary_only",
     "warning": "Comprehensive analysis skipped by user",
     "completed_at": "<timestamp>"
   }

4. Proceed to UPG-004 with warning flag
```

---

## Output Documents

### preliminary-analysis.md (Always Generated)

```markdown
# Preliminary Upgrade Analysis: {name} {current} → {target}

**Generated**: {timestamp}
**Phase**: 15-upgrade (preliminary)
**Risk Level**: {LOW|MEDIUM|HIGH|CRITICAL}

## Changelog Sources
- {list of URLs consulted}

## Breaking Changes Identified

| ID | Type | Name | Severity | Files Affected | Description |
|----|------|------|----------|----------------|-------------|
| BC-001 | removed_api | componentWillMount | CRITICAL | 5 | Lifecycle removed |

## Deprecated APIs in Use

| API | Files | Replacement | Removal Version |
|-----|-------|-------------|-----------------|
| ... | ... | ... | ... |

## Dependency Compatibility

| Dependency | Current | Required | Compatible |
|------------|---------|----------|------------|
| ... | ... | ... | Yes/No |

## Risk Score Calculation

- CRITICAL impacts: {n} × 10 = {score}
- HIGH impacts: {n} × 5 = {score}
- MEDIUM impacts: {n} × 2 = {score}
- LOW impacts: {n} × 1 = {score}
- **Total Score**: {total}
- **Risk Level**: {level}
```

### impact-analysis.md (Comprehensive Path Only)

Generated by Impact Analysis Orchestrator. Contains:
- Full blast radius (M1)
- Entry points affected (M2)
- Risk zones with coverage gaps (M3)

### upgrade-analysis.md (Final Merged Output)

```markdown
# Upgrade Analysis: {name} {current} → {target}

**Generated**: {timestamp}
**Analysis Type**: {Quick|Comprehensive|Preliminary Only}
**Risk Level**: {LOW|MEDIUM|HIGH|CRITICAL}

## Summary

| Metric | Value |
|--------|-------|
| Breaking Changes | {n} |
| Files Affected | {n} |
| Modules Affected | {n} |
| Risk Score | {score} |

## Breaking Changes
{from preliminary analysis}

## Blast Radius
{from comprehensive analysis OR "Not analyzed - quick mode"}

## Entry Points Affected
{from comprehensive analysis OR "Not analyzed - quick mode"}

## Risk Zones
{from comprehensive analysis OR "Not analyzed - quick mode"}

## Migration References
- {links to guides}

## Analysis Metadata
```json
{
  "analysis_type": "comprehensive",
  "user_choice": "comprehensive",
  "preliminary_completed_at": "...",
  "comprehensive_completed_at": "...",
  "sub_agents_used": ["M1", "M2", "M3"]
}
```
```

---

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Package/runtime name |
| current_version | string | Yes | Current version |
| target_version | string | Yes | Target version |
| ecosystem | string | Yes | Package ecosystem |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| preliminary-analysis.md | Markdown | Preliminary risk assessment (always) |
| impact-analysis.md | Markdown | Comprehensive analysis (if chosen) |
| upgrade-analysis.md | Markdown | Final merged analysis report |
| risk_level | string | LOW, MEDIUM, HIGH, or CRITICAL |
| breaking_changes | array | List of breaking changes with severity |
| affected_files | array | Files that need modification |
| user_choice | string | quick, comprehensive, or skip |

## State Tracking

Update `.isdlc/state.json` with sub-phase tracking:

```json
{
  "phases": {
    "15-upgrade": {
      "sub_phases": {
        "15-upgrade-preliminary-analysis": {
          "status": "completed",
          "preliminary_risk": "MEDIUM",
          "breaking_changes_count": 5,
          "risk_score": 18
        },
        "15-upgrade-impact-analysis": {
          "status": "completed",
          "user_choice": "comprehensive",
          "delegated_to": "impact-analysis-orchestrator",
          "sub_agents": { ... }
        }
      }
    }
  }
}
```

## Integration Points

- **Registry Lookup (UPG-002)**: Provides target version
- **Impact Analysis Orchestrator (IA-001)**: Receives delegation for comprehensive analysis
- **Impact Analyzer (IA-101-104)**: Analyzes file impact in upgrade context
- **Entry Point Finder (IA-201-204)**: Finds affected entry points
- **Risk Assessor (IA-301-304)**: Assesses risk zones
- **Migration Planning (UPG-004)**: Consumes risk assessment and affected files
- **Security Auditor**: May flag security advisories for current version

## Validation

- [ ] Changelogs fetched for version range
- [ ] Breaking changes extracted and categorized
- [ ] Preliminary risk score calculated
- [ ] User presented with informed choice
- [ ] User choice recorded in state.json
- [ ] Appropriate analysis path executed
- [ ] All output documents written to artifact folder
- [ ] State.json updated with sub-phase completion
