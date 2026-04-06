# Requirements Summary: REQ-GH-237

7 functional requirements defined (5 Must Have, 2 Should Have). Core: replace CodeBERT with Jina v2 adapter (FR-001), wire into engine routing as default (FR-002), swap dependencies (FR-003), delete dead code (FR-004), update tests (FR-007). Enhancements: discover pre-warm (FR-005), stale embedding warning (FR-006). No backward compatibility. 17 acceptance criteria total, all testable. NFRs: 10-min embedding generation, zero native build steps, 500ms search latency (unchanged).
