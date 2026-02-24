# ADR-0004: LLM Model Selection for M4 (Opus)

## Status

Accepted

## Context

Each agent in the iSDLC framework specifies a `model` in its frontmatter. The model determines which Claude model processes the agent's prompt. M1, M2, and M3 all use `opus`. The question is which model M4 should use.

**Requirement references**: FR-01 (AC-01.2), NFR-01

## Decision

Use `opus` for M4, consistent with M1/M2/M3.

## Rationale

1. **Reasoning complexity**: M4 performs multi-step cross-referencing across three agent outputs. It must compare file lists, detect coverage gaps, and compute completeness scores. This requires strong structured reasoning that benefits from Opus-class capabilities.

2. **Consistency**: All impact analysis sub-agents use opus. Using a different model for M4 would be an unexplained exception.

3. **Quality over speed**: M4's findings influence the executive summary and inform downstream architecture decisions. False negatives (missed inconsistencies) reduce M4's value. Opus provides the best chance of accurate cross-validation.

4. **Acceptable cost**: At $0.33-$0.72 per call, M4's cost is comparable to each M1/M2/M3 call and well within the performance budget (NFR-01).

## Consequences

**Positive:**
- Consistent with existing agent model choices
- Best reasoning quality for cross-validation tasks
- Predictable performance characteristics

**Negative:**
- Higher cost per call than Sonnet (~5x)
- Slightly longer execution time than Sonnet

## Alternatives Considered

1. **Sonnet**: ~80% cheaper, ~40% faster. However, M4's cross-referencing requires careful structured reasoning. Sonnet may miss subtle inconsistencies, reducing M4's value. Can be evaluated as a cost optimization after initial deployment proves M4's effectiveness.

2. **Haiku**: Too limited for multi-output cross-referencing. Would likely produce low-quality verification reports.

3. **Configurable model**: Allow the user to override M4's model via configuration. Over-engineering for the initial implementation (Article V). Can be added later if cost becomes a concern.
