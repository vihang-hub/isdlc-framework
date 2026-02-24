# Error Taxonomy: Cross-Validation Verifier (M4)

**Feature**: REQ-0015
**Phase**: 04-Design
**Version**: 1.0
**Created**: 2026-02-15

---

## 1. M4 Verification Finding Types

These are the finding types that M4 produces when cross-validating M1/M2/M3 outputs.

### 1.1 File List Category

| Finding Type | Severity | Trigger Condition | Description | AC Reference |
|-------------|----------|-------------------|-------------|-------------|
| MISSING_FROM_BLAST_RADIUS | WARNING | File in M2 entry points but not in M1 affected files | M2 found a relevant file that M1's blast radius analysis missed | AC-02.1 |
| ORPHAN_IMPACT | INFO | File in M1 blast radius but not reachable from any M2 entry point | M1 flagged a file that M2 cannot trace to any entry point -- may be stale or indirect | AC-02.2 |

### 1.2 Risk Scoring Category

| Finding Type | Severity | Trigger Condition | Description | AC Reference |
|-------------|----------|-------------------|-------------|-------------|
| RISK_SCORING_GAP | WARNING | High coupling (M1) + non-high risk (M3), or high blast radius + low risk | M3's risk assessment does not account for coupling or scope identified by M1 | AC-03.1, AC-03.3 |
| UNDERTESTED_CRITICAL_PATH | CRITICAL | Deep call chain (>=4 layers, M2) passing through file with <50% coverage (M3) | A deep implementation path has insufficient test coverage -- highest risk for regressions | AC-03.2 |

### 1.3 Completeness Category

| Finding Type | Severity | Trigger Condition | Description | AC Reference |
|-------------|----------|-------------------|-------------|-------------|
| INCOMPLETE_ANALYSIS | WARNING | M2 entry point has no M1 affected file, or M1 module has no M3 risk assessment | Gap in cross-references between agents -- some analysis paths are incomplete | AC-04.1, AC-04.2, AC-04.3 |

---

## 2. Severity Definitions

| Severity | Meaning | Examples | Report Impact | Workflow Impact |
|----------|---------|---------|---------------|-----------------|
| CRITICAL | Untested critical path detected; high regression risk | Deep call chain through untested code | Surfaces in executive summary | None (fail-open, NFR-02) |
| WARNING | Inconsistency between agents; may indicate analysis gap | File list mismatch, risk scoring gap, incomplete coverage | Listed in findings section | None |
| INFO | Informational observation; low confidence of actual problem | Orphan impact files (stale references) | Listed in findings section | None |

### 2.1 Severity Assignment Rules

1. CRITICAL is reserved for findings that combine two risk factors: structural complexity (deep chains) AND lack of safety net (low test coverage)
2. WARNING is the default for any inconsistency between two agents
3. INFO is used when only one agent reports something unusual, with no corroborating data from another agent
4. Severity is fixed per finding type (not configurable) -- see table in Section 1

---

## 3. Verification Status

| Status | Condition | Meaning |
|--------|-----------|---------|
| PASS | No CRITICAL and no WARNING findings | All agents are consistent |
| WARN | WARNING findings exist, no CRITICAL | Minor inconsistencies detected |
| FAIL | At least one CRITICAL finding | Significant risk detected |

Note: FAIL does NOT block the workflow (NFR-02 fail-open). It surfaces the finding for human awareness.

---

## 4. Orchestrator Error Tiers (ADR-0003)

These are not M4 finding types -- they are orchestrator-level error handling for M4 itself.

| Tier | Error Condition | Detection Point | User-Visible Message | State Impact | Report Impact |
|------|----------------|----------------|---------------------|--------------|---------------|
| 1 | Agent file not found | Before Task call | (none -- silent) | No M4 entry in sub_agents | No Cross-Validation section |
| 2 | Task call fails (timeout, crash) | After Task call | "WARNING: Cross-validation verification incomplete. Proceeding without verification." | M4 status: "skipped" | Note: "Cross-validation was not performed due to verifier error" |
| 3 | Response cannot be parsed | After Task call | "WARNING: Cross-validation verification incomplete. Proceeding without verification." | M4 status: "skipped" | Note: "Cross-validation was not performed due to verifier error" |

### 4.1 Tier Detection Logic

```
Tier 1 check:
  IF cross-validation-verifier agent is not available for Task delegation
  THEN skip Step 3.5 entirely (no warning, no state entry)

Tier 2 check:
  IF Task call to M4 throws an error or times out
  THEN log warning, set m4_status = "skipped", proceed to Step 4

Tier 3 check:
  IF M4 response does not contain "verification_report" key
  OR verification_report.verification_status is not in [PASS, WARN, FAIL]
  THEN treat as Tier 2 (log warning, skip, proceed)
```

---

## 5. Internal M4 Error Handling

When M4 encounters errors during cross-validation, it handles them internally and returns a valid response:

| Error | Handling | Finding Generated |
|-------|---------|-------------------|
| M1 response has status != "success" | Skip M1-dependent checks | CV-NNN: WARNING, "M1 data unavailable" |
| M2 response has status != "success" | Skip M2-dependent checks | CV-NNN: WARNING, "M2 data unavailable" |
| M3 response has status != "success" | Skip M3-dependent checks | CV-NNN: WARNING, "M3 data unavailable" |
| M1 impact_summary missing field | Skip check using that field | Note in finding description |
| M2 entry_points missing field | Skip check using that field | Note in finding description |
| M3 risk_assessment missing field | Skip check using that field | Note in finding description |
| No findings generated | Return PASS status | Empty findings array |

M4 always returns `status: "success"` -- it never returns an error status. All internal errors are converted to findings or notes.
