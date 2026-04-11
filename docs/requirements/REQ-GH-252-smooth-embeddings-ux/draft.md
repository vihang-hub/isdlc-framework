# REQ-GH-252: Smooth embeddings UX — discover → generation → server → search wiring should be seamless by default

**Source**: github
**Source ID**: GH-252
**Type**: REQ
**Created**: 2026-04-11
**GitHub**: https://github.com/vihang-hub/isdlc-framework/issues/252

---

## Summary

The flow from `/discover` → embeddings generation → embedding server → search wiring is not smooth today. After `/discover` completes, users often find that (a) embeddings weren't actually generated, (b) the embedding server isn't running, or (c) code searches still use lexical backends even when embeddings exist.

## Observed Problem

On a fresh install of the harness on a new project (Java 8 + Enactor Process Framework, 2,264 files, 1,221 process definitions), after running `/discover`:

1. User asks "what about embeddings?"
2. Response: *"the embedding pipeline isn't configured for this project — `docs/.embeddings/` doesn't exist, so the code embeddings refresh step was skipped silently per the discovery spec."*

Discover appeared to complete successfully, but semantic search isn't set up. The user has no clear path to enable it without reading the code.

## Root Causes (three independent gaps)

### Gap 1: Discover → Generation is fragile and silent

**Location**: `src/claude/agents/discover-orchestrator.md` Step 7.9 (line 2566)

- Step 7.9 invokes `npx isdlc-embedding generate .` but per the spec *"if the command fails... log the error and continue to finalize — embedding generation is optional and should not block discovery completion"*
- No upfront dependency check (`@huggingface/transformers` installed? enough memory? model download reachable?)
- No verification after generation that `docs/.embeddings/*.emb` actually exists
- Failures are logged to stderr and invisible to the user — discover says it completed even when generation silently failed
- Related: GH-250 (opt-in gap — generate runs unconditionally even when user opted out)

### Gap 2: Embedding server does not auto-start on session start

**Location**: embedding server lifecycle (`lib/embedding/server/lifecycle.js`), Claude Code session start hooks (`src/claude/hooks/`)

- Config has `auto_start: true` but that only fires when something calls the server API
- On a fresh Claude Code session, nothing proactively calls the server, so it's not running unless the user manually runs `isdlc-embedding server start`
- `.isdlc/state.json` stores embedding metadata but no health check runs at session start
- Partially addressed: GH-244 (status line), GH-245 (crash auto-restart), GH-246 (launchd/systemd reboot survival), GH-241 (port collision false success). None of these cover the session-start auto-probe gap.

### Gap 3: Tool-router does NOT route to the embedding MCP

**Location**: `src/claude/hooks/tool-router.cjs:192`

The `isdlc-embedding` MCP server IS registered in `src/claude/settings.json:430-434` and exposes:
- `isdlc_embedding_semantic_search`
- `isdlc_embedding_list_modules`
- `isdlc_embedding_add_content`

But `tool-router.cjs` only checks for `code-index-mcp` availability and routes Grep/Glob/Read to code-index tools. It has **zero awareness** of the `isdlc-embedding` MCP server. Result: even when embeddings are generated AND the server is running AND the MCP bridge is registered, agents continue using code-index (lexical) search for all Grep calls.

Users have to explicitly invoke `mcp__isdlc-embedding__isdlc_embedding_semantic_search` by name to benefit from semantic search. That's not smooth.

## Proposed Work

### Part A — Discover → Generation (hardening)

- Pre-flight dependency check in Step 7.9: verify `@huggingface/transformers` is installable and model download is reachable. Prompt the user if blocked, don't just skip.
- Visible progress during generation: show chunking progress, embedding progress, and final package creation.
- Post-generation verification: confirm `docs/.embeddings/*.emb` exists and has non-zero chunks. If not, report the failure clearly in the discover completion banner (not silently).
- Respect opt-in (see GH-250) — if the user opted out, show a clear "embeddings disabled" message with instructions to enable.
- Surface failures in the `EXISTING PROJECT DISCOVERY COMPLETE` summary (✓ / ✗ / ⊘ for each artifact).

### Part B — Embedding server lifecycle at session start

- Add a SessionStart hook that:
  1. Checks if `hasUserEmbeddingsConfig(projectRoot)` returns true
  2. Checks if `docs/.embeddings/*.emb` exists
  3. Probes `http://localhost:{port}/health`
  4. If (1) && (2) && !(3): invoke `startServer(projectRoot)` from `lib/embedding/server/lifecycle.js`
  5. Record the server PID/port/health in `.isdlc/state.json` for status-line (GH-244) consumption
- Fail-open: if any step fails, log to stderr but don't block session start
- Expose a one-line status in the SessionStart cache so Claude sees "EMBEDDING_SERVER: running on :7777 (19811 chunks, Jina v2)" at session start

### Part C — Tool-router → isdlc-embedding MCP wiring

- Extend `inferEnvironmentRules()` in `src/claude/hooks/tool-router.cjs:184` to also probe for `isdlc-embedding` MCP availability
- When available, add rules that route **conceptual / natural-language Grep queries** to `mcp__isdlc-embedding__isdlc_embedding_semantic_search`
- Preserve existing exemptions: exact symbol names, file paths with wildcards, regex patterns → stay on lexical search
- Add a heuristic (or config flag) to distinguish "find where X is defined" (lexical) from "find code that does X" (semantic)
- Document the routing hierarchy: semantic (conceptual) > code-index (symbol) > grep-glob (literal)

## Acceptance Criteria

- [ ] **A1**: After `/discover` completes on a fresh project with embeddings opted-in, `docs/.embeddings/*.emb` exists OR the completion banner shows a clear ✗ for embedding generation with the failure reason
- [ ] **A2**: Missing dependencies (`@huggingface/transformers`, disk space, network) are reported BEFORE generation attempts, not silently swallowed
- [ ] **A3**: On Claude Code session start, if embeddings are configured and present but the server isn't running, the server auto-starts and its status is visible in the session cache
- [ ] **A4**: Tool-router detects `isdlc-embedding` MCP availability and routes eligible Grep calls to `isdlc_embedding_semantic_search`
- [ ] **A5**: Exact-symbol and literal-pattern Grep calls continue to route to code-index or remain as Grep (lexical)
- [ ] **A6**: A single session-start status line shows `SEMANTIC SEARCH: {active|inactive|failed}` so users know whether they're getting semantic or lexical search
- [ ] **A7**: Tests cover the three failure modes: generation fails / server unavailable / MCP not registered. All three fail-open without blocking workflows.

## Dependencies / Related

- **GH-250** (opt-in gap) — must fix first so Part A respects opt-out correctly
- **GH-244** (status line) — Part B produces the signal the status line reads
- **GH-245** (auto-restart on crash) — complements Part B auto-start
- **GH-246** (launchd/systemd reboot) — complements Part B (system-level vs session-level lifecycle)
- **GH-247** (auto-trigger incremental refresh) — separate staleness concern, orthogonal
- **REQ-GH-224** (embedding pipeline activation) — the original embedding pipeline work; this issue tracks the integration gaps left behind after 224 shipped

## Out of Scope

- Auto-starting the server at OS boot (GH-246 covers that)
- Memory calibration correctness (GH-248)
- fp16 graph optimization re-enable (GH-249)
- Incremental refresh automation (GH-247)
