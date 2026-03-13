# Requirements Summary: Roundtable Memory Layer

**Accepted**: 2026-03-13

## Problem Statement

The roundtable analysis conversation resets to zero knowledge every session. Developers re-establish preferences, re-answer questions, and receive default depth on every topic regardless of history. The memory layer adds persistent recall of user preferences (cross-project) and project-specific topic history, so each session starts from learned behavior.

## Users

- **Developer (primary)**: Uses roundtable regularly, has consistent topic depth preferences, expects the tool to learn and adapt
- **Team members**: Benefit from shared project-level topic history
- **Framework maintainers**: Extend dispatch/roundtable flow with clean integration point

## Functional Requirements

| FR | Title | Priority | Confidence |
|---|---|---|---|
| FR-001 | User Memory Storage | Must Have | High |
| FR-002 | Project Memory Storage | Must Have | High |
| FR-003 | Dispatch Injection | Must Have | High |
| FR-004 | Memory-Aware Depth Sensing | Must Have | High |
| FR-005 | Memory Conflict Resolution | Must Have | High |
| FR-006 | Session Record Write-Back | Must Have | High |
| FR-007 | User-Triggered Compaction | Must Have | High |
| FR-008 | Graceful Degradation | Must Have | High |
| FR-009 | Performance Warning | Should Have | Medium |
| FR-010 | Weight Decay and Feedback | Should Have | Medium |

## Key Design Choices

- Memory preferences are **weighted signals**, not rules -- the roundtable can override based on context
- **Brief acknowledgment** at topic transitions -- user always knows when memory influences depth
- **Conflict resolution**: user and project memory disagreements surfaced to user; user decides
- **User-triggered compaction** via `isdlc memory compact` -- no automatic background processing
- **All topics equal** -- no topic receives special handling
- **No automatic semantic search** at startup -- deferred as future extension

## Out of Scope

Automatic semantic search, user-id segmentation, automatic compaction, cloud sync, session memory (already in REQ-0046)

## Assumptions and Inferences

- **Performance**: 1-second read threshold inferred from draft; accepted implicitly
- **Weight decay**: Decay formula inferred from weighted signals concept; user confirmed concept but not algorithm
