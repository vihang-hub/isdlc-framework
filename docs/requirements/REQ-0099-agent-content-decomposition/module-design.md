# Module Design: REQ-0099 — Agent Content Decomposition

## content-model.js (shared)

Defines the classification schema:

```javascript
export const CLASSIFICATION_TYPES = Object.freeze({
  ROLE_SPEC: 'role_spec',
  RUNTIME_PACKAGING: 'runtime_packaging',
  MIXED: 'mixed'
});

export const PORTABILITY = Object.freeze({
  FULL: 'full',
  PARTIAL: 'partial',
  NONE: 'none'
});
```

## agent-classification.js

Exports `agentClassifications` — a frozen Map of agent name → section classifications.

Standard agent sections template (most agents follow this):
- frontmatter → role_spec/full
- role_description → role_spec/full
- phase_overview → role_spec/full
- constitutional_principles → role_spec/full
- tool_usage → runtime_packaging/none
- iteration_protocol → mixed/partial
- suggested_prompts → runtime_packaging/none

Exports: `getAgentClassification(name)`, `listClassifiedAgents()`, `getAgentPortabilitySummary()`

~150 lines (47 entries, most using standard template with overrides for special agents).
