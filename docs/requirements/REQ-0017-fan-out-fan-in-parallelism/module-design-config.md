# Module Design: CLI Flag and Configuration

**REQ ID**: REQ-0017
**Phase**: 04-design
**Created**: 2026-02-15
**Author**: System Designer (Agent 04)
**Traces**: FR-007, ADR-0002

---

## 1. Module Overview

| Field | Value |
|-------|-------|
| Module | Fan-Out CLI Flag and Configuration |
| Files | `src/claude/commands/isdlc.md`, `.isdlc/state.json` |
| Responsibility | Parse --no-fan-out flag, store in state, provide config resolution logic |
| Dependencies | state.json (existing), isdlc.md flag parsing (existing pattern) |
| Consumers | Phase 16 agent, Phase 08 agent |

---

## 2. Component 1: --no-fan-out Flag Parsing in isdlc.md

### 2.1 Insertion Point

The flag is parsed in the existing flag parsing block at workflow init (isdlc.md, around line 248-252 based on current content). The pattern follows the existing flags: `-light`, `--supervised`, `--debate`, `--no-debate`.

### 2.2 Modification to isdlc.md

Add to the flag parsing section (Step 3):

```markdown
3. Parse flags from command arguments:
   - If args contain "-light": set flags.light = true, remove "-light" from description
   - If args contain "--supervised": set flags.supervised = true, remove "--supervised" from description
   - If args contain "--debate": set flags.debate = true, remove "--debate" from description
   - If args contain "--no-debate": set flags.no_debate = true, remove "--no-debate" from description
   - If args contain "--no-fan-out": set flags.no_fan_out = true, remove "--no-fan-out" from description
```

Add to the usage examples:

```markdown
/isdlc feature "Feature description" --no-fan-out
/isdlc fix "Bug description" --no-fan-out
```

Add to the flag documentation table:

```markdown
| Flag | Effect | Default |
|------|--------|---------|
| `--no-fan-out` | Disable fan-out parallelism for this workflow | Fan-out enabled (when threshold met) |
```

### 2.3 State Storage

The flag is stored in state.json under `active_workflow.flags`:

```json
{
  "active_workflow": {
    "flags": {
      "no_fan_out": true
    }
  }
}
```

If `--no-fan-out` is not provided, the `no_fan_out` key is either absent or `false`. Phase agents treat both as "fan-out not disabled by flag."

### 2.4 Flag Scope

The flag applies to the entire workflow run. Once set at workflow init, it persists until the workflow completes. It cannot be toggled mid-workflow (AC-007-04).

---

## 3. Component 2: state.json Fan-Out Configuration Section

### 3.1 Schema (Defined in database-design.md, referenced here)

```json
{
  "fan_out": {
    "enabled": true,
    "defaults": {
      "max_agents": 8,
      "timeout_per_chunk_ms": 600000
    },
    "phase_overrides": {
      "16-quality-loop": {
        "enabled": true,
        "tests_per_agent": 250,
        "min_tests_threshold": 250,
        "max_agents": 8,
        "strategy": "round-robin"
      },
      "08-code-review": {
        "enabled": true,
        "files_per_agent": 7,
        "min_files_threshold": 5,
        "max_agents": 8,
        "strategy": "group-by-directory"
      }
    }
  }
}
```

### 3.2 Default Behavior (No Config Present)

When the `fan_out` section is entirely absent from state.json (the common case for existing installations), all defaults apply:

| Parameter | Default |
|-----------|---------|
| `enabled` | `true` |
| `max_agents` | `8` |
| `timeout_per_chunk_ms` | `600000` (10 minutes) |
| Phase 16 `tests_per_agent` | `250` |
| Phase 16 `min_tests_threshold` | `250` |
| Phase 16 `strategy` | `"round-robin"` |
| Phase 08 `files_per_agent` | `7` |
| Phase 08 `min_files_threshold` | `5` |
| Phase 08 `strategy` | `"group-by-directory"` |

No migration is needed. The absence of the section means "use defaults." This is consistent with how other optional state.json sections work (Article XIV: State Management Integrity, backward-compatible schema changes).

### 3.3 Partial Configuration

Users can provide partial configuration. Missing fields use defaults:

```json
{
  "fan_out": {
    "phase_overrides": {
      "16-quality-loop": {
        "tests_per_agent": 100
      }
    }
  }
}
```

This sets Phase 16's tests_per_agent to 100, but all other parameters use defaults.

---

## 4. Component 3: Configuration Resolution Function

### 4.1 Resolution Algorithm

Phase agents resolve fan-out configuration using this algorithm:

```
FUNCTION resolve_fan_out_config(state, current_phase):

  // Step 1: Initialize with hardcoded defaults
  config = {
    enabled: true,
    max_agents: 8,
    timeout_per_chunk_ms: 600000,
    strategy: PHASE_DEFAULTS[current_phase].strategy,
    items_per_agent: PHASE_DEFAULTS[current_phase].items_per_agent,
    min_threshold: PHASE_DEFAULTS[current_phase].min_threshold
  }

  // Step 2: Apply global settings (if present)
  IF state.fan_out exists AND is object:
    IF state.fan_out.enabled is boolean:
      config.enabled = state.fan_out.enabled
    IF state.fan_out.defaults exists AND is object:
      IF state.fan_out.defaults.max_agents is integer AND 1 <= value <= 8:
        config.max_agents = state.fan_out.defaults.max_agents
      ELSE IF state.fan_out.defaults.max_agents exists:
        LOG WARNING "Invalid fan_out.defaults.max_agents, using default 8"
      IF state.fan_out.defaults.timeout_per_chunk_ms is integer AND value > 0:
        config.timeout_per_chunk_ms = state.fan_out.defaults.timeout_per_chunk_ms
      ELSE IF state.fan_out.defaults.timeout_per_chunk_ms exists:
        LOG WARNING "Invalid timeout_per_chunk_ms, using default 600000"

  // Step 3: Apply per-phase overrides (if present)
  IF state.fan_out.phase_overrides[current_phase] exists AND is object:
    override = state.fan_out.phase_overrides[current_phase]
    IF override.enabled is boolean:
      config.enabled = override.enabled
    IF override.max_agents is integer AND 1 <= value <= 8:
      config.max_agents = override.max_agents
    IF override.strategy is "round-robin" OR "group-by-directory":
      config.strategy = override.strategy
    // Phase-specific fields
    APPLY_PHASE_SPECIFIC_OVERRIDES(config, override, current_phase)

  // Step 4: CLI flag override (highest precedence)
  IF state.active_workflow AND state.active_workflow.flags AND state.active_workflow.flags.no_fan_out === true:
    config.enabled = false

  RETURN config

FUNCTION APPLY_PHASE_SPECIFIC_OVERRIDES(config, override, phase):
  IF phase == "16-quality-loop":
    IF override.tests_per_agent is integer AND value >= 1:
      config.items_per_agent = override.tests_per_agent
    IF override.min_tests_threshold is integer AND value >= 1:
      config.min_threshold = override.min_tests_threshold
  ELSE IF phase == "08-code-review":
    IF override.files_per_agent is integer AND value >= 1:
      config.items_per_agent = override.files_per_agent
    IF override.min_files_threshold is integer AND value >= 1:
      config.min_threshold = override.min_files_threshold
```

### 4.2 Phase Defaults Table

```
PHASE_DEFAULTS = {
  "16-quality-loop": {
    strategy: "round-robin",
    items_per_agent: 250,
    min_threshold: 250
  },
  "08-code-review": {
    strategy: "group-by-directory",
    items_per_agent: 7,
    min_threshold: 5
  }
}
```

### 4.3 Precedence Summary

| Priority | Source | Effect |
|----------|--------|--------|
| 1 (highest) | `active_workflow.flags.no_fan_out` | Disables fan-out for entire workflow |
| 2 | `fan_out.phase_overrides[phase].enabled` | Per-phase enable/disable |
| 3 | `fan_out.enabled` | Global enable/disable |
| 4 (lowest) | Hardcoded defaults | Fan-out enabled, max 8 agents |

---

## 5. Validation Rules for Configuration

| Field | Type | Range | On Invalid |
|-------|------|-------|------------|
| `fan_out.enabled` | boolean | true/false | Default to `true` |
| `fan_out.defaults.max_agents` | integer | 1-8 | Default to `8`, log warning |
| `fan_out.defaults.timeout_per_chunk_ms` | integer | > 0 | Default to `600000`, log warning |
| `fan_out.phase_overrides[key]` | object | Must be object | Ignore if not object |
| `*.strategy` | string | "round-robin" or "group-by-directory" | Default to phase-specific, log warning |
| `*.tests_per_agent` | integer | >= 1 | Default to `250`, log warning |
| `*.min_tests_threshold` | integer | >= 1 | Default to `250`, log warning |
| `*.files_per_agent` | integer | >= 1 | Default to `7`, log warning |
| `*.min_files_threshold` | integer | >= 1 | Default to `5`, log warning |
| `*.max_agents` | integer | 1-8 | Default to `8`, log warning |

All validation failures use graceful degradation with defaults (Article X: Fail-Safe Defaults). No configuration error should prevent the workflow from proceeding.

---

## 6. AC-007-02 Resolution (workflows.json)

Per ADR-0002, workflows.json does not exist on disk and is not created for this feature. AC-007-02 ("Per-workflow overrides can be specified in workflows.json agent_modifiers") is satisfied by the `fan_out.phase_overrides` section in state.json instead. The per-phase override mechanism provides equivalent functionality without introducing a new configuration file.

**Deviation from requirements spec**: AC-007-02 references workflows.json, but the architecture decision (ADR-0002) explicitly chose state.json-only configuration. The deviation is documented and justified:
- workflows.json does not exist (impact analysis finding)
- Creating it introduces unnecessary complexity (Article V)
- state.json phase_overrides provides equivalent per-phase configuration
- The --no-fan-out flag provides per-workflow override capability

---

## 7. Traceability

| Design Element | Requirement | Acceptance Criteria |
|----------------|-------------|---------------------|
| --no-fan-out flag parsing | FR-007 | AC-007-03 |
| Flag stored in active_workflow.flags | FR-007 | AC-007-03 |
| state.json fan_out section | FR-007 | AC-007-01 |
| Per-phase overrides | FR-007 | AC-007-02 (via ADR-0002 deviation) |
| Config-not-applied-mid-workflow | FR-007 | AC-007-04 |
| Validation with defaults | Article X | Fail-safe defaults |
| Precedence resolution | FR-007 | AC-007-01, AC-007-03 |
