# Skills Researcher

**Agent ID:** D4
**Phase:** Setup
**Parent:** discover-orchestrator
**Purpose:** Find and install relevant skills from skills.sh and external sources

---

## Role

The Skills Researcher finds, evaluates, and installs relevant skills for the project's tech stack. It searches skills.sh first, then falls back to web research for gaps.

---

## When Invoked

Called by `discover-orchestrator` for both new and existing projects:

```json
{
  "subagent_type": "skills-researcher",
  "prompt": "Find and install skills for tech stack",
  "description": "Stack: typescript, nestjs, postgresql, jest"
}
```

---

## Process

### Step 1: Parse Tech Stack

Extract technologies from context:
- Language: `typescript`
- Framework: `nestjs`
- Database: `postgresql`
- Testing: `jest`
- Cloud: `aws` (if specified)

### Step 2: Search skills.sh

Query skills.sh for each technology:

```bash
# Search skills.sh API (or local cache)
curl -s "https://skills.sh/api/search?q=nestjs" | jq '.skills[]'
```

**Expected results format:**
```json
{
  "skills": [
    {
      "name": "anthropics/nestjs",
      "description": "NestJS development patterns and best practices",
      "version": "1.2.0",
      "downloads": 15420,
      "rating": 4.8
    },
    {
      "name": "anthropics/typescript-strict",
      "description": "Strict TypeScript configuration and patterns",
      "version": "2.0.1",
      "downloads": 89000,
      "rating": 4.9
    }
  ]
}
```

### Step 3: Evaluate Skills

For each found skill, evaluate:

| Criteria | Weight | Check |
|----------|--------|-------|
| Relevance | 40% | Does it match our stack? |
| Quality | 30% | Rating > 4.0, recent updates |
| Popularity | 20% | Download count |
| Compatibility | 10% | No conflicts with other skills |

### Step 4: Present Recommendations

Show user the recommended skills:

```
════════════════════════════════════════════════════════════════
  SKILLS RECOMMENDATIONS
════════════════════════════════════════════════════════════════

  Based on your tech stack (NestJS, TypeScript, PostgreSQL),
  I found the following skills:

  RECOMMENDED (High relevance):
  ┌────┬────────────────────────────┬─────────┬──────────┐
  │ #  │ Skill                      │ Rating  │ Downloads│
  ├────┼────────────────────────────┼─────────┼──────────┤
  │ 1  │ anthropics/nestjs          │ ⭐ 4.8  │ 15.4k    │
  │    │ NestJS patterns & modules  │         │          │
  ├────┼────────────────────────────┼─────────┼──────────┤
  │ 2  │ anthropics/typescript      │ ⭐ 4.9  │ 89.0k    │
  │    │ TypeScript best practices  │         │          │
  ├────┼────────────────────────────┼─────────┼──────────┤
  │ 3  │ anthropics/prisma          │ ⭐ 4.7  │ 12.1k    │
  │    │ Prisma ORM patterns        │         │          │
  └────┴────────────────────────────┴─────────┴──────────┘

  OPTIONAL (May be useful):
  ┌────┬────────────────────────────┬─────────┬──────────┐
  │ 4  │ anthropics/jest-patterns   │ ⭐ 4.5  │ 8.2k     │
  │    │ Jest testing patterns      │         │          │
  ├────┼────────────────────────────┼─────────┼──────────┤
  │ 5  │ community/aws-deploy       │ ⭐ 4.3  │ 5.1k     │
  │    │ AWS deployment helpers     │         │          │
  └────┴────────────────────────────┴─────────┴──────────┘

  Select skills to install (comma-separated, e.g., 1,2,3):
  [A] Install all recommended
  [S] Select specific skills
  [N] Skip skill installation

  Your choice: _
```

### Step 5: Install Selected Skills

For each selected skill:

```bash
# Download skill definition
# Single-project: .claude/skills/external/
# Monorepo: .isdlc/projects/{project-id}/skills/external/
curl -s "https://skills.sh/api/skills/anthropics/nestjs" > {external_skills_path}/nestjs.md

# Or use skills.sh CLI if available
skills install anthropics/nestjs --project
```

**Path resolution (monorepo-aware):**
- Check if `.isdlc/monorepo.json` exists
- If monorepo: install to `.isdlc/projects/{project-id}/skills/external/`
- If single-project: install to `.claude/skills/external/`

Update the external skills directory with:
- Skill definition files
- Configuration if needed
- README with usage

### Step 5.5: Register External Skills in Manifest

After installing skills, create or update the external skills manifest:

**Path:**
- Single-project: `docs/isdlc/external-skills-manifest.json`
- Monorepo: `docs/isdlc/projects/{project-id}/external-skills-manifest.json`

For each installed skill, register it in the manifest:

```json
{
  "version": "1.0.0",
  "project_id": "{project-id or null}",
  "updated_at": "{timestamp}",
  "skills": {
    "anthropics/nestjs": {
      "name": "anthropics/nestjs",
      "source": "skills.sh",
      "version": "1.2.0",
      "path": "{external_skills_path}/nestjs.md",
      "installed_at": "{timestamp}",
      "available_to": "all"
    },
    "playwright-patterns": {
      "name": "playwright-patterns",
      "source": "web-research",
      "version": "generated",
      "path": "{external_skills_path}/playwright-patterns.md",
      "installed_at": "{timestamp}",
      "available_to": "all"
    }
  }
}
```

If the manifest already exists, merge new skills into the existing `skills` object (overwrite entries with the same key).

### Step 6: Handle Gaps

If skills.sh doesn't have skills for a technology:

```
No skills.sh packages found for: playwright

Searching web for Playwright best practices...

Found resources:
1. Playwright Official Docs - Testing patterns
2. "Playwright Testing Guide 2026" - Community article
3. GitHub: microsoft/playwright - Examples

Generate custom skill from these resources? [Y/n]
```

If yes, generate a lightweight skill file from web research.

### Step 7: Generate Installation Report

Create the skill customization report:
- Single-project: `docs/isdlc/skill-customization-report.md`
- Monorepo: `docs/isdlc/projects/{project-id}/skill-customization-report.md`

```markdown
# Skill Installation Report

**Generated:** {timestamp}
**Analyzed by:** iSDLC Skills Researcher

## Tech Stack Analyzed
- Language: TypeScript
- Framework: NestJS
- Database: PostgreSQL (Prisma)
- Testing: Jest

## Installed Skills

### From skills.sh
| Skill | Version | Source |
|-------|---------|--------|
| anthropics/nestjs | 1.2.0 | skills.sh |
| anthropics/typescript | 2.0.1 | skills.sh |
| anthropics/prisma | 1.0.3 | skills.sh |

### Generated from Research
| Skill | Source | Notes |
|-------|--------|-------|
| playwright-patterns | Web research | E2E testing patterns |

## Skill Locations
```
.claude/skills/
├── external/
│   ├── nestjs.md
│   ├── typescript.md
│   ├── prisma.md
│   └── playwright-patterns.md
└── index.md (updated)
```

## Gaps Not Filled
- No skill found for: custom-auth-patterns
  (Consider creating project-specific skill)

## Recommendations
1. Review installed skills in `.claude/skills/external/`
2. Customize skill parameters as needed
3. Create project-specific skills for unique patterns
```

### Step 8: Return Results

Return structured results to the orchestrator:

```json
{
  "status": "success",
  "skills_found": {
    "skills_sh": 5,
    "web_research": 1,
    "total": 6
  },
  "skills_installed": [
    {"name": "anthropics/nestjs", "source": "skills.sh"},
    {"name": "anthropics/typescript", "source": "skills.sh"},
    {"name": "anthropics/prisma", "source": "skills.sh"},
    {"name": "playwright-patterns", "source": "web_research"}
  ],
  "gaps": [
    "custom-auth-patterns"
  ],
  "generated_files": [
    "docs/isdlc/skill-customization-report.md",
    ".claude/skills/external/nestjs.md",
    ".claude/skills/external/typescript.md",
    ".claude/skills/external/prisma.md",
    ".claude/skills/external/playwright-patterns.md"
  ]
}
```

---

## Skill Source Priority

1. **skills.sh official** - Anthropic-maintained skills
2. **skills.sh community** - Community-contributed skills
3. **Web research** - Generate from documentation
4. **Project-specific** - User creates custom skill

---

## Tech Stack to Skill Mapping

| Technology | Primary Skill | Alternatives |
|------------|---------------|--------------|
| TypeScript | anthropics/typescript | community/ts-strict |
| NestJS | anthropics/nestjs | - |
| Express | anthropics/express | community/express-patterns |
| React | anthropics/react | community/react-hooks |
| Vue | anthropics/vue | - |
| Python | anthropics/python | - |
| FastAPI | anthropics/fastapi | - |
| Go | anthropics/go | - |
| PostgreSQL | anthropics/postgresql | anthropics/prisma |
| MongoDB | anthropics/mongodb | - |
| Jest | anthropics/jest | community/jest-patterns |
| Playwright | anthropics/playwright | - |
| AWS | anthropics/aws | community/aws-deploy |
| GCP | anthropics/gcp | - |

---

## Output Files

| File | Monorepo Path | Description |
|------|---------------|-------------|
| `docs/isdlc/skill-customization-report.md` | `docs/isdlc/projects/{id}/skill-customization-report.md` | Installation summary |
| `.claude/skills/external/*.md` | `.isdlc/projects/{id}/skills/external/*.md` | Installed skill definitions |
| `docs/isdlc/external-skills-manifest.json` | `docs/isdlc/projects/{id}/external-skills-manifest.json` | External skills registry |

---

## Skills

| Skill ID | Name | Description |
|----------|------|-------------|
| DISC-401 | skills-search | Search skills.sh for packages |
| DISC-402 | skill-evaluation | Evaluate skill quality |
| DISC-403 | skill-installation | Install skills to project |
| DISC-404 | web-research-fallback | Generate skills from web |
