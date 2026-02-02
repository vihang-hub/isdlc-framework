---
name: impact-analysis
description: Fetch changelogs and scan codebase for deprecated APIs and breaking changes
skill_id: UPG-003
owner: upgrade-engineer
collaborators: [security-compliance-auditor, solution-architect]
project: sdlc-framework
version: 1.0.0
when_to_use: After target version selected to understand upgrade risk
dependencies: [UPG-001, UPG-002]
---

# Impact Analysis

## Purpose
Perform deep impact analysis by fetching changelogs, migration guides, and scanning the codebase for usage of deprecated or removed APIs between the current and target versions.

## When to Use
- After target version is selected
- Before generating the migration plan
- When assessing risk of an upgrade

## Prerequisites
- Current and target versions known (UPG-001, UPG-002)
- Codebase accessible for scanning
- Internet access for changelog/migration guide lookup

## Process

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
```

### Step 3: Scan Codebase for Impact
```
For each breaking change identified:
1. Search codebase for usage of affected API
   - Use Grep to find imports, function calls, config references
   - Count number of files and lines affected
2. Categorize impact:
   - CRITICAL: Removed API in active use → code will break
   - HIGH: Changed behavior in active use → tests may fail
   - MEDIUM: Deprecated API in active use → works now, will break later
   - LOW: Changed default → may need config update
   - NONE: Breaking change not applicable to this codebase
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

### Step 5: Generate Risk Assessment
```
Risk Score Calculation:
- Count CRITICAL impacts (weight: 10)
- Count HIGH impacts (weight: 5)
- Count MEDIUM impacts (weight: 2)
- Count LOW impacts (weight: 1)

Risk Level:
- Score 0-5:   LOW    — straightforward upgrade
- Score 6-15:  MEDIUM — careful testing needed
- Score 16-30: HIGH   — significant refactoring required
- Score 30+:   CRITICAL — consider stepwise upgrade
```

### Step 6: Write Analysis Report
```
Write docs/requirements/UPG-NNNN-{name}-v{version}/upgrade-analysis.md:

# Upgrade Analysis: {name} {current} → {target}

## Summary
- Risk Level: [LOW/MEDIUM/HIGH/CRITICAL]
- Files Affected: N
- Breaking Changes: N
- Deprecated APIs in Use: N

## Breaking Changes
| Change | Severity | Files Affected | Description |
|--------|----------|----------------|-------------|
| ...    | CRITICAL | 5              | ...         |

## Deprecated APIs in Use
| API | Files | Replacement | Removal Version |
|-----|-------|-------------|-----------------|

## Dependency Compatibility
| Dependency | Current | Required | Compatible |
|------------|---------|----------|------------|

## Changelog Summary
[Key changes between versions]

## Migration References
- [link to migration guide]
- [link to changelog]
```

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
| upgrade-analysis.md | Markdown | Full impact analysis report |
| risk_level | string | LOW, MEDIUM, HIGH, or CRITICAL |
| breaking_changes | array | List of breaking changes with severity |
| affected_files | array | Files that need modification |

## Project-Specific Considerations
- TypeScript projects need type definition compatibility checks
- Monorepo upgrades may cascade across workspace packages
- Framework upgrades (React, Angular, etc.) often have codemods available

## Integration Points
- **Registry Lookup (UPG-002)**: Provides target version
- **Migration Planning (UPG-004)**: Consumes risk assessment and affected files
- **Security Auditor**: May flag security advisories for current version
- **Solution Architect**: Consulted for architectural impact

## Validation
- All breaking changes between versions identified
- Codebase scanned for usage of each breaking change
- Risk level calculated and documented
- Analysis report written to correct output path
- No CRITICAL impacts without detailed description
