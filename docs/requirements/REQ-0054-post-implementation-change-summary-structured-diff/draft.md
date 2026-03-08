# Post-implementation change summary — structured diff report after phase 06

**Source**: GitHub Issue #103
**Labels**: hackability

## Context

Part of the [Hackability & Extensibility Roadmap](../docs/isdlc/hackability-roadmap.md) — **Tier 2, Built-in** (Section 4.3.4).

## Problem

After the implementation phase, developers have no structured summary of what changed and why. They see individual file edits but lack a holistic view: which requirements each change addresses, what new files were created and their purpose, and overall test results. This gap also blocks downstream tooling — user-space hooks (#101) can't generate Jira updates or Slack notifications without a machine-readable change summary.

## Design

After implementation phase (06) completes, automatically generate a structured summary:

- **Modified files** with 1-2 line rationale per file
- **New files** with purpose description
- **Requirement tracing** — which FR/AC each change addresses
- **Test results summary** — pass/fail counts, coverage delta

Output format: `docs/requirements/{artifact_folder}/change-summary.md` (human-readable) + `.isdlc/change-summary.json` (machine-readable, consumable by hooks).

## Invisible UX

Fully automatic — generated at the end of phase 06 without any user request. Displayed as a brief summary to the user. Machine-readable version available for user-space hooks.

## Dependencies

- None (standalone), but enables user-space hooks (#101) to consume structured change data

## Effort

Low-Medium
