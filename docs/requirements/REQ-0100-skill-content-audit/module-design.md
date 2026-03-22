# Module Design: REQ-0100 — Skill Content Audit

## skill-classification.js

Standard skill section template (applies to most of 245 skills):
- frontmatter → role_spec/full
- purpose → role_spec/full
- when_to_use → role_spec/full
- prerequisites → role_spec/full
- process_steps → mixed/partial (analytical guidance portable, tool commands not)
- output_format → mixed/partial

Category-level portability summaries:
```javascript
export const categoryPortability = Object.freeze({
  'analysis-topics': { full: 95, partial: 5, none: 0 },
  'development': { full: 40, partial: 30, none: 30 },
  'testing': { full: 50, partial: 30, none: 20 },
  // ... 17 categories
});
```

Exports: `getSkillClassification(skillId)`, `getSkillSectionTemplate()`, `getCategoryPortability(category)`, `listCategories()`

~100 lines.
