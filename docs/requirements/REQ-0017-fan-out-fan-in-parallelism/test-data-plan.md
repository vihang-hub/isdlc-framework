# Test Data Plan: Fan-Out/Fan-In Parallelism (REQ-0017)

**Phase**: 05-test-strategy
**Created**: 2026-02-15
**Author**: Test Design Engineer (Agent 05)
**Traces**: FR-001 through FR-007, NFR-001 through NFR-004

---

## 1. Overview

This document defines the test data requirements and generation approach for the fan-out/fan-in parallelism feature. Because the implementation is a markdown protocol (not executable code), test data consists of:

1. State.json configuration variants (for config tests)
2. Skills manifest file (real + mutated variants)
3. Markdown file content (real files read directly)
4. JSON validation payloads (from interface spec contracts)

All test data is generated within test setup functions -- no external data files required.

---

## 2. State.json Test Data Fixtures

### 2.1 Minimal State (No fan_out section)

```json
{
  "skill_enforcement": { "enabled": true, "mode": "observe" },
  "current_phase": "16-quality-loop",
  "active_workflow": {
    "type": "feature",
    "flags": {}
  }
}
```

**Used by**: TC-C01, TC-C04

### 2.2 Complete Fan-Out Config

```json
{
  "skill_enforcement": { "enabled": true, "mode": "observe" },
  "current_phase": "16-quality-loop",
  "active_workflow": {
    "type": "feature",
    "flags": {}
  },
  "fan_out": {
    "enabled": true,
    "defaults": {
      "max_agents": 4,
      "timeout_per_chunk_ms": 300000
    },
    "phase_overrides": {
      "16-quality-loop": {
        "enabled": true,
        "strategy": "round-robin",
        "tests_per_agent": 500,
        "min_tests_threshold": 300,
        "max_agents": 6
      },
      "08-code-review": {
        "enabled": true,
        "strategy": "group-by-directory",
        "files_per_agent": 10,
        "min_files_threshold": 8,
        "max_agents": 4
      }
    }
  }
}
```

**Used by**: TC-C02, TC-C07, TC-C08

### 2.3 no_fan_out Flag Set

```json
{
  "skill_enforcement": { "enabled": true, "mode": "observe" },
  "current_phase": "16-quality-loop",
  "active_workflow": {
    "type": "feature",
    "flags": {
      "no_fan_out": true
    }
  }
}
```

**Used by**: TC-C03

### 2.4 Boundary Values

```json
{
  "fan_out_min_agents": { "fan_out": { "defaults": { "max_agents": 1 } } },
  "fan_out_max_agents": { "fan_out": { "defaults": { "max_agents": 8 } } },
  "fan_out_disabled": { "fan_out": { "enabled": false } },
  "fan_out_phase_override_disabled": {
    "fan_out": {
      "enabled": true,
      "phase_overrides": {
        "08-code-review": { "enabled": false }
      }
    }
  }
}
```

**Used by**: TC-C05, TC-C06, TC-C09, TC-C10

---

## 3. Skills Manifest Test Data

### 3.1 Real Manifest (Post-Implementation)

The test reads the actual `skills-manifest.json` from `src/claude/hooks/config/`. After implementation, this file should contain:

- `ownership.quality-loop-engineer.skill_count`: 12
- `ownership.quality-loop-engineer.skills`: [..., "QL-012"]
- `skill_lookup["QL-012"]`: "quality-loop-engineer"
- `path_lookup["quality-loop/fan-out-engine"]`: "quality-loop-engineer"
- `total_skills`: 243

**Used by**: TC-M01 through TC-M06

### 3.2 Pre-Implementation Manifest (Negative Verification)

The test can verify the pre-implementation state by checking:
- QL-012 NOT present (before impl)
- skill_count is 11 (before impl)

This allows tests to be written before implementation and run both before (expected fail) and after (expected pass).

---

## 4. Markdown File Paths (Real Files)

Tests read these files directly from the source tree:

| File | Purpose | Tests |
|------|---------|-------|
| `src/claude/skills/quality-loop/fan-out-engine/SKILL.md` | Fan-out engine protocol definition | TC-P01 through TC-P05, TC-P14, TC-P15, TC-P17, TC-P18 |
| `src/claude/agents/16-quality-loop-engineer.md` | Phase 16 fan-out integration | TC-P06 through TC-P09, TC-P16, TC-P18 |
| `src/claude/agents/07-qa-engineer.md` | Phase 08 fan-out integration | TC-P10 through TC-P13 |
| `src/claude/commands/isdlc.md` | CLI flag parsing | TC-I08, TC-I09 |
| `src/claude/hooks/config/skills-manifest.json` | Skill registration | TC-M01 through TC-M06, TC-I01 |

### 4.1 Expected Content Patterns (Regex)

| Pattern | Description | Used by |
|---------|-------------|---------|
| `/#+\s.*[Ff]an.?[Oo]ut/` | Fan-out section header | TC-P06, TC-P10 |
| `/#+\s.*[Cc]hunk\s+[Ss]plitter/` | Chunk splitter section | TC-P02 |
| `/#+\s.*([Pp]arallel\s+)?[Ss]pawner/` | Spawner section | TC-P03 |
| `/#+\s.*([Rr]esult\s+)?[Mm]erger/` | Merger section | TC-P04 |
| `/QL-012/` | Skill ID reference | TC-P05, TC-I01, TC-I02 |
| `/250/` | Test threshold value | TC-P06, TC-I03 |
| `/\b5\b.*file/i` | File threshold value | TC-P10, TC-I04 |
| `/round-robin/` | Round-robin strategy | TC-P02, TC-I11 |
| `/group-by-directory/` | Directory grouping strategy | TC-P11, TC-I11 |
| `/Track\s*A/` | Track A reference | TC-P07 |
| `/union/i` | Union coverage aggregation | TC-P08 |
| `/cross.?cutting/i` | Cross-cutting concerns | TC-P12 |
| `/dedup/i` | Deduplication reference | TC-P04, TC-P13 |
| `/partial\s+(failure|result)/i` | Partial failure handling | TC-P14 |
| `/(below|threshold).*single.?agent/i` | Below-threshold skip | TC-P15 |
| `/--no-fan-out/` | CLI flag | TC-I08 |
| `/no_fan_out/` | State key | TC-I08 |
| `/fan_out_metadata/i` | Observability metadata | TC-P17, TC-I12 |
| `/5%|overhead/i` | Orchestration overhead | TC-P18 |

---

## 5. Validation Rules JSON Data

The `validation-rules.json` file in the artifact folder is read directly by integration tests to verify completeness. Expected structure:

- `configuration_validation.rules`: 10 rules (VR-CFG-001 through VR-CFG-010)
- `chunk_splitter_input_validation.rules`: 7 rules (VR-CS-001 through VR-CS-007)
- `chunk_splitter_output_validation.rules`: 5 rules (VR-CSO-001 through VR-CSO-005)
- `chunk_agent_result_validation.rules`: 10 rules (VR-CR-001 through VR-CR-010)
- `merged_result_validation.rules`: 7 rules (VR-MR-001 through VR-MR-007)
- `deduplication_validation.rules`: 3 rules (VR-DD-001 through VR-DD-003)
- `coverage_aggregation_validation.rules`: 3 rules (VR-COV-001 through VR-COV-003)

**Used by**: TC-I10

---

## 6. Data Generation Approach

| Data Type | Generation Method |
|-----------|------------------|
| State.json configs | Generated in `beforeEach()` via `setupTestEnv(overrides)` and `writeState()` |
| Skills manifest | Copied from real config dir by `setupTestEnv()` (post-implementation reads real file) |
| Markdown files | Read directly from `src/claude/` via `fs.readFileSync()` using `path.resolve(__dirname, ...)` |
| Validation rules JSON | Read directly from `docs/requirements/REQ-0017-fan-out-fan-in-parallelism/validation-rules.json` |

No external data generation tools needed. No fixture files required. All data is either inline in test functions or read from the actual source tree.

---

## 7. Sensitive Data

None. This feature has no user credentials, API keys, PII, or other sensitive data. All test data is synthetic configuration values and file path strings.
