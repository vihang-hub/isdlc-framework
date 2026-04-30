# Requirements Specification: Live Workflow Dashboard

**ID**: REQ-GH-258
**Source**: GitHub Issue #258
**Status**: Analyzed
**Labels**: ready-to-build

---

## Functional Requirements

### FR-001: Two-Panel Dashboard Layout
Replace `src/dashboard/index.html` with a new `.isdlc/dashboard.html` that shows Analysis (left) and Build (right) panels side-by-side. Visual style lifted from `docs/index.html` animated flow.

### FR-002: Analysis Panel
Analysis panel (left): slug title from analysis-index.json, persona nodes from `persona-*.md` files — core 3 (Maya/Alex/Jordan) always shown, contributing personas shown as secondary nodes, promoted personas shown with their own confirmation stage. Confirmation stage progress from `meta.json → acceptance`. Phase dots from `phases_completed`. Bug vs feature confirmation stages from `bug_classification`.

### FR-003: Build Panel
Build panel (right): phase DAG (05→06→16→08), active agent badge from `state.json → active_agent`, task progress from `docs/isdlc/tasks.md`, sub-agent nodes when parallel dispatch active.

### FR-004: Skills Display
Two groups under active agent. Built-in from `getAgentSkillIndex()` — shown as "loaded". External from `external-skills-manifest.json` — shown with distinct badge. Future: fired vs not-fired when #278 ships.

### FR-005: Hooks Display
Read `.isdlc/hook-activity.log`, filter to current phase. Color-coded: green=allow, red=block (glow), amber=warn, grey=idle/skip. Tooltip on hover with hook name + reason.

### FR-006: Server API Expansion
Expand `/api/state` to include active analysis `meta.json` content (resolved via analysis-index.json slug), recent hook events (tail hook-activity.log), agent skills (built-in + external), persona list (names + role_type from persona files).

### FR-007: Remove Manual Controls
Remove Play/Next controls. All state driven by polling `/api/state`.

### FR-008: Dashboard Location
Dashboard HTML lives at `.isdlc/dashboard.html`, installed by the framework installer. Server serves it instead of `src/dashboard/index.html`. Falls back to old UI if `.isdlc/dashboard.html` doesn't exist.

### FR-009: Preserve Static Demo
`docs/index.html` (GitHub Pages static demo) remains unchanged.

### FR-010: Persona Discovery
Server scans `src/claude/agents/persona-*.md` at startup, extracts `role_type` from frontmatter, serves persona list in `/api/state`. Dashboard renders core vs contributing vs promoted with distinct visual treatment.

---

## Non-Functional Requirements

### NFR-001: Poll Interval
2 seconds during active workflow/analysis, 10 seconds when idle.

### NFR-002: Zero Dependencies
Vanilla JS, CSS, HTML. No npm dependencies for the dashboard.

### NFR-003: Fail-Open
Missing files, corrupt JSON, absent hook log → degrade gracefully, never crash.

---

## Architecture

### Data Flow
Dashboard server polls 5 data sources: `state.json` (build), `analysis-index.json` (active slug), `docs/requirements/{slug}/meta.json` (analysis detail), `hook-activity.log` (hooks), persona files (one-time scan at startup). All served via expanded `/api/state`.

### Server Changes
`src/dashboard/server.js` gains: (1) `scanPersonas()` — reads `persona-*.md` frontmatter at startup, caches. (2) `scanHookLog()` — tails last 50 lines of `hook-activity.log`, filters to current phase. (3) `readActiveMeta()` — reads `meta.json` for the active analysis slug. (4) `getAgentSkills()` — calls `getAgentSkillIndex` + reads external manifest. All added to `buildStateResponse()`.

### API Shape
`/api/state` response gains: `active_meta` (full meta.json for active analysis), `hook_events` (recent hook log entries), `agent_skills` (built-in + external for active agent), `personas` (array of `{ name, role_type }`). Existing fields unchanged.

### Caching Strategy
Personas: scan once at startup. Hook log: re-read every poll. Agent skills: re-read when `active_agent` changes. `meta.json`: re-read every poll. `analysis-index.json`: existing 5s cache.

### Backward Compatibility
`src/dashboard/index.html` stays as fallback. Old `/api/state` consumers see new fields but existing fields are unchanged.

---

## Dependencies
- GH-277: analysis-index.json (shipped)
- #278: skill_usage_log population (future — skills show as "loaded" until then)
