# Wireframe: Phase 02 Progress Display with M4

**Feature**: REQ-0015
**Type**: CLI output (terminal text)
**Created**: 2026-02-15

This feature has no GUI. The "UI" is the terminal output displayed during Phase 02 execution. This wireframe specifies the exact text output at each stage.

---

## Wireframe 1: During M1/M2/M3 Parallel Execution

```
================================================================
  PHASE 02: IMPACT ANALYSIS - {feature name}
================================================================

Based on finalized requirements from Phase 01.
Scope change from original: {none|expanded|reduced|refined}

IMPACT ANALYSIS                                     [In Progress]
|- * Impact Analyzer (M1)                              (running)
|- * Entry Point Finder (M2)                           (running)
|- * Risk Assessor (M3)                                (running)
'- o Cross-Validation Verifier (M4)                    (pending)
```

---

## Wireframe 2: During M4 Execution

```
IMPACT ANALYSIS                                     [In Progress]
|- + Impact Analyzer (M1)                              (complete)
|- + Entry Point Finder (M2)                           (complete)
|- + Risk Assessor (M3)                                (complete)
'- * Cross-Validation Verifier (M4)                    (running)
```

---

## Wireframe 3: Summary (M4 Success with Findings)

```
================================================================
  IMPACT ANALYSIS COMPLETE
================================================================

Based on finalized requirements (Phase 01)
Scope Change: {type}

Blast Radius: {from M1} ({N} files, {N} modules)
Risk Level: {from M3}
Cross-Validation: {WARN|FAIL} ({N} findings, {N}% complete)

Key Findings:
* Entry point: {from M2}
* High-risk area: {from M3}
* Cross-validation: {CV finding description}

Impact analysis saved to:
  docs/requirements/{artifact-folder}/impact-analysis.md

Proceeding to Phase 03: Architecture...
================================================================
```

---

## Wireframe 4: Summary (M4 Success, Clean Pass)

```
================================================================
  IMPACT ANALYSIS COMPLETE
================================================================

Based on finalized requirements (Phase 01)
Scope Change: {type}

Blast Radius: {from M1} ({N} files, {N} modules)
Risk Level: {from M3}
Cross-Validation: PASS (0 findings, 100% complete)

Key Findings:
* Entry point: {from M2}
* High-risk area: {from M3}

Impact analysis saved to:
  docs/requirements/{artifact-folder}/impact-analysis.md

Proceeding to Phase 03: Architecture...
================================================================
```

---

## Wireframe 5: Summary (M4 Skipped)

```
================================================================
  IMPACT ANALYSIS COMPLETE
================================================================

Based on finalized requirements (Phase 01)
Scope Change: {type}

Blast Radius: {from M1} ({N} files, {N} modules)
Risk Level: {from M3}
Cross-Validation: (not performed)

WARNING: Cross-validation verification incomplete. Proceeding
without verification.

Key Findings:
* Entry point: {from M2}
* High-risk area: {from M3}

Impact analysis saved to:
  docs/requirements/{artifact-folder}/impact-analysis.md

Proceeding to Phase 03: Architecture...
================================================================
```

---

## Wireframe 6: Summary (M4 Not Found -- Backward Compatible)

Identical to pre-REQ-0015 output. No "Cross-Validation" line appears.
The user sees no indication that M4 was expected or missing.

```
================================================================
  IMPACT ANALYSIS COMPLETE
================================================================

Based on finalized requirements (Phase 01)
Scope Change: {type}

Blast Radius: {from M1} ({N} files, {N} modules)
Risk Level: {from M3}

Key Findings:
* Entry point: {from M2}
* High-risk area: {from M3}

Impact analysis saved to:
  docs/requirements/{artifact-folder}/impact-analysis.md

Proceeding to Phase 03: Architecture...
================================================================
```
