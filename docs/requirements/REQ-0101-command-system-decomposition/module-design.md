# Module Design: REQ-0101 — Command System Decomposition

## command-classification.js

isdlc.md classification (major sections):
- action_definitions (feature, fix, build, etc.) → role_spec/full
- build_handler_workflow (auto-detection, staleness, sizing) → role_spec/full
- analyze_handler_roundtable → mixed/partial
- phase_loop_controller → runtime_packaging/none
- skill_injection_steps → runtime_packaging/none
- interactive_relay_protocol → runtime_packaging/none
- add_handler → role_spec/full
- trivial_tier_execution → mixed/partial

Other commands:
- provider.md: provider_semantics → role_spec/full, claude_settings_ui → runtime_packaging/none
- discover.md: discovery_workflow → role_spec/full, agent_delegation → runtime_packaging/none
- tour.md: tour_content → role_spec/full, interactive_presentation → runtime_packaging/none

Exports: `getCommandClassification(commandName)`, `listClassifiedCommands()`

~80 lines.
