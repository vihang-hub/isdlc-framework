# Design Specification: Analyze Lifecycle Architecture Decision

**Item**: REQ-0073 | **GitHub**: #137

---

## 1. Analyze Subsystem Boundary

### Analyze Owns Exclusively

| Surface | Description |
|---------|-------------|
| meta.json lifecycle | topics_covered, phases_completed, confirmation state, acceptance record, analysis_status |
| Roundtable orchestration | Persona loading, topic coverage, depth sensing, conversation protocol |
| Bug-gather routing | Bug classification gate, bug-gather conversation protocol |
| Confirmation state machine | Sequential domain confirmations (Requirements → Architecture → Design), accept/amend transitions |
| Artifact batch writes | Write-once final artifact batch after all domains accepted |
| Memory write-back | Post-roundtable session record write, embedding trigger |
| Inference tracking | Captured assumptions, confidence levels, topic linkage |
| Sizing recommendation | Conversation-derived scope recommendation (pre-build sizing input) |

### Analyze Consumes from Core

| Core Service | How Analyze Uses It |
|-------------|-------------------|
| ItemStateService | `readMeta()`, `writeMeta()`, `deriveAnalysisStatus()`, `deriveBacklogMarker()` |
| BacklogService | `updateMarker()`, `appendToBacklog()`, `resolveItem()` |
| MemoryService | `readContext()`, `writeSessionRecord()`, `searchMemory()` |
| SessionCacheService | `build()` — context assembly for roundtable |
| ProjectRootService | `resolve()` — find .isdlc/ root |
| EmbeddingService | `embedSession()` — async post-analysis enrichment (fail-open) |

### Analyze Does NOT Use

| Core Service | Reason |
|-------------|--------|
| WorkflowEngine | Analyze is not a phase-based workflow |
| ValidatorEngine | No gate validation in analyze |
| StateStore (for active_workflow) | Analyze uses meta.json, not state.json active_workflow |
| Branch management | Analyze doesn't create branches |

## 2. Analyze Subsystem Interface

The analyze subsystem exposes a minimal interface to provider adapters:

```
AnalyzeSubsystem {
  // Entry point
  analyzeItem(input, options) → AnalyzeResult

  // Sub-flows
  classifySubject(draft, labels) → "bug" | "feature"
  executeBugGather(context) → BugGatherResult
  executeRoundtable(context) → RoundtableResult

  // Finalization
  finalizeAnalysis(slug, meta) → void

  // State queries
  getAnalysisStatus(slug) → "raw" | "partial" | "analyzed"
  checkStaleness(slug) → StalenessResult
}
```

Each provider adapter calls this interface differently:
- **Claude**: Inline handler in isdlc.md command, roundtable runs as conversation protocol
- **Codex**: AGENTS.md-driven analysis flow with sub-agent delegation for roundtable personas
- **Antigravity**: CLI wrapper (`analyze-item.cjs`) calls the subsystem directly

## 3. Provider Adapter Patterns for Analyze

### Claude Adapter
```
User says "analyze #134"
  → isdlc.md analyze handler (inline)
  → Resolves item, reads meta, reads draft
  → Bug classification gate
  → If feature: roundtable conversation protocol (inline, interactive)
  → If bug: bug-gather protocol (inline, interactive)
  → Artifact batch write
  → Memory write-back
  → analyze-finalize.cjs
```

### Codex Adapter
```
User says "analyze #134"
  → Codex instruction processes command
  → Resolves item via ItemStateService
  → Bug classification
  → If feature: spawns persona sub-agents for roundtable
  → Collects structured results, runs confirmation sequence
  → Artifact batch write
  → Memory write-back
  → Finalization via core service
```

### Antigravity Adapter
```
node src/antigravity/analyze-item.cjs --item "#134"
  → Resolves item via ItemStateService
  → Bug classification (CLI prompt)
  → If feature: drives roundtable via CLI menus
  → Artifact batch write
  → Memory write-back
  → Finalization via core service
```

## 4. Discover Subsystem (Preliminary)

This decision implies Discover follows the same pattern — a separate subsystem, not a WorkflowEngine workflow. Key similarities:

| Characteristic | Analyze | Discover |
|---------------|---------|----------|
| State store | meta.json per item | discover state in state.json |
| Progression | Topic coverage | Step completion |
| Parallel with build? | Yes | Yes (discover can run while a build is in progress) |
| Uses WorkflowEngine? | No | No |
| Uses ValidatorEngine? | No | No |

Formal discover subsystem design is REQ-0103 (Phase 6).

## 5. Impact on Backlog Items

| Item | Impact |
|------|--------|
| REQ-0082 (WorkflowEngine) | Confirmed: engine is build-only. No analyze support needed. |
| REQ-0085 (common.cjs decomposition) | Analyze-related helpers (persona-loader, roundtable-config) go to analyze subsystem, not core |
| REQ-0103 (Discover design) | Likely follows same separate-subsystem pattern |
| REQ-0108 (Analyze implementation) | Now has clear architecture: separate subsystem consuming core services |
| REQ-0109-0113 (Analyze sub-items) | All scoped within the analyze subsystem, not WorkflowEngine |
