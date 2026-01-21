# iSDLC Framework Documentation

Welcome to the iSDLC Framework documentation. This directory contains comprehensive documentation for understanding and working with the framework's architecture, workflows, and skill distribution.

## Core Documentation

These are the primary reference documents for the current framework (v1.0.0):

### [NEW-agents-and-skills-architecture.md](NEW-agents-and-skills-architecture.md)
**Architecture Overview**

A concise overview of the 1-to-1 agent-phase mapping architecture:
- 14 specialized agents (1 Orchestrator + 13 Phase Agents)
- Comparison between old multi-agent and new 1-to-1 mapping
- Agent responsibilities and key artifacts
- Quick reference for understanding the framework structure

**Use when**: You need a high-level understanding of the framework architecture.

---

### [WORKFLOW-ALIGNMENT.md](WORKFLOW-ALIGNMENT.md)
**Workflows & Artifact Alignment** (Most Comprehensive)

The most detailed operational reference covering:
- Complete agent-to-phase mapping with file references
- Linear workflow progression through all 13 phases
- Artifact structure for each phase (what goes where)
- Agent handoff protocols and gate validation procedures
- Quality gate enforcement and thresholds
- Migration notes from old to new agent names

**Use when**: You need to understand how agents work together, what artifacts each phase produces, or how phase gates function.

---

### [DETAILED-SKILL-ALLOCATION.md](DETAILED-SKILL-ALLOCATION.md)
**Skill Allocation Reference**

Complete skill-by-skill mapping across all 14 agents:
- All 116 skills listed with descriptions
- Skills organized by agent (00-13)
- Skill categories and how they split across agents
- Total skill counts per agent
- Category-to-agent mapping summary

**Use when**: You need to know which agent has which specific skills, or want to understand skill distribution across the framework.

---

## Historical Documentation (Archive)

These documents are kept for historical reference and understanding the framework's evolution:

### [archive/agents-and-skills-architecture-OLD.md](archive/agents-and-skills-architecture-OLD.md)
**Previous Architecture (Pre-Restructuring)**

The original multi-agent architecture before the 1-to-1 mapping restructure. Useful for:
- Understanding the framework's evolution
- Comparing old vs new approaches
- Historical context for design decisions

---

### [archive/RESTRUCTURING-SUMMARY.md](archive/RESTRUCTURING-SUMMARY.md)
**Migration Summary**

Documents the restructuring from 10 multi-phase agents to 14 specialized agents:
- What changed and why
- File changes (created, deleted, updated)
- Benefits of the new architecture
- Migration impact assessment

---

### [archive/SKILL-REDISTRIBUTION-COMPLETE.md](archive/SKILL-REDISTRIBUTION-COMPLETE.md)
**Skill Redistribution Completion Report**

Summary document marking the completion of skill redistribution task:
- Quick reference table of skills per agent
- Category allocation strategy
- Design decisions for skill splits
- Validation checklist

---

## Quick Reference

### By Use Case

| What you need | Document to read |
|---------------|------------------|
| Understand the overall architecture | [NEW-agents-and-skills-architecture.md](NEW-agents-and-skills-architecture.md) |
| Know what artifacts each phase produces | [WORKFLOW-ALIGNMENT.md](WORKFLOW-ALIGNMENT.md) |
| Understand phase gates and validation | [WORKFLOW-ALIGNMENT.md](WORKFLOW-ALIGNMENT.md) |
| Find which agent has a specific skill | [DETAILED-SKILL-ALLOCATION.md](DETAILED-SKILL-ALLOCATION.md) |
| Learn how agents hand off work | [WORKFLOW-ALIGNMENT.md](WORKFLOW-ALIGNMENT.md) |
| Understand the framework's history | [archive/RESTRUCTURING-SUMMARY.md](archive/RESTRUCTURING-SUMMARY.md) |

### By Agent

All agent definitions are in [../.claude/agents/](../.claude/agents/):
- **Agent 00**: [sdlc-orchestrator.md](../.claude/agents/00-sdlc-orchestrator.md)
- **Agent 01**: [requirements-analyst.md](../.claude/agents/01-requirements-analyst.md)
- **Agent 02**: [solution-architect.md](../.claude/agents/02-solution-architect.md)
- **Agent 03**: [system-designer.md](../.claude/agents/03-system-designer.md)
- **Agent 04**: [test-design-engineer.md](../.claude/agents/04-test-design-engineer.md)
- **Agent 05**: [software-developer.md](../.claude/agents/05-software-developer.md)
- **Agent 06**: [integration-tester.md](../.claude/agents/06-integration-tester.md)
- **Agent 07**: [qa-engineer.md](../.claude/agents/07-qa-engineer.md)
- **Agent 08**: [security-compliance-auditor.md](../.claude/agents/08-security-compliance-auditor.md)
- **Agent 09**: [cicd-engineer.md](../.claude/agents/09-cicd-engineer.md)
- **Agent 10**: [dev-environment-engineer.md](../.claude/agents/10-dev-environment-engineer.md)
- **Agent 11**: [deployment-engineer-staging.md](../.claude/agents/11-deployment-engineer-staging.md)
- **Agent 12**: [release-manager.md](../.claude/agents/12-release-manager.md)
- **Agent 13**: [site-reliability-engineer.md](../.claude/agents/13-site-reliability-engineer.md)

### Framework Resources

- **Phase Gate Checklists**: [../isdlc-framework/checklists/](../isdlc-framework/checklists/)
- **Document Templates**: [../isdlc-framework/templates/](../isdlc-framework/templates/)
- **Configuration Files**: [../isdlc-framework/config/](../isdlc-framework/config/)
- **Utility Scripts**: [../isdlc-framework/scripts/](../isdlc-framework/scripts/)
- **Skills**: [../.claude/skills/](../.claude/skills/)

---

## Document Maintenance

**Last Updated**: 2026-01-17
**Framework Version**: 1.0.0
**Status**: Active

### Contributing to Documentation

When updating documentation:
1. Keep core documents focused and current
2. Move outdated/historical content to `archive/`
3. Update this README.md when adding new documents
4. Maintain cross-references between related documents
5. Update "Last Updated" dates in document frontmatter

---

For the main framework overview, see [../README.md](../README.md).
