# Module Design: REQ-0102 — Topic Content Classification

## topic-classification.js

Standard topic section template (all 6 topics follow this):
- frontmatter → role_spec/full
- depth_guidance → role_spec/full
- analytical_knowledge → role_spec/full
- validation_criteria → role_spec/full
- artifact_instructions → role_spec/full
- source_step_files → runtime_packaging/none

Exports: `getTopicClassification(topicId)`, `listClassifiedTopics()`, `getTopicPortabilitySummary()`

~60 lines.
