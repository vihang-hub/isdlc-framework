# Requirements Summary: REQ-0042

## Problem Statement

REQ-0041 implemented a complete search abstraction layer (8 modules, full test coverage) but none of these modules are wired into the framework's runtime. The setup pipeline does not detect or install search tools, no agents reference the search abstraction, and MCP server configuration is not triggered. This requirement bridges that gap.

## User Types

- **P1**: New iSDLC user running `isdlc init` (receives search recommendations during setup)
- **P2**: Existing iSDLC user upgrading or running `/discover` (future follow-on)
- **P3**: Framework contributor creating new agents (follows migration pattern)

## Functional Requirements

| FR | Title | Priority | Confidence |
|----|-------|----------|------------|
| FR-001 | Setup Pipeline Integration | Must Have | High |
| FR-002 | CLI Flag Support (--no-search-setup) | Must Have | High |
| FR-003 | Quick-Scan Agent Migration | Should Have | High |
| FR-004 | Impact Analysis Sub-Agent Migration (M1-M3) | Should Have | Medium |
| FR-005 | Discovery Analyzer Migration | Could Have | Medium |
| FR-006 | Installer Step Count Update | Must Have | High |
| FR-007 | Help Text and Documentation | Should Have | High |

## Key Acceptance Criteria

- **AC-001-01**: Installer step 8 calls `detectSearchCapabilities()` (Must Have)
- **AC-001-07**: Failures never block installer completion (Must Have)
- **AC-002-03**: `--no-search-setup` skips step 8 entirely (Must Have)
- **AC-003-01**: Quick-scan agent includes Enhanced Search section (Should Have)
- **AC-003-04**: Existing Grep/Glob instructions preserved as fallback (Should Have)

## Confidence Levels

- **High**: FR-001, FR-002, FR-003, FR-006, FR-007 -- directly stated in GH-95 and REQ-0041 architecture
- **Medium**: FR-004, FR-005 -- inferred from codebase analysis of high-impact agent patterns
