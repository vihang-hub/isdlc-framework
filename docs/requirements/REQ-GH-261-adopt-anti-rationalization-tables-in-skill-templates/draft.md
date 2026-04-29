# Adopt anti-rationalization tables in skill templates

**Source**: GitHub Issue #261
**Type**: REQ (Feature)

## Summary

Adopt the anti-rationalization table pattern from addyosmani/agent-skills as a standard section in iSDLC skill templates.

Anti-rationalization tables list common excuses an AI agent generates to skip quality steps, paired with factual rebuttals. They act as behavioral guardrails at the prompt level — complementing our deterministic hook enforcement with a second layer that catches subtle quality shortcuts hooks can't block.

## Motivation

Our hooks enforce structural constraints (can't skip phases, can't commit to main, can't write state via bash), but they can't catch an agent that:
- Writes superficial tests that technically pass but don't verify behavior
- Skips edge cases because "this is straightforward"
- Defers security considerations because "it's internal"
- Rationalizes away spec compliance because "the user didn't explicitly ask"

Anti-rationalization tables preemptively inject counter-arguments into the context, competing in the attention mechanism when the model reaches for a shortcut.

## Pattern Details

### Format
Two-column Markdown table near the end of each SKILL.md:

```markdown
## Common Rationalizations
| Rationalization | Reality |
|---|---|
| "I'll write tests after the code works" | You won't. Tests written after test implementation, not behavior. |
| "This is too simple to test" | Simple code gets complicated. The test documents expected behavior. |
```

### Rebuttal Styles
- Concede then redirect: "You might be right 70% of the time. The other 30% costs hours."
- Quantify the cost: "Security retrofitting is 10x harder than building it in."
- Reframe the premise: "That's documentation, not specification."
- State a law: "Bugs compound. A bug in Slice 1 makes Slices 2-5 wrong."
- Direct imperative: "Reproduce first."

### Common Rationalization Archetypes
1. Deferral — "I'll do it later"
2. Minimization — "This is too simple to need X"
3. False confidence — "I know what the bug is"
4. Efficiency theater — "Tests slow me down"
5. Displacement — "The framework handles it"

## Scope

- Add `## Common Rationalizations` section to the skill template
- Author anti-rationalization tables for high-impact built-in skills (testing, security, requirements, implementation, code review)
- Update skill anatomy docs with authoring guidance
- Update skill validation to flag skills missing the section (warn, not block)

## References

- Source: addyosmani/agent-skills
- Complementary to hook-based enforcement (deterministic guardrails + behavioral persuasion)
- Related: #262 (skill catalog rationalisation)
