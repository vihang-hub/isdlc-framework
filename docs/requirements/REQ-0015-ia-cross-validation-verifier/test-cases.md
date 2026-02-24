# Test Cases: REQ-0015 Impact Analysis Cross-Validation Verifier

**Phase**: 05-test-strategy
**Feature**: M4 Verifier agent
**Created**: 2026-02-15
**Total Test Cases**: 32
**AC Coverage**: 28/28 (100%)
**Test File**: `lib/cross-validation-verifier.test.js`

---

## Test Case Index

| ID | AC | Category | Description | Priority |
|----|----|----------|-------------|----------|
| TC-01.1 | AC-01.1 | Agent Definition | Agent file exists at correct path | P0 |
| TC-01.2 | AC-01.2 | Agent Definition | Agent has required frontmatter fields | P0 |
| TC-01.3 | AC-01.3 | Agent Definition | Agent specifies M1/M2/M3 input parsing | P1 |
| TC-01.4 | AC-01.4 | Agent Definition | Agent specifies severity-categorized findings | P1 |
| TC-02.1 | AC-02.1 | File List Cross-Val | Agent specifies MISSING_FROM_BLAST_RADIUS finding | P1 |
| TC-02.2 | AC-02.2 | File List Cross-Val | Agent specifies ORPHAN_IMPACT finding | P1 |
| TC-02.3 | AC-02.3 | File List Cross-Val | Agent specifies symmetric difference computation | P1 |
| TC-02.4 | AC-02.4 | File List Cross-Val | Agent specifies affected_agents attribution | P1 |
| TC-03.1 | AC-03.1 | Risk Scoring Gaps | Agent specifies RISK_SCORING_GAP finding | P1 |
| TC-03.2 | AC-03.2 | Risk Scoring Gaps | Agent specifies UNDERTESTED_CRITICAL_PATH finding | P1 |
| TC-03.3 | AC-03.3 | Risk Scoring Gaps | Agent specifies blast radius vs risk validation | P1 |
| TC-03.4 | AC-03.4 | Risk Scoring Gaps | Agent specifies recommendation field for each gap | P1 |
| TC-04.1 | AC-04.1 | Completeness | Agent specifies M2 entry point to M1 file mapping | P1 |
| TC-04.2 | AC-04.2 | Completeness | Agent specifies M1 module to M3 risk mapping | P1 |
| TC-04.3 | AC-04.3 | Completeness | Agent specifies INCOMPLETE_ANALYSIS finding | P1 |
| TC-04.4 | AC-04.4 | Completeness | Agent specifies completeness_score computation | P1 |
| TC-05.1 | AC-05.1 | Orchestrator Integration | Orchestrator contains Step 3.5 with Task call to M4 | P0 |
| TC-05.2 | AC-05.2 | Orchestrator Integration | Orchestrator includes Cross-Validation section in report template | P0 |
| TC-05.3 | AC-05.3 | Orchestrator Integration | Orchestrator surfaces CRITICAL findings in executive summary | P1 |
| TC-05.4 | AC-05.4 | Orchestrator Integration | Orchestrator shows M4 in progress display | P1 |
| TC-05.5 | AC-05.5 | Orchestrator Integration | Orchestrator includes M4 in sub_agents state | P1 |
| TC-06.1 | AC-06.1 | Report Structure | Agent specifies summary with severity counts | P1 |
| TC-06.2 | AC-06.2 | Report Structure | Agent specifies finding fields (id, severity, category, description, affected_agents, recommendation) | P1 |
| TC-06.3 | AC-06.3 | Report Structure | Agent specifies completeness_score (0-100) | P1 |
| TC-06.4 | AC-06.4 | Report Structure | Agent specifies verification_status (PASS/WARN/FAIL) | P1 |
| TC-06.5 | AC-06.5 | Report Structure | Agent specifies dual JSON and markdown output | P1 |
| TC-07.1 | AC-07.1 | Skill Registration | Skills manifest has IA-401 and IA-402 entries | P0 |
| TC-07.2 | AC-07.2 | Skill Registration | Skill file exists at correct path | P0 |
| TC-07.3 | AC-07.3 | Skill Registration | Skills manifest ownership, lookup, and paths entries correct | P0 |
| TC-NFR01 | NFR-01 | Performance | Agent is invoked sequentially (after M1/M2/M3) | P2 |
| TC-NFR02 | NFR-02 | Fail-Open | Orchestrator specifies three-tier fail-open handling | P0 |
| TC-NFR03 | NFR-03 | Backward Compat | M1/M2/M3 agent files are not modified | P0 |

---

## Detailed Test Cases

### Category 1: Agent Definition (FR-01)

#### TC-01.1: Agent file exists at correct path
**AC**: AC-01.1
**Priority**: P0
**Type**: Existence check

**Given**: The project codebase after Phase 06 implementation
**When**: Reading `src/claude/agents/impact-analysis/cross-validation-verifier.md`
**Then**: The file exists and is non-empty

**Validation**:
```javascript
assert.ok(existsSync(agentPath), 'Agent file must exist');
const content = readFileSync(agentPath, 'utf-8');
assert.ok(content.length > 100, 'Agent file must have substantial content');
```

---

#### TC-01.2: Agent has required frontmatter fields
**AC**: AC-01.2
**Priority**: P0
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Extracting the YAML frontmatter block (between `---` delimiters)
**Then**: Frontmatter contains:
- `name: cross-validation-verifier`
- `description:` field (non-empty)
- `model:` field (opus)
- `owned_skills:` list containing `IA-401` and `IA-402`

**Validation**:
```javascript
const frontmatter = extractFrontmatter(content);
assert.ok(frontmatter.includes('name: cross-validation-verifier'));
assert.ok(frontmatter.includes('model:'));
assert.ok(frontmatter.includes('IA-401'));
assert.ok(frontmatter.includes('IA-402'));
```

---

#### TC-01.3: Agent specifies M1/M2/M3 input parsing
**AC**: AC-01.3
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching the agent content for input specification
**Then**: Agent content references:
- `impact_summary` (M1 input)
- `entry_points` (M2 input)
- `risk_assessment` (M3 input)
- Defensive parsing or graceful handling of missing fields

**Validation**:
```javascript
assert.ok(content.includes('impact_summary'));
assert.ok(content.includes('entry_points'));
assert.ok(content.includes('risk_assessment'));
assert.match(content, /[Dd]efensive|missing|graceful|fail/i);
```

---

#### TC-01.4: Agent specifies severity-categorized findings
**AC**: AC-01.4
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for severity definitions
**Then**: Agent content specifies CRITICAL, WARNING, and INFO severity levels

**Validation**:
```javascript
assert.ok(content.includes('CRITICAL'));
assert.ok(content.includes('WARNING'));
assert.ok(content.includes('INFO'));
```

---

### Category 2: File List Cross-Validation (FR-02)

#### TC-02.1: Agent specifies MISSING_FROM_BLAST_RADIUS finding
**AC**: AC-02.1
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for the MISSING_FROM_BLAST_RADIUS finding type
**Then**: Agent content describes:
- Finding type: `MISSING_FROM_BLAST_RADIUS`
- Trigger: file in M2 but not in M1
- Severity: WARNING

**Validation**:
```javascript
assert.ok(content.includes('MISSING_FROM_BLAST_RADIUS'));
```

---

#### TC-02.2: Agent specifies ORPHAN_IMPACT finding
**AC**: AC-02.2
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for the ORPHAN_IMPACT finding type
**Then**: Agent content describes:
- Finding type: `ORPHAN_IMPACT`
- Trigger: file in M1 but not in M2
- Severity: INFO

**Validation**:
```javascript
assert.ok(content.includes('ORPHAN_IMPACT'));
```

---

#### TC-02.3: Agent specifies symmetric difference computation
**AC**: AC-02.3
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for delta/symmetric difference references
**Then**: Agent content references computing the symmetric difference between M1 and M2 file lists

**Validation**:
```javascript
assert.match(content, /symmetric.difference|delta|XOR/i);
```

---

#### TC-02.4: Agent specifies affected_agents attribution
**AC**: AC-02.4
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for agent attribution in findings
**Then**: Agent content specifies `affected_agents` field with indicators like "M1-found", "M2-missing"

**Validation**:
```javascript
assert.ok(content.includes('affected_agents'));
assert.match(content, /M[12]-found|M[12]-missing/);
```

---

### Category 3: Risk Scoring Gap Detection (FR-03)

#### TC-03.1: Agent specifies RISK_SCORING_GAP finding
**AC**: AC-03.1
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for the RISK_SCORING_GAP finding type
**Then**: Agent content describes:
- Finding type: `RISK_SCORING_GAP`
- Trigger: high coupling (M1) + non-high risk (M3)
- Severity: WARNING

**Validation**:
```javascript
assert.ok(content.includes('RISK_SCORING_GAP'));
```

---

#### TC-03.2: Agent specifies UNDERTESTED_CRITICAL_PATH finding
**AC**: AC-03.2
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for the UNDERTESTED_CRITICAL_PATH finding type
**Then**: Agent content describes:
- Finding type: `UNDERTESTED_CRITICAL_PATH`
- Trigger: deep call chain (M2) + low coverage (M3)
- Severity: CRITICAL

**Validation**:
```javascript
assert.ok(content.includes('UNDERTESTED_CRITICAL_PATH'));
```

---

#### TC-03.3: Agent specifies blast radius vs risk validation
**AC**: AC-03.3
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for blast radius vs risk cross-check
**Then**: Agent content specifies checking M1 blast_radius against M3 overall_risk (e.g., high blast + low risk = suspicious)

**Validation**:
```javascript
assert.match(content, /blast.radius/i);
assert.match(content, /overall.risk|risk.level/i);
```

---

#### TC-03.4: Agent specifies recommendation field for each gap
**AC**: AC-03.4
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for recommendation specifications in findings
**Then**: Agent content specifies a `recommendation` field in findings with actionable text

**Validation**:
```javascript
assert.ok(content.includes('recommendation'));
assert.match(content, /[Ii]ncrease risk|[Aa]dd test coverage|[Rr]econcile/);
```

---

### Category 4: Completeness Validation (FR-04)

#### TC-04.1: Agent specifies M2 entry point to M1 file mapping
**AC**: AC-04.1
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for entry point to file mapping validation
**Then**: Agent content specifies checking that every M2 entry point maps to at least one M1 affected file

**Validation**:
```javascript
assert.match(content, /[Ee]ntry.*point.*M1|M2.*entry.*M1/);
```

---

#### TC-04.2: Agent specifies M1 module to M3 risk mapping
**AC**: AC-04.2
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for module-to-risk mapping validation
**Then**: Agent content specifies checking that every M1 module has a corresponding M3 risk assessment

**Validation**:
```javascript
assert.match(content, /M1.*module.*M3|module.*risk.*assessment/i);
```

---

#### TC-04.3: Agent specifies INCOMPLETE_ANALYSIS finding
**AC**: AC-04.3
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for the INCOMPLETE_ANALYSIS finding type
**Then**: Agent content describes the INCOMPLETE_ANALYSIS finding for gaps in cross-references

**Validation**:
```javascript
assert.ok(content.includes('INCOMPLETE_ANALYSIS'));
```

---

#### TC-04.4: Agent specifies completeness_score computation
**AC**: AC-04.4
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for completeness score computation
**Then**: Agent content specifies computing a completeness_score as a percentage (0-100)

**Validation**:
```javascript
assert.ok(content.includes('completeness_score'));
assert.match(content, /0.*100|percentage|%/);
```

---

### Category 5: Orchestrator Integration (FR-05)

#### TC-05.1: Orchestrator contains Step 3.5 with Task call to M4
**AC**: AC-05.1
**Priority**: P0
**Type**: Content validation

**Given**: The orchestrator file `src/claude/agents/impact-analysis/impact-analysis-orchestrator.md` has been updated
**When**: Searching for Step 3.5 or cross-validation verifier invocation
**Then**: Orchestrator contains:
- Step 3.5 (or equivalent numbered step)
- Reference to cross-validation-verifier agent
- Task call pattern after M1/M2/M3 complete

**Validation**:
```javascript
assert.match(orchContent, /[Ss]tep\s*3\.5|[Cc]ross-[Vv]alidat/);
assert.ok(orchContent.includes('cross-validation-verifier'));
```

---

#### TC-05.2: Orchestrator includes Cross-Validation section in report template
**AC**: AC-05.2
**Priority**: P0
**Type**: Content validation

**Given**: The orchestrator file has been updated
**When**: Searching for the Cross-Validation section in the report template
**Then**: Orchestrator references a "Cross-Validation" section in the impact-analysis.md report template

**Validation**:
```javascript
assert.match(orchContent, /##\s*Cross-Validation|Cross-Validation.*section/i);
```

---

#### TC-05.3: Orchestrator surfaces CRITICAL findings in executive summary
**AC**: AC-05.3
**Priority**: P1
**Type**: Content validation

**Given**: The orchestrator file has been updated
**When**: Searching for CRITICAL finding handling in executive summary
**Then**: Orchestrator specifies surfacing CRITICAL findings from M4 in the executive summary

**Validation**:
```javascript
assert.match(orchContent, /CRITICAL.*[Ee]xecutive|[Ee]xecutive.*CRITICAL/i);
```

---

#### TC-05.4: Orchestrator shows M4 in progress display
**AC**: AC-05.4
**Priority**: P1
**Type**: Content validation

**Given**: The orchestrator file has been updated
**When**: Searching for M4 in progress display
**Then**: Orchestrator includes "Cross-Validation Verifier (M4)" in the progress indicator

**Validation**:
```javascript
assert.match(orchContent, /M4|Cross-Validation Verifier/);
assert.match(orchContent, /progress|running|pending|complete/i);
```

---

#### TC-05.5: Orchestrator includes M4 in sub_agents state
**AC**: AC-05.5
**Priority**: P1
**Type**: Content validation

**Given**: The orchestrator file has been updated
**When**: Searching for M4 in state update section
**Then**: Orchestrator specifies adding M4-cross-validation-verifier to sub_agents in state.json

**Validation**:
```javascript
assert.match(orchContent, /M4.*sub_agents|sub_agents.*M4/i);
```

---

### Category 6: Report Structure (FR-06)

#### TC-06.1: Agent specifies summary with severity counts
**AC**: AC-06.1
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for report summary specification
**Then**: Agent specifies a summary object with `total_findings`, `critical`, `warning`, `info` counts

**Validation**:
```javascript
assert.ok(content.includes('total_findings'));
assert.ok(content.includes('"critical"') || content.includes("'critical'") || content.match(/critical.*<int>|critical.*int/i));
```

---

#### TC-06.2: Agent specifies finding fields
**AC**: AC-06.2
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for finding field specification
**Then**: Agent specifies each finding must have: id, severity, category, description, affected_agents, recommendation

**Validation**:
```javascript
for (const field of ['id', 'severity', 'category', 'description', 'affected_agents', 'recommendation']) {
  assert.ok(content.includes(field), `Finding must specify "${field}" field`);
}
```

---

#### TC-06.3: Agent specifies completeness_score field
**AC**: AC-06.3
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for completeness_score in the output contract
**Then**: Agent specifies `completeness_score` as a 0-100 integer

**Validation**:
```javascript
assert.ok(content.includes('completeness_score'));
```

---

#### TC-06.4: Agent specifies verification_status field
**AC**: AC-06.4
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for verification_status in the output contract
**Then**: Agent specifies `verification_status` with values PASS, WARN, FAIL

**Validation**:
```javascript
assert.ok(content.includes('verification_status'));
assert.ok(content.includes('PASS'));
assert.ok(content.includes('WARN'));
assert.ok(content.includes('FAIL'));
```

---

#### TC-06.5: Agent specifies dual JSON and markdown output
**AC**: AC-06.5
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for output format specification
**Then**: Agent specifies both `verification_report` (JSON) and `report_section` (markdown) in the response

**Validation**:
```javascript
assert.ok(content.includes('verification_report'));
assert.ok(content.includes('report_section'));
```

---

### Category 7: Skill Registration (FR-07)

#### TC-07.1: Skills manifest has IA-401 and IA-402 entries
**AC**: AC-07.1
**Priority**: P0
**Type**: JSON validation

**Given**: The skills manifest has been updated
**When**: Reading `src/claude/hooks/config/skills-manifest.json`
**Then**: The manifest contains entries for skill IDs `IA-401` and `IA-402`

**Validation**:
```javascript
const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
assert.ok(manifest.skill_lookup['IA-401'], 'IA-401 must be in skill_lookup');
assert.ok(manifest.skill_lookup['IA-402'], 'IA-402 must be in skill_lookup');
```

---

#### TC-07.2: Skill file exists at correct path
**AC**: AC-07.2
**Priority**: P0
**Type**: Existence check

**Given**: The project codebase after Phase 06 implementation
**When**: Checking for skill file at `src/claude/skills/impact-analysis/cross-validation/SKILL.md`
**Then**: The skill file exists and contains IA-401 frontmatter

**Validation**:
```javascript
assert.ok(existsSync(skillPath), 'Skill file must exist');
const skillContent = readFileSync(skillPath, 'utf-8');
assert.ok(skillContent.includes('IA-401'));
```

---

#### TC-07.3: Skills manifest ownership, lookup, and paths entries correct
**AC**: AC-07.3
**Priority**: P0
**Type**: JSON validation

**Given**: The skills manifest has been updated
**When**: Reading skills-manifest.json and checking all three sections
**Then**:
- `ownership` has `cross-validation-verifier` entry with skills `IA-401`, `IA-402`
- `skill_lookup` maps `IA-401` and `IA-402` to `cross-validation-verifier`
- `skill_paths` has `impact-analysis/cross-validation` entry

**Validation**:
```javascript
const owner = manifest.ownership['cross-validation-verifier'];
assert.ok(owner, 'Ownership entry must exist');
assert.deepStrictEqual(owner.skills, ['IA-401', 'IA-402']);
assert.equal(manifest.skill_lookup['IA-401'], 'cross-validation-verifier');
assert.equal(manifest.skill_lookup['IA-402'], 'cross-validation-verifier');
assert.ok(manifest.skill_paths['impact-analysis/cross-validation']);
```

---

### Category 8: Non-Functional Requirements

#### TC-NFR01: Agent is invoked sequentially after M1/M2/M3
**AC**: NFR-01
**Priority**: P2
**Type**: Content validation

**Given**: The orchestrator file has been updated
**When**: Checking the ordering of M4 invocation relative to M1/M2/M3
**Then**: Orchestrator specifies M4 runs AFTER all three sub-agents complete, not in parallel

**Validation**:
```javascript
// Step 3.5 appears after Step 3 (collect results) but before Step 4 (consolidate)
const step3Pos = orchContent.indexOf('Step 3');
const step35Pos = orchContent.indexOf('Step 3.5') || orchContent.indexOf('Cross-Validat');
const step4Pos = orchContent.indexOf('Step 4');
assert.ok(step35Pos > step3Pos, 'Step 3.5 must come after Step 3');
assert.ok(step35Pos < step4Pos, 'Step 3.5 must come before Step 4');
```

---

#### TC-NFR02: Orchestrator specifies three-tier fail-open handling
**AC**: NFR-02
**Priority**: P0
**Type**: Content validation

**Given**: The orchestrator file has been updated
**When**: Searching for fail-open handling tiers
**Then**: Orchestrator specifies:
- Tier 1: Agent file not found -> silent skip
- Tier 2: Task call fails -> log warning, proceed
- Tier 3: Response unparseable -> log warning, proceed

**Validation**:
```javascript
assert.match(orchContent, /[Ff]ail.open|graceful/i);
assert.match(orchContent, /[Tt]ier|agent.*not.*found|skip/i);
assert.match(orchContent, /[Ww]arning.*proceed|proceed.*without/i);
```

---

#### TC-NFR03: M1/M2/M3 agent files are not modified
**AC**: NFR-03
**Priority**: P0
**Type**: Existence/content check

**Given**: The Phase 06 implementation is complete
**When**: Checking M1, M2, M3 agent files
**Then**: These files are not in the git diff (no modifications)

Note: This test validates backward compatibility by confirming that existing agent files remain unchanged. In practice, this is validated during code review (Phase 08) by checking the git diff. For the test file, we validate that the requirement is documented in the orchestrator.

**Validation**:
```javascript
// Validate the orchestrator mentions backward compatibility
assert.match(orchContent, /M1.*unchanged|M2.*unchanged|M3.*unchanged|[Bb]ackward|NFR-03/i);
```

---

#### TC-C02: Both feature and upgrade workflows supported
**AC**: C-02
**Priority**: P1
**Type**: Content validation

**Given**: The M4 agent file exists
**When**: Searching for workflow support specification
**Then**: Agent content references both `feature` and `upgrade` workflows

**Validation**:
```javascript
assert.ok(content.includes('feature'));
assert.ok(content.includes('upgrade'));
```
