# Changelog

All notable changes to the iSDLC Framework are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.0.0] - 2026-01-18

### Major Enhancements

This release includes 4 major enhancements that significantly expand the framework's capabilities.

#### Enhancement #1: Project Constitution

A governance system where projects can define immutable principles that all agents must follow.

**Added**
- `isdlc-framework/templates/constitution.md` - Constitution template with 10 default articles
- `docs/CONSTITUTION-GUIDE.md` - Complete guide on customizing and using constitutions
- Constitutional principles section in all 14 agent files
- Constitution validation at each quality gate
- `constitution` config block in `init-project.sh` state.json template

**Articles Available**
- Specification Primacy
- Test-First Development
- Library-First Design
- Security by Design
- Explicit Over Implicit
- Simplicity First (YAGNI)
- Artifact Traceability
- Documentation Currency
- Quality Gate Integrity
- Fail-Safe Defaults

#### Enhancement #2: Adaptive Workflow

Orchestrator-managed workflow that determines required phases based on task complexity at runtime.

**Added**
- `.claude/skills/orchestration/assess-complexity.md` (ORCH-009) - Complexity assessment skill
- Dynamic phase selection based on task complexity

**How It Works**
- Orchestrator assesses task complexity across 6 dimensions
- Selects appropriate phases dynamically (simple tasks skip unnecessary phases)
- Adapts as scope changes during development

#### Enhancement #3: Autonomous Iteration

Self-correcting agents that iterate when tests fail rather than stopping at first failure.

**Added**
- `.claude/skills/development/autonomous-iterate.md` (DEV-014) - Iteration skill
- `docs/AUTONOMOUS-ITERATION.md` - Complete documentation
- `iteration_tracking` to phases 05 and 06 in state.json template
- `autonomous_iteration` config block with max iterations and timeouts
- Iteration history tracking in state.json

**Features**
- Default iteration limits (max 10 iterations, 5 min timeout)
- Failure analysis and root cause detection
- Stuck-in-loop detection (3+ same errors)
- Automatic escalation when max iterations exceeded

#### Enhancement #4: Skill Enforcement

Exclusive skill ownership where each skill belongs to exactly one agent with runtime validation and audit logging.

**Added**
- `isdlc-framework/config/skills-manifest.yaml` (~800 lines) - Central ownership manifest
- `.claude/skills/orchestration/skill-validation/SKILL.md` (ORCH-010) - Validation skill
- `docs/SKILL-ENFORCEMENT.md` - Complete documentation
- `owned_skills` array in all 14 agent YAML frontmatter
- `SKILL ENFORCEMENT PROTOCOL` section in all agent files
- `skill_enforcement` config block in state.json template
- `skill_usage_log` array for audit trail

**Features**
- Each of 119 skills has exactly ONE owner agent
- Three enforcement modes: strict (block), warn (allow+log), audit (log only)
- Pre-execution ownership validation
- Full audit trail of all skill usage
- Gate integration for compliance review

### Changed

- **Skills count**: 116 → 119 (added ORCH-009, ORCH-010, DEV-014)
- **Orchestration skills**: 8 → 10
- **Development skills**: 14 → 15
- Updated `owner` field in all 118 skill files to actual agent names (was generic terms like "developer")
- Updated all 14 agent files with enhanced sections for constitution, iteration, and enforcement
- Enhanced `init-project.sh` with all four enhancement configurations

### Updated Files

**Agent Files (14 files)**
- All agents in `.claude/agents/*.md` updated with:
  - `owned_skills` array in YAML frontmatter
  - CONSTITUTIONAL PRINCIPLES section
  - AUTONOMOUS ITERATION PROTOCOL section (phases 05, 06)
  - SKILL ENFORCEMENT PROTOCOL section

**Skill Files (118 files)**
- All skills in `.claude/skills/**/SKILL.md` updated with correct `owner` field

**Configuration**
- `isdlc-framework/scripts/init-project.sh` - Added all enhancement configs

**Documentation**
- `README.md` - Updated features, skills count, added new sections
- Added 4 new documentation files in `docs/`

---

## [1.0.0] - 2026-01-16

### Initial Release

The first stable release of the iSDLC Framework.

**Core Features**
- 14 specialized agents (1 Orchestrator + 13 Phase Agents)
- 1-to-1 agent-to-phase mapping
- 116 skills across 10 categories
- 13 quality gates with validation checklists
- 7 document templates
- 3 configuration files
- 3 utility scripts

**Agents**
- 00 - SDLC Orchestrator
- 01 - Requirements Analyst
- 02 - Solution Architect
- 03 - System Designer
- 04 - Test Design Engineer
- 05 - Software Developer
- 06 - Integration Tester
- 07 - QA Engineer
- 08 - Security & Compliance Auditor
- 09 - CI/CD Engineer
- 10 - Dev Environment Engineer
- 11 - Deployment Engineer (Staging)
- 12 - Release Manager
- 13 - Site Reliability Engineer

**Skill Categories**
- Orchestration (8 skills)
- Requirements (10 skills)
- Architecture (12 skills)
- Design (10 skills)
- Testing (13 skills)
- Development (14 skills)
- DevOps (14 skills)
- Security (13 skills)
- Operations (12 skills)
- Documentation (10 skills)

**Framework Resources**
- Phase gate checklists (`isdlc-framework/checklists/`)
- Document templates (`isdlc-framework/templates/`)
- Configuration files (`isdlc-framework/config/`)
- Utility scripts (`isdlc-framework/scripts/`)

---

## Version History Summary

| Version | Date | Highlights |
|---------|------|------------|
| 2.0.0 | 2026-01-18 | 4 major enhancements: Constitution, Scale-Adaptive, Autonomous Iteration, Skill Enforcement |
| 1.0.0 | 2026-01-16 | Initial release: 14 agents, 116 skills, 13 gates |

---

**Maintained by**: iSDLC Framework Team
**Repository**: integrated-sdls-framework-v0.1
