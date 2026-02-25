# Requirements Specification: TOON Format Integration

**Requirement ID:** REQ-0040
**Artifact Folder:** REQ-0040-toon-format-integration
**Created:** 2026-02-25
**Status:** Draft
**Phase:** 01-requirements
**Backlog Item:** #33

---

## 1. Project Overview

### 1.1 Problem Statement

The iSDLC framework injects large volumes of structured data (skills manifest, state arrays, session cache) into agent context on every run. At approximately 18,500 tokens for session cache alone, plus state.json arrays exceeding 100K characters, this consumes significant context window budget and degrades agent response speed.

### 1.2 Proposed Solution

Adopt Token-Oriented Object Notation (TOON) for encoding tabular and uniform array data injected into agent context. TOON declares field names once as a header row, with data following as compact rows -- eliminating repetitive JSON key names. This targets a 35% token reduction on session cache and 40-60% on state array injections.

### 1.3 Goals

- Reduce session cache token consumption by at least 30% (~6,600 tokens saved)
- Reduce state.json array injection tokens by at least 40%
- Improve or maintain LLM accuracy when parsing injected data
- Improve overall agent response speed through smaller context payloads

### 1.4 Success Metrics

| Metric | Baseline | Target |
|--------|----------|--------|
| Session cache tokens | ~18,500 | <=12,950 (30% reduction) |
| State array injection tokens | ~124K chars | <=74K chars (40% reduction) |
| LLM parsing accuracy | JSON baseline | Equal or better (TOON benchmarks: +2-10 points) |
| Hook latency (encoding) | 0ms (no encoding) | <50ms added |
| Test count | >=555 | >=555 (no regression) |

---

## 2. Stakeholders and Personas

### 2.1 Persona 1: Framework Developer

- **Role:** Maintains the iSDLC hook system, session cache, and state management
- **Goals:** Reduce token overhead, improve agent speed, maintain reliability
- **Pain Points:** Large JSON payloads consuming context budget, repetitive field names in 243-entry arrays
- **Key Tasks:** Modify hooks to encode/decode TOON, update cache builder, update tests, add SDK dependency

### 2.2 Persona 2: iSDLC End User

- **Role:** Developer using the iSDLC framework for their projects
- **Goals:** Faster agent responses, reliable workflows
- **Pain Points:** Slow agent runs when context is bloated
- **Key Tasks:** None -- feature is fully transparent. Workflows run as before with faster results.

### 2.3 Persona 3: Agent (Claude Code)

- **Role:** Consumes injected context data during agent runs
- **Goals:** Parse structured data accurately, maximize context budget for reasoning
- **Pain Points:** Large token footprint from JSON arrays leaves less room for reasoning
- **Key Tasks:** Read TOON-formatted sections in session cache and state data injections

---

## 3. Functional Requirements

### FR-001: TOON SDK Integration and CJS Wrapper

**ID:** REQ-001
**Priority:** Must Have
**Persona:** Framework Developer

**Description:** Add the TOON TypeScript SDK (github.com/toon-format/toon) as an npm dependency and create a CJS-compatible wrapper utility (`src/claude/hooks/lib/toon-encoder.cjs`) for use in all hook files.

**Details:**
- Install `toon` package from npm
- Create wrapper exposing `encode(data)` and `decode(toonString)` functions
- Wrapper must be loadable via `require()` in CJS hook files
- If SDK ships ESM-only, wrapper must bridge via dynamic `import()` or compiled output
- Wrapper handles the header-row extraction from uniform object arrays automatically

**Acceptance Criteria:**
- AC-001-01: Given the TOON SDK is installed, when a CJS hook calls `require('./lib/toon-encoder.cjs')`, then it receives `encode` and `decode` functions without error
- AC-001-02: Given tabular data (array of objects with uniform keys), when `encode(data)` is called, then it returns a valid TOON string with headers on the first row and data on subsequent rows
- AC-001-03: Given a valid TOON string, when `decode(toonString)` is called, then it returns the original array of objects with correct types
- AC-001-04: Given the wrapper is loaded on Node 20, 22, and 24, when any function is called, then it executes without module resolution errors

---

### FR-002: Session Cache TOON Encoding

**ID:** REQ-002
**Priority:** Must Have
**Persona:** Framework Developer

**Description:** Convert the four session cache sections (SKILL_INDEX, SKILLS_MANIFEST, ITERATION_REQUIREMENTS, WORKFLOW_CONFIG) from JSON to TOON format in `inject-session-cache.cjs`. This includes all skill types across 17 categories, the skill_lookup table (243 entries), and the ownership table (41 entries).

**Details:**
- Modify inject-session-cache.cjs to use toon-encoder for tabular sections
- SKILL_INDEX: 240 skills encoded as TOON (all skill types included)
- SKILLS_MANIFEST: skill_lookup (243 entries, 7 fields) and ownership (41 entries) as TOON tables
- ITERATION_REQUIREMENTS: tabular portions as TOON
- WORKFLOW_CONFIG: tabular portions as TOON
- Non-tabular content within sections (if any) remains as-is

**Acceptance Criteria:**
- AC-002-01: Given inject-session-cache.cjs builds the session cache, when the SKILL_INDEX section is generated, then it is encoded as TOON (header row + 240 data rows)
- AC-002-02: Given inject-session-cache.cjs builds the session cache, when the SKILLS_MANIFEST section is generated, then skill_lookup (243 entries) and ownership (41 entries) are encoded as TOON tables
- AC-002-03: Given inject-session-cache.cjs builds the session cache, when ITERATION_REQUIREMENTS and WORKFLOW_CONFIG sections are generated, then tabular portions are encoded as TOON
- AC-002-04: Given the TOON-encoded session cache is produced, when its token count is measured, then it is at least 30% smaller than the JSON-encoded equivalent

---

### FR-003: State Array TOON Encoding for Context Injection

**ID:** REQ-003
**Priority:** Should Have
**Persona:** Framework Developer

**Description:** Encode state.json arrays (workflow_history, history, skill_usage_log) as TOON when injecting into agent context. Storage remains JSON -- TOON encoding is applied at read/injection time only, preserving state.json integrity per Article XIV.

**Details:**
- Identify all code paths where state.json arrays are injected into agent context
- Apply TOON encoding at the injection point (not at storage time)
- workflow_history (~105K chars) is the largest target
- skill_usage_log (~9K chars) is append-only per Article XIV -- TOON applies only to reads
- history (~10K chars) encoded at injection time

**Acceptance Criteria:**
- AC-003-01: Given state.json contains a workflow_history array, when it is injected into agent context, then it is encoded as TOON
- AC-003-02: Given state.json contains history and skill_usage_log arrays, when they are injected into agent context, then they are encoded as TOON
- AC-003-03: Given TOON encoding is applied to state array injection, when the original state.json file is inspected, then it remains valid JSON (TOON is read-time only)
- AC-003-04: Given the TOON-encoded state arrays, when their token count is measured against JSON equivalents, then the reduction is at least 40%

---

### FR-004: JSON Fallback on Decode Failure

**ID:** REQ-004
**Priority:** Must Have
**Persona:** iSDLC End User

**Description:** If TOON decoding fails for any reason, fall back to JSON parsing transparently. Log the fallback event as a warning but do not throw errors or block workflows. This ensures Article X (fail-safe defaults) compliance.

**Details:**
- Wrap all `decode()` calls in try/catch
- On TOON decode failure, attempt JSON.parse() on the original data
- Log fallback events to stderr (hook stdout is reserved for JSON protocol)
- Per-section fallback: if one session cache section fails TOON encoding, only that section falls back to JSON; other sections remain TOON
- All hooks exit 0 regardless of TOON failures (fail-open)

**Acceptance Criteria:**
- AC-004-01: Given a malformed TOON string is passed to `decode()`, when decoding fails, then the wrapper attempts JSON.parse() on the original data
- AC-004-02: Given a TOON decode failure occurs, when the fallback activates, then a warning is logged to stderr (not an error thrown)
- AC-004-03: Given a session cache section fails TOON encoding, when inject-session-cache.cjs processes it, then that section falls back to JSON while other sections remain TOON-encoded
- AC-004-04: Given any TOON failure in any hook, when the hook completes, then it exits 0 (fail-open per Article X)

---

### FR-005: Cache Rebuild TOON Consistency

**ID:** REQ-005
**Priority:** Must Have
**Persona:** Framework Developer

**Description:** Update `bin/rebuild-cache.js` to produce TOON-encoded cache sections, ensuring consistency with inject-session-cache.cjs output.

**Details:**
- rebuild-cache.js must use the same toon-encoder.cjs wrapper as inject-session-cache.cjs
- Output format must be identical for the same input data
- Fallback behavior must match (JSON fallback on encoding failure)

**Acceptance Criteria:**
- AC-005-01: Given a developer runs `node bin/rebuild-cache.js`, when the cache is rebuilt, then SKILL_INDEX, SKILLS_MANIFEST, ITERATION_REQUIREMENTS, and WORKFLOW_CONFIG sections are TOON-encoded
- AC-005-02: Given rebuild-cache.js and inject-session-cache.cjs both generate a cache from the same input data, when their outputs are compared, then the TOON-encoded sections are identical
- AC-005-03: Given rebuild-cache.js encounters a TOON encoding failure, when it falls back to JSON, then the cache is still produced successfully

---

## 4. Non-Functional Requirements

| NFR ID | Category | Requirement | Metric | Measurement Method | Priority |
|--------|----------|-------------|--------|-------------------|----------|
| NFR-001 | Performance | Session cache token reduction | >=30% reduction on all 4 sections (baseline: ~18,500 tokens) | Token counting before/after on identical input data | Must Have |
| NFR-002 | Performance | State array token reduction | >=40% reduction on workflow_history, history, skill_usage_log injections | Token counting before/after on representative state.json | Must Have |
| NFR-003 | Performance | Encoding latency | TOON encoding adds <50ms to session cache rebuild time | Timestamp comparison in cache rebuild benchmarks | Should Have |
| NFR-004 | Reliability | JSON fallback | 100% of TOON decode failures fall back to JSON without error propagation | Unit tests with malformed TOON input, integration tests with corrupted cache | Must Have |
| NFR-005 | Compatibility | CJS hook compatibility | TOON encoder/decoder works via `require()` in all CJS hook files | Load test on Node 20, 22, 24 with CJS require() | Must Have |
| NFR-006 | Compatibility | Node.js version support | Works on Node 20, 22, 24 (Article XII CI matrix) | CI matrix execution across all 3 versions | Must Have |
| NFR-007 | Maintainability | Test baseline preservation | Total test count >= 555 after implementation (Article II) | npm test count output | Must Have |
| NFR-008 | Integrity | State write atomicity | state.json written as full JSON only (TOON at read/injection time, not storage) | Code review + integration test verifying state.json remains valid JSON | Must Have |
| NFR-009 | Accuracy | LLM parsing accuracy | No degradation in agent task completion with TOON data | Existing test suite passes with TOON-encoded context | Must Have |

---

## 5. Constraints

| CON ID | Constraint | Rationale |
|--------|-----------|-----------|
| CON-001 | TOON encoding applies only to tabular/uniform array data | TOON is ineffective for deeply nested or non-uniform structures |
| CON-002 | Hook files must use CJS `require()` (Article XIII) | Claude Code spawns hooks as standalone Node processes outside package scope |
| CON-003 | state.json storage remains JSON (Article XIV) | State writes must be atomic full-JSON; TOON applies only at read/injection time |
| CON-004 | skill_usage_log is append-only (Article XIV) | TOON encoding must not modify the append-only contract |
| CON-005 | Hooks must fail-open on all errors (Article X) | TOON failures must never block user workflows |
| CON-006 | No backwards compatibility required | Clean cutover; no need to support reading both formats during transition |

---

## 6. Assumptions

| ID | Assumption | Risk if Wrong |
|----|-----------|---------------|
| ASM-001 | TOON TypeScript SDK is available on npm and maintained | Would need to implement minimal encoder/decoder from scratch |
| ASM-002 | TOON SDK ships a CJS-compatible build or can be wrapped | If ESM-only, need async dynamic import() bridge in CJS wrapper |
| ASM-003 | Claude models parse TOON at equal or better accuracy than JSON | If accuracy degrades, feature provides no net benefit despite token savings |
| ASM-004 | Session cache sections have uniform/tabular structure | Non-uniform subsections would need to remain JSON within TOON-encoded sections |
| ASM-005 | No active workflows need to be preserved during cutover | Clean cutover assumption; active workflows at migration time could see format mismatch |

---

## 6.5 Deferred Files

The following files were identified in the Phase 02 impact analysis as requiring modification, but architecture decisions made in Phase 03 eliminated the need for changes:

| File | Expected Change | Status | Justification |
|------|----------------|--------|---------------|
| `package.json` | Add `toon` npm dependency | Deferred | ADR-0040-01 selected native CJS encoder implementation with zero npm dependencies. The `toon` npm package is not used. |
| `bin/rebuild-cache.js` | Add TOON logging | Deferred | This file delegates entirely to `common.cjs::rebuildSessionCache()` (line 32). TOON encoding is handled internally by `rebuildSessionCache()`, so `rebuild-cache.js` inherits TOON output automatically with no code changes. Impact analysis Section REQ-005 confirms: "no direct changes needed if rebuildSessionCache() handles TOON internally." |

---

## 7. Out of Scope

- Full JSON replacement across the framework -- TOON complements JSON for tabular data only
- TOON encoding for prose content (constitution.md, agent definitions, discovery context)
- TOON encoding for deeply nested state.json objects (~6K chars, 4.6% of state)
- Backwards compatibility / dual-format reading during transition period
- TOON encoding for non-iSDLC project files

---

## 8. Dependencies

```
REQ-001 (SDK + Wrapper)
  |
  +--> REQ-004 (JSON Fallback -- baked into wrapper)
  |      |
  |      +--> REQ-002 (Session Cache Encoding)
  |             |
  |             +--> REQ-005 (Cache Rebuild Consistency)
  |
  +--> REQ-003 (State Array Encoding -- parallel after REQ-001 + REQ-004)
```

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| TOON | Token-Oriented Object Notation -- a data format that declares field names once as a header row, with data following as compact rows. Reduces token consumption by 30-60% for tabular data. |
| Session Cache | A markdown file (`.isdlc/session-cache.md`) injected into agent context on every run, containing skill indices, manifest data, iteration config, and workflow config. |
| CJS | CommonJS module system using `require()`/`module.exports`. Used by all iSDLC hook files. |
| ESM | ECMAScript Modules using `import`/`export`. Used by iSDLC CLI and lib files. |
| Fail-open | A failure mode where errors are logged but do not block execution. Hooks must always exit 0. |
| skill_lookup | A 243-entry table in skills-manifest.json mapping skill IDs to metadata (category, phase, agent). |
| ownership | A 41-entry table in skills-manifest.json mapping agents to their owned skills. |

---

## 10. Research Context

- TOON reduces token consumption by 30-60% vs JSON for tabular/uniform data
- TypeScript SDK: github.com/toon-format/toon (16,495+ stars)
- Benchmarks: 73.9% accuracy (vs JSON 69.7%) using 39.6% fewer tokens
- Claude Haiku: TOON 59.8% vs JSON 57.4% accuracy
- Sweet spot: uniform arrays where field names repeat across entries
- Less effective for deeply nested/non-uniform structures
