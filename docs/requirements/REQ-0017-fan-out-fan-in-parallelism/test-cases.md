# Test Cases: Fan-Out/Fan-In Parallelism (REQ-0017)

**Phase**: 05-test-strategy
**Created**: 2026-02-15
**Author**: Test Design Engineer (Agent 05)
**Traces**: FR-001 through FR-007, NFR-001 through NFR-004
**Total Test Cases**: 46

---

## Test File 1: test-fan-out-manifest.test.cjs (6 tests)

### Purpose
Validate that the skills-manifest.json has the correct QL-012 skill registration after implementation.

### TC-M01: QL-012 in quality-loop-engineer skills array
**Requirement**: FR-001 (AC-001-04)
**Priority**: P0 (Critical -- manifest corruption blocks workflows)
**Preconditions**: skills-manifest.json exists in config directory
**Steps**:
1. Read skills-manifest.json from `src/claude/hooks/config/`
2. Access `ownership["quality-loop-engineer"].skills`
3. Assert array includes `"QL-012"`
**Expected**: `"QL-012"` is present in the skills array
**Type**: Unit

### TC-M02: skill_count updated to 12
**Requirement**: FR-001 (AC-001-04)
**Priority**: P0
**Preconditions**: skills-manifest.json exists
**Steps**:
1. Read skills-manifest.json
2. Access `ownership["quality-loop-engineer"].skill_count`
3. Assert value equals 12
**Expected**: skill_count is 12 (was 11)
**Type**: Unit

### TC-M03: QL-012 in skill_lookup
**Requirement**: FR-001 (AC-001-04)
**Priority**: P0
**Preconditions**: skills-manifest.json exists
**Steps**:
1. Read skills-manifest.json
2. Access `skill_lookup["QL-012"]`
3. Assert value equals `"quality-loop-engineer"`
**Expected**: QL-012 maps to quality-loop-engineer
**Type**: Unit

### TC-M04: fan-out-engine in path_lookup
**Requirement**: FR-001 (AC-001-04)
**Priority**: P0
**Preconditions**: skills-manifest.json exists
**Steps**:
1. Read skills-manifest.json
2. Access `path_lookup["quality-loop/fan-out-engine"]`
3. Assert value equals `"quality-loop-engineer"`
**Expected**: Path maps to quality-loop-engineer
**Type**: Unit

### TC-M05: total_skills incremented to 243
**Requirement**: FR-001 (AC-001-04)
**Priority**: P1
**Preconditions**: skills-manifest.json exists
**Steps**:
1. Read skills-manifest.json
2. Access top-level `total_skills`
3. Assert value equals 243
**Expected**: total_skills reflects the addition of QL-012
**Type**: Unit

### TC-M06: QL skills array is sequential (QL-001 through QL-012)
**Requirement**: FR-001 (AC-001-04)
**Priority**: P2
**Preconditions**: skills-manifest.json exists
**Steps**:
1. Read skills-manifest.json
2. Access `ownership["quality-loop-engineer"].skills`
3. Assert array contains QL-001 through QL-012 in order
4. Assert no gaps in the sequence
**Expected**: Sequential QL-001 to QL-012 with no missing entries
**Type**: Unit

---

## Test File 2: test-fan-out-config.test.cjs (10 tests)

### Purpose
Validate the state.json fan_out configuration section and the --no-fan-out flag behavior.

### TC-C01: Default config when fan_out section absent
**Requirement**: FR-007 (AC-007-01)
**Priority**: P0 (Critical -- default behavior must work)
**Preconditions**: state.json has active_workflow but no fan_out section
**Steps**:
1. Create state.json via setupTestEnv with no fan_out section
2. Read state.json
3. Assert `fan_out` key is undefined or absent
4. Verify that absence of fan_out means defaults apply (per validation-rules.json VR-CFG-001 through VR-CFG-010)
**Expected**: Missing fan_out section is valid -- defaults apply
**Type**: Unit

### TC-C02: Complete fan_out config is valid JSON
**Requirement**: FR-007 (AC-007-01)
**Priority**: P0
**Preconditions**: state.json with complete fan_out section
**Steps**:
1. Create state.json with fan_out section containing: enabled=true, defaults.max_agents=4, defaults.timeout_per_chunk_ms=300000, phase_overrides for both phases
2. Read back state.json
3. Assert all fields are present with correct types
**Expected**: Full fan_out config is parseable and type-correct
**Type**: Unit

### TC-C03: no_fan_out flag set in active_workflow.flags
**Requirement**: FR-007 (AC-007-03)
**Priority**: P0
**Preconditions**: state.json with active_workflow
**Steps**:
1. Create state.json with `active_workflow.flags.no_fan_out = true`
2. Read state.json
3. Assert `active_workflow.flags.no_fan_out === true`
**Expected**: Flag correctly persists as boolean true
**Type**: Unit

### TC-C04: no_fan_out flag absent means fan-out enabled
**Requirement**: FR-007 (AC-007-03), NFR-003
**Priority**: P0
**Preconditions**: state.json with active_workflow.flags but no no_fan_out key
**Steps**:
1. Create state.json with `active_workflow.flags = {}`
2. Read state.json
3. Assert `active_workflow.flags.no_fan_out` is undefined
4. Verify that undefined means fan-out is NOT disabled
**Expected**: Absent flag means fan-out remains enabled (backward compatible)
**Type**: Unit

### TC-C05: max_agents value 1 (minimum boundary)
**Requirement**: FR-007 (AC-007-01)
**Priority**: P1
**Preconditions**: state.json with fan_out.defaults.max_agents = 1
**Steps**:
1. Create state.json with fan_out.defaults.max_agents = 1
2. Read and validate
3. Assert value is 1 (minimum valid)
**Expected**: max_agents = 1 is valid (effectively disables parallelism but not an error)
**Type**: Unit (boundary)

### TC-C06: max_agents value 8 (maximum boundary)
**Requirement**: FR-007 (AC-007-01)
**Priority**: P1
**Preconditions**: state.json with fan_out.defaults.max_agents = 8
**Steps**:
1. Create state.json with fan_out.defaults.max_agents = 8
2. Read and validate
3. Assert value is 8 (maximum valid)
**Expected**: max_agents = 8 is valid
**Type**: Unit (boundary)

### TC-C07: Phase 16 override config structure
**Requirement**: FR-007 (AC-007-01, AC-007-02)
**Priority**: P1
**Preconditions**: state.json with Phase 16 override
**Steps**:
1. Create state.json with `fan_out.phase_overrides["16-quality-loop"] = { enabled: true, strategy: "round-robin", tests_per_agent: 500, min_tests_threshold: 300, max_agents: 6 }`
2. Read and validate all fields present and type-correct
**Expected**: Phase 16 override section has all expected fields
**Type**: Unit

### TC-C08: Phase 08 override config structure
**Requirement**: FR-007 (AC-007-01, AC-007-02)
**Priority**: P1
**Preconditions**: state.json with Phase 08 override
**Steps**:
1. Create state.json with `fan_out.phase_overrides["08-code-review"] = { enabled: true, strategy: "group-by-directory", files_per_agent: 10, min_files_threshold: 8, max_agents: 4 }`
2. Read and validate all fields present and type-correct
**Expected**: Phase 08 override section has all expected fields
**Type**: Unit

### TC-C09: fan_out.enabled = false disables fan-out globally
**Requirement**: FR-007 (AC-007-01)
**Priority**: P0
**Preconditions**: state.json with fan_out.enabled = false
**Steps**:
1. Create state.json with fan_out.enabled = false
2. Read state.json
3. Assert fan_out.enabled === false
**Expected**: Global disable flag correctly persists
**Type**: Unit

### TC-C10: Per-phase override can disable fan-out for one phase only
**Requirement**: FR-007 (AC-007-02)
**Priority**: P1
**Preconditions**: state.json with global enabled=true but Phase 08 override enabled=false
**Steps**:
1. Create state.json with fan_out.enabled = true, fan_out.phase_overrides["08-code-review"].enabled = false
2. Read state.json
3. Assert fan_out.enabled === true (global)
4. Assert fan_out.phase_overrides["08-code-review"].enabled === false
**Expected**: Per-phase disable is independent of global enable
**Type**: Unit

---

## Test File 3: test-fan-out-protocol.test.cjs (18 tests)

### Purpose
Validate that the agent markdown files contain all required fan-out protocol sections, thresholds, and contract references.

### TC-P01: SKILL.md file exists at expected path
**Requirement**: FR-001 (AC-001-04)
**Priority**: P0
**Preconditions**: Implementation complete
**Steps**:
1. Check file exists at `src/claude/skills/quality-loop/fan-out-engine/SKILL.md`
**Expected**: File exists
**Type**: Content validation

### TC-P02: SKILL.md contains chunk splitter section
**Requirement**: FR-002
**Priority**: P0
**Preconditions**: SKILL.md exists
**Steps**:
1. Read SKILL.md
2. Assert content contains a section header matching "Chunk Splitter" (case-insensitive)
3. Assert section contains "round-robin" and "group-by-directory"
**Expected**: Chunk splitter section present with both strategy names
**Type**: Content validation

### TC-P03: SKILL.md contains parallel spawner section
**Requirement**: FR-003
**Priority**: P0
**Preconditions**: SKILL.md exists
**Steps**:
1. Read SKILL.md
2. Assert content contains a section header matching "Parallel Spawner" or "Spawner"
3. Assert section contains "Task" (referring to Task tool calls)
**Expected**: Spawner section present referencing Task tool
**Type**: Content validation

### TC-P04: SKILL.md contains result merger section
**Requirement**: FR-004
**Priority**: P0
**Preconditions**: SKILL.md exists
**Steps**:
1. Read SKILL.md
2. Assert content contains a section header matching "Result Merger" or "Merger"
3. Assert section contains "dedup" or "deduplicate" (per FR-004 AC-004-03)
**Expected**: Merger section present with deduplication reference
**Type**: Content validation

### TC-P05: SKILL.md references QL-012 skill ID
**Requirement**: FR-001 (AC-001-04)
**Priority**: P0
**Preconditions**: SKILL.md exists
**Steps**:
1. Read SKILL.md
2. Assert content contains "QL-012"
**Expected**: Skill ID QL-012 referenced in the file
**Type**: Content validation

### TC-P06: Phase 16 agent contains fan-out decision tree
**Requirement**: FR-005 (AC-005-01, AC-005-07)
**Priority**: P0
**Preconditions**: 16-quality-loop-engineer.md exists
**Steps**:
1. Read `src/claude/agents/16-quality-loop-engineer.md`
2. Assert contains section with "fan-out" or "Fan-Out" in a header
3. Assert contains "decision tree" or decision flow logic
4. Assert contains threshold value "250" (min test threshold)
**Expected**: Fan-out decision tree present with 250-test threshold
**Type**: Content validation

### TC-P07: Phase 16 agent references Track A only
**Requirement**: FR-005 (AC-005-06)
**Priority**: P0
**Preconditions**: 16-quality-loop-engineer.md exists
**Steps**:
1. Read 16-quality-loop-engineer.md
2. Find fan-out protocol section
3. Assert the fan-out instructions reference "Track A" (not Track B)
4. Assert "Track B" is explicitly excluded or noted as "not affected" near fan-out context
**Expected**: Fan-out applies only to Track A; Track B exclusion documented
**Type**: Content validation

### TC-P08: Phase 16 agent specifies coverage aggregation as union
**Requirement**: FR-005 (AC-005-05)
**Priority**: P1
**Preconditions**: 16-quality-loop-engineer.md exists
**Steps**:
1. Read 16-quality-loop-engineer.md
2. Assert contains "union" in coverage aggregation context (not "average")
**Expected**: Coverage is aggregated as union of covered lines
**Type**: Content validation

### TC-P09: Phase 16 agent max agents is 8
**Requirement**: FR-005 (AC-005-01), FR-002 (AC-002-03)
**Priority**: P1
**Preconditions**: 16-quality-loop-engineer.md exists
**Steps**:
1. Read 16-quality-loop-engineer.md
2. Assert contains "maximum" or "max" in proximity to "8" within fan-out section
**Expected**: Maximum 8 agents specified
**Type**: Content validation

### TC-P10: Phase 08 agent contains fan-out decision tree
**Requirement**: FR-006 (AC-006-01, AC-006-06)
**Priority**: P0
**Preconditions**: 07-qa-engineer.md exists
**Steps**:
1. Read `src/claude/agents/07-qa-engineer.md`
2. Assert contains section with "fan-out" or "Fan-Out" in a header
3. Assert contains threshold value "5" (min file threshold)
**Expected**: Fan-out section present with 5-file threshold
**Type**: Content validation

### TC-P11: Phase 08 agent specifies group-by-directory strategy
**Requirement**: FR-006 (AC-006-01)
**Priority**: P0
**Preconditions**: 07-qa-engineer.md exists
**Steps**:
1. Read 07-qa-engineer.md
2. Assert contains "group-by-directory" in fan-out section
**Expected**: Group-by-directory strategy specified for Phase 08
**Type**: Content validation

### TC-P12: Phase 08 agent specifies cross-cutting concerns section
**Requirement**: FR-006 (AC-006-07)
**Priority**: P1
**Preconditions**: 07-qa-engineer.md exists
**Steps**:
1. Read 07-qa-engineer.md
2. Assert contains "cross-cutting" or "Cross-Cutting" reference in fan-out section
**Expected**: Cross-cutting concerns handling documented
**Type**: Content validation

### TC-P13: Phase 08 agent specifies deduplication for findings
**Requirement**: FR-006 (AC-006-05), FR-004 (AC-004-03)
**Priority**: P1
**Preconditions**: 07-qa-engineer.md exists
**Steps**:
1. Read 07-qa-engineer.md
2. Assert contains "dedup" or "deduplicate" or "Deduplication" in fan-out section
**Expected**: Finding deduplication documented
**Type**: Content validation

### TC-P14: SKILL.md documents partial failure handling
**Requirement**: NFR-002
**Priority**: P0
**Preconditions**: SKILL.md exists
**Steps**:
1. Read SKILL.md
2. Assert contains reference to partial failure, degraded result, or "N-1 results"
**Expected**: Partial failure recovery is documented in the protocol
**Type**: Content validation

### TC-P15: SKILL.md documents below-threshold skip behavior
**Requirement**: NFR-003
**Priority**: P0
**Preconditions**: SKILL.md exists
**Steps**:
1. Read SKILL.md
2. Assert contains "below" or "threshold" and "single-agent" or "skip" in proximity
**Expected**: Below-threshold fallback to single-agent documented
**Type**: Content validation

### TC-P16: Phase 16 agent chunk spawner includes read-only constraints
**Requirement**: FR-003 (AC-003-05), FR-005
**Priority**: P1
**Preconditions**: 16-quality-loop-engineer.md exists
**Steps**:
1. Read 16-quality-loop-engineer.md
2. Assert fan-out section contains "Do NOT write to" or "read-only" or "state.json" constraint
**Expected**: Chunk agent read-only sandbox constraints present
**Type**: Content validation

### TC-P17: SKILL.md documents observability / skill usage logging
**Requirement**: NFR-004
**Priority**: P1
**Preconditions**: SKILL.md exists
**Steps**:
1. Read SKILL.md
2. Assert contains "skill_usage_log" or "observability" or "fan_out_metadata"
**Expected**: Observability requirements documented
**Type**: Content validation

### TC-P18: NFR-001 orchestration overhead limit documented
**Requirement**: NFR-001
**Priority**: P2
**Preconditions**: SKILL.md or Phase 16 agent
**Steps**:
1. Read SKILL.md and 16-quality-loop-engineer.md
2. Assert one or both contain "5%" or "overhead" reference
**Expected**: Orchestration overhead limit is specified in protocol
**Type**: Content validation

---

## Test File 4: test-fan-out-integration.test.cjs (12 tests)

### Purpose
Cross-component consistency validation. Verify that all modified files reference each other correctly and threshold values are consistent.

### TC-I01: Phase 16 agent references QL-012 skill
**Requirement**: FR-001, FR-005
**Priority**: P0
**Preconditions**: 16-quality-loop-engineer.md modified
**Steps**:
1. Read 16-quality-loop-engineer.md
2. Assert contains "QL-012" reference
3. Read skills-manifest.json
4. Assert QL-012 maps to quality-loop-engineer
**Expected**: Phase 16 agent and manifest agree on QL-012 ownership
**Type**: Integration

### TC-I02: Phase 08 agent references QL-012 or fan-out-engine skill
**Requirement**: FR-001, FR-006
**Priority**: P0
**Preconditions**: 07-qa-engineer.md modified
**Steps**:
1. Read 07-qa-engineer.md
2. Assert contains "QL-012" or "fan-out" skill reference
**Expected**: Phase 08 agent references the shared engine
**Type**: Integration

### TC-I03: Phase 16 test threshold matches across spec and agent
**Requirement**: FR-005 (AC-005-01, AC-005-07)
**Priority**: P0
**Preconditions**: Both files exist
**Steps**:
1. Read requirements-spec.md, extract threshold "250" for tests
2. Read 16-quality-loop-engineer.md
3. Assert agent file also specifies 250 as threshold
**Expected**: 250-test threshold consistent between spec and implementation
**Type**: Integration

### TC-I04: Phase 08 file threshold matches across spec and agent
**Requirement**: FR-006 (AC-006-01, AC-006-06)
**Priority**: P0
**Preconditions**: Both files exist
**Steps**:
1. Read requirements-spec.md, extract threshold "5" for files
2. Read 07-qa-engineer.md
3. Assert agent file specifies 5 as minimum file threshold
**Expected**: 5-file threshold consistent between spec and implementation
**Type**: Integration

### TC-I05: Max agents (8) consistent across all files
**Requirement**: FR-002 (AC-002-03), FR-003 (AC-003-03)
**Priority**: P1
**Preconditions**: All files exist
**Steps**:
1. Read requirements-spec.md -- confirm max 8
2. Read interface-spec.md -- confirm max_chunks default 8
3. Read SKILL.md -- confirm max 8
4. Read 16-quality-loop-engineer.md -- confirm max 8
5. Read 07-qa-engineer.md -- confirm max 8
**Expected**: Maximum 8 agents consistently specified everywhere
**Type**: Integration

### TC-I06: Merged output format backward compatible with gate-blocker
**Requirement**: NFR-003, FR-004
**Priority**: P0
**Preconditions**: Interface spec exists
**Steps**:
1. Read interface-spec.md merged output schema (Section 5.2)
2. Assert `all_tests_passing`, `lint_passing`, `type_check_passing`, `coverage_percent`, `test_summary`, `failures` fields are present
3. Assert `fan_out_summary` is documented as additive (gate-blocker ignores unknown fields)
**Expected**: All existing gate-blocker fields preserved; new fields are additive only
**Type**: Integration

### TC-I07: SKILL.md version matches interface spec version
**Requirement**: FR-001
**Priority**: P2
**Preconditions**: Both files exist
**Steps**:
1. Read SKILL.md, extract version (should be 1.0.0)
2. Read interface-spec.md Section 9, extract version (1.0.0)
3. Assert versions match
**Expected**: Both documents specify version 1.0.0
**Type**: Integration

### TC-I08: isdlc.md flag parsing section includes --no-fan-out
**Requirement**: FR-007 (AC-007-03)
**Priority**: P0
**Preconditions**: isdlc.md modified
**Steps**:
1. Read `src/claude/commands/isdlc.md`
2. Assert contains "--no-fan-out" in the flag parsing section
3. Assert contains "no_fan_out" (the state key name)
**Expected**: --no-fan-out flag documented in command spec
**Type**: Integration

### TC-I09: isdlc.md flag table includes --no-fan-out row
**Requirement**: FR-007 (AC-007-03)
**Priority**: P1
**Preconditions**: isdlc.md modified
**Steps**:
1. Read isdlc.md
2. Assert the flag documentation table contains a row with `--no-fan-out`
**Expected**: Flag documented in the flag table
**Type**: Integration

### TC-I10: validation-rules.json covers all config fields
**Requirement**: FR-007
**Priority**: P1
**Preconditions**: validation-rules.json exists
**Steps**:
1. Read validation-rules.json
2. Assert configuration_validation.rules covers: enabled, max_agents, timeout_per_chunk_ms, strategy, tests_per_agent, min_tests_threshold, files_per_agent, min_files_threshold, no_fan_out
3. Count rules >= 10
**Expected**: All fan_out config fields have validation rules
**Type**: Integration

### TC-I11: Phase 16 and Phase 08 use different default strategies
**Requirement**: FR-005 (AC-005-01), FR-006 (AC-006-01)
**Priority**: P1
**Preconditions**: Agent files exist
**Steps**:
1. Read 16-quality-loop-engineer.md, verify "round-robin" strategy
2. Read 07-qa-engineer.md, verify "group-by-directory" strategy
3. Assert strategies are different
**Expected**: Phase 16 uses round-robin; Phase 08 uses group-by-directory
**Type**: Integration

### TC-I12: Observability log entry schema includes fan_out_metadata
**Requirement**: NFR-004
**Priority**: P1
**Preconditions**: Interface spec and SKILL.md exist
**Steps**:
1. Read interface-spec.md Section 7.1
2. Assert documents `fan_out_metadata` in skill_usage_log entry
3. Assert metadata includes: skill_id, chunk_count, total_items, strategy, degraded
**Expected**: Observability log entry fully specified
**Type**: Integration

---

## Summary

| Test File | Test Count | Priority Breakdown |
|-----------|-----------|-------------------|
| test-fan-out-manifest.test.cjs | 6 | 4xP0, 1xP1, 1xP2 |
| test-fan-out-config.test.cjs | 10 | 4xP0, 5xP1, 1xP2 |
| test-fan-out-protocol.test.cjs | 18 | 8xP0, 7xP1, 3xP2 |
| test-fan-out-integration.test.cjs | 12 | 5xP0, 5xP1, 2xP2 |
| **TOTAL** | **46** | **21xP0, 18xP1, 7xP2** |

All 7 FRs and 4 NFRs have at least one P0 test case. No P3 tests (all requirements are critical or high for a protocol-level feature).
