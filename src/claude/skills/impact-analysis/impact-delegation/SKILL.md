---
name: impact-delegation
description: Delegate impact analysis work to parallel sub-agents (M1, M2, M3)
skill_id: IA-001
owner: impact-analysis-orchestrator
collaborators: []
project: isdlc
version: 1.0.0
when_to_use: During Phase 02 Impact Analysis to launch parallel sub-agents
dependencies: []
---

# Impact Delegation

## Purpose
Coordinate the launch of parallel sub-agents (Impact Analyzer, Entry Point Finder, Risk Assessor) for comprehensive feature impact analysis based on finalized requirements.

## When to Use
- Starting Phase 02 Impact Analysis
- Need to analyze feature impact from multiple perspectives
- Launching parallel analysis workstreams
- Distributing analysis across specialized agents

## Prerequisites
- Phase 01 Requirements completed
- Requirements document available
- Discovery report available
- Quick scan results (optional)

## Process

### Step 1: Load Requirements Context
```
1. Read finalized requirements from Phase 01
2. Extract acceptance criteria
3. Identify scope changes from original description
4. Prepare context for sub-agents
```

### Step 2: Prepare Delegation Prompts
```
For each sub-agent (M1, M2, M3):
1. Include clarified requirements summary
2. Include all acceptance criteria
3. Include requirements context JSON
4. Include path to discovery report
5. Specify expected output format
```

### Step 3: Launch Parallel Agents
```
Launch ALL THREE agents simultaneously:
- M1: Impact Analyzer (IA-101 to IA-104)
- M2: Entry Point Finder (IA-201 to IA-204)
- M3: Risk Assessor (IA-301 to IA-304)

Use parallel Task tool calls in a single message.
```

### Step 4: Track Progress
```
Display progress indicator:
IMPACT ANALYSIS                     [In Progress]
├─ ◐ Impact Analyzer (M1)              (running)
├─ ◐ Entry Point Finder (M2)           (running)
└─ ◐ Risk Assessor (M3)                (running)
```

## Inputs
| Input | Type | Required | Description |
|-------|------|----------|-------------|
| requirements_document | String | Yes | Path to finalized requirements |
| discovery_report | String | Yes | Path to discovery report |
| quick_scan | String | No | Path to quick scan results |
| artifact_folder | String | Yes | Target folder for outputs |

## Outputs
| Output | Type | Description |
|--------|------|-------------|
| delegation_status | Object | Status of each sub-agent launch |
| agent_prompts | Object | Prompts sent to each agent |
| tracking_state | Object | Progress tracking data |

## Validation
- Requirements document loaded and parsed
- All three sub-agents launched in parallel
- Progress tracking initialized
- Context correctly distributed to agents
