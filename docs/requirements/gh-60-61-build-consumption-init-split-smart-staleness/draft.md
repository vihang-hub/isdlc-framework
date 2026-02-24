# Feature B: Build Consumption — Init Split + Smart Staleness

**Source**: GitHub #60 + #61
**Type**: Feature (combined)
**Created**: 2026-02-20

---

## GH-60: Split build STEP 1: separate workflow init from first phase execution

### Problem

`/isdlc build` STEP 1 uses `MODE: init-and-phase-01` which bundles two distinct concerns:

1. **Workflow initialization** — create `active_workflow` in state.json, create feature branch, assign REQ-NNNN ID
2. **Run Phase 01** — execute the first phase of the workflow

Now that the three-verb model (`add`/`analyze`/`build`) exists, `analyze` can complete phases 00-04 before `build` is ever invoked. The build auto-detection (steps 4a-4e) correctly computes `START_PHASE` (e.g. `05-test-strategy` for fully analyzed items), but the orchestrator mode name and structure still assume Phase 01 runs during init.

### Proposed Change

Split into two clean steps:

| Step | What | Who |
|------|------|-----|
| **INIT** | Create workflow, branch, state.json setup only | orchestrator (one-shot, no phase execution) |
| **Phase loop** | Execute phases from `START_PHASE` onward | Phase-Loop Controller (direct delegation) |

This means:
- A new orchestrator mode: `MODE: init-only` (no phase execution)
- The Phase-Loop Controller handles ALL phase execution uniformly — Phase 01 if analysis wasn't done, or Phase 05+ if it was
- `MODE: init-and-phase-01` becomes deprecated / removed

---

## GH-61: Smart staleness check: only warn when intervening commits overlap blast radius

### Problem

The build handler's staleness check (step 4b) compares `meta.codebase_hash` against current `HEAD`. If they differ, it presents a staleness warning menu requiring the user to choose Proceed/Re-run/Re-analyze.

In a parallel development workflow (2 laptops, analyze on one while building on the other), there will **always** be commits between analyze and build. The staleness warning fires every single time, and the user always picks [P] Proceed — making it pure noise.

### Proposed Change

Replace the naive hash comparison with a **blast-radius-aware staleness check**:

```
changedFiles = git diff --name-only {meta.codebase_hash}..HEAD
blastRadius = files from impact-analysis.md
overlap = intersection(changedFiles, blastRadius)

if overlap.length === 0:
    // silently proceed — no staleness, analysis still valid
elif overlap.length <= threshold:
    // informational warning with specific overlapping files, default to proceed
else:
    // strong warning, suggest re-analysis of affected areas
```

### Behavior

| Overlap | Action |
|---------|--------|
| 0 files | Silent proceed — no menu, no noise |
| 1-3 files | Informational: "N files in blast radius were modified. Proceeding." (no menu, just a note) |
| 4+ files | Warning menu as today, but showing which specific files overlap |

---

## Grouping

**Feature B: Build Consumption** — Both improve the build handler's consumption of pre-analyzed items.

- #60: Init-only mode (no forced Phase 01)
- #61: Smart staleness check (blast radius overlap, not naive hash)

**Feature A** (#57 + #59) handles the analyze-side decisions that Feature B consumes.

**Build order**: Feature A first, then Feature B.

## Related

- #57 (sizing in analyze — Feature A)
- #59 (complexity routing — Feature A)
