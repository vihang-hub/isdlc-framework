# UI/UX Wireframes -- REQ-0011: Adaptive Workflow Sizing

**Version**: 1.0.0
**Phase**: 04-design
**Traces to**: FR-03 (AC-08, AC-09, AC-10, AC-11), FR-04 (AC-12, AC-13)

---

## 1. Context

The iSDLC framework operates as a CLI tool within Claude Code. All "UI" is terminal text output. There are no graphical screens -- "wireframes" are text-based terminal banners, menus, and output formats.

Existing conventions observed in isdlc.md:
- Box drawing: `+--+` style borders for banners
- Unicode box drawing: `\u2554\u2550\u2557` style for interactive menus (SCENARIO 1-4)
- Indentation: 2-space for nested content
- Menu format: `[X] Label -- description` with `Enter selection:` prompt
- Banner width: 58 characters (matching existing BLOCKER banner)

This design uses the `+--+` style for informational banners (sizing recommendations, confirmations) and the `[X]` format for interactive menus, matching the existing Phase-Loop Controller patterns.

---

## 2. Wireframe W-01: Sizing Recommendation Banner (Light)

**Trigger**: STEP 3e-sizing, standard flow, recommendation is light
**Traces to**: AC-08

```
+----------------------------------------------------------+
|  WORKFLOW SIZING RECOMMENDATION                           |
|                                                           |
|  Recommended: LIGHT                                       |
|  Rationale: Low scope (3 files, low risk).                |
|             Architecture and Design phases can be skipped. |
|                                                           |
|  Impact Analysis Summary:                                 |
|    Files affected:  3                                     |
|    Modules:         1                                     |
|    Risk level:      low                                   |
|    Coupling:        low                                   |
|    Coverage gaps:   0                                     |
|                                                           |
|  If accepted, workflow becomes:                           |
|    00 -> 01 -> 02 -> 05 -> 06 -> 16 -> 08               |
|    (skipping Phase 03: Architecture, Phase 04: Design)    |
+----------------------------------------------------------+
```

**Template variables:**
- `{intensity}`: "LIGHT" | "STANDARD" | "EPIC"
- `{rationale}`: From `computeSizingRecommendation().rationale`
- `{file_count}`, `{module_count}`, `{risk_score}`, `{coupling}`, `{coverage_gaps}`: From metrics
- `{workflow_display}`: Phase flow with arrows (varies by intensity)
- `{skipped_note}`: Only shown for light intensity

---

## 3. Wireframe W-02: Sizing Recommendation Banner (Standard)

**Trigger**: STEP 3e-sizing, standard flow, recommendation is standard
**Traces to**: AC-08

```
+----------------------------------------------------------+
|  WORKFLOW SIZING RECOMMENDATION                           |
|                                                           |
|  Recommended: STANDARD                                    |
|  Rationale: Medium scope (12 files, medium risk).         |
|             Full workflow recommended.                     |
|                                                           |
|  Impact Analysis Summary:                                 |
|    Files affected:  12                                    |
|    Modules:         4                                     |
|    Risk level:      medium                                |
|    Coupling:        medium                                |
|    Coverage gaps:   1                                     |
|                                                           |
|  Workflow unchanged:                                      |
|    00 -> 01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 16 -> 08  |
+----------------------------------------------------------+
```

---

## 4. Wireframe W-03: Sizing Recommendation Banner (Epic)

**Trigger**: STEP 3e-sizing, standard flow, recommendation is epic
**Traces to**: AC-08

```
+----------------------------------------------------------+
|  WORKFLOW SIZING RECOMMENDATION                           |
|                                                           |
|  Recommended: EPIC                                        |
|  Rationale: Large scope (35 files, high risk).            |
|             Epic decomposition recommended.                |
|                                                           |
|  Impact Analysis Summary:                                 |
|    Files affected:  35                                    |
|    Modules:         8                                     |
|    Risk level:      high                                  |
|    Coupling:        high                                  |
|    Coverage gaps:   5                                     |
|                                                           |
|  NOTE: Epic execution is not yet implemented.             |
|  If accepted, workflow proceeds with STANDARD intensity.  |
|  The epic recommendation is recorded for future use.      |
+----------------------------------------------------------+
```

---

## 5. Wireframe W-04: Sizing Menu (Accept/Override/Show)

**Trigger**: Immediately after recommendation banner
**Traces to**: AC-09

```
Select an option:

[A] Accept recommendation ({INTENSITY})
[O] Override -- choose a different intensity
[S] Show full impact analysis

Enter selection:
```

**Interaction**: The Phase-Loop Controller uses `AskUserQuestion` (Claude Code's built-in user prompt mechanism) to present this menu and capture the response.

**Response handling:**
- User types "A" or "a" -> Accept
- User types "O" or "o" -> Override (show sub-menu W-05)
- User types "S" or "s" -> Show analysis (display content, return to this menu)

---

## 6. Wireframe W-05: Override Intensity Picker

**Trigger**: User selects [O] from W-04
**Traces to**: AC-10

```
Choose workflow intensity:

[1] Light    -- Skip Architecture and Design (for small changes)
[2] Standard -- Full 9-phase workflow (default)
[3] Epic     -- Large scope (proceeds as Standard -- epic not yet implemented)

Enter selection (1-3):
```

**Response handling:**
- User types "1" -> Apply light
- User types "2" -> Apply standard
- User types "3" -> Apply epic (with deferral note)

---

## 7. Wireframe W-06: Full Impact Analysis Display

**Trigger**: User selects [S] from W-04
**Traces to**: AC-09 (Show full analysis)

```
+----------------------------------------------------------+
|  FULL IMPACT ANALYSIS                                     |
+----------------------------------------------------------+

{full content of impact-analysis.md}

+----------------------------------------------------------+
|  END OF IMPACT ANALYSIS                                   |
+----------------------------------------------------------+
```

After display, the menu (W-04) is re-presented.

---

## 8. Wireframe W-07: Applied Sizing Confirmation (Light)

**Trigger**: After applySizingDecision completes for light intensity
**Traces to**: AC-11, AC-15

```
+----------------------------------------------------------+
|  SIZING APPLIED: LIGHT                                    |
|                                                           |
|  Phases removed:                                          |
|    - Phase 03: Architecture                               |
|    - Phase 04: Design                                     |
|                                                           |
|  Next phase: 05 - Test Strategy                           |
|  Remaining phases: 5                                      |
+----------------------------------------------------------+
```

---

## 9. Wireframe W-08: Applied Sizing Confirmation (Standard/Epic)

**Trigger**: After applySizingDecision completes for standard or epic
**Traces to**: AC-11

```
+----------------------------------------------------------+
|  SIZING APPLIED: STANDARD                                 |
|                                                           |
|  Full workflow retained.                                   |
|  Next phase: 03 - Architecture                            |
|  Remaining phases: 6                                      |
+----------------------------------------------------------+
```

For epic (deferred):

```
+----------------------------------------------------------+
|  SIZING APPLIED: EPIC (proceeding as Standard)            |
|                                                           |
|  Epic decomposition is not yet implemented.               |
|  Full workflow retained. Recommendation recorded.          |
|  Next phase: 03 - Architecture                            |
|  Remaining phases: 6                                      |
+----------------------------------------------------------+
```

---

## 10. Wireframe W-09: Forced Light Banner (-light flag)

**Trigger**: STEP 3e-sizing with `flags.light === true`
**Traces to**: AC-12, AC-13

```
+----------------------------------------------------------+
|  WORKFLOW SIZING: Light (forced via -light flag)          |
|                                                           |
|  Skipping phases:                                         |
|    - Phase 03: Architecture                               |
|    - Phase 04: Design                                     |
|                                                           |
|  Workflow: 00 -> 01 -> 02 -> 05 -> 06 -> 16 -> 08       |
+----------------------------------------------------------+
```

No menu is presented -- the `-light` flag bypasses the recommendation UX entirely.

---

## 11. Wireframe W-10: Sizing Skipped (No Config)

**Trigger**: STEP 3e-sizing when `feature.sizing` is missing or `sizing.enabled === false`

No banner displayed. Sizing is silently skipped with a default standard record written to state. The user sees no change in behavior -- the workflow proceeds as it does today.

---

## 12. Wireframe W-11: Parsing Failure Warning

**Trigger**: parseSizingFromImpactAnalysis returns null

```
+----------------------------------------------------------+
|  WORKFLOW SIZING: Standard (default)                      |
|                                                           |
|  Unable to parse impact analysis metrics.                 |
|  Proceeding with full standard workflow.                  |
+----------------------------------------------------------+
```

---

## 13. Wireframe W-12: Override Confirmation

**Trigger**: User overrides recommendation via [O] menu

```
+----------------------------------------------------------+
|  SIZING OVERRIDDEN                                        |
|                                                           |
|  Framework recommended: LIGHT                             |
|  Your choice: STANDARD                                    |
|                                                           |
|  Proceeding with STANDARD workflow.                       |
+----------------------------------------------------------+
```

---

## 14. Terminal Task List Update (After Light Sizing)

**Before sizing (user sees):**

```
  [1] Quick scan codebase (Phase 00)           [completed]
  [2] Capture requirements (Phase 01)          [completed]
  [3] Analyze impact (Phase 02)                [completed]
  [4] Design architecture (Phase 03)           [pending]
  [5] Create design specifications (Phase 04)  [pending]
  [6] Design test strategy (Phase 05)          [pending]
  [7] Implement features (Phase 06)            [pending]
  [8] Run parallel quality loop (Phase 16)     [pending]
  [9] Perform code review (Phase 08)           [pending]
```

**After light sizing applied:**

```
  ~~[1] Quick scan codebase (Phase 00)~~                                    [completed]
  ~~[2] Capture requirements (Phase 01)~~                                   [completed]
  ~~[3] Analyze impact (Phase 02)~~                                         [completed]
  ~~[4] Design architecture (Phase 03) (Skipped -- light workflow)~~        [completed]
  ~~[5] Create design specifications (Phase 04) (Skipped -- light workflow)~~  [completed]
  [6] Design test strategy (Phase 05)                                       [in_progress]
  [7] Implement features (Phase 06)                                         [pending]
  [8] Run parallel quality loop (Phase 16)                                  [pending]
  [9] Perform code review (Phase 08)                                        [pending]
```

The skipped tasks are marked completed with strikethrough and a "(Skipped -- light workflow)" note, matching the existing Phase-Loop Controller convention of marking completed tasks with `~~`.

---

## 15. Accessibility

All output is plain text with ASCII box drawing characters. No color codes, no Unicode characters beyond standard ASCII. This ensures compatibility with:
- Screen readers (plain text is fully accessible)
- Terminal emulators with limited charset support
- CI/CD log output (no ANSI escape sequences)
- Copy/paste to issue trackers and documentation
