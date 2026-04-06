# Design Summary: REQ-GH-237

## Overview

Drop-in adapter swap: replace `codebert-adapter.js` (244 lines) with `jina-code-adapter.js` (~60 lines) using `@huggingface/transformers` v4. The new adapter implements the identical interface (`embed`, `healthCheck`, `dispose`, `dimensions: 768`), slots into the existing `resolveAdapter()` switch, and requires zero changes to downstream consumers.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Adapter pattern | Drop-in replacement | Existing pattern is the right abstraction level |
| Model loading | Lazy singleton via `ensureExtractor()` | First call downloads + caches; subsequent reuse |
| Backward compat | None — delete CodeBERT entirely | No external consumers (user confirmed) |
| Pre-warm | During `/discover` setup | Mitigates 10-30s first-download latency |
| Stale detection | `model_id` in .emb metadata | Simple field check, warn-only |

## Cross-Check Results

- FRs ↔ Modules: all 7 FRs map to specific module changes
- Interface contracts: `JinaCodeAdapter` matches existing adapter shape exactly
- Architecture ↔ Design: ADR-001 (drop-in swap) directly implemented by module design
- Error paths: 5 error codes defined, all have recovery strategies

## Open Questions

None — all design decisions are resolved.

## Implementation Readiness

**Ready**. A developer can implement from these specs without further clarification. The adapter interface is fully specified, the wiring points are identified, and the blast radius is mapped.
