# ADR-0025: Staleness Detection Approach

## Status

Accepted

## Context

When the codebase has changed since analysis was performed (`meta.json.codebase_hash` differs from current `git rev-parse --short HEAD`), the build verb should warn the user. The requirements spec decided to use short hash comparison (DEC-002).

Two design questions arose:
1. Should the comparison logic include the git shell commands, or should it be a pure function?
2. Should staleness detection be tightly coupled with analysis status, or independent?

## Decision

Implement staleness detection as a pure comparison function (`checkStaleness`) in `three-verb-utils.cjs`, with git command execution done inline in the build verb handler.

### Pure Function Design

`checkStaleness(meta, currentHash)` takes two arguments:
- `meta`: The parsed meta.json object
- `currentHash`: The current git short hash (obtained by the caller)

It returns `{ stale, originalHash, currentHash, commitsBehind }` where `commitsBehind` is initially null and populated by the caller after running `git rev-list --count`.

### Independence from Analysis Status

Staleness is checked independently of analysis status. Both fully-analyzed and partially-analyzed items can be stale. The staleness menu is presented **before** the analysis-status menu when both conditions apply, because staleness resolution may change the user's analysis-status choice.

## Rationale

1. **Pure function testability**: `checkStaleness()` can be tested without git. The git commands are the caller's responsibility.
2. **Short hash comparison (DEC-002)**: meta.json already stores 7-character short hashes. Full hashes would require a breaking schema change (prohibited by CON-002).
3. **Graceful degradation (NFR-004)**: If git is unavailable or commands fail, staleness detection is skipped entirely. The build proceeds with existing analysis.
4. **Commit count enrichment**: `git rev-list --count {old}..HEAD` provides useful context ("15 commits since analysis") at negligible performance cost (NFR-002).

## Graceful Degradation Table

| Failure | Behavior |
|---------|----------|
| meta.json missing | No staleness check (no hash to compare) |
| `codebase_hash` field absent | Skip staleness, populate hash for future use |
| `git rev-parse` fails | Skip staleness, log warning |
| `git rev-list --count` fails | Show staleness warning without commit count |

## Consequences

**Positive:**
- Clean separation of pure logic and shell commands.
- Testable without mocking git.
- Graceful degradation in all failure modes.

**Negative:**
- Short hash has a theoretical collision risk (~1 in 268 million for 7-char hex). Acceptable for the use case.

## Traces

- FR-004 (Staleness Detection)
- AC-004-01 through AC-004-07
- NFR-002 (Git Hash Performance)
- NFR-004 (Graceful Degradation)
- CON-002 (No Breaking Meta.json Changes)
