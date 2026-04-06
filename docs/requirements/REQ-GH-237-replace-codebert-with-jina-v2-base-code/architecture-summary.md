# Architecture Summary: REQ-GH-237

Drop-in adapter swap (Option A selected over abstract factory). ADR-001: Replace CodeBERT with Jina v2 via @huggingface/transformers v4 — same 768 dims, zero downstream changes. ADR-002: No backward compat (no external consumers). Net dep change: remove onnxruntime-node, add @huggingface/transformers (count stays at 6). Model download handled by Transformers.js cache. Pre-warm during /discover mitigates first-use latency.
