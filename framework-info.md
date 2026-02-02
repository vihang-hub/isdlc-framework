# iSDLC Framework Repository

This is the **iSDLC Framework** itself - a comprehensive SDLC framework for Claude Code with 14 specialized AI agents.

## Repository Type

**Framework Repository** - This contains the agent definitions, skills, templates, and tools that will be used by actual software projects.

## What's in This Repository

### SDLC Agents (14 Specialized AI Agents)
Located in `src/claude/agents/`:
- **00-sdlc-orchestrator.md** - Coordinates all phases and validates gates
- **01-requirements-analyst.md** - Captures requirements, user stories, NFRs
- **02-solution-architect.md** - Designs architecture, tech stack, database
- **03-system-designer.md** - Creates API contracts, module designs, UI/UX
- **04-test-design-engineer.md** - Develops test strategy and test cases
- **05-software-developer.md** - Implements code following TDD
- **06-integration-tester.md** - Runs integration and E2E tests
- **07-qa-engineer.md** - Performs code review and quality analysis
- **08-security-compliance-auditor.md** - Security scanning and compliance
- **09-cicd-engineer.md** - Sets up CI/CD pipelines
- **10-dev-environment-engineer.md** - Builds and launches environments for testing
- **11-deployment-engineer-staging.md** - Handles staging deployments
- **12-release-manager.md** - Manages production releases
- **13-site-reliability-engineer.md** - Operations and monitoring

### Discover Agents (8 Sub-Agents + 1 Orchestrator)
Located in `src/claude/agents/discover/`:
- **discover-orchestrator.md** - Coordinates project discovery (D0)
- **architecture-analyzer.md** - Analyzes tech stack, dependencies, deployment topology (D1)
- **test-evaluator.md** - Evaluates test coverage, quality, critical paths (D2)
- **constitution-generator.md** - Generates project constitution (D3)
- **skills-researcher.md** - Researches best practices for tech stack (D4)
- **data-model-analyzer.md** - Scans schemas, ORM models, migrations, relationships (D5)
- **feature-mapper.md** - Maps API endpoints, UI pages, CLI commands, business domains (D6)
- **product-analyst.md** - Vision elicitation, brainstorming, PRD generation (D7)
- **architecture-designer.md** - Designs architecture from PRD and tech stack (D8)

### Skills (163 Specialized Skills)
Located in `src/claude/skills/` organized in 11 categories:
- **orchestration/** (10 skills) - Workflow management, gates, delegation
- **requirements/** (10 skills) - Elicitation, user stories, NFR quantification
- **architecture/** (12 skills) - Architecture patterns, tech evaluation, ADRs
- **design/** (10 skills) - API contracts, UI/UX, module design
- **testing/** (13 skills) - Test strategy, test cases, coverage analysis
- **development/** (15 skills) - Implementation, code review, refactoring
- **security/** (13 skills) - Threat modeling, scanning, penetration testing
- **devops/** (16 skills) - CI/CD, infrastructure, deployment strategies, build orchestration
- **documentation/** (10 skills) - Technical writing, API docs, runbooks
- **operations/** (12 skills) - Monitoring, incident response, SLA management
- **discover/** (40 skills) - Project analysis, vision elicitation, PRD generation, architecture design

### Framework Resources
Located in `src/isdlc/`:
- **checklists/** - 13 phase gate validation checklists
- **templates/** - Document templates for artifacts
- **config/** - Configuration files (defaults, coding standards, testing standards, skills manifest, workflow definitions)
- **scripts/** - Utility scripts (validate-state, generate-report)

### Documentation
Located in `docs/`:
- Complete architecture documentation
- Skill distribution guides
- Workflow alignment documentation

## How to Use This Repository

### If You're Working on the Framework Itself
This repository is for developing and maintaining the iSDLC framework:
- Add new skills to `src/claude/skills/`
- Modify agent definitions in `src/claude/agents/`
- Update templates in `src/isdlc/templates/`
- Enhance scripts in `src/isdlc/scripts/`
- Update documentation in `docs/` and `README.md`

### If You Want to Use This Framework for a Project
This framework is designed to be cloned/installed and then used for actual software projects:

1. Clone this framework repository
2. Run `./install.sh` to install into your project
3. The project will have agents, skills, and its own `.isdlc/` state directory
4. The cloned framework folder is cleaned up after installation

## Current State

This is the framework repository, so there's no "current phase" - it's the foundation that projects will use.

**Framework Version**: 2.0.0
**Last Updated**: 2026-01-18
**Status**: Active development

## Key Framework Concepts

### 1-to-1 Agent-Phase Mapping
Each SDLC phase has exactly ONE dedicated agent:
- Phase 01 → Requirements Analyst
- Phase 02 → Solution Architect
- Phase 03 → System Designer
- Phase 04 → Test Design Engineer
- Phase 05 → Software Developer
- Phase 06 → Integration Tester
- Phase 07 → QA Engineer
- Phase 08 → Security & Compliance Auditor
- Phase 09 → CI/CD Engineer
- Phase 10 → Environment Builder
- Phase 11 → Deployment Engineer (Staging)
- Phase 12 → Release Manager
- Phase 13 → Site Reliability Engineer

### Quality Gates
Each phase ends with a quality gate (GATE-01 through GATE-13) with specific validation criteria.

### Workflow Types
Instead of always running all 13 phases, the framework provides focused workflows:

| Command | Workflow | Phases |
|---------|----------|--------|
| `/sdlc feature` | New Feature | 01 → 02 → 03 → 05 → 10 → 06 → 09 → 07 |
| `/sdlc fix` | Bug Fix (TDD) | 01 → 05 → 10 → 06 → 09 → 07 |
| `/sdlc test run` | Run Tests | 10 → 06 |
| `/sdlc test generate` | Generate Tests | 04 → 05 → 10 → 06 → 07 |
| `/sdlc start` | Full Lifecycle | 01 → ... → 05 → 10 → 06 → ... → 10(remote) → 11 → ... → 13 |

Workflow definitions are in `.isdlc/config/workflows.json`. Each workflow has a fixed, non-skippable phase sequence with strict gate enforcement.

### Artifact-Based Handoffs
Each phase produces specific artifacts that the next phase consumes.

### Key Features
- **Project Constitution** - Customizable governance principles
- **Autonomous Iteration** - Self-correcting agents that iterate until tests pass
- **Skill Enforcement** - Exclusive skill ownership with audit logging

## Development Guidelines

When working on this framework:

1. **Agent Modifications**: Update agent files in `src/claude/agents/` and ensure consistency with gate checklists
2. **New Skills**: Add to appropriate category in `src/claude/skills/`
3. **Templates**: Maintain templates in `src/isdlc/templates/` for artifact generation
4. **Documentation**: Keep README.md and docs/ up-to-date with any changes
5. **Testing**: Test changes with real projects using the framework

## Framework Philosophy

- **Clear Ownership**: Each agent owns exactly one phase
- **Specialization**: Deep expertise in specific areas
- **Quality Gates**: No phase skipping, validation required (workflow-aware)
- **Focused Workflows**: Feature, fix, test, and full lifecycle paths
- **Traceability**: Requirements → Design → Code → Tests
- **Automation**: Scripts and tools to support the workflow
- **Standardization**: Templates and standards for consistency

## Questions About This Framework?

See:
- [README.md](README.md) - Complete framework overview and installation guide
- [docs/README.md](docs/README.md) - Documentation index and guide
- [docs/NEW-agents-and-skills-architecture.md](docs/NEW-agents-and-skills-architecture.md) - Architecture overview
- [docs/WORKFLOW-ALIGNMENT.md](docs/WORKFLOW-ALIGNMENT.md) - Workflows and artifacts
- [docs/DETAILED-SKILL-ALLOCATION.md](docs/DETAILED-SKILL-ALLOCATION.md) - Skill allocation

## For Claude Code AI Agents

When invoked in this repository:
- You have access to all 14 agent definitions
- You have access to all 163 skills
- You can reference templates, checklists, and configs
- Focus on framework development, not project implementation
- Help maintain consistency across agents and artifacts
- **Keep framework-info.md updated** when making changes to the framework
