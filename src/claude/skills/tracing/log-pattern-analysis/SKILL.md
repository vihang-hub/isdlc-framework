---
name: log-pattern-analysis
description: Analyze log patterns to identify anomalies and error sequences
skill_id: TRACE-104
owner: symptom-analyzer
collaborators: []
project: sdlc-framework
version: 1.0.0
when_to_use: During T1 symptom analysis when logs are available
dependencies: [TRACE-101]
---

# Log Pattern Analysis

## Purpose

Analyze application logs to identify patterns, anomalies, and error sequences that indicate the nature and timing of bugs.

## When to Use

- During T1 symptom analysis
- When application logs are available
- When timing or sequence matters

## Process

1. Parse log entries
2. Filter relevant timeframe
3. Identify error patterns
4. Detect anomalies
5. Correlate with symptoms

## Inputs

| Input | Type | Required | Description |
|-------|------|----------|-------------|
| log_files | Array | Yes | Paths to log files |
| timeframe | JSON | No | Start/end time filter |
| error_patterns | Array | No | Known error patterns |

## Outputs

| Output | Type | Description |
|--------|------|-------------|
| error_entries | Array | Extracted error log entries |
| patterns | Array | Identified recurring patterns |
| anomalies | Array | Unusual log sequences |
| timeline | Array | Chronological event sequence |

## Analysis Focus

- **Error frequency**: Spike detection
- **Error clustering**: Related errors
- **Timing patterns**: Time-based triggers
- **Correlation**: Cross-service patterns

## Validation

- Relevant logs extracted
- Patterns identified and documented
- Timeline constructed
