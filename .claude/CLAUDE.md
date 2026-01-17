# iSDLC Framework Repository

This is the **iSDLC Framework** itself - a comprehensive SDLC framework for Claude Code with 14 specialized AI agents.

## Repository Type

**Framework Repository** - This contains the agent definitions, skills, templates, and tools that will be used by actual software projects.

## What's in This Repository

### Agents (14 Specialized AI Agents)
Located in `.claude/agents/`:
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
- **10-dev-environment-engineer.md** - Configures local development
- **11-deployment-engineer-staging.md** - Handles staging deployments
- **12-release-manager.md** - Manages production releases
- **13-site-reliability-engineer.md** - Operations and monitoring

### Skills (116 Specialized Skills)
Located in `.claude/skills/` organized in 10 categories:
- **orchestration/** (8 skills) - Workflow management, gates, delegation
- **requirements/** (10 skills) - Elicitation, user stories, NFR quantification
- **architecture/** (12 skills) - Architecture patterns, tech evaluation, ADRs
- **design/** (10 skills) - API contracts, UI/UX, module design
- **testing/** (13 skills) - Test strategy, test cases, coverage analysis
- **development/** (14 skills) - Implementation, code review, refactoring
- **security/** (13 skills) - Threat modeling, scanning, penetration testing
- **devops/** (14 skills) - CI/CD, infrastructure, deployment strategies
- **documentation/** (10 skills) - Technical writing, API docs, runbooks
- **operations/** (12 skills) - Monitoring, incident response, SLA management

### Framework Resources
Located in `isdlc-framework/`:
- **checklists/** - 13 phase gate validation checklists
- **templates/** - 7 document templates for artifacts
- **config/** - 3 configuration files (defaults, coding standards, testing standards)
- **scripts/** - 3 utility scripts (init-project, validate-state, generate-report)

### Documentation
Located in `docs/`:
- Complete architecture documentation
- Skill distribution guides
- Workflow alignment documentation
- Restructuring history and migration notes

## How to Use This Repository

### If You're Working on the Framework Itself
This repository is for developing and maintaining the iSDLC framework:
- Add new skills to `.claude/skills/`
- Modify agent definitions in `.claude/agents/`
- Update templates in `isdlc-framework/templates/`
- Enhance scripts in `isdlc-framework/scripts/`
- Update documentation in `docs/` and `README.md`

### If You Want to Use This Framework for a Project
This framework is designed to be cloned/installed and then used for actual software projects:

1. Clone this framework repository
2. Use `isdlc-framework/scripts/init-project.sh` to create a new project
3. The project will reference these agents and skills
4. The project will have its own `.isdlc/` state directory

## Current State

This is the framework repository, so there's no "current phase" - it's the foundation that projects will use.

**Framework Version**: 1.0.0
**Last Updated**: 2026-01-17
**Status**: Active development

## Key Framework Concepts

### 1-to-1 Agent-Phase Mapping
Each SDLC phase has exactly ONE dedicated agent:
- Phase 01 → Requirements Analyst
- Phase 02 → Solution Architect
- Phase 03 → System Designer
- ... (all 13 phases)

### Quality Gates
Each phase ends with a quality gate (GATE-01 through GATE-13) with specific validation criteria.

### Linear Workflow
Projects flow through phases sequentially:
```
Requirements → Architecture → Design → Test Strategy → Implementation
→ Testing → Code Review → Validation → CI/CD → Local Dev
→ Staging Deploy → Production Deploy → Operations
```

### Artifact-Based Handoffs
Each phase produces specific artifacts that the next phase consumes.

## Development Guidelines

When working on this framework:

1. **Agent Modifications**: Update agent files in `.claude/agents/` and ensure consistency with gate checklists
2. **New Skills**: Add to appropriate category in `.claude/skills/` and update SKILL-DISTRIBUTION.md
3. **Templates**: Maintain templates in `isdlc-framework/templates/` for artifact generation
4. **Documentation**: Keep README.md and docs/ up-to-date with any changes
5. **Testing**: Test changes with real projects using the framework

## Framework Philosophy

- **Clear Ownership**: Each agent owns exactly one phase
- **Specialization**: Deep expertise in specific areas
- **Quality Gates**: No phase skipping, validation required
- **Traceability**: Requirements → Design → Code → Tests
- **Automation**: Scripts and tools to support the workflow
- **Standardization**: Templates and standards for consistency

## Questions About This Framework?

See:
- [README.md](../README.md) - Complete framework overview
- [docs/README.md](../docs/README.md) - Documentation index and guide
- [docs/NEW-agents-and-skills-architecture.md](../docs/NEW-agents-and-skills-architecture.md) - Architecture overview
- [docs/WORKFLOW-ALIGNMENT.md](../docs/WORKFLOW-ALIGNMENT.md) - Workflows and artifacts
- [docs/DETAILED-SKILL-ALLOCATION.md](../docs/DETAILED-SKILL-ALLOCATION.md) - Skill allocation
- [docs/archive/RESTRUCTURING-SUMMARY.md](../docs/archive/RESTRUCTURING-SUMMARY.md) - Migration history

## For Claude Code AI Agents

When invoked in this repository:
- You have access to all 14 agent definitions
- You have access to all 116 skills
- You can reference templates, checklists, and configs
- Focus on framework development, not project implementation
- Help maintain consistency across agents and artifacts
