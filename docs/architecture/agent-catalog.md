# Agent & Command Catalog

**Generated**: TBD (populated at runtime by D6 Step 9)
**Source**: Automated extraction from agent/command markdown definitions and config JSON

---

> **Note**: This file is a template. The Feature Mapper (D6) populates the actual
> content at runtime during `/discover --existing` by executing Step 9
> (Analyze Markdown Agent/Command Definitions). D6 replaces the placeholder
> rows below with real data extracted from the scanned files.

---

## Agent Inventory

| Agent Name | ID | Phase | Model | Skills | Delegates To |
|------------|----|----|-------|--------|--------------|
| _populated at runtime_ | _--_ | _--_ | _--_ | _--_ | _--_ |

## Command Inventory

| Command | Options | Routes To | Prerequisites |
|---------|---------|-----------|---------------|
| _populated at runtime_ | _--_ | _--_ | _--_ |

## Delegation Graph

_The delegation graph below is generated at runtime by tracing command -> orchestrator -> phase agent call chains._

### Entry Points (Commands)

- _populated at runtime_ (e.g., `/sdlc feature` -> `00-sdlc-orchestrator`)

### Orchestrators (delegate to other agents)

- _populated at runtime_ (e.g., `discover-orchestrator` delegates to: `architecture-analyzer`, `test-evaluator`, `feature-mapper`, `data-model-analyzer`)

### Leaf Agents (no delegation)

- _populated at runtime_ (e.g., `architecture-analyzer` (Setup))

## Config Summary

### Phase Enablement (from iteration-requirements.json)

| Phase | Enabled | Skip Reason |
|-------|---------|-------------|
| _populated at runtime_ | _--_ | _--_ |

### Skill Ownership (from skills-manifest.json)

| Agent | Phase | Skill Count | Skill IDs |
|-------|-------|-------------|-----------|
| _populated at runtime_ | _--_ | _--_ | _--_ |
