# Requirements Summary: REQ-0062 Developer Usage Analytics

**Accepted**: 2026-03-12

## Problem

iSDLC has no product analytics. The framework author cannot see how external developers use the framework, and individual developers have no visibility into their own usage patterns. Framework improvements are driven by intuition rather than data.

## Users

- **Framework Author**: Understands adoption patterns, identifies friction points, prioritizes improvements from real usage data
- **Developer User**: Reviews personal stats via `/isdlc stats`, controls telemetry consent, audits what data is shared

## Requirements (10 FRs)

| FR | Title | Priority | Confidence |
|----|-------|----------|------------|
| FR-001 | Event Collection Pipeline | Must Have | High |
| FR-002 | Compaction Detection | Should Have | Medium |
| FR-003 | Local Event Store | Must Have | High |
| FR-004 | Telemetry Transmission | Must Have | High |
| FR-005 | Collector Endpoint | Must Have | Medium |
| FR-006 | Consent and Opt-In | Must Have | High |
| FR-007 | Stats Command | Must Have | High |
| FR-008 | Telemetry Preview | Should Have | High |
| FR-009 | Anonymization Transform | Must Have | High |
| FR-010 | Configurable Retention | Should Have | High |

## Key Privacy Guarantee

Transmitted telemetry contains no slugs, file paths, project names, branch names, or user identifiers. Anonymization is allowlist-based (new fields excluded by default). Auditable via `/isdlc telemetry preview`.

## Out of Scope

Team-level aggregation, real-time dashboard, A/B testing, custom event definitions, backfilling historical data.
