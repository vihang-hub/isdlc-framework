# Architecture Overview: REQ-0099 — Agent Content Decomposition

## ADR-CODEX-012: Content Classification Model
- **Status**: Accepted
- **Context**: 47 agent files need RoleSpec/RuntimePackaging classification for Codex consumption
- **Decision**: Frozen classification objects in src/core/content/. One file per content type. Registry for lookup.
- **Rationale**: Same pure-data pattern as Phase 4. Classification is metadata, not restructuring.

## File Layout
- `src/core/content/content-model.js` (NEW — shared schema: SectionEntry type, ClassificationType enum)
- `src/core/content/agent-classification.js` (NEW — 47 agent classifications)
- `src/core/bridge/content-model.cjs` (NEW — shared CJS bridge)
