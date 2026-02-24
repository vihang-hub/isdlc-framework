# Module Design — Command & Config Changes

**Components**: discover.md (modified), party-personas.json (new)
**Traces to**: REQ-001, REQ-009, REQ-012, ADR-008

---

## 1. discover.md Command File Changes

**File**: `src/claude/commands/discover.md`
**Change Type**: Minor additions (~15 lines)

### 1.1 Options Table Addition

Insert two new rows into the existing Options table (after the `--skip-skills` row):

```markdown
| `--party` | Force party mode for new project setup (skip mode menu) |
| `--classic` | Force classic mode for new project setup (skip mode menu) |
```

### 1.2 Examples Addition

Add party/classic examples to the Examples section:

```bash
# Force party mode for new project
/discover --new --party

# Force classic mode for new project
/discover --new --classic

# Party mode (auto-detects new project)
/discover --party
```

### 1.3 New Project Output Addition

Add to the "New projects" output section:

```markdown
- `docs/architecture/test-strategy-outline.md` - Test strategy outline (party mode only)
```

### 1.4 Implementation Section Change

The Implementation section already handles flag pass-through. The existing pattern:
```
"Execute /discover command --new [flags]"
```
naturally passes `--party` and `--classic` through to the orchestrator. No structural change needed — the orchestrator handles the new flags in its Mode Resolution logic.

### 1.5 Full Diff Preview

```diff
 | `--skip-skills` | Skip skills.sh integration |
+| `--party` | Force party mode for new project setup (skip mode menu) |
+| `--classic` | Force classic mode for new project setup (skip mode menu) |
 | `--atdd-ready` | Prepare AC for ATDD workflow integration |

 # Force new project setup
 /discover --new
+
+# Force party mode for new project
+/discover --new --party
+
+# Force classic mode for new project
+/discover --new --classic

 **New projects:**
 - `docs/architecture/architecture-overview.md` - Architecture blueprint with data model and API design
+- `docs/architecture/data-model.md` - Detailed data model
+- `docs/architecture/test-strategy-outline.md` - Test strategy outline (party mode only)
```

---

## 2. party-personas.json Configuration File

**File**: `src/claude/agents/discover/party-personas.json`
**Change Type**: New file (~130 lines)

### 2.1 Purpose

Declarative configuration for all party mode personas (AC-17, NFR-003). This file is the single source of truth for persona names, titles, communication styles, expertise areas, phase assignments, and phase interaction protocols.

### 2.2 Full Content

The file content is defined in Section 6.1 of the architecture-overview.md. The exact JSON is:

```json
{
  "version": "1.0.0",
  "description": "Persona definitions for Inception Party mode",
  "personas": {
    "nadia": {
      "name": "Nadia",
      "title": "Product Analyst",
      "agent_type": "product-analyst",
      "agent_id": "D7",
      "phase": 1,
      "is_existing_agent": true,
      "communication_style": "Empathetic, user-focused, asks 'why' and 'for whom'",
      "expertise": "User needs, market fit, MVP scope",
      "question_domains": ["user problems", "pain points", "success metrics", "target audience"],
      "debate_focus": "Advocates for user value and simplicity"
    },
    "oscar": {
      "name": "Oscar",
      "title": "Domain Researcher",
      "agent_type": "domain-researcher",
      "agent_id": "D9",
      "phase": 1,
      "is_existing_agent": false,
      "communication_style": "Thorough, evidence-based, cites industry standards",
      "expertise": "Compliance, regulations, best practices",
      "question_domains": ["industry context", "regulations", "competitors", "standards"],
      "debate_focus": "Ensures regulatory and industry alignment"
    },
    "tessa": {
      "name": "Tessa",
      "title": "Technical Scout",
      "agent_type": "technical-scout",
      "agent_id": "D10",
      "phase": 1,
      "is_existing_agent": false,
      "communication_style": "Pragmatic, trend-aware, evaluates feasibility",
      "expertise": "Emerging tech, tooling ecosystem, DX",
      "question_domains": ["scale expectations", "tech preferences", "ecosystem constraints", "DX priorities"],
      "debate_focus": "Evaluates technical feasibility and developer experience"
    },
    "liam": {
      "name": "Liam",
      "title": "Solution Architect",
      "agent_type": "solution-architect-party",
      "agent_id": "D11",
      "phase": 2,
      "is_existing_agent": false,
      "communication_style": "Structured, trade-off focused, systems thinker",
      "expertise": "Architecture patterns, scalability, integration",
      "question_domains": [],
      "debate_focus": "Proposes architecture patterns and evaluates trade-offs"
    },
    "zara": {
      "name": "Zara",
      "title": "Security Advisor",
      "agent_type": "security-advisor",
      "agent_id": "D12",
      "phase": 2,
      "is_existing_agent": false,
      "communication_style": "Risk-aware, principle-driven, challenges assumptions",
      "expertise": "Threat modeling, auth, data protection",
      "question_domains": [],
      "debate_focus": "Challenges proposals on security and data protection grounds"
    },
    "felix": {
      "name": "Felix",
      "title": "DevOps Pragmatist",
      "agent_type": "devops-pragmatist",
      "agent_id": "D13",
      "phase": 2,
      "is_existing_agent": false,
      "communication_style": "Opinionated, build-deploy focused, cost-conscious",
      "expertise": "CI/CD, infrastructure, observability",
      "question_domains": [],
      "debate_focus": "Evaluates operational cost, deployment complexity, and DX"
    },
    "architect": {
      "name": "Architecture Designer",
      "title": "Architecture Designer",
      "agent_type": "architecture-designer",
      "agent_id": "D8",
      "phase": 3,
      "is_existing_agent": true,
      "communication_style": "Systematic, pattern-driven",
      "expertise": "Component architecture, API design",
      "question_domains": [],
      "debate_focus": "Produces architecture overview artifact"
    },
    "data_modeler": {
      "name": "Data Model Designer",
      "title": "Data Model Designer",
      "agent_type": "data-model-designer",
      "agent_id": "D14",
      "phase": 3,
      "is_existing_agent": false,
      "communication_style": "Precise, relationship-aware",
      "expertise": "Entity design, schema, relationships",
      "question_domains": [],
      "debate_focus": "Produces data model artifact"
    },
    "test_strategist": {
      "name": "Test Strategist",
      "title": "Test Strategist",
      "agent_type": "test-strategist",
      "agent_id": "D15",
      "phase": 3,
      "is_existing_agent": false,
      "communication_style": "Quality-focused, coverage-driven",
      "expertise": "Test pyramid, coverage strategy, tooling",
      "question_domains": [],
      "debate_focus": "Produces test strategy outline artifact"
    }
  },
  "phases": {
    "1": {
      "name": "Vision Council",
      "type": "parallel",
      "personas": ["nadia", "oscar", "tessa"],
      "max_messages": 10,
      "interaction": "question-broadcast-debate",
      "output": "project_brief"
    },
    "2": {
      "name": "Stack & Architecture Debate",
      "type": "parallel",
      "personas": ["liam", "zara", "felix"],
      "max_messages": 10,
      "interaction": "propose-critique-converge",
      "output": "tech_stack_recommendation"
    },
    "3": {
      "name": "Blueprint Assembly",
      "type": "parallel",
      "personas": ["architect", "data_modeler", "test_strategist"],
      "max_messages": 10,
      "interaction": "produce-cross-review-finalize",
      "output": "design_artifacts"
    },
    "4": {
      "name": "Constitution & Scaffold",
      "type": "sequential",
      "personas": [],
      "max_messages": 0,
      "interaction": "task-delegation",
      "output": "constitution_and_skills"
    },
    "5": {
      "name": "Walkthrough",
      "type": "sequential",
      "personas": [],
      "max_messages": 0,
      "interaction": "orchestrator-inline",
      "output": "discovery_context"
    }
  }
}
```

### 2.3 Read Pattern

The orchestrator reads this file ONCE at the start of party mode:

```
Read src/claude/agents/discover/party-personas.json
Parse JSON
For each party phase:
  Look up phases[N].personas → get persona keys
  For each persona key:
    Look up personas[key] → get agent_type, name, communication_style, etc.
    Construct PERSONA_CONTEXT block
    Spawn agent with persona context
```

### 2.4 Extensibility (NFR-003)

The JSON structure supports future extensions without code changes:
- Add new personas: add a key to `personas` object
- Add new phases: add a key to `phases` object
- Change persona assignments: modify `phases[N].personas` array
- Adjust message limits: modify `phases[N].max_messages`
- New interaction patterns: add new `interaction` value (orchestrator handles)

---

## 3. Summary of All File Changes

| File | Type | Lines Changed | Purpose |
|------|------|---------------|---------|
| `src/claude/commands/discover.md` | Modified | +15 | Add --party/--classic flags, examples |
| `src/claude/agents/discover-orchestrator.md` | Modified | +470 | Mode selection + PARTY MODE FLOW |
| `src/claude/agents/discover/party-personas.json` | New | ~130 | Persona configuration |
| `src/claude/agents/discover/domain-researcher.md` | New | ~80 | D9 — Oscar |
| `src/claude/agents/discover/technical-scout.md` | New | ~80 | D10 — Tessa |
| `src/claude/agents/discover/solution-architect-party.md` | New | ~100 | D11 — Liam |
| `src/claude/agents/discover/security-advisor.md` | New | ~90 | D12 — Zara |
| `src/claude/agents/discover/devops-pragmatist.md` | New | ~90 | D13 — Felix |
| `src/claude/agents/discover/data-model-designer.md` | New | ~120 | D14 |
| `src/claude/agents/discover/test-strategist.md` | New | ~110 | D15 |
| **Total** | | **~1285** | |
