# Requirements Specification: Project Skills Distillation

**Status**: Draft
**Confidence**: High
**Last Updated**: 2026-02-24
**Coverage**: 95%
**Source**: GitHub #88
**Slug**: REQ-0037-project-skills-distillation

---

## Business Context

Discovery is the AI's onboarding -- it analyzes the codebase, evaluates tests, maps features, and detects patterns. Today, that knowledge is stored as raw reports that agents can only access during a 24-hour freshness window via context injection in phases 02-03. After that window closes or after state.json is cleared by a build, the insights evaporate.

This feature converts discovery output into permanent, concise project skills that ride the SessionStart cache into every agent session indefinitely. Discovery knowledge becomes institutional knowledge -- always available, never stale until re-discovery.

Additionally, the current `rebuildSessionCache()` injects raw discovery reports (Section 9: DISCOVERY_CONTEXT) directly into the session cache. These raw reports are large (~22,700 chars combined) and become redundant once distilled project skills exist. Removing Section 9 reduces context budget while delivering better-structured, more actionable content.

### Problem Statement

1. Discovery output expires after an arbitrary 24-hour window, despite rarely changing between discovery runs
2. Discovery context injection is limited to phases 02-03, not universally available to all agents
3. Raw discovery reports consume ~22,700 characters of context budget without being optimized for agent consumption
4. No mechanism exists to convert discovery artifacts into persistent, structured, agent-consumable knowledge

### Success Criteria

- All agents in every session have access to distilled project knowledge via the SessionStart cache
- Discovery knowledge persists across sessions indefinitely until re-discovery
- Context budget is reduced compared to raw report injection
- Re-running discovery (full or incremental) updates project skills without affecting user-added skills

### Cost of Inaction

Agents continue to lose access to discovery knowledge after 24 hours or after builds clear state.json. They make decisions without awareness of the project's architecture, conventions, domain language, or test landscape -- leading to inconsistent output and repeated discovery of the same information.

---

## Stakeholders and Personas

### Primary: iSDLC Agents (All)
- **Interest**: Permanent access to project architecture, conventions, domain terminology, and test landscape in every session
- **Pain Point**: Discovery knowledge disappears after 24 hours; agents in phases outside 02-03 never see it at all
- **Workflow**: Agent starts session -> SessionStart hook injects cache -> cache includes project skills -> agent has institutional knowledge

### Secondary: Developer (Operator)
- **Interest**: Idempotent discovery that doesn't clobber manually added skills; reduced context budget overhead
- **Pain Point**: Re-running discovery could overwrite user-added skills if not handled carefully
- **Workflow**: Runs `/discover` -> distillation produces skills -> manifest updated -> skills persist until next discovery

---

## User Journeys

### Journey 1: First Discovery (Full)
1. Developer runs `/discover` on an existing project
2. Phase 1 analysis completes (D1, D2, D5, D6 in parallel)
3. Phases 2-4 complete (report, constitution, external skills)
4. After each source phase, the corresponding project skill is distilled:
   - D1 output -> `project-architecture.md` + `project-conventions.md`
   - D2 output -> `project-test-landscape.md`
   - D6 output -> `project-domain.md`
5. Skills registered in `external-skills-manifest.json` with `source: "discover"`
6. `rebuildSessionCache()` called after distillation completes
7. Next session: all agents see project skills in their context window

### Journey 2: Re-Discovery (Full)
1. Developer runs `/discover` again (full re-discovery)
2. All four source phases run (D1, D2, D6)
3. For each phase that ran: remove the corresponding discover-sourced skill entries from manifest, delete old skill files
4. Distill fresh skills from updated artifacts
5. Register new entries, rebuild cache
6. User-added skills (`source: "user"` or `source: "skills.sh"`) remain untouched

### Journey 3: Re-Discovery (Incremental)
1. Developer selects incremental re-discovery (re-runs D1, D2, D5, D6 only)
2. All four source phases run -> all four skills get refreshed
3. Constitution and skills.sh skills are skipped and remain intact
4. Distillation runs for all four skills (clean-slate per source phase)
5. Cache rebuilt

### Journey 4: Partial Phase Failure
1. Discovery runs, but D2 (test-evaluator) fails
2. D1, D6 succeed -> `project-architecture`, `project-conventions`, `project-domain` are distilled
3. `project-test-landscape` is silently skipped, warning logged
4. If a previous `project-test-landscape` existed and D2 ran (but failed): the old skill is removed (clean-slate for that phase)
5. If D2 was skipped entirely (not run): old `project-test-landscape` remains intact

### Journey 5: First Discovery (New Project)
1. Developer runs `/discover --new` for a new project
2. New project flow completes (vision, research, tech stack, PRD, architecture, constitution)
3. After D4 (skills-researcher): distillation runs for applicable artifacts
4. Skills registered, cache rebuilt

---

## Technical Context

### Existing Infrastructure (Already Built)
- `rebuildSessionCache()` in `common.cjs` (line 3960): Builds session cache with multiple sections, including Section 7 (EXTERNAL_SKILLS) that reads skill files from `.claude/skills/external/`
- `inject-session-cache.cjs`: SessionStart hook that reads cache and outputs to context window (REQ-0001, shipped)
- `loadExternalManifest()` / `writeExternalManifest()` in `common.cjs`: Read/write external skills manifest
- `resolveExternalManifestPath()` in `common.cjs`: Monorepo-aware manifest path resolution

### Section 9 Removal
- `rebuildSessionCache()` currently includes Section 9: DISCOVERY_CONTEXT (lines 4114-4131 in `common.cjs`)
- Loads raw `project-discovery-report.md` (~10,500 chars), `test-evaluation-report.md` (~6,800 chars), `reverse-engineer-report.md` (~5,400 chars) directly into cache
- Total: ~22,700 characters of raw, unstructured content
- Replaced by four distilled project skills (max 20,000 chars total, likely less)

### Dependencies
- GH-89 (OPEN): External skills manifest schema with `source` field -- required for idempotent-by-source behavior
- GH-81, GH-82, GH-84: Skill index infrastructure -- DONE
- GH-91: SessionStart cache injection hook -- DONE

### Integration Points
- `discover-orchestrator.md`: New inline distillation step added after each source phase completes
- `common.cjs`: Section 9 (DISCOVERY_CONTEXT) removed from `rebuildSessionCache()`
- `external-skills-manifest.json`: New entries with `source: "discover"` added
- `.claude/skills/external/`: Four new skill files written at runtime

---

## Quality Attributes and Risks

### Quality Attributes
- **Idempotency**: Re-running discovery produces identical results given identical source artifacts
- **Fail-open**: Failure in one skill distillation does not block others or the overall discovery flow
- **Context efficiency**: Distilled skills consume less context budget than raw reports
- **Universality**: All agents in all phases receive project skills via SessionStart cache

### Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Distillation quality varies across codebases | Medium | Medium | Clear, specific instructions in orchestrator markdown for each skill's structure |
| Source artifact missing or malformed | Low | Low | Fail-open: skip skill, log warning, continue |
| Manifest format mismatch with GH-89 changes | Medium | Medium | Document behavior requirement (idempotent by source), let implementation conform to GH-89's schema |
| Context budget exceeded if skills are too verbose | Low | Medium | 5,000 char hard limit per skill enforced in orchestrator instructions |

---

## Functional Requirements

### FR-001: Distillation Step in Discover Orchestrator
**Confidence**: High

Add an inline distillation step to the discover orchestrator that produces project skill files from discovery artifacts. The step runs as inline orchestrator logic (no new sub-agent). It executes after each source phase completes in both the existing project flow and new project flow.

**Acceptance Criteria**:

- **AC-001-01**: Distillation step exists as inline logic within `discover-orchestrator.md`, not as a separate sub-agent
- **AC-001-02**: In the existing project full discovery flow, distillation runs after each source phase (D1, D2, D6) completes
- **AC-001-03**: In the existing project incremental discovery flow, distillation runs for each source phase that executed
- **AC-001-04**: In the new project flow, distillation runs after Step 8b (D4 skills-researcher), before Step 9 (finalize)
- **AC-001-05**: If a source phase was skipped (not run), the corresponding project skill from a previous run remains intact
- **AC-001-06**: If a source phase ran but distillation fails for a skill, the skill is silently skipped with a warning logged

### FR-002: Four Fixed Project Skills
**Confidence**: High

The distillation step produces exactly four project skills, each mapped to specific source artifacts:

| Skill File | Skill ID | Source Phase | Source Artifacts |
|------------|----------|-------------|-----------------|
| `project-architecture.md` | PROJ-001 | D1 | Architecture analysis output |
| `project-conventions.md` | PROJ-002 | D1 | Pattern detection output |
| `project-domain.md` | PROJ-003 | D6 | Feature mapping, domain terminology |
| `project-test-landscape.md` | PROJ-004 | D2 | Test evaluation output |

This is a fixed, closed set. Adding a new project skill requires an explicit update to the distillation step.

**Acceptance Criteria**:

- **AC-002-01**: Exactly four skill files are produced on a successful full discovery: `project-architecture.md`, `project-conventions.md`, `project-domain.md`, `project-test-landscape.md`
- **AC-002-02**: Each skill file is written to `.claude/skills/external/`
- **AC-002-03**: Each skill file uses standard `.md` format with YAML frontmatter: `name`, `description`, `skill_id` (PROJ-001 through PROJ-004), `owner` (discover-orchestrator), `collaborators`, `project`, `version` (1.0.0), `when_to_use`, `dependencies`
- **AC-002-04**: Each skill file body contains structured, distilled content (not verbatim copies of source artifacts)
- **AC-002-05**: Each skill file body includes a provenance section identifying source artifacts and discovery timestamp
- **AC-002-06**: Each skill file is under 5,000 characters total (frontmatter + body)

### FR-003: Idempotent by Source Phase
**Confidence**: High

On re-discovery, the distillation step uses a clean-slate approach scoped to each source phase. Only skills whose source phase actually ran in this discovery are cleaned and re-distilled. Skills whose source phase was skipped remain intact from the previous run.

**Acceptance Criteria**:

- **AC-003-01**: When a source phase runs, all discover-sourced manifest entries tied to that phase are removed and their corresponding skill files deleted before distillation
- **AC-003-02**: When a source phase is skipped, its corresponding discover-sourced skills remain in the manifest and on disk
- **AC-003-03**: Skills with `source` other than `"discover"` (e.g., `"skills.sh"`, `"user"`) are never modified or deleted by the distillation step
- **AC-003-04**: After distillation, only successfully distilled skills are present in the manifest (no entries for failed distillations from the current run)

### FR-004: Manifest Registration
**Confidence**: High

Each successfully distilled skill is registered in `external-skills-manifest.json` with `source: "discover"` and bindings that inject the skill into all phases for all agents.

**Acceptance Criteria**:

- **AC-004-01**: Each distilled skill is registered in `external-skills-manifest.json` with `source: "discover"`
- **AC-004-02**: Each manifest entry includes bindings with `injection_mode: "always"` and `delivery_type: "context"`
- **AC-004-03**: Phase bindings include all workflow phases (not limited to specific phases)
- **AC-004-04**: Agent bindings are empty (meaning all agents)
- **AC-004-05**: Manifest write uses existing `writeExternalManifest()` infrastructure or equivalent

### FR-005: Cache Rebuild
**Confidence**: High

After all distillation is complete and the manifest is updated, the distillation step triggers a single `rebuildSessionCache()` call to regenerate the session cache with the new project skills.

**Acceptance Criteria**:

- **AC-005-01**: `rebuildSessionCache()` is called exactly once after all distillation and manifest updates are complete
- **AC-005-02**: The cache rebuild occurs after the manifest write (not before, not per-skill)
- **AC-005-03**: If `rebuildSessionCache()` fails, the distillation step continues (fail-open) -- the skill files and manifest are still valid

### FR-006: Fail-Open Behavior
**Confidence**: High

The distillation step follows fail-open semantics throughout. No single failure blocks the overall discovery flow or prevents other skills from being distilled.

**Acceptance Criteria**:

- **AC-006-01**: If the manifest cannot be read, distillation proceeds assuming an empty manifest
- **AC-006-02**: If a source artifact is missing or unreadable, the corresponding skill is skipped with a warning logged
- **AC-006-03**: If writing a skill file fails, the remaining skills are still attempted
- **AC-006-04**: If the manifest write fails, a warning is logged but discovery continues
- **AC-006-05**: If `rebuildSessionCache()` fails, a warning is logged but discovery continues
- **AC-006-06**: No failure in the distillation step prevents the discovery workflow from proceeding to the next step (walkthrough/finalize)

### FR-007: Remove Section 9 from rebuildSessionCache()
**Confidence**: High

Remove Section 9 (DISCOVERY_CONTEXT) from the `rebuildSessionCache()` function in `common.cjs`. This section currently loads raw discovery reports directly into the session cache, which becomes redundant once project skills provide distilled versions of the same information.

**Acceptance Criteria**:

- **AC-007-01**: Section 9 (DISCOVERY_CONTEXT) is removed from `rebuildSessionCache()` in `common.cjs`
- **AC-007-02**: The three raw report files (`project-discovery-report.md`, `test-evaluation-report.md`, `reverse-engineer-report.md`) are no longer injected into the session cache
- **AC-007-03**: Section 7 (EXTERNAL_SKILLS) continues to function and now serves as the sole delivery mechanism for discovery knowledge via project skills
- **AC-007-04**: Existing tests for `rebuildSessionCache()` are updated to reflect the section removal

### FR-008: LLM Summarization (Not Programmatic)
**Confidence**: High

The distillation logic uses LLM summarization to produce skill file content. The orchestrator's markdown instructions define what source artifacts to read, what structure to produce, and the constraints. There is no programmatic content extraction or templating.

**Acceptance Criteria**:

- **AC-008-01**: The orchestrator markdown contains clear instructions for reading each source artifact
- **AC-008-02**: The orchestrator markdown defines the expected output structure for each of the four skills
- **AC-008-03**: The orchestrator markdown specifies the 5,000 character limit constraint
- **AC-008-04**: The orchestrator markdown specifies the provenance section requirement
- **AC-008-05**: No programmatic extraction code is added (no new `.js` or `.cjs` files for content extraction)

---

## Out of Scope

- **Removal of 24-hour staleness mechanism**: Tracked separately in GH-90
- **External manifest schema changes (source field)**: Tracked separately in GH-89 (dependency)
- **Extensible/dynamic skill set**: Skills are a fixed set of four; no registry or auto-generation from new sub-agents
- **Per-phase binding differentiation**: All four skills bound to all phases
- **Programmatic content extraction**: Distillation is LLM-based, not templated
- **New sub-agent for distillation**: Handled as inline orchestrator logic

---

## MoSCoW Prioritization

### Must Have
- **FR-001**: Distillation step in discover orchestrator
- **FR-002**: Four fixed project skills with correct format
- **FR-003**: Idempotent by source phase
- **FR-004**: Manifest registration with `source: "discover"`
- **FR-005**: Cache rebuild after distillation
- **FR-006**: Fail-open behavior

### Should Have
- **FR-007**: Remove Section 9 from `rebuildSessionCache()`
- **FR-008**: LLM summarization instructions in orchestrator markdown

### Could Have
- (none identified)

### Won't Have
- Extensible skill set / auto-registration
- Per-agent or per-phase binding configuration
- Programmatic content extraction
- New sub-agent

---

## Dependencies Between Requirements

```
FR-001 (distillation step)
  ├── FR-002 (skill files) -- distillation produces these
  ├── FR-003 (idempotency) -- governs re-run behavior
  ├── FR-004 (manifest) -- registration after write
  ├── FR-005 (cache rebuild) -- triggered after manifest
  └── FR-006 (fail-open) -- applies to all of the above

FR-007 (Section 9 removal) -- independent but related; should ship together
FR-008 (LLM instructions) -- provides the content for FR-001/FR-002

External:
  GH-89 (manifest source field) -- blocks FR-003 and FR-004
```

---

## Pending Sections

None -- all sections complete.
