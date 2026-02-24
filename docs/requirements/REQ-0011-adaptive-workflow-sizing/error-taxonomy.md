# Error Taxonomy -- REQ-0011: Adaptive Workflow Sizing

**Version**: 1.0.0
**Phase**: 04-design
**Traces to**: NFR-04, Article III (Security by Design), Article X (Fail-Safe Defaults)

---

## 1. Error Classification

All sizing errors are classified into three categories based on severity and action required.

| Category | Description | Action | User Visible |
|----------|-------------|--------|-------------|
| **WARNING** | Non-critical degradation. Sizing proceeds with defaults. | Log to stderr, continue | Sometimes (banner) |
| **FALLBACK** | Critical path failure. Sizing falls back to standard. | Log to stderr, apply standard | Yes (W-11 banner) |
| **ABORT** | State corruption risk. No sizing applied. | Log to stderr, skip sizing | No (silent) |

---

## 2. Error Codes

### 2.1 Parsing Errors (SZ-1xx)

| Code | Name | Category | Description | Trigger | Action |
|------|------|----------|-------------|---------|--------|
| SZ-100 | IA_FILE_NOT_FOUND | FALLBACK | impact-analysis.md not found at expected path | File read fails in STEP 3e-sizing S3.a | Default to standard, display W-11 |
| SZ-101 | IA_FILE_EMPTY | FALLBACK | impact-analysis.md exists but is empty (0 bytes) | parseSizingFromImpactAnalysis receives empty string | Default to standard, display W-11 |
| SZ-102 | JSON_BLOCK_NOT_FOUND | WARNING | No fenced JSON code block in IA file | Primary parsing finds no ```json blocks | Proceed to fallback regex parsing |
| SZ-103 | JSON_PARSE_FAILED | WARNING | JSON.parse threw an error on metadata block | Malformed JSON content | Proceed to fallback regex parsing |
| SZ-104 | FALLBACK_PARSE_FAILED | FALLBACK | Both JSON and regex fallback parsing failed | No structured data found in IA content | Return null, caller defaults to standard |
| SZ-105 | INVALID_FILE_COUNT | WARNING | files_directly_affected is not a valid non-negative integer | Validation in _validateAndNormalizeSizingMetrics | Default to 0 |
| SZ-106 | INVALID_MODULE_COUNT | WARNING | modules_affected is not a valid non-negative integer | Validation in _validateAndNormalizeSizingMetrics | Default to 0 |
| SZ-107 | INVALID_RISK_SCORE | WARNING | risk_level is not one of low/medium/high | Validation in _validateAndNormalizeSizingMetrics | Default to "medium" |
| SZ-108 | INVALID_COUPLING | WARNING | blast_radius is not one of low/medium/high | Validation in _validateAndNormalizeSizingMetrics | Default to "medium" |
| SZ-109 | INVALID_COVERAGE_GAPS | WARNING | coverage_gaps is not a valid non-negative integer | Validation in _validateAndNormalizeSizingMetrics | Default to 0 |

### 2.2 Configuration Errors (SZ-2xx)

| Code | Name | Category | Description | Trigger | Action |
|------|------|----------|-------------|---------|--------|
| SZ-200 | SIZING_CONFIG_MISSING | FALLBACK | workflows.json has no feature.sizing block | STEP 3e-sizing S1 reads undefined | Skip sizing entirely, write default standard record |
| SZ-201 | SIZING_DISABLED | FALLBACK | feature.sizing.enabled is false | STEP 3e-sizing S1 reads false | Skip sizing, write default standard record |
| SZ-202 | INVALID_LIGHT_MAX | WARNING | thresholds.light_max_files is not a positive integer | Validation in computeSizingRecommendation | Default to 5 |
| SZ-203 | INVALID_EPIC_MIN | WARNING | thresholds.epic_min_files is not a valid integer >= 2 | Validation in computeSizingRecommendation | Default to 20 |
| SZ-204 | THRESHOLD_ORDER_VIOLATION | WARNING | light_max_files >= epic_min_files | Validation in computeSizingRecommendation | Reset both to defaults (5, 20) |
| SZ-205 | SKIP_PHASES_NOT_ARRAY | WARNING | light_skip_phases is not an array | Validation in applySizingDecision | Default to ["03-architecture", "04-design"] |
| SZ-206 | SKIP_PHASE_NOT_IN_WORKFLOW | WARNING | A phase in light_skip_phases is not in active_workflow.phases | Phase removal in applySizingDecision | Skip that entry (filter is a no-op for non-existent entries) |

### 2.3 State Mutation Errors (SZ-3xx)

| Code | Name | Category | Description | Trigger | Action |
|------|------|----------|-------------|---------|--------|
| SZ-300 | NO_ACTIVE_WORKFLOW | ABORT | state.active_workflow is null or undefined | Guard in applySizingDecision | Return state unchanged, log to stderr |
| SZ-301 | INVARIANT_MIN_PHASES | FALLBACK | After mutation, phases.length < 3 | _checkSizingInvariants INV-01 | Rollback all changes, apply standard |
| SZ-302 | INVARIANT_INDEX_BOUNDS | FALLBACK | After mutation, current_phase_index >= phases.length | _checkSizingInvariants INV-02 | Rollback all changes, apply standard |
| SZ-303 | INVARIANT_ORPHAN_STATUS | FALLBACK | phase_status has a key not in phases array | _checkSizingInvariants INV-03 | Rollback all changes, apply standard |
| SZ-304 | INVARIANT_NEXT_NOT_PENDING | FALLBACK | phases[current_phase_index] status is not "pending" | _checkSizingInvariants INV-04 | Rollback all changes, apply standard |
| SZ-305 | INVALID_INTENSITY | WARNING | intensity parameter is not one of light/standard/epic | Guard in applySizingDecision | Default to "standard", log warning |
| SZ-306 | DOUBLE_SIZING_PREVENTED | ABORT | active_workflow.sizing already exists | Guard in STEP 3e-sizing trigger check | Skip sizing entirely |

### 2.4 UX Interaction Errors (SZ-4xx)

| Code | Name | Category | Description | Trigger | Action |
|------|------|----------|-------------|---------|--------|
| SZ-400 | USER_CANCEL | FALLBACK | User cancels sizing menu (Ctrl+C or empty input) | AskUserQuestion returns empty | Default to standard, proceed |
| SZ-401 | INVALID_MENU_CHOICE | WARNING | User enters unrecognized option in sizing menu | AskUserQuestion returns non-A/O/S | Re-present menu |
| SZ-402 | INVALID_OVERRIDE_CHOICE | WARNING | User enters unrecognized option in override picker | AskUserQuestion returns non-1/2/3 | Re-present override picker |

---

## 3. Error Logging Format

All sizing errors are logged to stderr following the existing hook pattern:

```
[sizing] {CODE}: {message}
```

Examples:
```
[sizing] SZ-100: impact-analysis.md not found at docs/requirements/REQ-0011-adaptive-workflow-sizing/impact-analysis.md
[sizing] SZ-103: JSON.parse failed on metadata block: Unexpected token } in JSON
[sizing] SZ-301: Invariant INV-01 failed: phases.length=2 < 3. Rolling back to standard.
[sizing] SZ-305: Invalid intensity "fast", defaulting to standard.
```

The `[sizing]` prefix distinguishes sizing errors from other hook output in stderr logs.

---

## 4. Fail-Safe Cascade

Every error path converges on the same fail-safe: standard intensity with no phase modification. This cascade is guaranteed by design.

```
                    Any Error
                       |
                       v
              +------------------+
              | Standard Fallback |
              +------------------+
              | intensity = standard
              | effective_intensity = standard
              | No phase modification
              | All 9 feature phases retained
              | Sizing record written (for audit)
              | Workflow proceeds as current behavior
              +------------------+
```

This means the worst-case outcome of any sizing failure is that the workflow behaves identically to the current (pre-REQ-0011) behavior. No data loss, no state corruption, no blocked workflow.

---

## 5. Error-to-Banner Mapping

| Error Code(s) | Banner Displayed | Description |
|---------------|------------------|-------------|
| SZ-100, SZ-101, SZ-104 | W-11 (Parsing Failure) | "Unable to parse impact analysis metrics" |
| SZ-200, SZ-201 | None | Silent fallback -- no UX impact |
| SZ-301 through SZ-304 | W-11 (modified) | "Sizing invariant check failed. Defaulting to standard." |
| SZ-305 | None | Silent correction -- user never sees invalid intensity |
| SZ-306 | None | Silent skip -- sizing already decided |
| SZ-400 | W-08 (Standard confirmation) | "Sizing defaulted to standard" |

---

## 6. Traceability

| Error Code Range | Requirement | Article |
|-----------------|-------------|---------|
| SZ-1xx (Parsing) | FR-01 (AC-01), NFR-04 | Article III (input validation), Article X (fail-safe) |
| SZ-2xx (Config) | FR-02 (AC-07), NFR-02 | Article X (fail-safe), Article IV (explicit) |
| SZ-3xx (State) | FR-05 (AC-15-18), NFR-04 | Article IX (gate integrity), Article X (fail-safe) |
| SZ-4xx (UX) | FR-03 (AC-09-10) | Article X (fail-safe) |
