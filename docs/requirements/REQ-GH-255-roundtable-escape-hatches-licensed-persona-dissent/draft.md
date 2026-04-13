# Roundtable escape hatches: licensed persona dissent + trivial-scope sanity gate

**Source**: GitHub issue #255
**URL**: https://github.com/vihang-hub/isdlc-framework/issues/255
**Type**: REQ (feature enhancement)
**Created**: 2026-04-13

---

## Problem

The `/isdlc analyze` roundtable always runs the full conversation loop regardless of scope. There's no graceful path for:
- **"Maybe we shouldn't do this at all"** — premise is flawed, work already done, duplicate, not worth doing
- **"This is 5 lines, skip the roundtable"** — scope is clearly trivial and doesn't warrant Maya/Alex/Jordan sequencing

The existing `/isdlc build --trivial` bypass requires the user to already know analysis is unnecessary. The roundtable itself can't surface this conclusion, even when the evidence is in front of it.

## Proposal

Two complementary escape hatches, both keeping personas in charge of the conversation (we are NOT removing or weakening personas):

### A. Licensed persona dissent (premise escape hatch)

Extend the roundtable protocol (`src/claude/agents/roundtable-analyst.md`) to license Maya/Alex/Jordan to propose three additional conversation moves:

- `close_without_work` — premise flawed, already done, duplicate, not worth doing
- `skip_to_trivial` — scope is clearly < 5 files, full roundtable not warranted
- `defer` — blocked by external dependency or other in-flight work

These are surfaced as natural persona turns, not menu items. Personas MUST cite **specific evidence** (draft contradictions, prior implementation in the codebase, scan metrics) — not raised speculatively. User confirms or overrides.

### B. Alex's first-scan sanity gate (size escape hatch)

During Alex's deferred codebase scan (which runs on the user's first reply in the resume flow), if metrics show `files_affected < 5` AND `risk = low` AND `coupling = low`, Alex MUST surface:

> "Scan shows this is trivial scope (N files, low risk, low coupling). Skip the roundtable and go straight to a trivial-tier build?"

Deterministic — triggered by scan output, not persona judgment. User can say "yes, skip" or "no, continue with full analysis."

## Acceptance Criteria

- [ ] `roundtable-analyst.md` documents the three licensed dissent moves with required evidence standards
- [ ] Alex's resume-flow response includes the trivial-scope gate when scan metrics match thresholds
- [ ] User confirmation of dissent short-circuits the rest of the roundtable and produces one of:
  - No artifacts + backlog item marked closed/deferred with reason
  - Trivial-tier build invocation (same as `/isdlc build --trivial`)
- [ ] Guardrails against "are you sure?" theatre — personas must cite evidence, not raise speculatively
- [ ] The four-domain confirmation sequence for items that DO warrant full analysis is unchanged

## Out of Scope

- Removing or weakening the existing four-domain confirmation sequence for non-trivial items
- Fully automated trivial detection without any persona involvement
- Changes to `/isdlc build --trivial` itself

## Rationale

Came out of a design discussion comparing Claude Code plan mode to `/isdlc analyze`. Plan mode has a natural "let me think out loud and conclude we shouldn't do this" mode that analyze currently lacks. This proposal restores that capability without giving up the structured roundtable for non-trivial work.
