# Interface Specification: REQ-0003 - Suggested Prompts Format

**Artifact ID:** REQ-0003-suggested-prompts
**Phase:** 04 - Design
**Created:** 2026-02-08
**Status:** Final

---

## 1. Prompt Block Format Specification

### 1.1 Canonical Format (Phase Agents and Sub-Orchestrators)

All prompt blocks emitted by phase agents and sub-orchestrators MUST follow this exact format:

```
---
SUGGESTED NEXT STEPS:
  [1] {primary_action}
  [2] {alternative_action}
  [3] {utility_action}
---
```

### 1.2 Format Rules

| Rule | Specification | ADR |
|------|---------------|-----|
| **Delimiter** | Three hyphens `---` on their own line, no leading/trailing whitespace | ADR-004 |
| **Header** | `SUGGESTED NEXT STEPS:` -- exact string, uppercase, with trailing colon | ADR-004 |
| **Item prefix** | Two spaces + `[N]` + one space + action text | ADR-004 |
| **Numbering** | Sequential starting at 1, no gaps | ADR-003 |
| **Item count** | Minimum 2, maximum 4 items per block | ADR-003 |
| **Character set** | ASCII only -- no Unicode, no emoji, no box-drawing characters | NFR-005 |
| **Line endings** | LF only (not CRLF) | NFR-005 |
| **Placement** | Last block in agent output, after all other content | ADR-001 |
| **Blank lines** | No blank lines between delimiter, header, items, and closing delimiter | ADR-004 |

### 1.3 Minimal Format (Sub-Agents)

Sub-agents emit a single-line status, not a multi-option block:

```
---
STATUS: {task_description} complete. Returning results to {parent_orchestrator_name}.
---
```

| Rule | Specification | ADR |
|------|---------------|-----|
| **Delimiter** | Same `---` delimiters | ADR-004 |
| **Header** | `STATUS:` -- exact string, uppercase, with trailing colon and space | ADR-005 |
| **Content** | One line describing completion status | ADR-005 |
| **No items** | No `[N]` numbered items | ADR-005 |

### 1.4 Orchestrator Lifecycle Format

The SDLC orchestrator uses the same canonical format (Section 1.1) at each of its 5 lifecycle emission points. The content varies by lifecycle point but the structural format is identical.

---

## 2. Prompt Tier Structure

### 2.1 Three-Tier Categorization (ADR-003)

Every canonical prompt block contains items from three tiers, always in this order:

| Position | Tier | Name | Purpose | Count |
|----------|------|------|---------|-------|
| [1] | Primary | Happy path | The most likely next action -- advance the workflow | Exactly 1 |
| [2] | Alternative | Context-specific | Other valid actions relevant to current phase | 1-2 |
| [3] or [4] | Utility | Always-available | Status, cancel, or help actions | Exactly 1 |

### 2.2 Tier Constraints

1. **Primary (Tier 1)** is ALWAYS `[1]`. Users who select `[1]` advance the workflow.
2. **Alternative (Tier 2)** occupies `[2]` and optionally `[3]`. These are phase-specific review or diagnostic actions.
3. **Utility (Tier 3)** is ALWAYS the last item. Standard utility prompts:
   - During active workflow: `Show workflow status`
   - After workflow completion: `View project status`

---

## 3. Dynamic Phase Name Resolution

### 3.1 Phase Key to Display Name Algorithm (ADR-007)

```
Input:  phase_key (e.g., "03-architecture", "02-impact-analysis", "11-local-testing")
Output: display_name (e.g., "Phase 03 - Architecture", "Phase 02 - Impact Analysis", "Phase 11 - Local Testing")

Algorithm:
1. Split phase_key on the first hyphen: number_part = "03", name_part = "architecture"
   - If phase_key contains a second segment: name_part = everything after first hyphen
   - e.g., "02-impact-analysis" -> number_part = "02", name_part = "impact-analysis"
2. Title-case the name_part: replace hyphens with spaces, capitalize each word
   - "impact-analysis" -> "Impact Analysis"
   - "local-testing" -> "Local Testing"
   - "code-review" -> "Code Review"
3. Combine: "Phase {number_part} - {title_cased_name}"
   - "Phase 03 - Architecture"
   - "Phase 02 - Impact Analysis"
```

### 3.2 Phase Name Resolution Examples

| Phase Key | Display Name |
|-----------|-------------|
| `00-quick-scan` | Phase 00 - Quick Scan |
| `01-requirements` | Phase 01 - Requirements |
| `02-impact-analysis` | Phase 02 - Impact Analysis |
| `02-tracing` | Phase 02 - Tracing |
| `03-architecture` | Phase 03 - Architecture |
| `04-design` | Phase 04 - Design |
| `05-test-strategy` | Phase 05 - Test Strategy |
| `06-implementation` | Phase 06 - Implementation |
| `07-testing` | Phase 07 - Testing |
| `08-code-review` | Phase 08 - Code Review |
| `09-validation` | Phase 09 - Validation |
| `10-cicd` | Phase 10 - Cicd |
| `11-local-testing` | Phase 11 - Local Testing |
| `12-remote-build` | Phase 12 - Remote Build |
| `13-test-deploy` | Phase 13 - Test Deploy |
| `14-production` | Phase 14 - Production |
| `15-operations` | Phase 15 - Operations |
| `16-upgrade-plan` | Phase 16 - Upgrade Plan |
| `16-upgrade-execute` | Phase 16 - Upgrade Execute |

### 3.3 Next Phase Resolution Algorithm (ADR-002)

```
Input:  active_workflow from state.json
Output: primary prompt text

Algorithm:
1. Read active_workflow.phases[] array
2. Read active_workflow.current_phase_index
3. Let next_index = current_phase_index + 1
4. IF next_index < phases.length:
     next_phase_key = phases[next_index]
     next_phase_name = resolve_display_name(next_phase_key)  // Section 3.1
     primary_prompt = "Continue to {next_phase_name}"
5. IF next_index >= phases.length:
     primary_prompt = "Complete workflow and merge to main"
```

---

## 4. Prompt Block Placement in Agent Files

### 4.1 Markdown Structure Convention

The `# SUGGESTED PROMPTS` section is placed in each agent file according to this convention:

```
# SELF-VALIDATION
...existing self-validation content...

# SUGGESTED PROMPTS                          <-- NEW SECTION

...prompt instructions and templates...

{closing_motivational_line}                  <-- EXISTING (unchanged)
```

### 4.2 Insertion Rules

1. The `# SUGGESTED PROMPTS` section is inserted AFTER the `# SELF-VALIDATION` section
2. The `# SUGGESTED PROMPTS` section is inserted BEFORE the closing motivational line
3. For agents without a `# SELF-VALIDATION` section, insert before the closing line
4. For agents without a closing line (e.g., sub-agents ending with a skills table), append at the end of the file

### 4.3 Agent Closing Lines (For Insertion Reference)

| Agent | Closing Line |
|-------|-------------|
| 01-requirements-analyst | "You are the foundation of the SDLC..." |
| 02-solution-architect | "You are the technical foundation of the project..." |
| 03-system-designer | "You translate architecture into actionable designs..." |
| 04-test-design-engineer | "You ensure quality is designed in from the start..." |
| 05-software-developer | "You bring designs to life with clean, tested..." |
| 06-integration-tester | "You validate that the system works as an integrated whole..." |
| 07-qa-engineer | "You are the quality gatekeeper ensuring code excellence..." |
| 08-security-compliance-auditor | "You are the last line of defense before deployment..." |
| 09-cicd-engineer | "You enable continuous delivery with automated, reliable pipelines." |
| 10-dev-environment-engineer | "You build and launch reliable environments..." |
| 11-deployment-engineer-staging | "You validate deployment procedures in staging..." |
| 12-release-manager | "You orchestrate production releases with precision..." |
| 13-site-reliability-engineer | "You are the guardian of production..." |
| 14-upgrade-engineer | (no closing line -- ends after SELF-VALIDATION) |
| quick-scan-agent | "You provide just enough context for requirements gathering..." |

---

## 5. State.json Read Contract

### 5.1 Fields Agents Read for Prompt Generation

Agents read these existing fields from `.isdlc/state.json`. No new fields are introduced (NFR-006).

```json
{
  "active_workflow": {
    "type": "feature|fix|test-run|test-generate|full-lifecycle|upgrade",
    "phases": ["01-requirements", "03-architecture", ...],
    "current_phase": "03-architecture",
    "current_phase_index": 1,
    "artifact_folder": "REQ-0003-suggested-prompts",
    "phase_status": {
      "01-requirements": "completed",
      "03-architecture": "in_progress",
      ...
    }
  }
}
```

### 5.2 Read Contract

| Field | Used For | Nullable? |
|-------|----------|-----------|
| `active_workflow` | Determine if workflow is active | YES -- null means no active workflow |
| `active_workflow.type` | Workflow type context (for orchestrator emission) | NO (when active_workflow exists) |
| `active_workflow.phases` | Array of phase keys in execution order | NO |
| `active_workflow.current_phase_index` | Position in phases array | NO |
| `active_workflow.artifact_folder` | Referenced in review prompts | NO |
| `active_workflow.phase_status` | Check if phases completed | NO |

### 5.3 Write Contract

**No writes.** Prompt generation is read-only. Agents do NOT write any prompt-related data to state.json. Prompts are ephemeral text output (NFR-006).

---

## 6. Searchability and Parsability

### 6.1 Search Strings

| Purpose | Search Pattern |
|---------|---------------|
| Find any prompt block | `SUGGESTED NEXT STEPS:` |
| Find sub-agent status | `STATUS:` (within `---` delimiters) |
| Find prompt section in agent files | `# SUGGESTED PROMPTS` |
| Find specific tier | `[1]`, `[2]`, `[3]`, `[4]` |

### 6.2 Regex Patterns (For Future Hook/Tool Use)

```
Prompt block:     ^---\nSUGGESTED NEXT STEPS:\n(?:  \[\d\] .+\n){2,4}---$
Status block:     ^---\nSTATUS: .+\n---$
Item extraction:  ^\s+\[(\d)\]\s+(.+)$
```

These patterns are documented for potential future use. No code currently parses prompt blocks (CON-002).

---

## 7. Traceability

| Interface Element | Traced Requirements | Traced ADRs | Traced NFRs |
|-------------------|---------------------|-------------|-------------|
| Canonical format (Section 1.1) | REQ-005 | ADR-004 | NFR-005 |
| Three-tier structure (Section 2) | REQ-001, REQ-003 | ADR-003 | - |
| Minimal format (Section 1.3) | REQ-004 | ADR-005 | NFR-002 |
| Phase name resolution (Section 3) | REQ-002, REQ-006 | ADR-002, ADR-007 | NFR-007 |
| File placement (Section 4) | REQ-003 | ADR-001 | NFR-002 |
| State read contract (Section 5) | REQ-006 | ADR-002 | NFR-006 |
